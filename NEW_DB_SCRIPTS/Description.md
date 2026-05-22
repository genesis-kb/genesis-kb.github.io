# Database Schema Migration & Optimization

This gist contains the scripts required to upgrade our database from the old YouTube-centric schema to the new platform-agnostic, multi-source architecture (9 tables). It also includes the optimized indexing script designed for high-performance downstream searching and filtering.

### Required Files (Included)
1. `app/models.py`: Contains the updated SQLAlchemy ORM models, complete with table arguments for optimized B-Tree and partial indexes.
2. `scripts/migrate_schema.py`: The ETL migration script.
3. `scripts/add_indexes.py`: The raw SQL indexing script for Full-Text Search (GIN) and downstream application querying.

### Instructions for Production Deployment

**Step 1: Dry Run**
To verify the generated SQL and ensure no immediate crashes occur without touching data:
```bash
python scripts/migrate_schema.py --dry-run
```

**Step 2: Execute Migration**
Run the migration script. This script runs inside a single database transaction. It gracefully renames the old tables (e.g., `youtube_videos` -> `old_youtube_videos`), runs `Base.metadata.create_all` to build the new tables, performs the data migration mapping, and then CASCADE drops the old tables.
```bash
python scripts/migrate_schema.py
```

**Step 3: Apply Downstream Indexes**
To ensure the downstream frontend application can rapidly filter content (by `summary_type`, `event_id`, etc.) and perform Full-Text Searches across transcripts and titles, execute the indexing script:
```bash
python scripts/add_indexes.py
```

### Key Optimizations Applied:
* **Transcript Versioning Safety**: Added a unique partial index on `transcripts(content_item_id) WHERE is_current = true`.
* **FTS Performance**: Added a partial `GIN` index on transcripts `WHERE is_current = true` to prevent indexing stale historical transcript versions.
* **Filter Speed**: Added standard B-Tree indexes on `summaries.summary_type`, `content_items.event_id`, and `content_sources.source_type`.