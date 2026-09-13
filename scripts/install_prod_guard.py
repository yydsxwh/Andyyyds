"""
给线上装「站点自愈」这套东西，可重复执行：

1. systemd 定时器每分钟跑一次 yyds-app-guard.sh，站点打不开就自动退回上一版构建并重启；
2. swap 扩到 4G，构建内存峰值有地方落，别再把整机拖到无响应。

发布脚本 deploy_safe_update.py 每次会自动调用本模块，一般不用手动跑。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REMOTE_DIR = "/var/www/yyds-course-platform"
GUARD_SCRIPT = f"{REMOTE_DIR}/scripts/ops/yyds-app-guard.sh"
GUARD_LOG = "/var/log/yyds-app-guard.log"
SWAP_FILE = "/swapfile-yyds"
SWAP_SIZE_MB = 4096

SERVICE_UNIT = f"""[Unit]
Description=YYDS site guard (auto-recover site when it stops responding)
After=network-online.target

[Service]
Type=oneshot
User=admin
Group=admin
Environment=HOME=/home/admin
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart={GUARD_SCRIPT}
# 兜底重建最慢要几分钟，超时必须放宽，否则守护会被 systemd 中途掐断
TimeoutStartSec=2400
"""

TIMER_UNIT = """[Unit]
Description=Run YYDS site guard every minute

[Timer]
OnBootSec=45s
OnUnitActiveSec=60s
AccuracySec=10s
Unit=yyds-app-guard.service

[Install]
WantedBy=timers.target
"""


def install(run) -> None:
    """用调用方给的 run(cmd) 执行远端命令，方便发布脚本直接复用同一条 SSH 连接。"""
    run(f"chmod +x {REMOTE_DIR}/scripts/ops/*.sh")
    run(
        f"sudo touch {GUARD_LOG} && sudo chown admin:admin {GUARD_LOG}",
    )
    run(
        "sudo tee /etc/systemd/system/yyds-app-guard.service > /dev/null <<'UNIT'\n"
        + SERVICE_UNIT
        + "UNIT"
    )
    run(
        "sudo tee /etc/systemd/system/yyds-app-guard.timer > /dev/null <<'UNIT'\n"
        + TIMER_UNIT
        + "UNIT"
    )
    run("sudo systemctl daemon-reload")
    run("sudo systemctl enable --now yyds-app-guard.timer")
    ensure_swap(run)


def ensure_swap(run) -> None:
    """内存不足时构建会把整机拖死，先保证有足够 swap 接住峰值。"""
    run(
        "set -e; "
        "total_mb=$(free -m | awk '/^Swap:/{print $2}'); "
        f"if [ \"$total_mb\" -ge {SWAP_SIZE_MB} ]; then echo \"swap ok: ${{total_mb}}M\"; exit 0; fi; "
        f"if [ ! -f {SWAP_FILE} ]; then "
        f"sudo fallocate -l {SWAP_SIZE_MB}M {SWAP_FILE} || "
        f"sudo dd if=/dev/zero of={SWAP_FILE} bs=1M count={SWAP_SIZE_MB}; "
        f"sudo chmod 600 {SWAP_FILE}; sudo mkswap {SWAP_FILE}; fi; "
        f"sudo swapon {SWAP_FILE} || true; "
        # 写进 fstab，重启后仍然有 swap
        f"grep -q '^{SWAP_FILE} ' /etc/fstab || "
        f"echo '{SWAP_FILE} none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null; "
        "free -m | awk '/^Swap:/{print \"swap now: \" $2 \"M\"}'"
    )


def main() -> int:
    # 单独手动执行时才需要自己建连接；发布流程走 install(run)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from deploy_safe_update import connect, run as run_on  # noqa: PLC0415

    client = connect()
    try:
        install(lambda cmd: run_on(client, cmd))
    finally:
        client.close()
    print("GUARD_INSTALLED", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
