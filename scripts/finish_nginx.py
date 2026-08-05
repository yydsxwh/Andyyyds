import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "47.242.157.181"
DOMAIN = "www.yydsxwh.com"


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
    c.connect(HOST, username="admin", pkey=key, look_for_keys=False, allow_agent=False, timeout=30)
    return c


def run(c, cmd, timeout=120, check=True):
    print(f"$ {cmd}", flush=True)
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:], flush=True)
    if err.strip():
        print(err[-3000:], flush=True)
    if check and code != 0:
        raise RuntimeError(f"fail {code}: {cmd}")
    return out, code


def main():
    c = connect()
    run(
        c,
        "sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u admin --hp /home/admin",
        check=False,
    )
    run(c, "pm2 save", check=False)

    nginx_conf = f"""
server {{
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name {DOMAIN} yydsxwh.com {HOST} _;

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

    run(c, "sleep 2; pm2 status")
    run(c, "curl -s -o /dev/null -w 'app:%{http_code}\\n' http://127.0.0.1:3000/")
    run(c, "curl -s -o /dev/null -w 'nginx:%{http_code}\\n' http://127.0.0.1/")
    print("DEPLOY_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
