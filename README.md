# Coffee DB

Small local text-file library of coffee-making recipes and tips pulled from public Instagram feeds.

## What is stored

- Source creator and profile URL
- Post URL and shortcode
- Post timestamp
- Caption text as the full transcript
- Simple category tags for filtering
- Basic engagement stats

## Files

- `build.py` - rebuilds the text exports from `seed.json`
- `seed.json` - curated source records with full captions/transcripts
- `recipes.json` - structured JSON export
- `recipes.md` - human-readable catalog
- `recipes.txt` - plain-text catalog

## Rebuild

```bash
python3 coffee-db/build.py
```

## Query

Use `jq`, `rg`, or plain text search against the exported files.

```bash
jq '.[].source.handle' coffee-db/recipes.json
```

## Notes

- The `transcript` field is the full Instagram caption text captured from the source post.
- Every row keeps a `source_url` and `profile_url` so you can trace the record back to the creator.
- For video posts, the caption is stored as the transcript unless a separate audio transcription is added later.
