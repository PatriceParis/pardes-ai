"""Bulk-download YouTube transcripts for breslev.fr videos.

Reads logs/breslev-videos.tsv produced by scrape_breslev_wpjson.py.
Writes one .txt per video under KB/transcripts/breslev/.
Skips videos already on disk so the run is resumable.
"""
from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    IpBlocked,
    RequestBlocked,
)

INPUT_TSV = Path(r"C:\Users\patri\Shalom\app\logs\breslev-videos.tsv")
OUT_DIR = Path(r"C:\Users\patri\Shalom\KB\transcripts\breslev")
OUT_DIR.mkdir(parents=True, exist_ok=True)

PREFERRED_LANGS = ["fr", "fr-FR", "he", "iw", "en", "en-US"]
DELAY_SEC = 1.0


class IpBannedAbort(Exception):
    """Raised when we detect a persistent IP ban so the caller can stop gracefully."""


def fetch_one(video_id: str) -> tuple[str, str] | None:
    """Return (lang, text) or None if no transcript. Raises IpBannedAbort on IP block."""
    api = YouTubeTranscriptApi()
    try:
        tlist = api.list(video_id)
    except (TranscriptsDisabled, VideoUnavailable):
        return None
    except (IpBlocked, RequestBlocked) as e:
        raise IpBannedAbort(str(e)) from e
    except Exception as e:  # noqa: BLE001
        print(f"  list error: {e}", file=sys.stderr)
        return None

    def try_fetch(tr) -> tuple[str, str]:
        try:
            return tr.language_code, _join(tr.fetch())
        except (IpBlocked, RequestBlocked) as e:
            raise IpBannedAbort(str(e)) from e

    for lang in PREFERRED_LANGS:
        try:
            tr = tlist.find_manually_created_transcript([lang])
            return try_fetch(tr)
        except NoTranscriptFound:
            pass
    for lang in PREFERRED_LANGS:
        try:
            tr = tlist.find_generated_transcript([lang])
            return try_fetch(tr)
        except NoTranscriptFound:
            pass
    try:
        tr = next(iter(tlist))
        return try_fetch(tr)
    except IpBannedAbort:
        raise
    except Exception:
        return None


def _join(entries) -> str:
    parts = []
    for e in entries:
        text = getattr(e, "text", None) or (e.get("text") if isinstance(e, dict) else "")
        if text:
            parts.append(text.replace("\n", " ").strip())
    return " ".join(parts)


def out_path_for(post_id: str, video_id: str) -> Path:
    safe_post = str(post_id).rjust(7, "0")
    return OUT_DIR / f"{safe_post}_{video_id}.txt"


def main() -> int:
    if not INPUT_TSV.exists():
        print(f"missing {INPUT_TSV}", file=sys.stderr)
        return 1

    rows: list[dict] = []
    with INPUT_TSV.open(encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        rows = list(reader)
    print(f"Total videos to consider: {len(rows)}")

    ok = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    ip_block_streak = 0
    for i, row in enumerate(rows, 1):
        vid = row["video_id"]
        post_id = row["post_id"]
        title = row["title"]
        out = out_path_for(post_id, vid)
        if out.exists():
            skipped += 1
            if i % 50 == 0:
                print(f"  [{i}/{len(rows)}] skip {vid} (already on disk)")
            continue
        try:
            result = fetch_one(vid)
            ip_block_streak = 0
        except IpBannedAbort as e:
            ip_block_streak += 1
            wait = min(300, 30 * ip_block_streak)
            print(
                f"  [{i}/{len(rows)}] IP_BLOCKED on {vid} — sleeping {wait}s (streak={ip_block_streak})",
                file=sys.stderr,
            )
            time.sleep(wait)
            if ip_block_streak >= 3:
                print(
                    f"\n  Aborting after {ip_block_streak} consecutive IP blocks. "
                    f"Wait for cool-down or change IP and re-run (resumable).",
                    file=sys.stderr,
                )
                break
            continue
        if result is None:
            failed.append((vid, title))
            print(f"  [{i}/{len(rows)}] FAIL {vid}  {title[:60]}", file=sys.stderr)
        else:
            lang, text = result
            header = (
                f"Titre: {title}\n"
                f"URL: https://www.youtube.com/watch?v={vid}\n"
                f"Post WP: {row['post_id']}  Slug: {row['slug']}\n"
                f"Catégories: {row['categories']}\n"
                f"Date: {row['date']}\n"
                f"Langue du transcript: {lang}\n"
                f"Source: YouTube auto/manual captions via youtube-transcript-api\n"
                f"---\n\n"
            )
            out.write_text(header + text + "\n", encoding="utf-8")
            ok += 1
            chars = len(text)
            print(f"  [{i}/{len(rows)}] OK {vid} ({lang}, {chars:,} chars) {title[:50]}")
        time.sleep(DELAY_SEC)

    print(f"\nDone. ok={ok} skipped={skipped} failed={len(failed)} total={len(rows)}")
    if failed:
        fail_path = OUT_DIR.parent / "breslev-failed.txt"
        fail_path.write_text(
            "\n".join(f"{vid}\t{title}" for vid, title in failed), encoding="utf-8"
        )
        print(f"Failed list -> {fail_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
