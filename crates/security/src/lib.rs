use directories::ProjectDirs;
use keyring::Entry;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::fs::{create_dir_all, File};
use std::io::Read;
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
        let config_dir = proj.config_dir();
        let _ = create_dir_all(config_dir);
        config_dir.join(".vault")
    })
}

fn read_from_vault(key: &str) -> Option<String> {
    let path = get_vault_path()?;
    if !path.exists() {
        return None;
    }
    let mut file = File::open(path).ok()?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).ok()?;

    for line in contents.lines() {
        if let Some((k, v)) = line.split_once('=') {
            if k.trim() == key {
                let trimmed = v.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn write_to_vault(key: &str, secret: &str) {
    let Some(path) = get_vault_path() else { return; };
    let mut map = HashMap::new();

    if path.exists() {
        if let Ok(contents) = std::fs::read_to_string(&path) {
            for line in contents.lines() {
                if let Some((k, v)) = line.split_once('=') {
                    map.insert(k.trim().to_string(), v.trim().to_string());
                }
            }
        }
    }

    map.insert(key.to_string(), secret.to_string());

    let mut out = String::new();
    for (k, v) in &map {
        out.push_str(&format!("{}={}\n", k, v));
    }

    let _ = std::fs::write(path, out);
}

fn delete_from_vault(key: &str) {
    let Some(path) = get_vault_path() else { return; };
    if !path.exists() {
        return;
    }
    if let Ok(contents) = std::fs::read_to_string(&path) {
        let mut out = String::new();
        for line in contents.lines() {
            if let Some((k, _)) = line.split_once('=') {
                if k.trim() != key {
                    out.push_str(line);
                    out.push('\n');
                }
            }
        }
        let _ = std::fs::write(path, out);
    }
}

pub struct SecretStore;

impl SecretStore {
    pub fn set_secret(key: &str, secret: &str) -> Result<(), SecurityError> {
        // 1. Immediately store in high-speed in-memory cache (<0.01ms)
        if let Ok(mut cache) = SECRET_CACHE.write() {
            cache.insert(key.to_string(), secret.to_string());
        }

        // 2. Persist to local vault file for instant restart retrieval (<0.5ms)
        write_to_vault(key, secret);

        // 3. Persist to OS Keyring
        if let Ok(entry) = Entry::new(SERVICE_NAME, key) {
            let _ = entry.set_password(secret);
        }

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

        // 3. Check fast local vault file (< 1ms)
        if let Some(val) = read_from_vault(key) {
            if !val.trim().is_empty() {
                if let Ok(mut cache) = SECRET_CACHE.write() {
                    cache.insert(key.to_string(), val.clone());
                }
                return Ok(val);
            }
        }

        // 4. Fall back to OS Keyring (Windows Credential Manager / macOS Keychain)
        let entry = Entry::new(SERVICE_NAME, key)
            .map_err(|e| SecurityError::KeyringError(e.to_string()))?;
        match entry.get_password() {
            Ok(secret) => {
                // Populate memory cache and local vault for subsequent calls
                if let Ok(mut cache) = SECRET_CACHE.write() {
                    cache.insert(key.to_string(), secret.clone());
                }
                write_to_vault(key, &secret);
                Ok(secret)
            }
            Err(keyring::Error::NoEntry) => Err(SecurityError::NotFound(key.to_string())),
            Err(e) => Err(SecurityError::KeyringError(e.to_string())),
        }
    }

    pub fn delete_secret(key: &str) -> Result<(), SecurityError> {
        // 1. Remove from cache
        if let Ok(mut cache) = SECRET_CACHE.write() {
            cache.remove(key);
        }

        // 2. Remove from vault
        delete_from_vault(key);

        // 3. Remove from Keyring
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
