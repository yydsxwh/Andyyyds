"""本机抓取公众号短链，写出可导入的 JSON（绕过服务器 IP 验证码）。"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

URL = sys.argv[1] if len(sys.argv) > 1 else ""
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("tmp/mp_ingest.json")


def main() -> int:
    if not URL:
        print("usage: python _scrape_mp_local_to_json.py <url> [out.json]")
        return 1

    req = urllib.request.Request(
        URL,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
                "MicroMessenger/8.0.49 NetType/WIFI Language/zh_CN"
            ),
            "Accept": "text/html,*/*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://mp.weixin.qq.com/",
        },
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        final = r.geturl()
        html = r.read().decode("utf-8", "replace")

    def meta(prop: str) -> str:
        m = re.search(
            rf'<meta[^>]+(?:property|name)="{re.escape(prop)}"[^>]+content="([^"]*)"',
            html,
            re.I,
        )
        if m:
            return m.group(1).strip()
        m = re.search(
            rf'<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="{re.escape(prop)}"',
            html,
            re.I,
        )
        return m.group(1).strip() if m else ""

    def js_var(name: str) -> str:
        # 兼容 var msg_title = htmlDecode("..."); / '...'
        m = re.search(
            rf"(?:var\s+|window\.){name}\s*=\s*(?:htmlDecode\()?\s*['\"]([^'\"]*)['\"]",
            html,
            re.I,
        )
        if not m:
            return ""
        return (
            m.group(1)
            .replace("\\x26", "&")
            .replace("&amp;", "&")
            .replace("\\'", "'")
            .strip()
        )

    # 平衡提取 js_content
    content = ""
    marker = re.search(r'id=["\']js_content["\']', html, re.I)
    if marker:
        gt = html.find(">", marker.start())
        start = gt + 1
        depth = 1
        for m in re.finditer(r"</?div\b[^>]*>", html[start:], re.I):
            tag = m.group(0)
            if tag.lower().startswith("</"):
                depth -= 1
                if depth == 0:
                    content = html[start : start + m.start()]
                    break
            elif not tag.endswith("/>"):
                depth += 1

    title = js_var("msg_title") or meta("og:title") or ""
    if not title:
        tm = re.search(r"<title>([^<]+)</title>", html, re.I)
        title = re.sub(r"[-_|].*$", "", tm.group(1)).strip() if tm else ""
    digest = js_var("msg_desc") or meta("og:description") or ""
    thumb = js_var("msg_cdn_url") or js_var("cdn_url_1_1") or meta("og:image") or ""

    biz = ""
    mid = ""
    idx = "1"
    sn = ""
    for pat, key in [
        (r'var\s+biz\s*=\s*["\']([^"\']+)["\']', "biz"),
        (r'window\.biz\s*=\s*["\']([^"\']+)["\']', "biz"),
        (r'__biz=([A-Za-z0-9=]+)', "biz"),
    ]:
        m = re.search(pat, html)
        if m and "${" not in m.group(1):
            biz = m.group(1)
            break
    mm = re.search(r'var\s+mid\s*=\s*["\']?(\d+)', html) or re.search(
        r'mid=(\d+)', final
    )
    if mm:
        mid = mm.group(1)
    im = re.search(r'var\s+idx\s*=\s*["\']?(\d+)', html)
    if im:
        idx = im.group(1)
    sm = re.search(r'var\s+sn\s*=\s*["\']([a-f0-9]+)', html) or re.search(
        r'sn=([a-f0-9]+)', html
    )
    if sm:
        sn = sm.group(1)

    canonical = final
    if biz and mid and sn:
        canonical = (
            f"https://mp.weixin.qq.com/s?__biz={biz}&mid={mid}&idx={idx}&sn={sn}"
        )

    # data-src -> src 粗处理
    content = re.sub(
        r'data-src=(["\'])(https?:[^"\']+)\1',
        r'src=\1\2\1',
        content,
        flags=re.I,
    )
    content = re.sub(r"<script[\s\S]*?</script>", "", content, flags=re.I)
    content = re.sub(r"<style[\s\S]*?</style>", "", content, flags=re.I)

    # 贴图（appmsg_type=9）：常无 #js_content，文案在 text_page_info，图在 picture_page_info_list
    if len(content.strip()) < 40:
        text_m = re.search(
            r"text_page_info\s*:\s*\{[^}]*?content\s*:\s*'((?:\\'|[^'])*)'",
            html,
            re.S,
        )
        caption = ""
        if text_m:
            caption = (
                text_m.group(1)
                .replace("\\x0a", "\n")
                .replace("\\n", "\n")
                .replace("\\'", "'")
                .replace("\\x26", "&")
                .strip()
            )
        pic_urls = re.findall(
            r"picture_page_info_list\s*:\s*\[(.*?)\]",
            html,
            re.S,
        )
        imgs: list[str] = []
        if pic_urls:
            imgs = re.findall(
                r"(?:cdn_url|cdn_url_1_1)\s*:\s*['\"](https?://[^'\"]+)['\"]",
                pic_urls[0],
            )
        # 列表为空时，仍尽量用页面上的 mmbiz 图（排除头像/空白占位）
        if not imgs:
            for u in re.findall(
                r"https?://mmbiz\.qpic\.cn/[^\s\"'<>\\]+",
                html,
            ):
                u2 = u.rstrip("\\").replace("\\x26", "&").replace("&amp;", "&")
                if "/mmhead/" in u2 or "pic_blank" in u2:
                    continue
                if u2 not in imgs:
                    imgs.append(u2)
        parts: list[str] = []
        if caption:
            safe = (
                caption.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            parts.append(
                "<p>" + "</p><p>".join(line for line in safe.split("\n") if line.strip()) + "</p>"
            )
        for src in imgs[:20]:
            parts.append(f'<p><img src="{src}" alt="" /></p>')
        if parts:
            content = "".join(parts)
        if not thumb and imgs:
            thumb = imgs[0]
        if not digest and caption:
            digest = re.sub(r"\s+", " ", caption)[:120]

    payload = {
        "inputUrl": URL,
        "canonicalUrl": canonical,
        "title": title,
        "digest": digest,
        "thumbUrl": thumb,
        "contentHtml": content,
        "biz": biz,
        "mid": mid,
        "idx": idx,
        "sn": sn,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    summary = {
        "out": str(OUT),
        "title": title,
        "canonicalUrl": canonical,
        "bodyLen": len(content),
        "thumb": bool(thumb),
        "biz": biz,
        "mid": mid,
        "sn": (sn[:8] + "...") if sn else "",
    }
    Path(str(OUT) + ".summary.txt").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("OK", OUT, "title_len", len(title), "body", len(content))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
