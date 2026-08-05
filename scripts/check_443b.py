import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
c.connect("47.242.157.181", username="admin", pkey=key, look_for_keys=False, allow_agent=False, timeout=30)
cmds = [
    "curl -vkI https://127.0.0.1/ 2>&1 | head -n 40",
    "curl -vkI https://47.242.157.181/ -H 'Host: www.yydsxwh.com' 2>&1 | head -n 50",
    "curl -vkI --resolve www.yydsxwh.com:443:127.0.0.1 https://www.yydsxwh.com/ 2>&1 | head -n 40",
    "sudo ss -lntup",
    "ip addr; ip route",
]
for cmd in cmds:
    print("===", cmd, flush=True)
    _, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", errors="replace"), flush=True)
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err, flush=True)
c.close()
