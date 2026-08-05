import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
c.connect("47.242.157.181", username="admin", pkey=key, look_for_keys=False, allow_agent=False, timeout=30)

cmds = [
    "pm2 status",
    "curl -s -o /dev/null -w 'local3000:%{http_code}\\n' http://127.0.0.1:3000/",
    "curl -s -o /dev/null -w 'local80:%{http_code}\\n' http://127.0.0.1/",
    "curl -s -o /dev/null -w 'hostwww:%{http_code}\\n' -H 'Host: www.yydsxwh.com' http://127.0.0.1/",
    "sudo nginx -t",
    "sudo tail -n 30 /var/log/nginx/error.log",
    "sudo tail -n 20 /var/log/nginx/access.log",
    "sudo cat /etc/nginx/sites-enabled/yyds-course",
]
for cmd in cmds:
    print("===", cmd, flush=True)
    _, o, e = c.exec_command(cmd, timeout=60)
    print(o.read().decode("utf-8", errors="replace"), flush=True)
    err = e.read().decode("utf-8", errors="replace")
    if err.strip():
        print(err, flush=True)
c.close()
