import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "47.242.157.181"
REMOTE_DIR = "/var/www/yyds-course-platform"
DOMAIN = "www.yydsxwh.com"


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
    c.connect(HOST, username="admin", pkey=key, look_for_keys=False, allow_agent=False, timeout=30)
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
    c = connect()
    sftp = c.open_sftp()
    local_base = r"E:\source\repos\yyds-course-platform"
    files = [
        "src/app/api/auth/login/route.ts",
        "src/app/api/auth/register/route.ts",
    ]
    for rel in files:
        local = os.path.join(local_base, *rel.split("/"))
        remote = f"{REMOTE_DIR}/{rel}"
        print("upload", rel, flush=True)
        sftp.put(local, remote)
    sftp.close()

    run(c, f"cd {REMOTE_DIR} && npm run build")
    run(c, "pm2 delete yyds-course || true")
    run(c, f"cd {REMOTE_DIR} && pm2 start npm --name yyds-course -- start -- -p 3000")
    run(c, "pm2 save")
    startup = run(c, "pm2 startup systemd -u admin --hp /home/admin")
    for line in startup.splitlines():
        if "sudo" in line and "env PATH" in line:
            run(c, line.strip())
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
    run(c, "sudo tee /etc/nginx/sites-available/yyds-course > /dev/null <<'EOF'\n" + nginx_conf + "EOF")
    run(c, "sudo ln -sfn /etc/nginx/sites-available/yyds-course /etc/nginx/sites-enabled/yyds-course")
    run(c, "sudo rm -f /etc/nginx/sites-enabled/default")
    run(c, "sudo nginx -t && sudo systemctl restart nginx && sudo systemctl enable nginx")
    run(c, "pm2 status")
    run(c, "curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/")
    run(c, "curl -s -o /dev/null -w '%{http_code}\\n' http://127.0.0.1/")
    print("DEPLOY_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
