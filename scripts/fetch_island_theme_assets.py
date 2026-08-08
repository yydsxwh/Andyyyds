"""
拉取热带海岛 / 阳光沙滩装扮素材到 public/themes/islands/。

图源：Unsplash（https://unsplash.com/license）与 Pexels（https://www.pexels.com/license/）
均可免费商用。优先用已核对「画面符合标题地点」的直链；无 API key 也能下载。

用法：
  python scripts/fetch_island_theme_assets.py
  python scripts/fetch_island_theme_assets.py --force-themes   # 强制重下 20 套 cover/bg
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "themes" / "islands"
MANIFEST = ROOT / "scripts" / "island_theme_assets_manifest.json"
# 本地预览缓存：优先 jelly-candidates（人工核对池），其次旧 island-pexels
PREVIEW_CACHES = [
    ROOT / "tmp" / "jelly-candidates",
    ROOT / "tmp" / "island-pexels",
]

UA = "Mozilla/5.0 (compatible; yyds-island-theme-fetcher/1.1; +https://www.yydsxwh.com)"

# (source, photo_id, filename, 中文说明)
# source: unsplash | pexels
# 硬性标准：岛滩 + 晴天阳光 + 椰/棕榈 + 清澈果冻海；40 张 photoId 互不重复
THEME_FILES: list[tuple[str, str, str, str]] = [
    ("unsplash", "1573843981267-be1999ff37cd", "maldives-cover.jpg", "马尔代夫晴空·封面"),
    ("pexels", "8356061", "maldives-bg.jpg", "马尔代夫晴空·背景"),
    ("pexels", "4605323", "seychelles-cover.jpg", "塞舌尔碧湾·封面"),
    ("pexels", "8356060", "seychelles-bg.jpg", "塞舌尔碧湾·背景"),
    ("pexels", "1078983", "okinawa-cover.jpg", "冲绳椰风·封面"),
    ("pexels", "1078982", "okinawa-bg.jpg", "冲绳椰风·背景"),
    ("pexels", "7652322", "bali-cover.jpg", "巴厘岛暖沙·封面"),
    ("pexels", "29901898", "bali-bg.jpg", "巴厘岛暖沙·背景"),
    ("pexels", "994605", "hawaii-cover.jpg", "夏威夷金晖·封面"),
    ("unsplash", "1507525428034-b723cf961d3e", "hawaii-bg.jpg", "夏威夷金晖·背景"),
    ("pexels", "1450360", "phuket-cover.jpg", "普吉蓝梦·封面"),
    ("pexels", "28408490", "phuket-bg.jpg", "普吉蓝梦·背景"),
    ("pexels", "8356062", "fiji-cover.jpg", "斐济珊瑚礁·封面"),
    ("pexels", "8356063", "fiji-bg.jpg", "斐济珊瑚礁·背景"),
    ("unsplash", "1519046904884-53103b34b206", "tahiti-cover.jpg", "大溪地椰湾·封面"),
    ("pexels", "4784289", "tahiti-bg.jpg", "大溪地椰湾·背景"),
    ("pexels", "753626", "borabora-cover.jpg", "波拉波拉泻湖·封面"),
    ("pexels", "8356064", "borabora-bg.jpg", "波拉波拉泻湖·背景"),
    ("unsplash", "1506953823976-52e1fdc0149a", "sanya-cover.jpg", "三亚椰影·封面"),
    ("pexels", "1450353", "sanya-bg.jpg", "三亚椰影·背景"),
    ("pexels", "31743357", "mauritius-cover.jpg", "毛里求斯蜜湾·封面"),
    ("pexels", "3155660", "mauritius-bg.jpg", "毛里求斯蜜湾·背景"),
    ("pexels", "457882", "boracay-cover.jpg", "长滩岛晴浪·封面"),
    ("pexels", "3601425", "boracay-bg.jpg", "长滩岛晴浪·背景"),
    ("pexels", "8356059", "palau-cover.jpg", "帕劳翡翠海·封面"),
    ("pexels", "1483053", "palau-bg.jpg", "帕劳翡翠海·背景"),
    ("pexels", "11227757", "cozumel-cover.jpg", "科苏梅尔蓝岸·封面"),
    ("pexels", "1483054", "cozumel-bg.jpg", "科苏梅尔蓝岸·背景"),
    ("pexels", "1320686", "samui-cover.jpg", "苏梅岛晨光·封面"),
    ("pexels", "3155662", "samui-bg.jpg", "苏梅岛晨光·背景"),
    ("pexels", "14667393", "langkawi-cover.jpg", "兰卡威潮音·封面"),
    ("pexels", "2507007", "langkawi-bg.jpg", "兰卡威潮音·背景"),
    ("unsplash", "1520454974749-611b7248ffdb", "guam-cover.jpg", "关岛碧波·封面"),
    ("unsplash", "1590523278191-995cbcda646b", "guam-bg.jpg", "关岛碧波·背景"),
    ("unsplash", "1573790387438-4da905039392", "kauai-cover.jpg", "考艾绿崖湾·封面"),
    ("pexels", "1430676", "kauai-bg.jpg", "考艾绿崖湾·背景"),
    ("pexels", "18245896", "andaman-cover.jpg", "安达曼珍珠湾·封面"),
    ("pexels", "1450359", "andaman-bg.jpg", "安达曼珍珠湾·背景"),
    # 替换原「圣托里尼」错配：加勒比椰影 + 蒂芙尼蓝海
    ("pexels", "240526", "aruba-cover.jpg", "阿鲁巴蒂芙尼·封面"),
    ("unsplash", "1582719508461-905c673771fd", "aruba-bg.jpg", "阿鲁巴蒂芙尼·背景"),
]

# 共享美图池：仅保留果冻海/椰滩向；禁止爱琴蓝白、山湖、纯水下鱼群
POOL: list[tuple[str, str, str, str]] = [
    ("unsplash", "1507525428034-b723cf961d3e", "pool-beach-01.jpg", "白沙晴滩"),
    ("pexels", "240526", "pool-beach-02.jpg", "椰影沙滩"),
    ("unsplash", "1519046904884-53103b34b206", "pool-beach-03.jpg", "热带椰林"),
    ("pexels", "18245896", "pool-beach-04.jpg", "椰影白沙果冻海"),
    ("pexels", "1450360", "pool-beach-05.jpg", "碧海长滩"),
    ("unsplash", "1520454974749-611b7248ffdb", "pool-beach-06.jpg", "晴空海湾"),
    ("pexels", "994605", "pool-beach-07.jpg", "阳光椰冠"),
    ("pexels", "4605323", "pool-beach-08.jpg", "椰林翡翠湾"),
    ("pexels", "4784289", "pool-ocean-01.jpg", "航拍果冻岸"),
    ("pexels", "3601425", "pool-ocean-02.jpg", "泻湖碧透"),
    ("unsplash", "1573843981267-be1999ff37cd", "pool-ocean-03.jpg", "泻湖水屋"),
    ("pexels", "28408490", "pool-ocean-04.jpg", "白沙蒂芙尼海"),
    ("pexels", "753626", "pool-ocean-05.jpg", "波拉波拉峰"),
    ("pexels", "1078983", "pool-palm-01.jpg", "椰林入海"),
    ("pexels", "1078982", "pool-palm-02.jpg", "航拍椰冠浅海"),
    ("pexels", "7652322", "pool-palm-03.jpg", "椰冠俯瞰海"),
    ("pexels", "14667393", "pool-tropic-01.jpg", "度假椰岸"),
    ("pexels", "11227757", "pool-tropic-02.jpg", "伞影果冻海"),
    ("pexels", "1450353", "pool-nature-01.jpg", "椰叶框景泻湖"),
    ("pexels", "1450359", "pool-nature-02.jpg", "环礁小岛"),
    ("pexels", "8356059", "pool-sky-01.jpg", "新月岛泻湖"),
    ("pexels", "8356060", "pool-sky-02.jpg", "全岛果冻环"),
    ("pexels", "8356061", "pool-share-01.jpg", "度假岛航拍"),
    ("pexels", "8356062", "pool-share-02.jpg", "三色海水"),
    ("pexels", "8356063", "pool-share-03.jpg", "礁缘蒂芙尼"),
    ("pexels", "8356064", "pool-share-04.jpg", "环岛玻璃海"),
    ("pexels", "1483053", "pool-share-05.jpg", "水屋椰岛"),
    ("pexels", "1483054", "pool-share-06.jpg", "沙洲果冻海"),
    ("pexels", "31743357", "pool-share-07.jpg", "蜜湾椰影"),
    ("pexels", "3155660", "pool-share-08.jpg", "礁盘浅海"),
    ("pexels", "29901898", "pool-share-09.jpg", "椰林礁缘"),
    ("pexels", "3155662", "pool-share-10.jpg", "长滩椰岸"),
    ("pexels", "1320686", "pool-share-11.jpg", "苏梅浅湾"),
    ("pexels", "457882", "pool-share-12.jpg", "碧湾晴天"),
    ("unsplash", "1506953823976-52e1fdc0149a", "pool-share-13.jpg", "吊床椰影"),
    ("unsplash", "1573790387438-4da905039392", "pool-share-14.jpg", "椰影透蓝"),
    ("unsplash", "1590523278191-995cbcda646b", "pool-share-15.jpg", "斜椰浅滩"),
    ("unsplash", "1582719508461-905c673771fd", "pool-share-16.jpg", "椰廊晴海"),
    ("pexels", "1430676", "pool-share-17.jpg", "摩托艇果冻海"),
    ("pexels", "2507007", "pool-share-18.jpg", "廊亭望海"),
]


def asset_url(source: str, photo_id: str, w: int = 1600) -> str:
    if source == "pexels":
        return (
            f"https://images.pexels.com/photos/{photo_id}/"
            f"pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w={w}"
        )
    return (
        f"https://images.unsplash.com/photo-{photo_id}"
        f"?auto=format&fit=crop&w={w}&q=78"
    )


def cache_hint_path(source: str, photo_id: str, filename: str) -> Path | None:
    """若本地预览缓存已有同图，优先复制，加快强制重下。"""
    stem = Path(filename).stem
    patterns = [
        f"*__{source}_{photo_id}.jpg",
        f"{stem}__{source}_{photo_id}.jpg",
        f"{source}_{photo_id}.jpg",
        f"*_{photo_id}.jpg",
    ]
    for cache_dir in PREVIEW_CACHES:
        if not cache_dir.is_dir():
            continue
        for pat in patterns:
            hits = list(cache_dir.glob(pat))
            if hits:
                return hits[0]
        # 宽松：文件名含 photo id 片段
        for p in cache_dir.glob("*.jpg"):
            if photo_id in p.name and p.stat().st_size > 8000:
                return p
    return None


def clean_rows(
    rows: list[tuple[str, str, str, str]],
) -> list[tuple[str, str, str, str]]:
    seen_file: set[str] = set()
    out: list[tuple[str, str, str, str]] = []
    for source, photo_id, filename, name in rows:
        if name == "跳过" or "0e0e" in photo_id or "skip" in filename:
            continue
        if filename in seen_file:
            continue
        seen_file.add(filename)
        out.append((source, photo_id, filename, name))
    return out


def download_bytes(url: str) -> bytes | None:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "image/*,*/*;q=0.8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if len(data) < 8000:
            return None
        return data
    except Exception as e:
        print(f"  ERR {e}")
        return None


def download_via_pexels_search(query: str, dest: Path) -> bool:
    key = os.environ.get("PEXELS_API_KEY", "").strip()
    if not key:
        return False
    q = urllib.parse.urlencode(
        {"query": query, "per_page": 1, "orientation": "landscape"}
    )
    api = f"https://api.pexels.com/v1/search?{q}"
    req = urllib.request.Request(
        api, headers={"Authorization": key, "User-Agent": UA}
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        photos = payload.get("photos") or []
        if not photos:
            return False
        src = photos[0]["src"].get("large2x") or photos[0]["src"].get("large")
        if not src:
            return False
        data = download_bytes(src)
        if not data:
            return False
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"  Pexels ERR {e}")
        return False


def fetch_one(
    source: str,
    photo_id: str,
    filename: str,
    name: str,
    *,
    force: bool,
) -> dict | None:
    dest = OUT_DIR / filename
    if dest.exists() and dest.stat().st_size > 8000 and not force:
        print(f"EXISTS {filename}")
        return {
            "file": f"/themes/islands/{filename}",
            "photoId": photo_id,
            "name": name,
            "source": source,
            "url": asset_url(source, photo_id),
        }

    # 本地预览缓存命中则复制（仍记真实图源）
    hint = cache_hint_path(source, photo_id, filename)
    if hint and hint.stat().st_size > 8000:
        # 缓存多为 1200w，主题需要更清晰时仍尝试直链
        print(f"GET cache+net {name} -> {filename}")
    else:
        print(f"GET {name} -> {filename}")

    url = asset_url(source, photo_id)
    data = download_bytes(url)
    if not data and hint:
        data = hint.read_bytes()
        print(f"  OK via cache {hint.name} {len(data)} B")
    if not data and source == "unsplash":
        # 个别 Unsplash ID 失效时，用同主题相关英文词试 Pexels
        q = name.split("·")[0].strip()
        if download_via_pexels_search(f"{q} tropical beach lagoon", dest):
            return {
                "file": f"/themes/islands/{filename}",
                "photoId": "pexels-search",
                "name": name,
                "source": "pexels",
                "url": "",
            }
    if not data:
        print("  FAIL")
        return None

    dest.write_bytes(data)
    print(f"  OK {len(data)} B")
    return {
        "file": f"/themes/islands/{filename}",
        "photoId": photo_id,
        "name": name,
        "source": source,
        "url": url,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force-themes",
        action="store_true",
        help="强制重下 20 套主题 cover/bg（修正错配时使用）",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    theme_rows = clean_rows(THEME_FILES)
    pool_rows = clean_rows(POOL)
    catalog = theme_rows + pool_rows
    print(f"Catalog unique files: {len(catalog)}")
    print(f"Out: {OUT_DIR}")

    ok_rows: list[dict] = []
    fail: list[str] = []

    theme_names = {fn for _, _, fn, _ in theme_rows}

    for i, (source, photo_id, filename, name) in enumerate(catalog):
        force = bool(args.force_themes and filename in theme_names)
        if force and (OUT_DIR / filename).exists():
            (OUT_DIR / filename).unlink()
        row = fetch_one(source, photo_id, filename, name, force=force)
        if row:
            ok_rows.append(row)
        else:
            fail.append(filename)
        time.sleep(0.12)

    # 确保 20 套主题文件齐全：失败则从已成功主题文件复制（仍标记）
    existing = [p for p in OUT_DIR.glob("*.jpg") if p.stat().st_size > 8000]
    for _, _, fn, _ in theme_rows:
        dest = OUT_DIR / fn
        if dest.exists() and dest.stat().st_size > 8000:
            continue
        if not existing:
            print(f"CRITICAL missing {fn} and no fallback files")
            continue
        # 仅用同目录其它成功主题图，避免再抄错配山湖
        theme_existing = [
            p
            for p in existing
            if p.name in theme_names and p.name != fn
        ] or existing
        src = theme_existing[hash(fn) % len(theme_existing)]
        shutil.copyfile(src, dest)
        print(f"COPIED fallback {src.name} -> {fn}")
        ok_rows.append(
            {
                "file": f"/themes/islands/{fn}",
                "photoId": "local-fallback-copy",
                "name": fn,
                "source": "copy",
                "url": "",
            }
        )

    # 一键装扮所见即所得：全站背景与缩略图必须同图（cover→bg），
    # 避免再出现「点波拉波拉封面却渲染另一座环礁航拍」。
    for cover in sorted(OUT_DIR.glob("*-cover.jpg")):
        bg = OUT_DIR / cover.name.replace("-cover.jpg", "-bg.jpg")
        if cover.stat().st_size > 8000:
            shutil.copy2(cover, bg)
            print(f"SYNC cover->bg {cover.name} -> {bg.name}")

    jpg_count = len([p for p in OUT_DIR.glob("*.jpg") if p.stat().st_size > 8000])
    MANIFEST.write_text(
        json.dumps(
            {
                "source": "Unsplash (https://unsplash.com/license) / Pexels (https://www.pexels.com/license/)",
                "count": jpg_count,
                "failed": fail,
                "assets": ok_rows,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"DONE jpg={jpg_count} fail={len(fail)} manifest={MANIFEST}")
    missing_themes = [
        fn
        for _, _, fn, _ in theme_rows
        if not ((OUT_DIR / fn).exists() and (OUT_DIR / fn).stat().st_size > 8000)
    ]
    if missing_themes:
        print("MISSING THEMES:", missing_themes)
        return 1
    return 0 if jpg_count >= 40 else 1


if __name__ == "__main__":
    raise SystemExit(main())
