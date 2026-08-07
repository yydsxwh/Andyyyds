"""
安全增量部署：保留远端 .env 与 prod.db，更新代码后 prisma db push + build + pm2 restart。
用于微信/手机号登录上线，不重跑 seed、不轮换 AUTH_SECRET。
"""
import os
import sys
import tarfile
import tempfile
import time

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "47.242.157.181"
USER = "admin"
REMOTE_DIR = "/var/www/yyds-course-platform"
LOCAL = r"E:\source\repos\yyds-course-platform"

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "uploads",
    "public/uploads",
    "agent-transcripts",
    "assets",
    "certs",
}
EXCLUDE_FILES = {".env", "dev.db", "dev.db-journal", "prod.db"}


def should_exclude(path):
    rel = os.path.relpath(path, LOCAL).replace("\\", "/")
    parts = rel.split("/")
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    name = os.path.basename(path)
    if name in EXCLUDE_FILES:
        return True
    if name.endswith(".db") or name.endswith(".db-journal"):
        return True
    return False


def pack():
    tmp = os.path.join(tempfile.gettempdir(), "yyds-auth-deploy.tar.gz")
    with tarfile.open(tmp, "w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL):
            dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
            for f in files:
                fp = os.path.join(root, f)
                if should_exclude(fp):
                    continue
                tar.add(fp, arcname=os.path.relpath(fp, LOCAL).replace("\\", "/"))
    return tmp


def connect(retries=8):
    key = paramiko.Ed25519Key.from_private_key_file(
        os.path.expanduser(r"~\.ssh\yyds_aliyun")
    )
    last = None
    for i in range(retries):
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            c.connect(
                HOST,
                username=USER,
                pkey=key,
                look_for_keys=False,
                allow_agent=False,
                timeout=60,
                banner_timeout=90,
                auth_timeout=60,
            )
            return c
        except Exception as e:
            last = e
            wait = min(45, 10 * (i + 1))
            print(f"ssh retry {i+1}/{retries}: {e}; sleep {wait}s", flush=True)
            time.sleep(wait)
    raise last


def run(c, cmd, timeout=1200):
    print(f"$ {cmd}", flush=True)
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-5000:], flush=True)
    if err.strip():
        print(err[-5000:], flush=True)
    if code != 0:
        raise RuntimeError(f"fail {code}: {cmd}")
    return out


def main():
    tarball = pack()
    print("packed", tarball, os.path.getsize(tarball), flush=True)
    c = connect()
    remote_tar = "/tmp/yyds-auth-deploy.tar.gz"
    sftp = c.open_sftp()
    sftp.put(tarball, remote_tar)
    sftp.close()

    run(c, f"mkdir -p {REMOTE_DIR}/.deploy_backup")
    run(c, f"cp -f {REMOTE_DIR}/.env {REMOTE_DIR}/.deploy_backup/.env || true")
    run(
        c,
        f"cp -f {REMOTE_DIR}/prisma/prod.db {REMOTE_DIR}/.deploy_backup/prod.db || true",
    )
    # 本地上传：staging 成功后再替换备份，且不清掉 public/uploads
    run(
        c,
        f"rm -rf {REMOTE_DIR}/.deploy_backup/uploads_staging && "
        f"if [ -d {REMOTE_DIR}/public/uploads ]; then "
        f"cp -a {REMOTE_DIR}/public/uploads {REMOTE_DIR}/.deploy_backup/uploads_staging && "
        f"rm -rf {REMOTE_DIR}/.deploy_backup/uploads && "
        f"mv {REMOTE_DIR}/.deploy_backup/uploads_staging {REMOTE_DIR}/.deploy_backup/uploads; "
        f"fi",
    )
    run(
        c,
        f"rm -rf {REMOTE_DIR}/src {REMOTE_DIR}/prisma "
        f"{REMOTE_DIR}/scripts {REMOTE_DIR}/package.json {REMOTE_DIR}/package-lock.json "
        f"{REMOTE_DIR}/next.config.ts {REMOTE_DIR}/next.config.js {REMOTE_DIR}/next.config.mjs "
        f"{REMOTE_DIR}/tsconfig.json {REMOTE_DIR}/postcss.config.mjs {REMOTE_DIR}/eslint.config.mjs "
        f"{REMOTE_DIR}/AGENTS.md {REMOTE_DIR}/CLAUDE.md || true",
    )
    run(
        c,
        f"if [ -d {REMOTE_DIR}/public ]; then "
        f"find {REMOTE_DIR}/public -mindepth 1 -maxdepth 1 ! -name uploads -exec rm -rf {{}} +; "
        f"else mkdir -p {REMOTE_DIR}/public; fi",
    )
    run(c, f"cd {REMOTE_DIR} && tar -xzf {remote_tar}")
    run(c, f"cp -f {REMOTE_DIR}/.deploy_backup/.env {REMOTE_DIR}/.env || true")
    run(
        c,
        f"test -f {REMOTE_DIR}/.deploy_backup/prod.db && "
        f"mkdir -p {REMOTE_DIR}/prisma && "
        f"cp -f {REMOTE_DIR}/.deploy_backup/prod.db {REMOTE_DIR}/prisma/prod.db || true",
    )
    run(
        c,
        f"if [ -d {REMOTE_DIR}/.deploy_backup/uploads ]; then "
        f"mkdir -p {REMOTE_DIR}/public && "
        f"rm -rf {REMOTE_DIR}/public/uploads && "
        f"cp -a {REMOTE_DIR}/.deploy_backup/uploads {REMOTE_DIR}/public/uploads; "
        f"fi",
    )

    run(c, f"cd {REMOTE_DIR} && npm ci --include=dev")
    run(c, f"rm -rf {REMOTE_DIR}/.next")
    # 必须用本地 prisma@5，避免 npx 拉到 Prisma 7 与 schema 不兼容
    run(c, f"cd {REMOTE_DIR} && ./node_modules/.bin/prisma generate")
    run(c, f"cd {REMOTE_DIR} && ./node_modules/.bin/prisma db push")
    run(c, f"cd {REMOTE_DIR} && npm run build")
    run(
        c,
        "pm2 restart yyds-course --update-env || "
        "pm2 start npm --name yyds-course -- start -- -p 3000",
    )
    run(c, "pm2 save")
    run(
        c,
        "sleep 3; "
        "curl -s -o /dev/null -w 'local:%{http_code}\\n' http://127.0.0.1:3000/login; "
        "curl -s http://127.0.0.1:3000/api/auth/methods; echo; "
        "curl -s -o /dev/null -w 'public:%{http_code}\\n' https://www.yydsxwh.com/login",
    )
    print("DEPLOY_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
