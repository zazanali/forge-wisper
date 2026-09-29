use chrono::Utc;
use directories::ProjectDirs;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs::create_dir_all;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum RetentionPolicy {
    Forever,
    #[default]
    Days30,
    Days7,
    Off,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HistoryRecord {
    pub id: String,
    pub created_at: String,
    pub app_name: Option<String>,
    pub provider_id: String,
    pub model_name: String,
    pub raw_text: String,
    pub final_text: String,
    pub duration_ms: u64,
    pub verification_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct HistoryStats {
    pub total_records: u64,
    pub total_words: u64,
    pub total_duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HistoryPage {
    pub records: Vec<HistoryRecord>,
    pub total_count: u64,
    pub limit: usize,
    pub offset: usize,
    pub has_more: bool,
}

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Database error: {0}")]
    SqliteError(#[from] rusqlite::Error),

    #[error("Storage directory error: {0}")]
    DirectoryError(String),
}

#[derive(Clone)]
pub struct StorageEngine {
    conn: Arc<Mutex<Connection>>,
}

impl StorageEngine {
    pub fn new_in_memory() -> Result<Self, StorageError> {
        let conn = Connection::open_in_memory()?;
        let engine = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        engine.init_schema()?;
        Ok(engine)
    }

    pub fn new_default() -> Result<Self, StorageError> {
        let db_path = Self::get_database_path()?;
        let conn = Connection::open(db_path)?;
        let engine = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        engine.init_schema()?;
        Ok(engine)
    }

    fn get_database_path() -> Result<PathBuf, StorageError> {
        if let Some(proj_dirs) = ProjectDirs::from("com", "forge", "ForgeWisper") {
            let data_dir = proj_dirs.data_dir();
            create_dir_all(data_dir)
                .map_err(|e| StorageError::DirectoryError(e.to_string()))?;
            Ok(data_dir.join("history.db"))
        } else {
            Ok(PathBuf::from("forge_wisper_history.db"))
        }
    }

    fn init_schema(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();

        // Production pragmas for concurrency and performance
        let _ = conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;");

        conn.execute(
            "CREATE TABLE IF NOT EXISTS dictation_history (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                app_name TEXT,
                provider_id TEXT NOT NULL,
                model_name TEXT NOT NULL,
                raw_text TEXT NOT NULL,
                final_text TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                verification_status TEXT NOT NULL
            );",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_history_created_at ON dictation_history (created_at DESC);",
            [],
        )?;

        Ok(())
    }

    pub fn insert_record(&self, record: &HistoryRecord, retention: RetentionPolicy) -> Result<(), StorageError> {
        if retention == RetentionPolicy::Off {
            return Ok(());
        }

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO dictation_history (
                id, created_at, app_name, provider_id, model_name, raw_text, final_text, duration_ms, verification_status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                record.id,
                record.created_at,
                record.app_name,
                record.provider_id,
                record.model_name,
                record.raw_text,
                record.final_text,
                record.duration_ms,
                record.verification_status,
            ],
        )?;

        // Auto prune expired entries based on retention policy
        Self::prune_internal(&conn, retention)?;

        Ok(())
    }

    pub fn list_records(&self, limit: usize, search: Option<&str>) -> Result<Vec<HistoryRecord>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let mut results = Vec::new();

        if let Some(query) = search {
            let pattern = format!("%{}%", query);
            let mut stmt = conn.prepare(
                "SELECT id, created_at, app_name, provider_id, model_name, raw_text, final_text, duration_ms, verification_status
                 FROM dictation_history
                 WHERE raw_text LIKE ?1 OR final_text LIKE ?1
                 ORDER BY created_at DESC
                 LIMIT ?2",
            )?;

            let rows = stmt.query_map(params![pattern, limit as i64], |row| {
                Ok(HistoryRecord {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    app_name: row.get(2)?,
                    provider_id: row.get(3)?,
                    model_name: row.get(4)?,
                    raw_text: row.get(5)?,
                    final_text: row.get(6)?,
                    duration_ms: row.get(7)?,
                    verification_status: row.get(8)?,
                })
            })?;

            for r in rows {
                results.push(r?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, created_at, app_name, provider_id, model_name, raw_text, final_text, duration_ms, verification_status
                 FROM dictation_history
                 ORDER BY created_at DESC
                 LIMIT ?1",
            )?;

            let rows = stmt.query_map(params![limit as i64], |row| {
                Ok(HistoryRecord {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    app_name: row.get(2)?,
                    provider_id: row.get(3)?,
                    model_name: row.get(4)?,
                    raw_text: row.get(5)?,
                    final_text: row.get(6)?,
                    duration_ms: row.get(7)?,
                    verification_status: row.get(8)?,
                })
            })?;

            for r in rows {
                results.push(r?);
            }
        }

        Ok(results)
    }

    /// Retrieve a single history record by ID without full table scan
    pub fn get_record(&self, id: &str) -> Result<Option<HistoryRecord>, StorageError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, created_at, app_name, provider_id, model_name, raw_text, final_text, duration_ms, verification_status
             FROM dictation_history
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(HistoryRecord {
                id: row.get(0)?,
                created_at: row.get(1)?,
                app_name: row.get(2)?,
                provider_id: row.get(3)?,
                model_name: row.get(4)?,
                raw_text: row.get(5)?,
                final_text: row.get(6)?,
                duration_ms: row.get(7)?,
                verification_status: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Database-backed pagination query returning records, total count, and has_more
    pub fn get_history_page(
        &self,
        limit: usize,
        offset: usize,
        search: Option<&str>,
    ) -> Result<HistoryPage, StorageError> {
        let conn = self.conn.lock().unwrap();
        let limit_val = limit.max(1) as i64;
        let offset_val = offset as i64;

        let (total_count, records) = if let Some(query) = search {
            let pattern = format!("%{}%", query);
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM dictation_history WHERE raw_text LIKE ?1 OR final_text LIKE ?1",
                params![pattern],
                |r| r.get(0),
            )?;

            let mut stmt = conn.prepare(
                "SELECT id, created_at, app_name, provider_id, model_name, raw_text, final_text, duration_ms, verification_status
                 FROM dictation_history
                 WHERE raw_text LIKE ?1 OR final_text LIKE ?1
                 ORDER BY created_at DESC
                 LIMIT ?2 OFFSET ?3",
            )?;

            let rows = stmt.query_map(params![pattern, limit_val, offset_val], |row| {
                Ok(HistoryRecord {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    app_name: row.get(2)?,
                    provider_id: row.get(3)?,
                    model_name: row.get(4)?,
                    raw_text: row.get(5)?,
                    final_text: row.get(6)?,
                    duration_ms: row.get(7)?,
                    verification_status: row.get(8)?,
                })
            })?;

            let mut recs = Vec::new();
            for r in rows {
                recs.push(r?);
            }
            (count.max(0) as u64, recs)
        } else {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM dictation_history",
                [],
                |r| r.get(0),
            )?;

            let mut stmt = conn.prepare(
                "SELECT id, created_at, app_name, provider_id, model_name, raw_text, final_text, duration_ms, verification_status
                 FROM dictation_history
                 ORDER BY created_at DESC
                 LIMIT ?1 OFFSET ?2",
            )?;

            let rows = stmt.query_map(params![limit_val, offset_val], |row| {
                Ok(HistoryRecord {
                    id: row.get(0)?,
                    created_at: row.get(1)?,
                    app_name: row.get(2)?,
                    provider_id: row.get(3)?,
                    model_name: row.get(4)?,
                    raw_text: row.get(5)?,
                    final_text: row.get(6)?,
                    duration_ms: row.get(7)?,
                    verification_status: row.get(8)?,
                })
            })?;

            let mut recs = Vec::new();
            for r in rows {
                recs.push(r?);
            }
            (count.max(0) as u64, recs)
        };

        let has_more = (offset + records.len()) < total_count as usize;

        Ok(HistoryPage {
            records,
            total_count,
            limit,
            offset,
            has_more,
        })
    }

    /// Single aggregate query computing total records, total duration, and total words
    /// without loading full history records into memory.
    pub fn get_stats(&self, since: Option<&str>) -> Result<HistoryStats, StorageError> {
        let conn = self.conn.lock().unwrap();

        // Count words using SQL string length difference:
        // LENGTH(TRIM(final_text)) - LENGTH(REPLACE(TRIM(final_text), ' ', '')) + 1
        let query = if since.is_some() {
            "SELECT 
                COUNT(*),
                COALESCE(SUM(duration_ms), 0),
                COALESCE(SUM(CASE WHEN LENGTH(TRIM(final_text)) > 0 THEN (LENGTH(TRIM(final_text)) - LENGTH(REPLACE(TRIM(final_text), ' ', '')) + 1) ELSE 0 END), 0)
             FROM dictation_history
             WHERE created_at >= ?1"
        } else {
            "SELECT 
                COUNT(*),
                COALESCE(SUM(duration_ms), 0),
                COALESCE(SUM(CASE WHEN LENGTH(TRIM(final_text)) > 0 THEN (LENGTH(TRIM(final_text)) - LENGTH(REPLACE(TRIM(final_text), ' ', '')) + 1) ELSE 0 END), 0)
             FROM dictation_history"
        };

        if let Some(cutoff) = since {
            let mut stmt = conn.prepare(query)?;
            let stats = stmt.query_row(params![cutoff], |row| {
                let total_records: i64 = row.get(0)?;
                let total_duration_ms: i64 = row.get(1)?;
                let total_words: i64 = row.get(2)?;
                Ok(HistoryStats {
                    total_records: total_records.max(0) as u64,
                    total_duration_ms: total_duration_ms.max(0) as u64,
                    total_words: total_words.max(0) as u64,
                })
            })?;
            Ok(stats)
        } else {
            let mut stmt = conn.prepare(query)?;
            let stats = stmt.query_row([], |row| {
                let total_records: i64 = row.get(0)?;
                let total_duration_ms: i64 = row.get(1)?;
                let total_words: i64 = row.get(2)?;
                Ok(HistoryStats {
                    total_records: total_records.max(0) as u64,
                    total_duration_ms: total_duration_ms.max(0) as u64,
                    total_words: total_words.max(0) as u64,
                })
            })?;
            Ok(stats)
        }
    }

    pub fn delete_record(&self, id: &str) -> Result<bool, StorageError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM dictation_history WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    pub fn clear_all(&self) -> Result<(), StorageError> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM dictation_history", [])?;
        Ok(())
    }

    fn prune_internal(conn: &Connection, retention: RetentionPolicy) -> SqlResult<()> {
        let days = match retention {
            RetentionPolicy::Days7 => 7,
            RetentionPolicy::Days30 => 30,
            RetentionPolicy::Forever | RetentionPolicy::Off => return Ok(()),
        };

        let cutoff = Utc::now() - chrono::Duration::days(days);
        let cutoff_str = cutoff.to_rfc3339();

        conn.execute(
            "DELETE FROM dictation_history WHERE created_at < ?1",
            params![cutoff_str],
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_storage_crud_and_search() {
        let engine = StorageEngine::new_in_memory().unwrap();
        let record = HistoryRecord {
            id: Uuid::new_v4().to_string(),
            created_at: Utc::now().to_rfc3339(),
            app_name: Some("VS Code".to_string()),
            provider_id: "groq".to_string(),
            model_name: "whisper-large-v3-turbo".to_string(),
            raw_text: "Schedule the meeting for Friday".to_string(),
            final_text: "Schedule the meeting for Friday.".to_string(),
            duration_ms: 1200,
            verification_status: "PASS".to_string(),
        };

        engine.insert_record(&record, RetentionPolicy::Forever).unwrap();

        let items = engine.list_records(10, None).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].raw_text, "Schedule the meeting for Friday");

        let search_items = engine.list_records(10, Some("Friday")).unwrap();
        assert_eq!(search_items.len(), 1);

        let search_none = engine.list_records(10, Some("Monday")).unwrap();
        assert_eq!(search_none.len(), 0);

        engine.delete_record(&record.id).unwrap();
        assert_eq!(engine.list_records(10, None).unwrap().len(), 0);
    }

    #[test]
    fn test_pagination_and_aggregate_stats() {
        let engine = StorageEngine::new_in_memory().unwrap();

        // 1. Initial empty stats
        let initial_stats = engine.get_stats(None).unwrap();
        assert_eq!(initial_stats.total_records, 0);
        assert_eq!(initial_stats.total_words, 0);
        assert_eq!(initial_stats.total_duration_ms, 0);

        // 2. Insert 5 records with known words and durations
        for i in 1..=5 {
            let record = HistoryRecord {
                id: format!("rec-{}", i),
                created_at: format!("2026-09-26T01:0{}:00Z", i),
                app_name: Some("Terminal".to_string()),
                provider_id: "local-whisper".to_string(),
                model_name: "base".to_string(),
                raw_text: format!("raw sentence number {}", i),
                final_text: format!("Word one two three number {}", i), // 5 words
                duration_ms: 1000 * i,
                verification_status: "PASS".to_string(),
            };
            engine.insert_record(&record, RetentionPolicy::Forever).unwrap();
        }

        // 3. Test get_record
        let single = engine.get_record("rec-3").unwrap();
        assert!(single.is_some());
        assert_eq!(single.unwrap().final_text, "Word one two three number 3");

        let non_existent = engine.get_record("rec-999").unwrap();
        assert!(non_existent.is_none());

        // 4. Test aggregate get_stats
        let stats = engine.get_stats(None).unwrap();
        assert_eq!(stats.total_records, 5);
        assert_eq!(stats.total_words, 30); // 5 records * 6 words ("Word one two three number X")
        assert_eq!(stats.total_duration_ms, 1000 + 2000 + 3000 + 4000 + 5000); // 15,000 ms

        // Filtered stats with since cutoff
        let filtered_stats = engine.get_stats(Some("2026-09-26T01:04:00Z")).unwrap();
        assert_eq!(filtered_stats.total_records, 2); // rec-4 and rec-5
        assert_eq!(filtered_stats.total_words, 12); // 2 records * 6 words
        assert_eq!(filtered_stats.total_duration_ms, 9000);

        // 5. Test get_history_page pagination
        let page1 = engine.get_history_page(2, 0, None).unwrap();
        assert_eq!(page1.records.len(), 2);
        assert_eq!(page1.total_count, 5);
        assert_eq!(page1.offset, 0);
        assert_eq!(page1.limit, 2);
        assert!(page1.has_more);
        assert_eq!(page1.records[0].id, "rec-5"); // ORDER BY created_at DESC

        let page2 = engine.get_history_page(2, 2, None).unwrap();
        assert_eq!(page2.records.len(), 2);
        assert_eq!(page2.records[0].id, "rec-3");
        assert!(page2.has_more);

        let page3 = engine.get_history_page(2, 4, None).unwrap();
        assert_eq!(page3.records.len(), 1);
        assert_eq!(page3.records[0].id, "rec-1");
        assert!(!page3.has_more); // Last page

        // Search pagination
        let search_page = engine.get_history_page(10, 0, Some("number 2")).unwrap();
        assert_eq!(search_page.records.len(), 1);
        assert_eq!(search_page.total_count, 1);
        assert_eq!(search_page.records[0].id, "rec-2");
        assert!(!search_page.has_more);
    }
}
