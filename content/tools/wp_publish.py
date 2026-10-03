#!/usr/bin/env python3
"""Publish (or schedule) one article package to masports.ir via the WordPress REST API.

Credentials come from the environment, never from files in the repo:
  WP_URL           e.g. https://masports.ir
  WP_USER          WordPress username that owns the Application Password
  WP_APP_PASSWORD  Application Password (Users -> Profile -> Application Passwords)

Usage:
  python3 content/tools/wp_publish.py check
  python3 content/tools/wp_publish.py posts            # list recent posts (JSON)
  python3 content/tools/wp_publish.py publish post.json [--dry-run]

post.json fields:
  title, slug, content (HTML), excerpt,
  categories: [names], tags: [names],
  publish_at_tehran: "YYYY-MM-DD HH:MM"   (omit to publish now)
  image: {path, alt, title, caption, description}   (optional)
  meta: {}  (optional; e.g. rank_math_* / _yoast_wpseo_* keys if the site exposes them)
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

TEHRAN = timezone(timedelta(hours=3, minutes=30))  # Iran has no DST since 2022


def env():
    missing = [k for k in ("WP_URL", "WP_USER", "WP_APP_PASSWORD") if not os.environ.get(k)]
    if missing:
        sys.exit(f"missing environment variables: {', '.join(missing)}")
    base = os.environ["WP_URL"].rstrip("/") + "/wp-json/wp/v2"
    s = requests.Session()
    s.auth = (os.environ["WP_USER"], os.environ["WP_APP_PASSWORD"].replace(" ", ""))
    s.headers["User-Agent"] = "masport-content-agent"
    return base, s


def ok(r):
    if r.status_code >= 400:
        sys.exit(f"HTTP {r.status_code} {r.request.method} {r.url}\n{r.text[:1000]}")
    return r.json()


def term_ids(base, s, kind, names):
    ids = []
    for name in names or []:
        found = ok(s.get(f"{base}/{kind}", params={"search": name, "per_page": 100}))
        match = next((t for t in found if t["name"].strip() == name.strip()), None)
        if match is None:
            match = ok(s.post(f"{base}/{kind}", json={"name": name}))
        ids.append(match["id"])
    return ids


def upload_image(base, s, img):
    path = img["path"]
    mime = "image/webp" if path.endswith(".webp") else "image/jpeg" if path.endswith((".jpg", ".jpeg")) else "image/png"
    with open(path, "rb") as f:
        media = ok(s.post(
            f"{base}/media",
            data=f.read(),
            headers={"Content-Type": mime,
                     "Content-Disposition": f'attachment; filename="{os.path.basename(path)}"'},
        ))
    ok(s.post(f"{base}/media/{media['id']}", json={
        "alt_text": img.get("alt", ""),
        "title": img.get("title", ""),
        "caption": img.get("caption", ""),
        "description": img.get("description", ""),
    }))
    return media["id"]


def cmd_check():
    base, s = env()
    me = ok(s.get(f"{base}/users/me", params={"context": "edit"}))
    print(json.dumps({"ok": True, "user": me.get("name"), "roles": me.get("roles")}, ensure_ascii=False))


def cmd_posts():
    base, s = env()
    posts = ok(s.get(f"{base}/posts", params={
        "per_page": 100, "status": "publish,future,draft", "context": "edit",
        "_fields": "id,date,status,slug,link,title,categories,tags"}))
    print(json.dumps(posts, ensure_ascii=False, indent=1))


def cmd_publish(path, dry_run):
    with open(path, encoding="utf-8") as f:
        p = json.load(f)
    body = {
        "title": p["title"],
        "slug": p["slug"],
        "content": p["content"],
        "excerpt": p.get("excerpt", ""),
        "status": "publish",
    }
    when = p.get("publish_at_tehran")
    if when:
        local = datetime.strptime(when, "%Y-%m-%d %H:%M").replace(tzinfo=TEHRAN)
        if local > datetime.now(timezone.utc) + timedelta(minutes=2):
            body["status"] = "future"
            body["date_gmt"] = local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    if p.get("meta"):
        body["meta"] = p["meta"]
    if dry_run:
        print(json.dumps({k: v for k, v in body.items() if k != "content"}, ensure_ascii=False, indent=1))
        return
    base, s = env()
    existing = ok(s.get(f"{base}/posts", params={"slug": p["slug"], "status": "publish,future,draft"}))
    if existing:
        sys.exit(f"slug already exists: {existing[0]['link']} (id {existing[0]['id']})")
    body["categories"] = term_ids(base, s, "categories", p.get("categories"))
    body["tags"] = term_ids(base, s, "tags", p.get("tags"))
    if p.get("image"):
        body["featured_media"] = upload_image(base, s, p["image"])
    post = s.post(f"{base}/posts", json=body)
    if post.status_code >= 400 and "meta" in body:
        body.pop("meta")  # SEO plugin meta not exposed over REST; publish without it
        post = s.post(f"{base}/posts", json=body)
    post = ok(post)
    print(json.dumps({"id": post["id"], "status": post["status"], "date": post["date"],
                      "link": post["link"]}, ensure_ascii=False))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "check":
        cmd_check()
    elif args[0] == "posts":
        cmd_posts()
    elif args[0] == "publish" and len(args) >= 2:
        cmd_publish(args[1], "--dry-run" in args)
    else:
        sys.exit(__doc__)
