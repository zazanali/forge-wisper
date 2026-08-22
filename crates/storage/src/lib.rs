use chrono::Utc;
use directories::ProjectDirs;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::fs::create_dir_all;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RetentionPolicy {
    Forever,
    Days30,
    Days7,
    Off,
}

impl Default for RetentionPolicy {
    fn default() -> Self {
        Self::Days30
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}
