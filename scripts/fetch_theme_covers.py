"""
拉取高端商务 / 现代办公类背景图到 public/covers/biz-*.jpg
图源：Unsplash（网站可免费使用），统一约 1600px JPEG。
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "covers"
MANIFEST = ROOT / "scripts" / "theme_covers_manifest.json"

# (unsplash photo id, file stem, 中文名, veil: cool|warm|light|cyber)
CATALOG: list[tuple[str, str, str, str]] = [
    ("1497366216548-37526070297c", "biz-glass-office", "玻璃办公廊", "cool"),
    ("1497366811353-68707443dcb3", "biz-open-plan", "开放办公区", "light"),
    ("1497215728101-856f4ea42174", "biz-desk-plant", "绿植工位", "light"),
    ("1486312338219-ce68d2c6f44d", "biz-laptop-hands", "键入专注", "cool"),
    ("1519389950473-47ba0277781c", "biz-team-table", "长桌协作", "cool"),
    ("1522071820081-009f0129c71c", "biz-team-smile", "团队合影", "light"),
    ("1542744173-8e7e53415bb0", "biz-boardroom", "董事会议室", "cool"),
    ("1556761175-5973dc0f32e7", "biz-handshake", "商务握手", "light"),
    ("1553877522-43269d4ea984", "biz-startup", "创业冲刺", "cool"),
    ("1559136555-9303baea8ebd", "biz-macbook", "极简笔电", "cool"),
    ("1573164713988-8665fc963095", "biz-present", "商务演讲", "light"),
    ("1573496359142-b8d87734a5a2", "biz-pro-portrait", "职场肖像", "cool"),
    ("1581091226825-a6a2a5aee158", "biz-engineer", "工程现场", "cool"),
    ("1600880292203-757bb62b4baf", "biz-cowork-bright", "明亮联合办公", "light"),
    ("1600880292089-90a7e086ee0c", "biz-sofa-talk", "沙发会谈", "warm"),
    ("1449824913935-59a10b8d2000", "biz-skyline-day", "日间天际线", "cool"),
    ("1477959858617-67f85cf4f1df", "biz-city-aerial", "都市航拍", "cool"),
    ("1486406146926-c627a92ad1ab", "biz-glass-tower", "玻璃塔楼", "cool"),
    ("1514565131-fce0801e5785", "biz-street", "现代街区", "cool"),
    ("1519501025264-65ba15a82344", "biz-night-city", "都市夜景", "cyber"),
    ("1526481280693-3bfa7568e0f3", "biz-neon-alley", "霓虹巷道", "cyber"),
    ("1451188503012-e6954d942949", "biz-earth-data", "地球数据", "cyber"),
    ("1454165804606-c3d57bc86b40", "biz-charts", "图表案头", "cool"),
    ("1460925895917-afdab827c52f", "biz-dashboard", "数据仪表盘", "cool"),
    ("1504384308090-c894fdcc538d", "biz-code-dark", "暗色代码", "cyber"),
    ("1518770660439-4636190af475", "biz-circuit", "电路纹理", "cyber"),
    ("1526374965328-7f61d4dc18c5", "biz-matrix", "矩阵代码", "cyber"),
    ("1531297484001-80022131f5a1", "biz-laptop-dark", "暗调笔电", "cyber"),
    ("1550751827-4bd374c3f58b", "biz-gadgets", "科技装置", "cyber"),
    ("1558494949-ef010cbdcc31", "biz-servers", "机柜阵列", "cyber"),
    ("1517245386807-bb43f82c33c4", "biz-standup", "站会讨论", "light"),
    ("1515187029135-18ee286d815b", "biz-conference", "大型会场", "cool"),
    ("1521737711867-e3b97375f902", "biz-pair", "结对工作", "cool"),
    ("1531482615713-2afd69097998", "biz-sticky", "便签工坊", "cool"),
    ("1556761175-b413da4baf72", "biz-keynote", "领袖演讲", "cool"),
    ("1557804506-669a67965ba0", "biz-client", "客户会面", "light"),
    ("1497215842964-222b430dc094", "biz-keyboard", "键盘特写", "cool"),
    ("1523240795612-9a054b0db644", "biz-students", "青年成长", "light"),
    ("1522202176988-66273c2fd55f", "biz-collab", "协作研讨", "light"),
    ("1552664730-d307ca884978", "biz-training", "培训教室", "light"),
    ("1481627834876-b7833e8f5570", "biz-books", "书架光影", "warm"),
    ("1516321318423-f06f85e504b3", "biz-online-learn", "在线学习", "cool"),
    ("1524178232363-1fb2b075b655", "biz-lecture", "阶梯讲堂", "cool"),
    ("1571260899304-425eee4c7efc", "biz-learner", "学员笔电", "cool"),
    ("1580582932707-520aed937b7b", "biz-classroom", "现代教室", "light"),
    ("1677442136019-21780ecad995", "biz-ai-glow", "AI 光感", "cool"),
    ("1618005182384-a83a8bd57fbe", "biz-abstract-3d", "立体抽象", "cool"),
    ("1633356122544-f134324a6cee", "biz-ui-code", "界面代码", "cool"),
    ("1664575602276-fa8d74fc1a5e", "biz-datacenter", "数据中心", "cyber"),
    ("1551836022-d5d88e9218df", "biz-present-slide", "投影汇报", "cool"),
    ("1497366754034-897374bb5a0e", "biz-hall", "办公大厅", "light"),
    ("1507679799987-1e225ba3f0d0", "biz-city-blur", "都市光斑", "cool"),
    ("1516321497487-e849ec73a2be", "biz-mentor", "导师辅导", "warm"),
    ("1431540015161-0bf868a2d407", "biz-hotel-lobby", "商务大堂", "light"),
    ("1497366858526-0773d8d8f8f8", "biz-corridor", "办公走廊", "cool"),
    ("1467232004584-a241de8bcf5d", "biz-skyline-dusk", "黄昏天际", "cool"),
    ("1504384308090-c894fdcc538d", "biz-devdesk", "开发者桌面", "cyber"),
    ("1517245386807-bb43f82c33c4", "biz-agile", "敏捷讨论", "light"),
    ("1556761175-4b77a7d0b0b0", "biz-leader", "领袖风采", "cool"),
    ("1560179707-f14e90ef3628", "biz-corp-building", "企业大厦", "cool"),
    ("1560472354-b33ff0c44a43", "biz-handshake-desk", "桌前握手", "light"),
    ("1573167243879-0b0b0b0b0b0b", "biz-skip-bad", "跳过", "cool"),
    ("1573164713714-d95e436ab8d4", "biz-diversity", "多元团队", "light"),
    ("1581092918056-0c4c3acd3789", "biz-lab-auto", "智能产线", "cool"),
    ("1581093458791-9f3c3900df4b", "biz-rnd", "研发实验", "cool"),
    ("1596524430615-b3717eeb8b9e", "biz-notebook", "笔记规划", "warm"),
    ("1600508774634-4f0b0b0b0b0b", "biz-skip2", "跳过", "cool"),
    ("1611224923853-80b023f02d71", "biz-kanban", "看板规划", "cool"),
    ("1620712943543-bcc4688e7485", "biz-robot", "机器人臂", "cool"),
    ("1639322537504-6427a16b0a28", "biz-vr", "沉浸体验", "cyber"),
    ("1642543492481-44e81e3914a7", "biz-fintech", "金融科技", "cool"),
    ("1667372393119-3d4c4829a6e9", "biz-neural", "智能脉络", "cool"),
    ("1682687220742-abe2b9c2a0c3", "biz-skip3", "跳过", "cool"),
    ("1694906452590-0b0b0b0b0b0b", "biz-skip4", "跳过", "cool"),
    ("1704637796963-0b0b0b0b0b0b", "biz-skip5", "跳过", "cool"),
    ("1416339404031-0b0b0b0b0b0b", "biz-skip6", "跳过", "cool"),
    ("1423666635541-0b0b0b0b0b0b", "biz-skip7", "跳过", "cool"),
    ("1432888498266-38ffec3eaf0a", "biz-cafe-work", "咖啡馆办公", "warm"),
    ("1454165804606-c3d57bc86b40", "biz-planner", "商务企划", "cool"),
    ("1467232004584-a241de8bcf5d", "biz-dusk-city", "暮色都会", "cool"),
    ("1475724017909-0b0b0b0b0b0b", "biz-skip8", "跳过", "cool"),
    ("1486312338219-ce68d2c6f44d", "biz-typing", "敲击键盘", "cool"),
    ("1497215728101-856f4ea42174", "biz-sunlit-desk", "阳光桌面", "warm"),
    ("1507679799987-1e225a3a0b0b", "biz-skip9", "跳过", "cool"),
    ("1517245386807-bb43f82c33c4", "biz-workshop-meet", "工作坊会议", "light"),
    ("1524758634661-0b0b0b0b0b0b", "biz-skip10", "跳过", "cool"),
    ("1531973576160-7125cd663d86", "biz-loft", "工业风办公", "cool"),
    ("1542744173-8e7e53415bb0", "biz-strategy", "战略会议", "cool"),
    ("1551434678-e076c223a692", "biz-dev-team", "研发团队", "cool"),
    ("1552664730-d307ca884978", "biz-coach", "教练培训", "light"),
    ("1556761175-5973dc0f32e7", "biz-deal", "成交握手", "light"),
    ("1559136555-9303baea8ebd", "biz-minimal-mac", "极简苹果桌", "cool"),
    ("1560179707-f14e90ef3628", "biz-hq", "总部大厦", "cool"),
    ("1560472354-b33ff0c44a43", "biz-close-deal", "签约现场", "light"),
    ("1563986768609-322da13575f3", "biz-mobile", "移动办公", "cool"),
    ("1573164713988-8665fc963095", "biz-stage", "舞台演讲", "light"),
    ("1573497019940-1c28c88b4f3e", "biz-exec", "高管肖像", "cool"),
    ("1581091226825-a6a2a5aee158", "biz-industry40", "工业互联", "cool"),
    ("1588196749597-9ff033e7a7a7", "biz-remote", "远程协作", "cool"),
    ("1593642632823-8b969b7145ba", "biz-ultrawide", "超宽屏工位", "cool"),
    ("1600880292203-757bb62b4baf", "biz-bright-space", "通透空间", "light"),
    ("1611224923853-80b023f02d71", "biz-roadmap", "路线规划", "cool"),
    ("1618005182384-a83a8bd57fbe", "biz-fluid-3d", "流体立体", "cool"),
    ("1633356122102-3fe28e9f4a0c", "biz-skip11", "跳过", "cool"),
    ("1639322537504-6427a16b0a28", "biz-immersive", "沉浸科技", "cyber"),
    ("1664575602554-2726ca0e0c0c", "biz-skip12", "跳过", "cool"),
    ("1677442136019-21780ecad995", "biz-llm", "大模型意象", "cool"),
]


def clean_catalog() -> list[tuple[str, str, str, str]]:
    seen_file: set[str] = set()
    seen_photo: set[str] = set()
    out: list[tuple[str, str, str, str]] = []
    for photo_id, file_stem, name, veil in CATALOG:
        if name == "跳过" or "0b0b" in photo_id:
            continue
        if file_stem in seen_file or photo_id in seen_photo:
            continue
        seen_file.add(file_stem)
        seen_photo.add(photo_id)
        out.append((photo_id, file_stem, name, veil))
    return out


def download(photo_id: str, dest: Path) -> bool:
    url = (
        f"https://images.unsplash.com/photo-{photo_id}"
        f"?auto=format&fit=crop&w=1600&q=78"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; yyds-cover-fetcher/1.0)",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if len(data) < 12000:
            print(f"  SKIP tiny ({len(data)} B)")
            return False
        dest.write_bytes(data)
        return True
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}")
        return False
    except Exception as e:
        print(f"  ERR {e}")
        return False


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = clean_catalog()
    print(f"Unique catalog: {len(catalog)}")
    ok_rows: list[dict] = []
    for photo_id, file_stem, name, veil in catalog:
        dest = OUT_DIR / f"{file_stem}.jpg"
        if dest.exists() and dest.stat().st_size > 12000:
            print(f"EXISTS {file_stem}")
            ok_rows.append(
                {
                    "id": f"photo-{file_stem}",
                    "file": f"/covers/{file_stem}.jpg",
                    "name": name,
                    "veil": veil,
                }
            )
            continue
        print(f"GET {name} ({file_stem})")
        if download(photo_id, dest):
            print(f"  OK {dest.stat().st_size} B")
            ok_rows.append(
                {
                    "id": f"photo-{file_stem}",
                    "file": f"/covers/{file_stem}.jpg",
                    "name": name,
                    "veil": veil,
                }
            )
        elif dest.exists():
            dest.unlink(missing_ok=True)

    MANIFEST.write_text(
        json.dumps(ok_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nDone: {len(ok_rows)} images → {OUT_DIR}")
    print(f"Manifest → {MANIFEST}")
    return 0 if len(ok_rows) >= 35 else 1


if __name__ == "__main__":
    raise SystemExit(main())
