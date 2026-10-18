#!/usr/bin/env python3
"""Publish article files from articles/ to a WordPress site through its REST API.

Each article is a Markdown file with a front-matter block:

    ---
    title: عنوان مقاله
    slug: english-url-slug
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
- Category and tag names are looked up and created if missing.

Environment variables: WP_URL (e.g. https://masports.ir), WP_USER, WP_APP_PASSWORD.
Usage: publish_to_wordpress.py FILE [FILE ...]   (add --dry-run to only validate)
"""
import base64
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

import markdown  # pip install markdown

REQUIRED = ("title", "slug", "excerpt", "publish_at")


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
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", meta["slug"]):
        raise ValueError(f"{path}: slug must be lowercase English words joined by '-'")
    when = dt.datetime.fromisoformat(meta["publish_at"])
    if when.tzinfo is None:
        raise ValueError(f"{path}: publish_at needs a timezone, e.g. +03:30")
    body = m.group(2).strip()
    if len(body) < 800:
        raise ValueError(f"{path}: article body looks too short ({len(body)} chars)")
    meta["when"] = when
    meta["html"] = markdown.markdown(body, extensions=["extra", "sane_lists"])
    return meta


class WP:
    def __init__(self, base, user, password):
        self.base = base.rstrip("/")
        token = base64.b64encode(f"{user}:{password}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "komak-morabi-publisher/1.0",
        }

    def call(self, method, route, data=None, query=None):
        # ?rest_route= works even when pretty permalinks are off.
        params = {"rest_route": route}
        params.update(query or {})
        url = f"{self.base}/?{urllib.parse.urlencode(params)}"
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(url, data=body, method=method, headers=self.headers)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode() or "null")
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            raise RuntimeError(f"{method} {route} -> HTTP {e.code}: {detail}") from None

    def term_ids(self, taxonomy, names):
        ids = []
        for name in names or []:
            found = self.call("GET", f"/wp/v2/{taxonomy}", query={"search": name, "per_page": 100})
            match = next((t for t in found if t["name"] == name), None)
            if not match:
                match = self.call("POST", f"/wp/v2/{taxonomy}", {"name": name})
            ids.append(match["id"])
        return ids

    def find_post(self, slug):
        found = self.call("GET", "/wp/v2/posts",
                          query={"slug": slug, "status": "publish,future,draft,pending,private",
                                 "context": "edit"})
        return found[0] if found else None


def main(argv):
    dry = "--dry-run" in argv
    files = [a for a in argv if not a.startswith("--")]
    if not files:
        print("No article files given; nothing to do.")
        return 0
    articles = [(f, parse_article(f)) for f in files]  # validate everything first
    if dry:
        for f, a in articles:
            print(f"OK  {f}: «{a['title']}» → {a['slug']} at {a['when'].isoformat()}")
        return 0

    wp = WP(os.environ["WP_URL"], os.environ["WP_USER"], os.environ["WP_APP_PASSWORD"])
    now = dt.datetime.now(dt.timezone.utc)
    for f, a in articles:
        future = a["when"] > now
        payload = {
            "title": a["title"],
            "slug": a["slug"],
            "excerpt": a["excerpt"],
            "content": a["html"],
            "status": "future" if future else "publish",
            "date_gmt": a["when"].astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
            "categories": wp.term_ids("categories", a.get("categories")),
            "tags": wp.term_ids("tags", a.get("tags")),
        }
        existing = wp.find_post(a["slug"])
        if existing and existing.get("status") == "publish" and future:
            payload["status"] = "publish"  # never un-publish a live post
        if existing:
            post = wp.call("POST", f"/wp/v2/posts/{existing['id']}", payload)
            action = "updated"
        else:
            post = wp.call("POST", "/wp/v2/posts", payload)
            action = "created"
        print(f"{action} post {post['id']} [{post['status']}] «{a['title']}» → {post.get('link')}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
