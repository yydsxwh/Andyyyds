"""
用站长商标图生成网站 / Android / Windows 全套图标。

源图：横向完整 Logo（图形标 + 中英文）。
- logo.png：完整商标（顶栏用）
- 其余方形图标：裁切左侧图形标（V/ZI 环），居中留白
"""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC_CANDIDATES = [
    ROOT / "tmp" / "trademark-source.png",
    Path(
        r"C:\Users\Administrator\.cursor\projects\e-source-repos-yyds-course-platform"
        r"\assets\c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_"
        r"empty-window_images___-4e6fc793-5be2-4013-8a6c-d54eb2612f69.png"
    ),
]


def find_source() -> Path:
    for p in SRC_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError("未找到商标源图")


def is_ink(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 8:
        return False
    # 近白底不算内容
    return not (r > 245 and g > 245 and b > 245)


def content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if not is_ink(px[x, y]):
                continue
            found = True
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if not found:
        return 0, 0, w - 1, h - 1
    return minx, miny, maxx, maxy


def find_mark_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    """左侧图形标与右侧文字之间有空白缝，据此切开。"""
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = content_bbox(im)
    counts: list[int] = []
    for x in range(w):
        ink = 0
        for y in range(miny, maxy + 1):
            if is_ink(px[x, y]):
                ink += 1
        counts.append(ink)

    start = next((i for i, c in enumerate(counts) if c > 20), minx)
    gap_start = None
    for x in range(start + 10, w - 8):
        if all(counts[x + k] < 5 for k in range(8)):
            gap_start = x
            break
    mark_end = (gap_start - 1) if gap_start else maxx

    mminx, mminy, mmaxx, mmaxy = w, h, 0, 0
    for y in range(h):
        for x in range(start, mark_end + 1):
            if not is_ink(px[x, y]):
                continue
            mminx = min(mminx, x)
            mminy = min(mminy, y)
            mmaxx = max(mmaxx, x)
            mmaxy = max(mmaxy, y)
    return mminx, mminy, mmaxx, mmaxy


def trim_full_logo(im: Image.Image, pad: int = 24) -> Image.Image:
    minx, miny, maxx, maxy = content_bbox(im)
    cropped = im.crop((minx, miny, maxx + 1, maxy + 1))
    out = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (255, 255, 255, 255))
    out.paste(cropped, (pad, pad), cropped)
    return out


def square_from_mark(
    im: Image.Image,
    mark: tuple[int, int, int, int],
    size: int,
    *,
    scale: float = 0.72,
    bg: tuple[int, int, int, int] = (255, 255, 255, 255),
    circle_mask: bool = False,
) -> Image.Image:
    """把图形标放进正方形；scale 控制占画布比例（Android 自适应留安全区）。"""
    minx, miny, maxx, maxy = mark
    mark_im = im.crop((minx, miny, maxx + 1, maxy + 1))
    canvas = Image.new("RGBA", (size, size), bg)
    target = int(size * scale)
    ratio = min(target / mark_im.width, target / mark_im.height)
    nw = max(1, int(mark_im.width * ratio))
    nh = max(1, int(mark_im.height * ratio))
    resized = mark_im.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (size - nw) // 2
    oy = (size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    if circle_mask:
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), mask)
        return out
    return canvas


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({im.size[0]}x{im.size[1]})")


def save_ico(im256: Image.Image, path: Path, sizes: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    images = [
        im256.resize((s, s), Image.Resampling.LANCZOS) if im256.size != (s, s) else im256.copy()
        for s in sizes
    ]
    # 最大图为主，其余 append，避免 Pillow 只写出 16x16 空壳
    images[-1].save(
        path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1],
    )
    print(f"wrote {path.relative_to(ROOT)} ico sizes={sizes} bytes={path.stat().st_size}")


def main() -> None:
    src = find_source()
    print("source:", src)
    raw = Image.open(src).convert("RGBA")
    # 缓存到仓库 tmp，方便复跑
    cache = ROOT / "tmp" / "trademark-source.png"
    cache.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() != cache.resolve():
        shutil.copy2(src, cache)

    logo = trim_full_logo(raw, pad=28)
    mark = find_mark_bbox(raw)
    print("mark_bbox:", mark)

    brand = ROOT / "public" / "brand"
    save_png(logo, brand / "logo.png")
    # 图形标原尺寸备份，供壳层 / 调试
    mark_im = raw.crop((mark[0], mark[1], mark[2] + 1, mark[3] + 1))
    save_png(mark_im, brand / "mark.png")

    icon_specs = {
        brand / "favicon-32.png": 32,
        brand / "favicon-48.png": 48,
        brand / "icon-192.png": 192,
        brand / "icon-512.png": 512,
        brand / "apple-touch-icon.png": 180,
        ROOT / "src" / "app" / "icon.png": 192,
        ROOT / "src" / "app" / "apple-icon.png": 180,
        ROOT / "desktop" / "icon.png": 512,
        ROOT / "desktop" / "shell" / "mark.png": 128,
    }
    for path, size in icon_specs.items():
        # 小尺寸略放大图形，512 给桌面壳留边
        scale = 0.78 if size >= 180 else 0.86
        save_png(square_from_mark(raw, mark, size, scale=scale), path)

    # 网站 favicon（多尺寸 ICO）
    master = square_from_mark(raw, mark, 256, scale=0.82)
    save_ico(master, ROOT / "public" / "favicon.ico", [16, 32, 48, 64, 128, 256])
    save_ico(master, ROOT / "src" / "app" / "favicon.ico", [16, 32, 48, 64, 128, 256])

    # Android mipmap
    densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    res = ROOT / "android" / "app" / "src" / "main" / "res"
    for density, size in densities.items():
        folder = res / f"mipmap-{density}"
        # 普通图标：白底方形
        launcher = square_from_mark(raw, mark, size, scale=0.8)
        save_png(launcher, folder / "ic_launcher.png")
        # 圆形
        save_png(
            square_from_mark(raw, mark, size, scale=0.78, circle_mask=True),
            folder / "ic_launcher_round.png",
        )
        # 自适应前景：透明底 + 更小安全区
        fg = square_from_mark(
            raw,
            mark,
            size,
            scale=0.62,
            bg=(0, 0, 0, 0),
        )
        save_png(fg, folder / "ic_launcher_foreground.png")

    # 背景色贴近商标青蓝高光，白底更干净
    bg_xml = res / "values" / "ic_launcher_background.xml"
    bg_xml.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        "    <color name=\"ic_launcher_background\">#FFFFFF</color>\n"
        "</resources>\n",
        encoding="utf-8",
    )
    print("updated", bg_xml.relative_to(ROOT))
    print("DONE")


if __name__ == "__main__":
    main()
