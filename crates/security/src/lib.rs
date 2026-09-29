use directories::ProjectDirs;
use keyring::Entry;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::RwLock;
use thiserror::Error;

const SERVICE_NAME: &str = "ForgeWisper";

lazy_static! {
    static ref SECRET_CACHE: RwLock<HashMap<String, String>> = RwLock::new(HashMap::new());
}

#[derive(Debug, Error)]
pub enum SecurityError {
    #[error("Keyring access failed: {0}")]
    KeyringError(String),

    #[error("Secret not found for key: {0}")]
    NotFound(String),
}

fn get_vault_path() -> Option<PathBuf> {
    ProjectDirs::from("com", "forge", "ForgeWisper").map(|proj| {
        proj.config_dir().join(".vault")
    })
}

/// One-time migration helper: if a legacy plaintext vault file exists from older versions,
/// read the secret, import it into the OS keyring, and immediately wipe the file from disk.
fn migrate_and_wipe_legacy_vault(key: &str) -> Option<String> {
    let path = get_vault_path()?;
    if !path.exists() {
        return None;
    }

    let contents = std::fs::read_to_string(&path).ok()?;
    let mut found_secret = None;
    let mut remaining = Vec::new();

    for line in contents.lines() {
        if let Some((k, v)) = line.split_once('=') {
            let trimmed_k = k.trim();
            let trimmed_v = v.trim();
            if trimmed_k == key && !trimmed_v.is_empty() {
                found_secret = Some(trimmed_v.to_string());
            } else if !trimmed_k.is_empty() {
                remaining.push(format!("{}={}", trimmed_k, trimmed_v));
            }
        }
    }

    // If no more keys remain in the legacy vault, remove the file entirely
    if remaining.is_empty() {
        let _ = std::fs::remove_file(&path);
    } else {
        let _ = std::fs::write(&path, remaining.join("\n"));
    }

    found_secret
}

fn delete_legacy_vault(key: &str) {
    if let Some(path) = get_vault_path() {
        if !path.exists() {
            return;
        }
        if let Ok(contents) = std::fs::read_to_string(&path) {
            let mut remaining = Vec::new();
            for line in contents.lines() {
                if let Some((k, _)) = line.split_once('=') {
                    if k.trim() != key {
                        remaining.push(line.to_string());
                    }
                }
            }
            if remaining.is_empty() {
                let _ = std::fs::remove_file(&path);
            } else {
                let _ = std::fs::write(&path, remaining.join("\n"));
            }
        }
    }
}

pub struct SecretStore;

impl SecretStore {
    pub fn set_secret(key: &str, secret: &str) -> Result<(), SecurityError> {
        // 1. Immediately store in high-speed in-memory cache (<0.01ms)
        if let Ok(mut cache) = SECRET_CACHE.write() {
            cache.insert(key.to_string(), secret.to_string());
        }

        // 2. Persist securely to OS Keyring (Windows Credential Manager / macOS Keychain)
        if let Ok(entry) = Entry::new(SERVICE_NAME, key) {
            let _ = entry.set_password(secret);
        }

        // 3. Ensure no plaintext legacy vault remains on disk
        delete_legacy_vault(key);

        Ok(())
    }

    pub fn get_secret(key: &str) -> Result<String, SecurityError> {
        // 1. Check in-memory cache first (sub-microsecond)
        if let Ok(cache) = SECRET_CACHE.read() {
            if let Some(val) = cache.get(key) {
                if !val.trim().is_empty() {
                    return Ok(val.clone());
                }
            }
        }

        // 2. Check environment variables (e.g. GROQ_API_KEY)
        let env_key = key.to_uppercase();
        if let Ok(val) = std::env::var(&env_key) {
            if !val.trim().is_empty() {
                let clean = val.trim().to_string();
                if let Ok(mut cache) = SECRET_CACHE.write() {
                    cache.insert(key.to_string(), clean.clone());
                }
                return Ok(clean);
            }
        }
        if key == "groq_api_key" {
            if let Ok(val) = std::env::var("GROQ_API_KEY") {
                if !val.trim().is_empty() {
                    let clean = val.trim().to_string();
                    if let Ok(mut cache) = SECRET_CACHE.write() {
                        cache.insert(key.to_string(), clean.clone());
                    }
                    return Ok(clean);
                }
            }
        }

        // 3. Check OS Keyring (Windows Credential Manager / macOS Keychain)
        let entry = Entry::new(SERVICE_NAME, key)
            .map_err(|e| SecurityError::KeyringError(e.to_string()))?;
        match entry.get_password() {
            Ok(secret) => {
                if let Ok(mut cache) = SECRET_CACHE.write() {
                    cache.insert(key.to_string(), secret.clone());
                }
                Ok(secret)
            }
            Err(keyring::Error::NoEntry) => {
                // 4. One-time legacy migration check: if legacy .vault file was left on disk,
                // migrate secret to OS Keyring and wipe the plaintext file from disk.
                if let Some(migrated_secret) = migrate_and_wipe_legacy_vault(key) {
                    let _ = entry.set_password(&migrated_secret);
                    if let Ok(mut cache) = SECRET_CACHE.write() {
                        cache.insert(key.to_string(), migrated_secret.clone());
                    }
                    return Ok(migrated_secret);
                }
                Err(SecurityError::NotFound(key.to_string()))
            }
            Err(e) => {
                // If keyring is unavailable, check legacy vault fallback
                if let Some(migrated_secret) = migrate_and_wipe_legacy_vault(key) {
                    if let Ok(mut cache) = SECRET_CACHE.write() {
                        cache.insert(key.to_string(), migrated_secret.clone());
                    }
                    return Ok(migrated_secret);
                }
                Err(SecurityError::KeyringError(e.to_string()))
            }
        }
    }

    pub fn delete_secret(key: &str) -> Result<(), SecurityError> {
        // 1. Remove from in-memory cache
        if let Ok(mut cache) = SECRET_CACHE.write() {
            cache.remove(key);
        }

        // 2. Remove legacy vault from disk if present
        delete_legacy_vault(key);

        // 3. Remove from OS Keyring
        if let Ok(entry) = Entry::new(SERVICE_NAME, key) {
            let _ = entry.delete_password();
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_store_cache() {
        let test_key = "test_groq_api_key_speed";
        let test_val = "gsk_test1234567890abcdef";

        // Set
        let start = std::time::Instant::now();
        assert!(SecretStore::set_secret(test_key, test_val).is_ok());
        let set_duration = start.elapsed();
        println!("Set duration: {:?}", set_duration);

        // Get from cache
        let start_get = std::time::Instant::now();
        let retrieved = SecretStore::get_secret(test_key).expect("Should retrieve secret");
        let get_duration = start_get.elapsed();
        println!("Get duration: {:?}", get_duration);

        assert_eq!(retrieved, test_val);
        // Cached retrieval must be sub-millisecond (< 500 microseconds)
        assert!(get_duration.as_micros() < 500);

        // Cleanup
        assert!(SecretStore::delete_secret(test_key).is_ok());
        assert!(SecretStore::get_secret(test_key).is_err());
    }
}
