#!/usr/bin/env python3
"""Build a small local coffee recipe database from curated Instagram captures."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SEED_PATH = ROOT / "seed.json"
DB_PATH = ROOT / "coffee_recipes.sqlite"
JSON_PATH = ROOT / "recipes.json"


def load_seed() -> list[dict]:
    with SEED_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("seed.json must contain a JSON array")
    return data


def build() -> None:
    seed = load_seed()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.executescript(
        """
        PRAGMA foreign_keys = ON;

        DROP TABLE IF EXISTS entries;
        DROP TABLE IF EXISTS sources;

        CREATE TABLE sources (
            source_id INTEGER PRIMARY KEY AUTOINCREMENT,
            handle TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            profile_url TEXT NOT NULL,
            notes TEXT
        );

        CREATE TABLE entries (
            entry_id INTEGER PRIMARY KEY,
            source_id INTEGER NOT NULL REFERENCES sources(source_id),
            shortcode TEXT NOT NULL UNIQUE,
            post_url TEXT NOT NULL,
            posted_at TEXT NOT NULL,
            media_type INTEGER,
            like_count INTEGER,
            comment_count INTEGER,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            summary TEXT NOT NULL,
            transcript_source TEXT NOT NULL,
            transcript TEXT NOT NULL,
            tags_json TEXT NOT NULL
        );

        CREATE INDEX idx_entries_posted_at ON entries(posted_at);
        CREATE INDEX idx_entries_category ON entries(category);
        """
    )

    source_ids: dict[str, int] = {}
    for row in seed:
        source = row["source"]
        handle = source["handle"]
        if handle not in source_ids:
            cur.execute(
                """
                INSERT INTO sources (handle, display_name, profile_url, notes)
                VALUES (?, ?, ?, ?)
                """,
                (
                    handle,
                    source["display_name"],
                    source["profile_url"],
                    source.get("notes"),
                ),
            )
            source_ids[handle] = cur.lastrowid

    for row in seed:
        post = row["post"]
        source_id = source_ids[row["source"]["handle"]]
        cur.execute(
            """
            INSERT INTO entries (
                entry_id, source_id, shortcode, post_url, posted_at,
                media_type, like_count, comment_count,
                title, category, summary, transcript_source, transcript, tags_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["entry_id"],
                source_id,
                post["shortcode"],
                post["post_url"],
                post["posted_at"],
                post.get("media_type"),
                post.get("like_count"),
                post.get("comment_count"),
                row["title"],
                row["category"],
                row["summary"],
                row["transcript_source"],
                row["transcript"],
                json.dumps(row["tags"], ensure_ascii=False),
            ),
        )

    conn.commit()

    rows = cur.execute(
        """
        SELECT
            e.entry_id,
            s.handle,
            s.display_name,
            s.profile_url,
            s.notes,
            e.shortcode,
            e.post_url,
            e.posted_at,
            e.media_type,
            e.like_count,
            e.comment_count,
            e.title,
            e.category,
            e.summary,
            e.transcript_source,
            e.transcript,
            e.tags_json
        FROM entries e
        JOIN sources s ON s.source_id = e.source_id
        ORDER BY e.posted_at DESC, e.entry_id ASC
        """
    ).fetchall()

    export = []
    for row in rows:
        export.append(
            {
                "entry_id": row["entry_id"],
                "source": {
                    "handle": row["handle"],
                    "display_name": row["display_name"],
                    "profile_url": row["profile_url"],
                    "notes": row["notes"],
                },
                "post": {
                    "shortcode": row["shortcode"],
                    "post_url": row["post_url"],
                    "posted_at": row["posted_at"],
                    "media_type": row["media_type"],
                    "like_count": row["like_count"],
                    "comment_count": row["comment_count"],
                },
                "title": row["title"],
                "category": row["category"],
                "summary": row["summary"],
                "transcript_source": row["transcript_source"],
                "transcript": row["transcript"],
                "tags": json.loads(row["tags_json"]),
            }
        )

    with JSON_PATH.open("w", encoding="utf-8") as fh:
        json.dump(export, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    conn.close()
    print(f"built {len(export)} entries")


if __name__ == "__main__":
    build()
