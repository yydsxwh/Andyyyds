import os
import sys
import tarfile
import tempfile
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
    tmp = os.path.join(tempfile.gettempdir(), "yyds-wechat-pay-deploy.tar.gz")
    with tarfile.open(tmp, "w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL):
            dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
            for f in files:
                fp = os.path.join(root, f)
                if should_exclude(fp):
                    continue
                tar.add(fp, arcname=os.path.relpath(fp, LOCAL).replace("\\", "/"))
    return tmp


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
    c.connect(HOST, username=USER, pkey=key, look_for_keys=False, allow_agent=False, timeout=30)
    return c


def run(c, cmd, timeout=1200):
    print(f"$ {cmd}", flush=True)
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:], flush=True)
    if err.strip():
        print(err[-4000:], flush=True)
    if code != 0:
        raise RuntimeError(f"fail {code}: {cmd}")
    return out


def main():
    tarball = pack()
    print("packed", tarball, os.path.getsize(tarball))
    c = connect()
    sftp = c.open_sftp()
    remote_tar = "/tmp/yyds-wechat-pay-deploy.tar.gz"
    sftp.put(tarball, remote_tar)
    sftp.close()

    run(c, f"mkdir -p {REMOTE_DIR}/.deploy_backup {REMOTE_DIR}/certs")
    run(c, f"cp -f {REMOTE_DIR}/.env {REMOTE_DIR}/.deploy_backup/.env || true")
    run(c, f"cp -f {REMOTE_DIR}/prisma/prod.db {REMOTE_DIR}/.deploy_backup/prod.db || true")
    run(c, f"rm -rf {REMOTE_DIR}/src {REMOTE_DIR}/prisma {REMOTE_DIR}/public {REMOTE_DIR}/scripts")
    run(
        c,
        f"cd {REMOTE_DIR} && tar -xzf {remote_tar} "
        f"&& cp -f .deploy_backup/.env .env || true",
    )
    run(
        c,
        f"test -f {REMOTE_DIR}/.deploy_backup/prod.db && "
        f"cp -f {REMOTE_DIR}/.deploy_backup/prod.db {REMOTE_DIR}/prisma/prod.db || true",
    )

    # Ensure public site url for notify callback
    run(
        c,
        f"grep -q '^NEXT_PUBLIC_SITE_URL=' {REMOTE_DIR}/.env || "
        f"echo 'NEXT_PUBLIC_SITE_URL=https://www.yydsxwh.com' >> {REMOTE_DIR}/.env",
    )

    run(c, f"cd {REMOTE_DIR} && npm ci")
    run(c, f"cd {REMOTE_DIR} && npx prisma generate")
    run(c, f"cd {REMOTE_DIR} && npx prisma db push")
    run(c, f"cd {REMOTE_DIR} && node scripts/ensure_distribution.js || true")
    run(c, f"cd {REMOTE_DIR} && node scripts/ensure_merchants.js || true")
    run(c, f"cd {REMOTE_DIR} && npm run build")
    run(c, "pm2 restart yyds-course --update-env || pm2 start npm --name yyds-course -- start -- -p 3000")
    run(c, "pm2 save")
    run(
        c,
        "sleep 3; "
        "curl -s -o /dev/null -w 'home:%{http_code}\\n' http://127.0.0.1:3000/; "
        "curl -s -o /dev/null -w 'settings:%{http_code}\\n' http://127.0.0.1:3000/studio/settings; "
        "curl -s -o /dev/null -w 'notify_post:%{http_code}\\n' -X POST http://127.0.0.1:3000/api/payments/wechat/notify -H 'content-type: application/json' -d '{}'; "
        "curl -s -o /dev/null -w 'public:%{http_code}\\n' https://www.yydsxwh.com/",
    )
    print("DEPLOY_OK", flush=True)
    print("NOTE: Configure WECHAT_* in .env and upload apiclient_key.pem to enable real pay.", flush=True)
    c.close()


if __name__ == "__main__":
    main()
