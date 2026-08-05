import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
c.connect("47.242.157.181", username="admin", pkey=key, look_for_keys=False, allow_agent=False, timeout=30)
cmds = [
    "sudo ss -lntp | grep -E ':80|:443' || true",
    "sudo lsof -iTCP:443 -sTCP:LISTEN || true",
    "sudo nginx -T 2>/dev/null | head -n 80",
    "ls -la /etc/nginx/sites-enabled/",
    "sudo iptables -t nat -L -n 2>/dev/null | head -n 40 || true",
    "systemctl list-units --type=service --state=running | head -n 40",
]
for cmd in cmds:
    print("===", cmd, flush=True)
    _, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", errors="replace"), flush=True)
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err, flush=True)
c.close()
