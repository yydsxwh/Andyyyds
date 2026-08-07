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


def connect(retries=10):
    key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
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
            wait = min(60, 15 * (i + 1))
            print(f"ssh connect retry {i+1}/{retries}: {e}; sleep {wait}s", flush=True)
            time.sleep(wait)
    raise last


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
    # 本地上传备份：先拷到 staging，成功后再替换正式备份。
    # 旧逻辑「先 rm 备份再 cp」会在 public/uploads 缺失时把唯一备份也删掉。
    run(
        c,
        f"rm -rf {REMOTE_DIR}/.deploy_backup/uploads_staging && "
        f"if [ -d {REMOTE_DIR}/public/uploads ]; then "
        f"cp -a {REMOTE_DIR}/public/uploads {REMOTE_DIR}/.deploy_backup/uploads_staging && "
        f"rm -rf {REMOTE_DIR}/.deploy_backup/uploads && "
        f"mv {REMOTE_DIR}/.deploy_backup/uploads_staging {REMOTE_DIR}/.deploy_backup/uploads; "
        f"fi",
    )
    # 保留 public/uploads，只清其它 public 子项，避免部署再次抹掉本地视频
    run(c, f"rm -rf {REMOTE_DIR}/src {REMOTE_DIR}/prisma {REMOTE_DIR}/scripts")
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

    # Ensure public site url for notify callback
    run(
        c,
        f"grep -q '^NEXT_PUBLIC_SITE_URL=' {REMOTE_DIR}/.env || "
        f"echo 'NEXT_PUBLIC_SITE_URL=https://www.yydsxwh.com' >> {REMOTE_DIR}/.env",
    )

    # 1.6G 小机无 swap 时 prisma/next build 易被 OOM 杀掉；部署前确保有 2G swap
    run(
        c,
        "if ! swapon --show | grep -q .; then "
        "sudo fallocate -l 2G /swapfile 2>/dev/null || "
        "sudo dd if=/dev/zero of=/swapfile bs=1M count=2048; "
        "sudo chmod 600 /swapfile; sudo mkswap /swapfile; sudo swapon /swapfile; "
        "fi; "
        "grep -q '/swapfile' /etc/fstab || "
        "echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null; "
        "free -h",
    )
    # 清掉半截 node_modules；npm ci 与 postinstall prisma generate 并发时易 ENOENT，
    # 故先 ignore-scripts 装完依赖，再单独 generate。
    run(c, f"cd {REMOTE_DIR} && rm -rf node_modules")
    run(
        c,
        f"cd {REMOTE_DIR} && "
        f"PRISMA_SKIP_POSTINSTALL_GENERATE=1 npm ci --include=dev --ignore-scripts",
    )
    run(
        c,
        f"cd {REMOTE_DIR} && node -e \"require.resolve('@tailwindcss/postcss')\"",
    )
    run(c, f"cd {REMOTE_DIR} && npx prisma generate")
    run(c, f"cd {REMOTE_DIR} && npx prisma db push")
    run(c, f"cd {REMOTE_DIR} && node scripts/ensure_distribution.js || true")
    run(c, f"cd {REMOTE_DIR} && node scripts/ensure_merchants.js || true")
    # 构建前先挪走旧 .next：失败可回滚，避免「删掉构建产物后 build 失败 → 全站打不开」
    run(
        c,
        f"cd {REMOTE_DIR} && rm -rf .next_prev && "
        f"(test -d .next && mv .next .next_prev || true)",
    )
    try:
        run(c, f"cd {REMOTE_DIR} && npm run build")
    except Exception:
        run(
            c,
            f"cd {REMOTE_DIR} && rm -rf .next && "
            f"(test -d .next_prev && mv .next_prev .next || true)",
        )
        raise
    run(c, f"cd {REMOTE_DIR} && rm -rf .next_prev")
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
