import os
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

HOST = "47.242.157.181"
USER = "admin"
LOCAL_PROJECT = Path(r"E:\source\repos\Andyyyds")
REMOTE_DIR = "/var/www/yyds-course-platform"
DOMAIN = "www.yydsxwh.com"
AUTH_SECRET = "yyds-prod-secret-change-me-" + str(int(time.time()))

EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    "uploads",
    "public/uploads",
    "agent-transcripts",
    "assets",
}
EXCLUDE_FILES = {".env", "dev.db", "dev.db-journal"}


def should_exclude(path: Path) -> bool:
    rel = path.relative_to(LOCAL_PROJECT).as_posix()
    parts = rel.split("/")
    if any(p in EXCLUDE_DIRS for p in parts):
        return True
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix in {".db", ".db-journal"}:
        return True
    return False


def make_tarball() -> Path:
    tmp = Path(tempfile.gettempdir()) / "yyds-course-platform-deploy.tar.gz"
    with tarfile.open(tmp, "w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL_PROJECT):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if not should_exclude(root_path / d)]
            for name in files:
                fp = root_path / name
                if should_exclude(fp):
                    continue
                tar.add(fp, arcname=fp.relative_to(LOCAL_PROJECT).as_posix())
    return tmp


def ssh_connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key_path = os.path.expanduser(r"~\.ssh\yyds_aliyun")
    pkey = paramiko.Ed25519Key.from_private_key_file(key_path)
    client.connect(
        HOST,
        username=USER,
        pkey=pkey,
        look_for_keys=False,
        allow_agent=False,
        timeout=30,
    )
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> str:
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:])
    if err.strip():
        print(err[-3000:])
    if code != 0:
        raise RuntimeError(f"Command failed ({code}): {cmd}\n{err}\n{out}")
    return out


def main():
    print("Packing project...")
    tarball = make_tarball()
    print(f"Package: {tarball} ({tarball.stat().st_size} bytes)")

    print("Connecting as admin...")
    client = ssh_connect()
    print("Connected.")

    run(client, "sudo DEBIAN_FRONTEND=noninteractive apt-get update -y")
    run(
        client,
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx curl ca-certificates gnupg",
    )

    # Node.js 22 if missing
    run(
        client,
        "command -v node >/dev/null && node -v || "
        "(curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && "
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs)",
    )
    run(client, "node -v && npm -v")
    run(client, "sudo npm install -g pm2")

    run(client, f"sudo mkdir -p {REMOTE_DIR} {REMOTE_DIR}/public/uploads")
    run(client, f"sudo chown -R {USER}:{USER} {REMOTE_DIR}")

    remote_tar = "/tmp/yyds-course-platform-deploy.tar.gz"
    print("Uploading package...")
    sftp = client.open_sftp()
    sftp.put(str(tarball), remote_tar)
    sftp.close()

    run(client, f"rm -rf {REMOTE_DIR}/* {REMOTE_DIR}/.[!.]* 2>/dev/null || true")
    run(client, f"tar -xzf {remote_tar} -C {REMOTE_DIR}")

    env_content = f"""AUTH_SECRET="{AUTH_SECRET}"
DATABASE_URL="file:./prod.db"
NODE_ENV="production"
NEXT_PUBLIC_SITE_URL="https://{DOMAIN}"
"""
    run(client, f"cat > {REMOTE_DIR}/.env <<'EOF'\n{env_content}EOF")

    run(client, f"cd {REMOTE_DIR} && npm ci")
    run(client, f"cd {REMOTE_DIR} && npx prisma generate")
    run(client, f"cd {REMOTE_DIR} && npx prisma db push")
    run(client, f"cd {REMOTE_DIR} && npx tsx prisma/seed.ts")
    run(client, f"cd {REMOTE_DIR} && npm run build")

    run(client, "pm2 delete yyds-course || true")
    run(
        client,
        f"cd {REMOTE_DIR} && pm2 start npm --name yyds-course -- start -- -p 3000",
    )
    run(client, "pm2 save")
    startup = run(client, "pm2 startup systemd -u admin --hp /home/admin")
    for line in startup.splitlines():
        if "sudo" in line and "env PATH" in line:
            run(client, line.strip())
            break

    nginx_conf = f"""
server {{
    listen 80;
    server_name {DOMAIN} yydsxwh.com {HOST};

    client_max_body_size 320m;

    location / {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }}
}}
"""
    run(
        client,
        "sudo tee /etc/nginx/sites-available/yyds-course > /dev/null <<'EOF'\n"
        f"{nginx_conf}EOF",
    )
    run(
        client,
        "sudo ln -sfn /etc/nginx/sites-available/yyds-course /etc/nginx/sites-enabled/yyds-course",
    )
    run(client, "sudo rm -f /etc/nginx/sites-enabled/default")
    run(client, "sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx")

    run(client, "pm2 status")
    run(client, "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000 || true")
    print("\nDEPLOY_OK")
    client.close()


if __name__ == "__main__":
    main()
