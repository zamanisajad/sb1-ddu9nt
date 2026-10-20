#!/usr/bin/env python3
"""Check an article against the Rank Math checks the owner sees in WordPress.

Usage: seo_check.py articles/<file>.md     (exit code 1 if any check FAILS)
Front matter must include focus_keyword and image_alt (see articles/README.md).
"""
import re, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from publish_to_wordpress import parse_article

SITE = "masports.ir"


def norm(s):
    # Rank Math matches the keyword literally; treat ezafe ٔ / ۀ and ZWNJ as plain to spot near-misses.
    return s.replace("ۀ", "ه").replace("ٔ", "")


def main(path):
    a = parse_article(path)
    kw = a.get("focus_keyword", "")
    body_md = open(path, encoding="utf-8").read().split("---", 2)[2]
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", body_md)          # drop link targets
    text = re.sub(r"[#*>`_-]", " ", text)
    words = re.findall(r"\S+", text)
    n = len(words)
    count = text.count(kw)
    density = 100 * count / n if n else 0
    all_kw = [kw] + list(a.get("keywords") or [])
    combined = 100 * sum(text.count(k) for k in all_kw if k) / n if n else 0
    first10 = " ".join(words[: max(1, n // 10)])
    headings = re.findall(r"^#{2,3} (.+)$", body_md, re.M)
    links = re.findall(r"\]\((https?://[^)]+)\)", body_md)
    internal = [u for u in links if SITE in u]
    external = [u for u in links if SITE not in u]
    paras = [p for p in re.split(r"\n\s*\n", body_md) if p.strip() and not p.lstrip().startswith(("#", "-"))]
    longest = max((len(p.split()) for p in paras), default=0)
    slug_words = a["slug"].split("-")
    digits = re.search(r"[0-9۰-۹]", a["title"])

    checks = [
        ("focus_keyword is set", bool(kw)),
        ("keyword at the start of the title", bool(kw) and a["title"].find(kw) == 0),
        ("title has a number", bool(digits)),
        (f"title ≤ 60 chars ({len(a['title'])})", len(a["title"]) <= 60),
        ("keyword in meta description (excerpt)", kw in a["excerpt"]),
        (f"meta description 120–160 chars ({len(a['excerpt'])})", 120 <= len(a["excerpt"]) <= 160),
        ("keyword in URL (slug)", all(w in slug_words for w in kw.split())),
        ("keyword in the first 10% of the content", kw in first10),
        ("keyword in at least one H2/H3", any(kw in h for h in headings)),
        (f"focus keyword density 0.75–2.5% ({density:.2f}%, {count}× in {n} words)", 0.75 <= density <= 2.5),
        (f"focus + related keywords density ≥ 1% ({combined:.2f}%)", 1.0 <= combined <= 3.0),
        (f"content length ≥ 1000 words ({n})", n >= 1000),
        (f"at least one internal link to {SITE} ({len(internal)})", len(internal) >= 1),
        (f"at least one external (dofollow) link ({len(external)})", len(external) >= 1),
        ("image_alt contains the keyword", kw in a.get("image_alt", "")),
        (f"paragraphs short (longest {longest} words ≤ 120)", longest <= 120),
    ]
    near = norm(text).count(norm(kw)) - count
    ok = True
    for name, passed in checks:
        print(("PASS " if passed else "FAIL ") + name)
        ok &= passed
    if near > 0:
        print(f"note: {near} more near-match(es) with ezafe/ۀ that Rank Math will NOT count; write the keyword plainly.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(max(main(p) for p in sys.argv[1:]))
