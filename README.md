# Coffee DB

Small local SQLite database of coffee-making recipes and tips pulled from public Instagram feeds.

## What is stored

- Source creator and profile URL
- Post URL and shortcode
- Post timestamp
- Caption text as the full transcript
- Simple category tags for filtering
- Basic engagement stats

## Files

- `build.py` - rebuilds the database from `seed.json`
- `seed.json` - curated source records with full captions/transcripts
- `coffee_recipes.sqlite` - SQLite database
- `recipes.json` - JSON export of the same records

## Rebuild

```bash
python3 coffee-db/build.py
```

## Query

```bash
sqlite3 coffee-db/coffee_recipes.sqlite "select handle, posted_at, category, substr(transcript, 1, 120) from entries order by posted_at desc;"
```

## Notes

- The `transcript` field is the full Instagram caption text captured from the source post.
- Every row keeps a `source_url` and `profile_url` so you can trace the record back to the creator.
- For video posts, the caption is stored as the transcript unless a separate audio transcription is added later.
