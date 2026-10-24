#!/usr/bin/env python3
"""Publish article files from articles/ to a WordPress site through its REST API.

Each article is a Markdown file with a front-matter block:

    ---
    title: عنوان مقاله
    slug: نشانی-کوتاه-فارسی
    excerpt: توضیح متا (حدود ۱۵۵ نویسه)
    publish_at: 2026-10-20T18:00:00+03:30
    categories: [مربیگری]
    tags: [برنامه تمرینی, مربی بدنسازی]
    ---
    متن مقاله به Markdown …

Behavior:
- If publish_at is in the future, the post is created with status "future".
  WordPress then publishes it itself at that time. Otherwise it is published now.
- Idempotent: if a post with the same slug already exists, it is updated, not duplicated.
- Categories must already exist on the site (unknown ones are skipped with a warning).
  Tags are created if missing.

Environment variables: WP_URL (e.g. https://masports.ir), WP_USER, WP_APP_PASSWORD.
Only files whose front matter has `wp: publish` are sent; others are skipped
(older articles the owner pasted by hand). A `<file>.cover.png` next to the
article is uploaded as the featured image, with `image_alt` as its alt text.

Usage: publish_to_wordpress.py FILE [FILE ...]   (add --dry-run to only validate)
"""
import base64
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import markdown  # pip install markdown

REQUIRED = ("title", "slug", "excerpt", "publish_at")
AD_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ad-banner.html")
COVER_EXTS = ((".cover.webp", "image/webp"), (".cover.jpg", "image/jpeg"), (".cover.png", "image/png"))


def insert_ad(html):
    """Put the owner's ad banner (scripts/ad-banner.html) in the middle of the article,
    right before the H2 closest to the middle. No banner file → html unchanged."""
    if not os.path.exists(AD_FILE):
        return html
    ad = open(AD_FILE, encoding="utf-8").read().strip()
    starts = [m.start() for m in re.finditer(r"<h2[ >]", html)]
    if len(starts) >= 2:
        pos = starts[len(starts) // 2]
    else:
        paras = [m.end() for m in re.finditer(r"</p>", html)]
        pos = paras[len(paras) // 2] if paras else len(html)
    return html[:pos] + "\n" + ad + "\n" + html[pos:]


def find_cover(md_path):
    """The article's cover image next to it: owner-supplied .webp/.jpg wins over the generated .png."""
    for ext, ctype in COVER_EXTS:
        path = md_path[:-3] + ext
        if os.path.exists(path):
            return path, ctype
    return None, None


def parse_article(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        raise ValueError(f"{path}: front matter (--- ... ---) not found")
    meta = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, _, val = line.partition(":")
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            val = [v.strip().strip("\"'") for v in val[1:-1].split(",") if v.strip()]
        else:
            val = val.strip("\"'")
        meta[key.strip()] = val
    missing = [k for k in REQUIRED if not meta.get(k)]
    if missing:
        raise ValueError(f"{path}: missing front-matter fields: {', '.join(missing)}")
    if not re.fullmatch(r"[a-z0-9\u0600-\u06FF\u200c]+(-[a-z0-9\u0600-\u06FF\u200c]+)*", meta["slug"]):
        raise ValueError(f"{path}: slug must be Persian or lowercase English words joined by '-' (no spaces)")
    when = dt.datetime.fromisoformat(meta["publish_at"])
    if when.tzinfo is None:
        raise ValueError(f"{path}: publish_at needs a timezone, e.g. +03:30")
    body = m.group(2).strip()
    if len(body) < 800:
        raise ValueError(f"{path}: article body looks too short ({len(body)} chars)")
    meta["when"] = when
    meta["html"] = insert_ad(markdown.markdown(body, extensions=["extra", "sane_lists"]))
    return meta


class WP:
    def __init__(self, base, user, password):
        self.base = base.rstrip("/")
        token = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}", "X-Authorization": f"Basic {token}",
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "komak-morabi-publisher/1.0",
        }

    def call(self, method, route, data=None, query=None, raw=None, extra_headers=None):
        # ?rest_route= works even when pretty permalinks are off.
        params = {"rest_route": route}
        params.update(query or {})
        url = f"{self.base}/?{urllib.parse.urlencode(params)}"
        body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
        headers = {**self.headers, **(extra_headers or {})}
        for attempt in range(4):
            req = urllib.request.Request(url, data=body, method=method, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.loads(r.read().decode() or "null")
            except urllib.error.HTTPError as e:
                detail = e.read().decode(errors="replace")[:500]
                raise RuntimeError(f"{method} {route} -> HTTP {e.code}: {detail}") from None
            except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
                # The host sometimes drops a connection; retry a few times.
                print(f"network error on {method} {route} ({e}); retrying…")
                time.sleep(5 * (attempt + 1))
        raise RuntimeError(f"{method} {route}: network kept failing")

    def upload_image(self, path, alt, ctype="image/png"):
        """Upload an image to the media library and set its alt text; returns the media id."""
        name = os.path.basename(path)[:10] + "-" + cover_tag(path) + os.path.splitext(path)[1]  # ASCII: date-hash.ext
        media = self.call("POST", "/wp/v2/media", raw=open(path, "rb").read(), extra_headers={
            "Content-Type": ctype,
            "Content-Disposition": f'attachment; filename="{name}"'})
        self.call("POST", f"/wp/v2/media/{media['id']}", {"alt_text": alt, "title": alt})
        return media["id"]

    def media_url(self, media_id):
        try:
            return self.call("GET", f"/wp/v2/media/{media_id}", query={"context": "edit"}).get("source_url", "")
        except RuntimeError:
            return ""

    def term_ids(self, taxonomy, names, create):
        """Look up term ids by exact name. Tags are created if missing; categories never are."""
        ids = []
        for name in names or []:
            found = self.call("GET", f"/wp/v2/{taxonomy}", query={"search": name, "per_page": 100})
            match = next((t for t in found if t["name"] == name), None)
            if not match and create:
                try:
                    match = self.call("POST", f"/wp/v2/{taxonomy}", {"name": name})
                except RuntimeError as e:
                    print(f"warning: could not create {taxonomy} «{name}»: {e}")
            if not match:
                print(f"warning: {taxonomy} «{name}» not found on the site; skipped")
                continue
            ids.append(match["id"])
        return ids

    def find_post(self, slug):
        found = self.call("GET", "/wp/v2/posts",
                          query={"slug": slug, "status": "publish,future,draft,pending,private",
                                 "context": "edit"})
        return found[0] if found else None


def cover_tag(path):
    import hashlib
    return hashlib.sha1(open(path, "rb").read()).hexdigest()[:8]


def main(argv):
    dry = "--dry-run" in argv
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print("No article files given; nothing to do.")
        return 0
    articles = [(f, parse_article(f)) for f in files]  # validate everything first
    if dry:
        for f, a in articles:
            flag = "will publish" if a.get("wp") == "publish" else "NOT marked for publishing (wp: publish)"
            print(f"OK  {f}: «{a['title']}» → {a['slug']} at {a['when'].isoformat()} [{flag}]")
        return 0

    wp = WP(os.environ["WP_URL"], os.environ["WP_USER"], os.environ["WP_APP_PASSWORD"])
    now = dt.datetime.now(dt.timezone.utc)
    for f, a in articles:
        if a.get("wp") != "publish":
            print(f"skip {f}: front matter has no 'wp: publish' (owner publishes it by hand)")
            continue
        future = a["when"] > now
        payload = {
            "title": a["title"],
            "slug": a["slug"],
            "excerpt": a["excerpt"],
            "content": a["html"],
            "status": "future" if future else "publish",
            "date_gmt": a["when"].astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
            "categories": wp.term_ids("categories", a.get("categories"), create=False),
            "tags": wp.term_ids("tags", a.get("tags"), create=True),
        }
        existing = wp.find_post(a["slug"])
        cover, ctype = find_cover(f)
        if cover:
            current = wp.media_url(existing["featured_media"]) if existing and existing.get("featured_media") else ""
            if cover_tag(cover) in current:
                print("featured image already up to date")
            else:
                try:
                    payload["featured_media"] = wp.upload_image(cover, a.get("image_alt") or a["title"], ctype)
                    print(f"uploaded featured image {payload['featured_media']} ({os.path.basename(cover)})")
                except RuntimeError as e:
                    print(f"warning: featured image upload failed: {e}")
        if existing and existing.get("status") == "publish" and future:
            payload["status"] = "publish"  # never un-publish a live post
        if existing:
            post = wp.call("POST", f"/wp/v2/posts/{existing['id']}", payload)
            action = "updated"
        else:
            post = wp.call("POST", "/wp/v2/posts", payload)
            action = "created"
        print(f"{action} post {post['id']} [{post['status']}] «{a['title']}» → {post.get('link')}")
        try:
            saved = wp.call("GET", f"/wp/v2/posts/{post['id']}", query={"context": "edit"})
            raw_html = (saved.get("content") or {}).get("raw", "")
            if "ad-banner-desktop.webp" in raw_html:
                print("ad banner: saved" + ("" if "<picture" in raw_html else " (WordPress removed <picture>/<source>; desktop image still shows)"))
            elif os.path.exists(AD_FILE):
                print("warning: ad banner was removed by WordPress filters")
        except RuntimeError as e:
            print(f"warning: could not re-read post: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
