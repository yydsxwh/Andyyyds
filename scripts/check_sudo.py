import os
import paramiko

key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "47.242.157.181",
    username="admin",
    pkey=key,
    look_for_keys=False,
    allow_agent=False,
    timeout=20,
)
cmds = [
    "sudo -n true && echo SUDO_NOPASS=yes || echo SUDO_NOPASS=no",
    "id",
    "sudo -n whoami || true",
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd)
    print("CMD", cmd)
    print(o.read().decode())
    print(e.read().decode())
c.close()
