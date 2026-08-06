"""
安全增量部署：同步本地代码到阿里云，构建并重启 pm2。
保留远端 .env / 数据库 / public/uploads / node_modules，不执行 seed。
"""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "47.242.157.181"
USER = "admin"
LOCAL_PROJECT = Path(r"E:\source\repos\yyds-course-platform")
REMOTE_DIR = "/var/www/yyds-course-platform"
REMOTE_TAR = "/tmp/yyds-safe-deploy.tar.gz"
REMOTE_STAGE = "/tmp/yyds-safe-deploy-stage"

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "uploads",
    "public/uploads",
    "agent-transcripts",
    "assets",
    ".cursor",
}
EXCLUDE_FILES = {".env", "dev.db", "dev.db-journal", "prod.db", "prod.db-journal"}


def should_exclude(path: Path) -> bool:
    rel = path.relative_to(LOCAL_PROJECT).as_posix()
    parts = rel.split("/")
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix in {".db", ".db-journal"}:
        return True
    # 本地临时诊断脚本不必上线
    if parts[0] == "scripts" and path.name.startswith("_"):
        return True
    return False


def make_tarball() -> Path:
    tmp = Path(tempfile.gettempdir()) / "yyds-safe-deploy.tar.gz"
    count = 0
    with tarfile.open(tmp, "w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL_PROJECT):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if not should_exclude(root_path / d)]
            for name in files:
                fp = root_path / name
                if should_exclude(fp):
                    continue
                tar.add(fp, arcname=fp.relative_to(LOCAL_PROJECT).as_posix())
                count += 1
    print(f"Packed {count} files -> {tmp} ({tmp.stat().st_size} bytes)", flush=True)
    return tmp


def connect(retries: int = 8) -> paramiko.SSHClient:
    last: Exception | None = None
    key = paramiko.Ed25519Key.from_private_key_file(
        os.path.expanduser(r"~\.ssh\yyds_aliyun")
    )
    for i in range(retries):
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                HOST,
                username=USER,
                pkey=key,
                look_for_keys=False,
                allow_agent=False,
                timeout=60,
                banner_timeout=90,
                auth_timeout=60,
            )
            print("SSH_OK", flush=True)
            return client
        except Exception as exc:  # noqa: BLE001
            last = exc
            wait = min(45, 10 * (i + 1))
            print(f"SSH retry {i + 1}/{retries}: {exc}; sleep {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"SSH failed: {last}")


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1200) -> str:
    print(f"$ {cmd}", flush=True)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-8000:], flush=True)
    if err.strip():
        print(err[-4000:], flush=True)
    if code != 0:
        raise RuntimeError(f"fail {code}: {cmd}\n{err[-2000:]}\n{out[-2000:]}")
    return out


def main() -> int:
    tarball = make_tarball()
    client = connect()

    print("Uploading...", flush=True)
    sftp = client.open_sftp()
    sftp.put(str(tarball), REMOTE_TAR)
    sftp.close()
    print("Upload done", flush=True)

    # 解到临时目录，再 rsync 覆盖代码；绝不碰 .env / db / uploads
    run(client, f"rm -rf {REMOTE_STAGE} && mkdir -p {REMOTE_STAGE}")
    run(client, f"tar -xzf {REMOTE_TAR} -C {REMOTE_STAGE}")
    run(
        client,
        "command -v rsync >/dev/null || "
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y rsync",
    )
    run(
        client,
        f"rsync -a --delete "
        f"--exclude '.env' "
        f"--exclude 'node_modules' "
        f"--exclude '.next' "
        f"--exclude 'public/uploads' "
        f"--exclude '*.db' "
        f"--exclude '*.db-journal' "
        f"{REMOTE_STAGE}/ {REMOTE_DIR}/",
    )

    # 依赖可能有变更；不跑 seed，避免清业务数据
    run(client, f"cd {REMOTE_DIR} && npm install", timeout=900)
    run(client, f"cd {REMOTE_DIR} && npx prisma generate")
    run(client, f"cd {REMOTE_DIR} && npx prisma db push")
    run(client, f"cd {REMOTE_DIR} && npm run build", timeout=1200)
    # 用 if/else，避免 || 与 && 连用导致 restart 成功后又多起一个进程
    run(
        client,
        "if pm2 describe yyds-course >/dev/null 2>&1; then "
        "pm2 restart yyds-course --update-env; "
        "else "
        f"cd {REMOTE_DIR} && pm2 start npm --name yyds-course -- start -- -p 3000; "
        "fi",
    )
    run(client, "pm2 save")
    run(client, "pm2 status")
    run(
        client,
        "sleep 4; "
        "curl -s -o /dev/null -w 'local:%{http_code}\\n' http://127.0.0.1:3000/; "
        "curl -s -o /dev/null -w 'site:%{http_code}\\n' -m 15 https://www.yydsxwh.com/; "
        f"grep -n '横屏全屏\\|learn-landscape-fs\\|learn-fs-enter' "
        f"{REMOTE_DIR}/src/components/learn-player.tsx "
        f"{REMOTE_DIR}/src/app/globals.css | head -20",
    )
    print("DEPLOY_OK", flush=True)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
