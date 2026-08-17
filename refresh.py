#!/usr/bin/env python3
"""Refresh the coffee library from the current public Instagram feeds."""

from __future__ import annotations

import json
import ssl
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parent
SEED_PATH = ROOT / "seed.json"
BUILD_PATH = ROOT / "build.py"
SESSION_EMAIL = "lyamets.misha@gmail.com"
INSTAGRAM_API_PATH = (
    "/Users/mikhailliamets/.nvm/versions/node/v24.14.0/lib/node_modules/"
    "@i7m/instagram-cli/node_modules/instagram-private-api"
)
SESSION_PATH = Path("/Users/mikhailliamets/.instagram-cli/users/lyamets.misha@gmail.com/session.ts.json")

HANDLE_RULES = {
    "tilt.45": ["ーーー今回の抽出レシピーーー", "Here is how I brew it", "抽出レシピー"],
    "itsjustcoffeepodcast": ["COFFEE TASTING BASICS", "filter paper", "Brewers Cup", "World Barista", "perfect espresso"],
    "specialtycoffeeassociation": ["Certified Home Brewers", "home brewers", "brewer", "brew"],
    "brickandmortarcoffee": ["Americano", "AIROCANO", "crema"],
    "bettr.academy": ["Anaerobic coffee", "fermentation", "workshop"],
    "first.crack.coffee": ["coffee class", "cupping", "technique", "sensory"],
}


@dataclass(frozen=True)
class FeedItem:
    handle: str
    shortcode: str
    caption: str
    media_type: int | None
    like_count: int | None
    comment_count: int | None
    taken_at: int | None
    full_name: str | None = None

    @property
    def key(self) -> str:
        return f"{self.handle}:{self.shortcode}"


def load_seed() -> list[dict[str, Any]]:
    if not SEED_PATH.exists():
        return []
    with SEED_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("seed.json must contain a JSON array")
    return data


def save_seed(seed: list[dict[str, Any]]) -> None:
    with SEED_PATH.open("w", encoding="utf-8") as fh:
        json.dump(seed, fh, ensure_ascii=False, indent=2)
        fh.write("\n")


def is_relevant(handle: str, caption: str) -> bool:
    text = caption.lower()
    rules = HANDLE_RULES.get(handle, [])
    if any(rule.lower() in text for rule in rules):
        return True
    if handle == "tilt.45" and "ーーー今回の抽出レシピーーー" in caption:
        return True
    return False


def infer_title(caption: str, handle: str) -> str:
    for line in (line.strip() for line in caption.splitlines()):
        if line:
            return line[:120]
    return handle


def infer_category(handle: str, caption: str) -> str:
    lower = caption.lower()
    if handle == "tilt.45":
        return "filter_recipe"
    if "taste" in lower or "flavor wheel" in lower or "bitterness" in lower:
        return "tasting"
    if "americano" in lower or "crema" in lower or "airocano" in lower:
        return "drink_tip"
    if "home brewers" in lower or "brew" in lower:
        return "gear"
    if "fermentation" in lower or "anaerobic" in lower or "workshop" in lower:
        return "education"
    return "coffee_note"


def infer_summary(handle: str, caption: str) -> str:
    lines = [line.strip() for line in caption.splitlines() if line.strip()]
    if not lines:
        return handle
    if handle == "tilt.45":
        for line in lines[1:]:
            if "粉量" in line or "Here is how I brew it" in line:
                return line
    return " ".join(lines[1:3])[:240] if len(lines) > 1 else lines[0][:240]


def infer_tags(handle: str, caption: str) -> list[str]:
    lower = caption.lower()
    tags = ["instagram"]
    if handle == "tilt.45":
        tags += ["filter", "pour-over"]
    if "filter" in lower or "drip" in lower or "brew" in lower:
        tags.append("brew")
    if "switch" in lower:
        tags.append("switch")
    if "americano" in lower:
        tags.append("americano")
    if "tasting" in lower or "flavor wheel" in lower:
        tags.append("tasting")
    if "fermentation" in lower or "anaerobic" in lower:
        tags.append("fermentation")
    return sorted(set(tags))


def translate_to_english(text: str) -> str:
    url = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl=auto&tl=en&dt=t&q={quote(text)}"
    )
    try:
        payload = urlopen(url, timeout=30).read().decode("utf-8")
    except Exception:
        # Fall back when the local Python trust store is incomplete.
        payload = urlopen(url, timeout=30, context=ssl._create_unverified_context()).read().decode("utf-8")
    data = json.loads(payload)
    return "".join(piece[0] for piece in data[0] if piece and piece[0])


def ensure_translation_fields(seed: list[dict[str, Any]]) -> bool:
    changed = False
    for row in seed:
        original = row.get("transcript_original") or row.get("transcript", "")
        if row.get("transcript_original") != original:
            row["transcript_original"] = original
            changed = True
        if not row.get("transcript_en"):
            row["transcript_en"] = translate_to_english(original)
            changed = True
    return changed


def fetch_feed_items(handles: list[str]) -> list[FeedItem]:
    js = f"""
const fs = require('fs');
const {{IgApiClient}} = require('{INSTAGRAM_API_PATH}');
const session = JSON.parse(fs.readFileSync('{SESSION_PATH}', 'utf8'));
const ig = new IgApiClient();
ig.state.generateDevice('{SESSION_EMAIL}');
(async () => {{
  await ig.state.deserialize(session);
  const handles = {json.dumps(handles)};
  const out = [];
  for (const handle of handles) {{
    try {{
      const user = await ig.user.searchExact(handle);
      const feed = ig.feed.user(user.pk);
      const items = await feed.items();
      for (const item of items.slice(0, 12)) {{
        out.push({{
          handle,
          shortcode: item.code,
          caption: item.caption?.text || '',
          media_type: item.media_type ?? null,
          like_count: item.like_count ?? null,
          comment_count: item.comment_count ?? null,
          taken_at: item.taken_at ?? null,
          full_name: user.full_name ?? null
        }});
      }}
    }} catch (err) {{
      out.push({{handle, error: String(err)}});
    }}
  }}
  process.stdout.write(JSON.stringify(out));
}})().catch(err => {{
  console.error(err.stack || String(err));
  process.exit(1);
}});
"""
    proc = subprocess.run(
        ["node", "-e", js],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    raw = json.loads(proc.stdout)
    items: list[FeedItem] = []
    for row in raw:
        if "error" in row:
            continue
        items.append(
            FeedItem(
                handle=row["handle"],
                shortcode=row["shortcode"],
                caption=row["caption"],
                media_type=row["media_type"],
                like_count=row["like_count"],
                comment_count=row["comment_count"],
                taken_at=row["taken_at"],
                full_name=row.get("full_name"),
            )
        )
    return items


def build_entry(handle: str, shortcode: str, caption: str, media_type: int | None, like_count: int | None, comment_count: int | None, taken_at: int | None) -> dict[str, Any]:
    ts = "1970-01-01T00:00:00.000Z"
    if taken_at:
        from datetime import datetime, timezone

        ts = datetime.fromtimestamp(taken_at, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "source": {
            "handle": handle,
            "display_name": handle,
            "profile_url": f"https://www.instagram.com/{handle}/",
            "notes": "Public Instagram feed captured via instagram-cli.",
        },
        "post": {
            "shortcode": shortcode,
            "post_url": f"https://www.instagram.com/p/{shortcode}/",
            "posted_at": ts,
            "media_type": media_type,
            "like_count": like_count,
            "comment_count": comment_count,
        },
        "title": infer_title(caption, handle),
        "category": infer_category(handle, caption),
        "summary": infer_summary(handle, caption),
        "transcript_source": "Instagram caption",
        "transcript_original": caption,
        "transcript_en": translate_to_english(caption),
        "tags": infer_tags(handle, caption),
    }


def main() -> None:
    seed = load_seed()
    seed_changed = ensure_translation_fields(seed)
    existing = {f"{row['source']['handle']}:{row['post']['shortcode']}": row for row in seed}
    handles = sorted({row["source"]["handle"] for row in seed})
    fetched = fetch_feed_items(handles)

    added = 0
    for item in fetched:
        if not item.caption or not is_relevant(item.handle, item.caption):
            continue
        if item.key in existing:
            continue
        seed.append(
            build_entry(
                item.handle,
                item.shortcode,
                item.caption,
                item.media_type,
                item.like_count,
                item.comment_count,
                item.taken_at,
            )
        )
        added += 1

    if added or seed_changed:
        seed.sort(key=lambda row: row["post"]["posted_at"], reverse=True)
        for idx, row in enumerate(seed, start=1):
            row["entry_id"] = idx
        save_seed(seed)

    subprocess.run(["python3", str(BUILD_PATH)], cwd=ROOT, check=True)
    print(f"refresh complete; added={added}; translated={'yes' if seed_changed or added else 'no changes'}")


if __name__ == "__main__":
    main()
