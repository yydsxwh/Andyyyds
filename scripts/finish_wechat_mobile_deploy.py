"""Complete deploy after source was uploaded but npm ci timed out.
Usage: python scripts/finish_wechat_mobile_deploy.py
"""
import os
import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "47.242.157.181"
REMOTE = "/var/www/yyds-course-platform"


def connect(retries=8):
    last = None
    for i in range(retries):
        try:
            c = paramiko.SSHClient()
            c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            key = paramiko.Ed25519Key.from_private_key_file(
                os.path.expanduser(r"~\.ssh\yyds_aliyun")
            )
            c.connect(
                HOST,
                username="admin",
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
            wait = 20 * (i + 1)
            print(f"SSH retry {i + 1}/{retries}: {e}; sleep {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"SSH failed: {last}")


def main():
    c = connect()

    def run(cmd, timeout=1200):
        print(f"$ {cmd}", flush=True)
        _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out.strip():
            print(out[-6000:], flush=True)
        if err.strip():
            print(err[-6000:], flush=True)
        print("exit", code, flush=True)
        if code != 0:
            raise RuntimeError(f"fail {code}: {cmd}")
        return out

    run(f"test -f {REMOTE}/src/lib/wechat-env.ts && echo HAS_CODE")
    run(f"cd {REMOTE} && npm install", timeout=900)
    run(f"cd {REMOTE} && npx prisma generate")
    run(f"cd {REMOTE} && npx prisma db push")
    run(f"cd {REMOTE} && npm run build", timeout=900)
    run(
        "pm2 restart yyds-course --update-env || "
        "pm2 start npm --name yyds-course -- start -- -p 3000"
    )
    run("pm2 save")
    run(
        "sleep 3; "
        "curl -s -o /dev/null -w 'home:%{http_code}\\n' http://127.0.0.1:3000/; "
        "curl -s -o /dev/null -w 'public:%{http_code}\\n' https://www.yydsxwh.com/"
    )
    print("DEPLOY_OK", flush=True)
    c.close()


if __name__ == "__main__":
    main()
