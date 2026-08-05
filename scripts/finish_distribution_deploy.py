import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "47.242.157.181"
REMOTE = "/var/www/yyds-course-platform"
LOCAL = r"E:\source\repos\yyds-course-platform"


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
    rel = "src/lib/distribution.ts"
    sftp.put(os.path.join(LOCAL, *rel.split("/")), f"{REMOTE}/{rel}")
    sftp.close()
    run(c, f"cd {REMOTE} && npm run build")
    run(c, "pm2 restart yyds-course")
    run(c, "pm2 save")
    run(c, "sleep 2; curl -s -o /dev/null -w 'local:%{http_code}\\n' http://127.0.0.1:3000/studio/distribution")
    print("DEPLOY_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
