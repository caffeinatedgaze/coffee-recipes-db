#!/usr/bin/env python3
"""Build the coffee library as plain-text exports."""

from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path
from textwrap import wrap


ROOT = Path(__file__).resolve().parent
SEED_PATH = ROOT / "seed.json"
JSON_PATH = ROOT / "recipes.json"
MD_PATH = ROOT / "recipes.md"
TXT_PATH = ROOT / "recipes.txt"


def load_seed() -> list[dict]:
    with SEED_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("seed.json must contain a JSON array")
    return data


def normalize(seed: list[dict]) -> list[dict]:
    rows = []
    for row in seed:
        source = row["source"]
        post = row["post"]
        rows.append(
            {
                "entry_id": row["entry_id"],
                "source": {
                    "handle": source["handle"],
                    "display_name": source["display_name"],
                    "profile_url": source["profile_url"],
                    "notes": source.get("notes"),
                },
                "post": {
                    "shortcode": post["shortcode"],
                    "post_url": post["post_url"],
                    "posted_at": post["posted_at"],
                    "media_type": post.get("media_type"),
                    "like_count": post.get("like_count"),
                    "comment_count": post.get("comment_count"),
                },
                "title": row["title"],
                "category": row["category"],
                "summary": row["summary"],
                "transcript_source": row["transcript_source"],
                "transcript": row["transcript"],
                "tags": row["tags"],
            }
        )

    rows.sort(key=lambda item: (item["post"]["posted_at"], item["entry_id"]), reverse=True)
    return rows


def format_block(entry: dict) -> str:
    tags = ", ".join(entry["tags"])
    post = entry["post"]
    source = entry["source"]
    return "\n".join(
        [
            f"#{entry['entry_id']} {entry['title']}",
            f"Source: {source['display_name']} (@{source['handle']})",
            f"Profile: {source['profile_url']}",
            f"Post: {post['post_url']}",
            f"Posted: {post['posted_at']}",
            f"Category: {entry['category']}",
            f"Tags: {tags}",
            f"Summary: {entry['summary']}",
            f"Transcript source: {entry['transcript_source']}",
            "",
            entry["transcript"].rstrip(),
        ]
    )


def build() -> None:
    rows = normalize(load_seed())

    with JSON_PATH.open("w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    md_parts = [
        "# Coffee Library",
        "",
        "Curated coffee-making recipes and tips from public Instagram captions.",
        "",
    ]
    txt_parts = [
        "Coffee Library",
        "==============",
        "",
        "Curated coffee-making recipes and tips from public Instagram captions.",
        "",
    ]
    for entry in rows:
        md_parts.extend(["## " + entry["title"], "", "```text", format_block(entry), "```", ""])
        txt_parts.extend([format_block(entry), "", "-" * 72, ""])

    MD_PATH.write_text("\n".join(md_parts).rstrip() + "\n", encoding="utf-8")
    TXT_PATH.write_text("\n".join(txt_parts).rstrip() + "\n", encoding="utf-8")
    print(f"built {len(rows)} entries")


if __name__ == "__main__":
    build()
