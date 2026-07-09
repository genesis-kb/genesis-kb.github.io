import os
import sys
import re
import json
import logging
import argparse
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Add project root to path so we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from NEW_DB_SCRIPTS.models import Base

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def _get_engine():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return None
    return create_engine(database_url)

def slugify(text_val: str) -> str:
    text_val = text_val.lower().strip()
    text_val = re.sub(r"[^\w\s-]", "", text_val)
    text_val = re.sub(r"[-\s]+", "-", text_val)
    return text_val.strip("-") or "unknown"

def run_migration(dry_run=False):
    engine = _get_engine()
    if not engine:
        logger.error("Could not get database engine. Check DATABASE_URL.")
        return

    logger.info("Starting schema migration...")
    
    with engine.connect() as conn:
        with conn.begin():
            # 1. Check if old tables exist
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'youtube_channels'
                );
            """)).scalar()
            
            if not result:
                logger.info("Old tables not found (or already migrated).")
                if not dry_run:
                    logger.info("Running Base.metadata.create_all to ensure tables exist...")
                    Base.metadata.create_all(conn)
                    conn.execute(text("ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;"))
                    conn.execute(text("DROP POLICY IF EXISTS \"Transcripts are viewable by everyone.\" ON transcripts;"))
                    conn.execute(text("""
                        CREATE POLICY "Transcripts are viewable by everyone." 
                        ON transcripts FOR SELECT USING (true);
                    """))
                return

            # 2. Rename old tables to prevent conflicts with new models
            logger.info("Renaming old tables...")
            rename_sqls = [
                "ALTER TABLE IF EXISTS youtube_channels RENAME TO old_youtube_channels;",
                "ALTER TABLE IF EXISTS youtube_videos RENAME TO old_youtube_videos;",
                "ALTER TABLE IF EXISTS transcripts RENAME TO old_transcripts;",
                "ALTER TABLE IF EXISTS ingestion_runs RENAME TO old_ingestion_runs;",
                "ALTER TABLE IF EXISTS yt_comments RENAME TO old_yt_comments;"
            ]
            for sql in rename_sqls:
                if not dry_run:
                    conn.execute(text(sql))
                else:
                    logger.info(f"DRY RUN: {sql}")

            # 3. Create new schema tables
            if not dry_run:
                logger.info("Creating new tables...")
                Base.metadata.create_all(conn)
                conn.execute(text("ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;"))
                conn.execute(text("DROP POLICY IF EXISTS \"Transcripts are viewable by everyone.\" ON transcripts;"))
                conn.execute(text("""
                    CREATE POLICY "Transcripts are viewable by everyone." 
                    ON transcripts FOR SELECT USING (true);
                """))
            else:
                logger.info("DRY RUN: Base.metadata.create_all(conn)")

            # 4. Migrate Data
            logger.info("Migrating data from old_youtube_channels -> content_sources...")
            migrate_sources_sql = """
                INSERT INTO content_sources (id, name, slug, source_type, base_url, config, is_active, last_run_status, created_at)
                SELECT 
                    id, 
                    channel_name, 
                    LOWER(REGEXP_REPLACE(channel_name, '[^a-zA-Z0-9]+', '-', 'g')), 
                    'youtube', 
                    channel_url, 
                    jsonb_build_object('yt_channel_id', channel_id, 'category', category, 'priority', priority), 
                    is_active, 
                    NULL, 
                    created_at
                FROM old_youtube_channels;
            """
            if not dry_run:
                res = conn.execute(text(migrate_sources_sql))
                logger.info(f"Migrated {res.rowcount} sources.")
            else:
                logger.info(f"DRY RUN: {migrate_sources_sql}")

            logger.info("Migrating data from old_youtube_videos -> content_items...")
            migrate_items_sql = """
                INSERT INTO content_items (id, source_id, external_id, title, description, content_type, url, published_at, event_date, status, technical_score, source_metadata, discovered_at)
                SELECT 
                    id, 
                    channel_id, 
                    video_id, 
                    title, 
                    description, 
                    'video', 
                    'https://www.youtube.com/watch?v=' || video_id, 
                    published_at, 
                    NULL, 
                    status, 
                    CASE WHEN is_technical THEN 5 ELSE 1 END, 
                    jsonb_build_object(
                        'duration', duration, 
                        'tags', tags, 
                        'thumbnail_url', thumbnail_url, 
                        'view_count', view_count,
                        'classification_reason', classification_reason,
                        'classification_confidence', classification_confidence
                    ), 
                    discovered_at
                FROM old_youtube_videos;
            """
            if not dry_run:
                res = conn.execute(text(migrate_items_sql))
                logger.info(f"Migrated {res.rowcount} items.")
            else:
                logger.info(f"DRY RUN: {migrate_items_sql}")

            logger.info("Migrating data from old_transcripts...")
            
            if not dry_run:
                manual_source_id = conn.execute(text("""
                    INSERT INTO content_sources (name, slug, source_type, is_active)
                    VALUES ('Manual Imports', 'manual-imports', 'manual', true)
                    RETURNING id;
                """)).scalar()

                transcripts = conn.execution_options(stream_results=True).execute(text("SELECT * FROM old_transcripts"))
                logger.info("Processing old transcripts incrementally...")
                
                migrated_transcripts_count = 0
                for t in transcripts:
                    if migrated_transcripts_count > 0 and migrated_transcripts_count % 1000 == 0:
                        logger.info(f"Processed {migrated_transcripts_count} transcripts so far...")
                    t_id = t.id
                    raw = t.raw_text
                    corrected = t.corrected_text
                    summary = t.summary
                    media_url = t.media_url or ''
                    
                    video_id = None
                    if "v=" in media_url:
                        video_id = media_url.split("v=")[-1].split("&")[0]
                    elif "youtu.be/" in media_url:
                        video_id = media_url.split("youtu.be/")[-1].split("?")[0]
                    
                    content_item_id = None
                    if video_id:
                        row = conn.execute(text("SELECT id FROM content_items WHERE external_id = :vid"), {"vid": video_id}).first()
                        if row:
                            content_item_id = row[0]
                    
                    if not content_item_id:
                        ext_id = video_id if video_id else f"manual-{t_id}"
                        source_meta = {
                            "loc": getattr(t, 'loc', None),
                            "tags": getattr(t, 'tags', None),
                            "categories": getattr(t, 'categories', None)
                        }
                        source_meta = {k: v for k, v in source_meta.items() if v is not None}
                        row = conn.execute(text("""
                            INSERT INTO content_items (
                                source_id, external_id, title, content_type, url, 
                                status, event_date, source_metadata
                            )
                            VALUES (
                                :s_id, :ext_id, :title, 'video', :url, 
                                :status, :event_date, :source_meta
                            )
                            ON CONFLICT (source_id, external_id) DO UPDATE SET 
                                title = EXCLUDED.title,
                                event_date = COALESCE(content_items.event_date, EXCLUDED.event_date),
                                source_metadata = COALESCE(content_items.source_metadata, '{}'::jsonb) || EXCLUDED.source_metadata,
                                status = EXCLUDED.status
                            RETURNING id;
                        """), {
                            "s_id": manual_source_id, 
                            "ext_id": ext_id, 
                            "title": t.title or 'Unknown', 
                            "url": t.media_url,
                            "status": getattr(t, 'status', 'transcribed'),
                            "event_date": getattr(t, 'event_date', None),
                            "source_meta": json.dumps(source_meta)
                        }).first()
                        content_item_id = row[0]
                    else:
                        source_meta = {
                            "loc": getattr(t, 'loc', None),
                            "tags": getattr(t, 'tags', None),
                            "categories": getattr(t, 'categories', None)
                        }
                        source_meta = {k: v for k, v in source_meta.items() if v is not None}
                        conn.execute(text("""
                            UPDATE content_items 
                            SET 
                                event_date = COALESCE(event_date, :event_date),
                                source_metadata = COALESCE(source_metadata, '{}'::jsonb) || :source_meta::jsonb,
                                status = CASE WHEN status IS NULL OR status = 'pending' THEN :status ELSE status END
                            WHERE id = :ci_id;
                        """), {
                            "event_date": getattr(t, 'event_date', None),
                            "source_meta": json.dumps(source_meta),
                            "status": getattr(t, 'status', 'transcribed'),
                            "ci_id": content_item_id
                        })

                    conn.execute(text("""
                        INSERT INTO transcripts (id, content_item_id, is_current, version, raw_text, corrected_text, created_at)
                        VALUES (:t_id, :ci_id, true, 1, :raw, :corr, :created_at)
                    """), {"t_id": t_id, "ci_id": content_item_id, "raw": raw, "corr": corrected, "created_at": t.created_at})
                    migrated_transcripts_count += 1
                    
                    if summary:
                        conn.execute(text("""
                            INSERT INTO summaries (transcript_id, summary_type, content, created_at)
                            VALUES (:t_id, 'tldr', :summ, :created_at)
                        """), {"t_id": t_id, "summ": summary, "created_at": t.created_at})
                    
                    if t.speakers:
                        speakers_list = [s.strip() for s in t.speakers.split(',')] if isinstance(t.speakers, str) else t.speakers
                        for spk in speakers_list:
                            if not spk: continue
                            spk_slug = slugify(spk)
                            spk_row = conn.execute(text("SELECT id FROM speakers WHERE slug = :slug"), {"slug": spk_slug}).first()
                            if not spk_row:
                                spk_row = conn.execute(text("""
                                    INSERT INTO speakers (name, slug) VALUES (:name, :slug) RETURNING id
                                """), {"name": spk, "slug": spk_slug}).first()
                            
                            spk_id = spk_row[0]
                            conn.execute(text("""
                                INSERT INTO content_item_speakers (content_item_id, speaker_id, role)
                                VALUES (:ci_id, :spk_id, 'speaker')
                                ON CONFLICT DO NOTHING;
                            """), {"ci_id": content_item_id, "spk_id": spk_id})
                            
                logger.info(f"Migrated {migrated_transcripts_count} transcripts, summaries and speakers.")
            else:
                logger.info("DRY RUN: skipping transcripts, summaries, speakers python logic.")

            logger.info("Migrating data from old_ingestion_runs -> pipeline_runs...")
            migrate_runs_sql = """
                INSERT INTO pipeline_runs (id, source_id, started_at, completed_at, status)
                SELECT 
                    id, 
                    channel_id, 
                    started_at, 
                    completed_at, 
                    CASE WHEN errors IS NOT NULL AND jsonb_array_length(errors) > 0 THEN 'failed' ELSE 'success' END
                FROM old_ingestion_runs;
            """
            if not dry_run:
                res = conn.execute(text(migrate_runs_sql))
                logger.info(f"Migrated {res.rowcount} pipeline runs.")
            else:
                logger.info(f"DRY RUN: {migrate_runs_sql}")

            logger.info("Migrating data from old_yt_comments -> external_publications...")
            has_yt_comments = conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'old_yt_comments')")).scalar()
            if has_yt_comments:
                migrate_comments_sql = """
                    INSERT INTO external_publications (id, content_item_id, platform, external_pub_id, status, published_at)
                    SELECT 
                        yc.id,
                        ci.id,
                        'youtube',
                        yc.comment_id,
                        yc.status,
                        yc.posted_at
                    FROM old_yt_comments yc
                    JOIN content_items ci ON ci.external_id = yc.video_id;
                """
                if not dry_run:
                    res = conn.execute(text(migrate_comments_sql))
                    logger.info(f"Migrated {res.rowcount} external publications.")
                else:
                    logger.info(f"DRY RUN: {migrate_comments_sql}")
            else:
                logger.info("Table old_yt_comments does not exist, skipping.")

            # 5. Drop old tables
            logger.info("Dropping old tables...")
            drop_sqls = [
                "DROP TABLE IF EXISTS old_yt_comments CASCADE;",
                "DROP TABLE IF EXISTS old_ingestion_runs CASCADE;",
                "DROP TABLE IF EXISTS old_transcripts CASCADE;",
                "DROP TABLE IF EXISTS old_youtube_videos CASCADE;",
                "DROP TABLE IF EXISTS old_youtube_channels CASCADE;"
            ]
            for sql in drop_sqls:
                if not dry_run:
                    conn.execute(text(sql))
                else:
                    logger.info(f"DRY RUN: {sql}")

    logger.info("Migration complete!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print SQL operations without executing")
    args = parser.parse_args()
    
    try:
        run_migration(dry_run=args.dry_run)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
