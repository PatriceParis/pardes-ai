"""Fetch YouTube transcripts for the 7 videos referenced in the
Deep Research Gemini PDF. Saves each as a .txt file under KB/transcripts/.

Falls back through preferred languages: French -> English -> any auto/manual.
Skips videos with no transcript available (and logs why).
"""
from __future__ import annotations

from pathlib import Path
from textwrap import shorten

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)

OUT_DIR = Path(r"C:\Users\patri\Shalom\KB\transcripts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# (ref_num, video_id, title)
VIDEOS: list[tuple[int, str, str]] = [
    (17, "5y-82nFxlM0", "The Jewish Roots of Our Faith"),
    (25, "6LL6ZmCHs6E", "What is the Genius and Story of the Jews? (Rabbi Sacks, Simon Schama, David Gregory)"),
    (26, "1lBZTONTa1c", "Rabbi Sacks - Teacher of Torah, Moral Voice, Leader of Leaders"),
    (27, "f9jaETOkxKY", "The Way of Study: Listening to God (Ten Paths to God | Unit 3)"),
    (49, "HSQTfjowlxQ", "Les FONDAMENTAUX du judaïsme — Le Talmud"),
    (50, "39AMunPWZR8", "Les FONDAMENTAUX du Judaïsme — La Littérature rabbinique"),
    (52, "YPy9ejyB5CY", "Torah study through the Generations — Rabbi Jonathan Sacks z'l"),
]

PREFERRED_LANGS = ["fr", "fr-FR", "en", "en-US", "en-GB"]


def fetch_one(video_id: str) -> tuple[str, str] | None:
    """Return (lang_used, joined_text) or None if unavailable."""
    api = YouTubeTranscriptApi()
    try:
        transcript_list = api.list(video_id)
    except (TranscriptsDisabled, VideoUnavailable) as e:
        print(f"  unavailable: {e.__class__.__name__}")
        return None
    except Exception as e:  # noqa: BLE001
        print(f"  list failed: {e}")
        return None

    # Try preferred languages, manual then auto
    for lang in PREFERRED_LANGS:
        try:
            tr = transcript_list.find_manually_created_transcript([lang])
            entries = tr.fetch()
            return tr.language_code, _join(entries)
        except NoTranscriptFound:
            pass
    for lang in PREFERRED_LANGS:
        try:
            tr = transcript_list.find_generated_transcript([lang])
            entries = tr.fetch()
            return tr.language_code, _join(entries)
        except NoTranscriptFound:
            pass
    # Last resort: any available transcript
    try:
        tr = next(iter(transcript_list))
        entries = tr.fetch()
        return tr.language_code, _join(entries)
    except Exception as e:  # noqa: BLE001
        print(f"  no transcript at all: {e}")
        return None


def _join(entries) -> str:
    parts = []
    for e in entries:
        text = getattr(e, "text", None) or (e.get("text") if isinstance(e, dict) else "")
        if text:
            parts.append(text.replace("\n", " ").strip())
    return " ".join(parts)


def write_file(ref_num: int, video_id: str, title: str, lang: str, text: str) -> Path:
    out = OUT_DIR / f"{ref_num:02d}_{video_id}.txt"
    header = (
        f"Titre: {title}\n"
        f"URL: https://www.youtube.com/watch?v={video_id}\n"
        f"Référence Deep Research: [{ref_num}]\n"
        f"Langue du transcript: {lang}\n"
        f"Source: YouTube auto/manual captions via youtube-transcript-api\n"
        f"---\n\n"
    )
    out.write_text(header + text + "\n", encoding="utf-8")
    return out


def main() -> int:
    print(f"Output directory: {OUT_DIR}\n")
    ok = 0
    failed: list[tuple[int, str, str]] = []
    for ref_num, vid, title in VIDEOS:
        print(f"[{ref_num}] {title}")
        print(f"     id={vid}")
        result = fetch_one(vid)
        if result is None:
            failed.append((ref_num, vid, title))
            continue
        lang, text = result
        path = write_file(ref_num, vid, title, lang, text)
        snippet = shorten(text, width=120, placeholder="…")
        print(f"  ok  ({lang}, {len(text):,} chars) -> {path.name}")
        print(f"  {snippet}")
        ok += 1
    print(f"\nDone. ok={ok} failed={len(failed)}")
    if failed:
        print("Failed:")
        for ref_num, vid, title in failed:
            print(f"  [{ref_num}] {vid}  {title}")
    return 0 if ok > 0 else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
