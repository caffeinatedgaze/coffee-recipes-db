# Coffee DB

Small local text-file library of coffee-making recipes and tips pulled from public Instagram feeds.

## Search UI

The repo also includes a static GitHub Pages-ready search UI:

- `index.html` - browser UI
- `styles.css` - visual design
- `app.js` - search, filters, and rendering

It reads `recipes.json` directly, so there is no build step.

## What is stored

- Source creator and profile URL
- Post URL and shortcode
- Post timestamp
- Caption text as the full original transcript
- English translation for non-English captions
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

- `transcript_original` keeps the full Instagram caption text captured from the source post.
- `transcript_en` keeps the English translation of that caption.
- Every row keeps a `source_url` and `profile_url` so you can trace the record back to the creator.
- For video posts, the caption is stored as the transcript unless a separate audio transcription is added later.
