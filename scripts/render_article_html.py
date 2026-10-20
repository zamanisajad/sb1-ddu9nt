#!/usr/bin/env python3
"""Render an article (Markdown + front matter) as a standalone RTL HTML page for copy-paste into WordPress.

Usage: render_article_html.py articles/2026-10-20-slug.md [out.html]
The page shows the SEO fields (title, slug, meta description, category, tags) in a box at the top,
then the article body. Open it in a browser, select the body, copy, and paste into the WordPress editor.
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from publish_to_wordpress import parse_article

src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".html"
a = parse_article(src)
e = lambda v: html.escape(", ".join(v) if isinstance(v, list) else str(v or ""))
page = f"""<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(a['title'])}</title>
<style>
body{{font-family:Vazirmatn,Tahoma,sans-serif;line-height:2;max-width:760px;margin:24px auto;padding:0 16px;color:#1f1a17;background:#fff}}
.seo{{background:#FFF4EC;border:1px solid #F9B48C;border-radius:12px;padding:12px 16px;margin-bottom:28px;font-size:14px}}
.seo b{{display:inline-block;min-width:110px;color:#8c3f19}}
h1{{font-size:28px;line-height:1.6}} h2{{margin-top:32px}} li{{margin:4px 0}}
</style></head><body>
<div class="seo">
<div><b>عنوان (سئو):</b> {e(a['title'])}</div>
<div><b>نامک (slug):</b> {e(a['slug'])}</div>
<div><b>توضیح متا:</b> {e(a['excerpt'])}</div>
<div><b>کلمهٔ کلیدی اصلی:</b> {e(a.get('focus_keyword'))}</div>
<div><b>کلمات کلیدی مرتبط:</b> {e(a.get('keywords'))}</div>
<div><b>تصویر شاخص:</b> فایل {e(os.path.basename(src).replace('.md', '.cover.png'))} — متن جایگزین (alt): {e(a.get('image_alt'))}</div>
<div><b>دسته‌بندی:</b> {e(a.get('categories'))}</div>
<div><b>برچسب‌ها:</b> {e(a.get('tags'))}</div>
<div><b>زمان پیشنهادی:</b> {e(a['when'].strftime('%Y-%m-%d %H:%M'))} (تهران)</div>
</div>
<h1>{e(a['title'])}</h1>
<article>
{a['html']}
</article>
</body></html>"""
open(out, "w", encoding="utf-8").write(page)
print(out)
