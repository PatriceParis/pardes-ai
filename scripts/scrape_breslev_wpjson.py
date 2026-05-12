"""Pull every WordPress post from breslev.fr via wp-json and extract YouTube IDs.

Output: logs/breslev-videos.tsv with columns:
  video_id \t post_id \t date \t slug \t title \t categories_csv
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

API = "https://breslev.fr/wp-json/wp/v2"
HEADERS = {"User-Agent": "Mozilla/5.0 Chrome/125.0"}
PER_PAGE = 100

OUT = Path(r"C:\Users\patri\Shalom\app\logs\breslev-videos.tsv")
OUT.parent.mkdir(parents=True, exist_ok=True)

YT_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|embed/|v/)|youtu\.be/|youtube-nocookie\.com/embed/)([a-zA-Z0-9_-]{11})"
)


def fetch_json(url: str) -> tuple[list[dict], dict]:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
        meta = {
            "X-WP-Total": r.headers.get("X-WP-Total", ""),
            "X-WP-TotalPages": r.headers.get("X-WP-TotalPages", ""),
        }
        return body, meta


def fetch_categories() -> dict[int, str]:
    cats: dict[int, str] = {}
    page = 1
    while True:
        url = f"{API}/categories?per_page=100&page={page}"
        try:
            body, _ = fetch_json(url)
        except Exception as e:  # noqa: BLE001
            print(f"  cats page {page} error: {e}", file=sys.stderr)
            break
        if not body:
            break
        for c in body:
            cats[c["id"]] = c["slug"]
        if len(body) < 100:
            break
        page += 1
    return cats


def main() -> int:
    print("Fetching categories…")
    cats = fetch_categories()
    print(f"  {len(cats)} categories")

    print("Fetching posts (100 per page)…")
    page = 1
    posts: list[dict] = []
    while True:
        url = f"{API}/posts?per_page={PER_PAGE}&page={page}&_fields=id,date,slug,title,content,categories"
        try:
            body, meta = fetch_json(url)
        except Exception as e:  # noqa: BLE001
            print(f"  posts page {page} error: {e}", file=sys.stderr)
            break
        if not body:
            break
        posts.extend(body)
        print(f"  page {page}: {len(body)} posts (total so far: {len(posts)})  X-WP-Total={meta['X-WP-Total']}")
        if len(body) < PER_PAGE:
            break
        page += 1
        time.sleep(0.3)

    print(f"\nTotal posts: {len(posts)}")

    # Extract YT IDs per post
    videos: dict[str, dict] = {}
    for p in posts:
        content = p.get("content", {}).get("rendered", "") or ""
        ids = set(YT_RE.findall(content))
        if not ids:
            continue
        title = re.sub(r"<[^>]+>", "", p.get("title", {}).get("rendered", "")).strip()
        cat_slugs = [cats.get(c, str(c)) for c in p.get("categories", [])]
        for vid in ids:
            # If we see the same id multiple times, keep the earliest post (most likely original)
            existing = videos.get(vid)
            if existing is None or p["date"] < existing["date"]:
                videos[vid] = {
                    "post_id": p["id"],
                    "date": p["date"],
                    "slug": p["slug"],
                    "title": title,
                    "categories": ",".join(cat_slugs),
                }

    print(f"Unique YouTube IDs found: {len(videos)}")

    with OUT.open("w", encoding="utf-8") as f:
        f.write("video_id\tpost_id\tdate\tslug\ttitle\tcategories\n")
        for vid, meta in sorted(videos.items(), key=lambda kv: kv[1]["date"]):
            f.write(
                f"{vid}\t{meta['post_id']}\t{meta['date']}\t{meta['slug']}\t{meta['title']}\t{meta['categories']}\n"
            )
    print(f"Wrote {OUT}")

    # Quick stats by category
    cat_counts: dict[str, int] = {}
    for meta in videos.values():
        for c in meta["categories"].split(","):
            cat_counts[c] = cat_counts.get(c, 0) + 1
    print("\nBy category:")
    for c, n in sorted(cat_counts.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {c}: {n}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
