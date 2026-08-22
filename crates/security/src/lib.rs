use keyring::Entry;
use thiserror::Error;

const SERVICE_NAME: &str = "ForgeWisper";

#[derive(Debug, Error)]
pub enum SecurityError {
    #[error("Keyring access failed: {0}")]
    KeyringError(String),

    #[error("Secret not found for key: {0}")]
    NotFound(String),
}

pub struct SecretStore;

impl SecretStore {
    pub fn set_secret(key: &str, secret: &str) -> Result<(), SecurityError> {
        let entry = Entry::new(SERVICE_NAME, key)
            .map_err(|e| SecurityError::KeyringError(e.to_string()))?;
        entry
            .set_password(secret)
            .map_err(|e| SecurityError::KeyringError(e.to_string()))?;
        Ok(())
    }

    pub fn get_secret(key: &str) -> Result<String, SecurityError> {
        // First check environment variable (e.g. GROQ_API_KEY)
        let env_key = key.to_uppercase();
        if let Ok(val) = std::env::var(&env_key) {
            if !val.trim().is_empty() {
                return Ok(val.trim().to_string());
            }
        }
        if key == "groq_api_key" {
            if let Ok(val) = std::env::var("GROQ_API_KEY") {
                if !val.trim().is_empty() {
                    return Ok(val.trim().to_string());
                }
            }
        }

        let entry = Entry::new(SERVICE_NAME, key)
            .map_err(|e| SecurityError::KeyringError(e.to_string()))?;
        match entry.get_password() {
            Ok(secret) => Ok(secret),
            Err(keyring::Error::NoEntry) => Err(SecurityError::NotFound(key.to_string())),
            Err(e) => Err(SecurityError::KeyringError(e.to_string())),
        }
    }

    pub fn delete_secret(key: &str) -> Result<(), SecurityError> {
        let entry = Entry::new(SERVICE_NAME, key)
            .map_err(|e| SecurityError::KeyringError(e.to_string()))?;
        match entry.delete_password() {
            Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(SecurityError::KeyringError(e.to_string())),
        }
    }
}
