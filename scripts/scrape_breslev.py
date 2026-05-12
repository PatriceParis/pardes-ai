"""Scrape breslev.fr/tous-les-cours and extract all YouTube IDs.

The listing page links to individual course pages on the same site.
Each course page embeds a YouTube video. We crawl one level deep.
"""
import re
import sys
import time
import urllib.request
from urllib.parse import urljoin
from pathlib import Path

ROOT = "https://breslev.fr/tous-les-cours/"
HOST = "https://breslev.fr"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
}

OUT_LIST = Path(r"C:\Users\patri\Shalom\app\logs\breslev-videos.txt")
OUT_LIST.parent.mkdir(parents=True, exist_ok=True)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


YT_RE = re.compile(
    r"(?:youtube\.com/(?:watch\?v=|embed/|v/)|youtu\.be/)([a-zA-Z0-9_-]{11})"
)


def extract_ids(html: str) -> set[str]:
    return set(YT_RE.findall(html))


# Find internal course links from the listing page
def main() -> int:
    print(f"Fetching {ROOT}")
    listing = fetch(ROOT)
    print(f"  {len(listing):,} bytes")

    # Direct YT IDs in the listing
    direct_ids = extract_ids(listing)
    print(f"  direct YT IDs on listing: {len(direct_ids)}")

    # Internal course pages — look for /cours/... or /enseignement/... or hrefs containing "cours"
    href_re = re.compile(
        r'href=["\'](https?://breslev\.fr/[^"\']+|/[^"\']+)["\']',
        re.IGNORECASE,
    )
    candidates: set[str] = set()
    for href in href_re.findall(listing):
        url = href if href.startswith("http") else urljoin(HOST, href)
        # Filter heuristics for likely course pages
        low = url.lower()
        if any(k in low for k in ("/cours", "/enseignement", "/video", "/lesson", "/leçon")):
            if not low.endswith((".jpg", ".png", ".pdf", ".svg")) and "/page" not in low:
                candidates.add(url)
    # Drop the index page itself
    candidates.discard(ROOT)
    candidates.discard(ROOT.rstrip("/"))
    print(f"  candidate internal pages: {len(candidates)}")

    all_ids: dict[str, str] = {vid: "(listing)" for vid in direct_ids}

    for i, url in enumerate(sorted(candidates), 1):
        try:
            html = fetch(url)
        except Exception as e:  # noqa: BLE001
            print(f"  [{i}/{len(candidates)}] {url} — error: {e}")
            continue
        ids = extract_ids(html)
        new = [v for v in ids if v not in all_ids]
        for v in ids:
            all_ids.setdefault(v, url)
        print(f"  [{i}/{len(candidates)}] {url} — {len(ids)} ids ({len(new)} new)")
        time.sleep(0.3)

    print(f"\nTotal unique YouTube IDs: {len(all_ids)}")
    with OUT_LIST.open("w", encoding="utf-8") as f:
        for vid, src in sorted(all_ids.items()):
            f.write(f"{vid}\t{src}\n")
    print(f"Wrote {OUT_LIST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
