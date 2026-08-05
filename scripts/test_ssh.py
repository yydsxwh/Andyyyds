import os
import paramiko

key = paramiko.Ed25519Key.from_private_key_file(os.path.expanduser(r"~\.ssh\yyds_aliyun"))
for user in ["root", "ubuntu", "admin"]:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(
            "47.242.157.181",
            username=user,
            pkey=key,
            look_for_keys=False,
            allow_agent=False,
            timeout=20,
        )
        _, o, _ = c.exec_command("whoami; echo HOME=$HOME; ls -la ~/.ssh || true")
        print("OK user=", user)
        print(o.read().decode())
        c.close()
        break
    except Exception as e:
        print("FAIL", user, type(e).__name__, e)
