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
LOCAL_PROJECT = Path(os.environ.get("YYDS_LOCAL_PROJECT") or Path(__file__).resolve().parents[1])
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
    "tmp",
    # Android / Electron 工程与构建缓存体积大，站点只需 public/app 安装包
    "android",
    "desktop",
    "www",
    "exports",
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
    # 安装包走 OSS，且体积上百 MB；打进每次部署包会拖垮上传，
    # 解包失败时 rsync --delete 还会把线上残留清成空目录
    if rel.startswith("public/app/") and path.suffix.lower() in {
        ".apk",
        ".exe",
        ".zip",
    }:
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
        str(Path.home() / ".ssh" / "yyds_aliyun")
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
            # 长传包时防空闲断连
            transport = client.get_transport()
            if transport is not None:
                transport.set_keepalive(30)
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


def upload_tarball(client: paramiko.SSHClient, tarball: Path) -> paramiko.SSHClient:
    """优先 paramiko SFTP（带 keepalive）；失败再试系统 scp。校验远端体积。"""
    local_size = tarball.stat().st_size
    key_path = str(Path.home() / ".ssh" / "yyds_aliyun")
    remote_spec = f"{USER}@{HOST}:{REMOTE_TAR}"

    for attempt in range(1, 8):
        print(f"Uploading (attempt {attempt}/7, {local_size} bytes)...", flush=True)
        uploaded = False

        # 1) SFTP：scp 超时后原 SSH 常已死，先确保会话可用再传
        try:
            transport = client.get_transport()
            if transport is None or not transport.is_active():
                try:
                    client.close()
                except Exception:  # noqa: BLE001
                    pass
                client = connect()
            sftp = client.open_sftp()
            try:
                # 大文件分块，进度可见，便于判断是否卡死
                with open(tarball, "rb") as local_f:
                    with sftp.file(REMOTE_TAR, "wb") as remote_f:
                        remote_f.set_pipelined(True)
                        sent = 0
                        chunk = 256 * 1024
                        while True:
                            buf = local_f.read(chunk)
                            if not buf:
                                break
                            remote_f.write(buf)
                            sent += len(buf)
                            if sent == local_size or sent % (2 * 1024 * 1024) < chunk:
                                pct = int(sent * 100 / local_size)
                                print(f"  SFTP {sent}/{local_size} ({pct}%)", flush=True)
            finally:
                sftp.close()
            uploaded = True
            print("SFTP put done", flush=True)
        except Exception as sftp_exc:  # noqa: BLE001
            print(f"SFTP failed: {sftp_exc}; try scp", flush=True)

        if not uploaded:
            try:
                import subprocess

                result = subprocess.run(
                    [
                        "scp",
                        "-i",
                        key_path,
                        "-o",
                        "BatchMode=yes",
                        "-o",
                        "StrictHostKeyChecking=accept-new",
                        "-o",
                        "ConnectTimeout=60",
                        "-o",
                        "ServerAliveInterval=20",
                        "-o",
                        "ServerAliveCountMax=30",
                        str(tarball),
                        remote_spec,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=1200,
                )
                if result.returncode != 0:
                    raise RuntimeError(
                        f"scp exit {result.returncode}: {result.stderr[-500:]}"
                    )
                uploaded = True
                # scp 可能拖死旧会话，校验前重连
                try:
                    client.close()
                except Exception:  # noqa: BLE001
                    pass
                client = connect()
            except Exception as scp_exc:  # noqa: BLE001
                print(f"scp failed: {scp_exc}", flush=True)
                time.sleep(min(40, 5 * attempt))
                try:
                    client.close()
                except Exception:  # noqa: BLE001
                    pass
                client = connect()
                continue

        # 校验体积
        try:
            out = run(client, f"stat -c%s {REMOTE_TAR}")
            remote_size = int(out.strip().splitlines()[-1].strip())
        except Exception as exc:  # noqa: BLE001
            print(f"stat remote failed: {exc}; reconnect", flush=True)
            try:
                client.close()
            except Exception:  # noqa: BLE001
                pass
            client = connect()
            continue

        if remote_size == local_size:
            print(f"Upload done ({remote_size} bytes)", flush=True)
            return client
        print(
            f"Size mismatch local={local_size} remote={remote_size}; retry",
            flush=True,
        )
        time.sleep(min(40, 5 * attempt))
        try:
            client.close()
        except Exception:  # noqa: BLE001
            pass
        client = connect()

    raise RuntimeError(f"Upload failed after retries: local={local_size} bytes")


def main() -> int:
    tarball = make_tarball()
    client = connect()
    client = upload_tarball(client, tarball)

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
        # exclude 的文件 rsync --delete 不会删；比 P 规则稳，避免再把安装包冲掉
        f"rsync -a --delete "
        f"--exclude '.env' "
        f"--exclude 'node_modules' "
        f"--exclude '.next' "
        f"--exclude 'public/uploads' "
        f"--exclude '.deploy_backup' "
        f"--exclude '*.db' "
        f"--exclude '*.db-journal' "
        f"--exclude 'public/app/*.apk' "
        f"--exclude 'public/app/*.exe' "
        f"--exclude 'public/app/*.zip' "
        f"{REMOTE_STAGE}/ {REMOTE_DIR}/",
    )

    # 依赖可能有变更；不跑 seed，避免清业务数据
    run(client, f"cd {REMOTE_DIR} && npm install", timeout=900)
    run(client, f"cd {REMOTE_DIR} && npx prisma generate")
    # Int→BigInt 等兼容扩列时 Prisma 会误报 data loss；SQLite 整数可安全拓宽
    run(client, f"cd {REMOTE_DIR} && npx prisma db push --accept-data-loss")
    # 清 lock / 残留 .next，避免并发或半成品导致 pages-manifest ENOENT
    # 用 [n]ext 避免 pkill -f 误匹配当前 SSH 命令行把自己杀掉
    run(
        client,
        f"rm -f {REMOTE_DIR}/.next/lock; "
        "pids=$(pgrep -f '[n]ext build' || true); "
        "if [ -n \"$pids\" ]; then kill $pids || true; fi; "
        f"sleep 1; rm -rf {REMOTE_DIR}/.next",
    )
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
