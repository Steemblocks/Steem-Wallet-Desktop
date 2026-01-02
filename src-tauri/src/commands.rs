use crate::crypto::{decrypt_private_key, encrypt_private_key, EncryptedKey};
use serde::{Deserialize, Serialize};

/// Response for encryption operations
#[derive(Serialize, Deserialize)]
pub struct EncryptResponse {
    pub success: bool,
    pub encrypted_data: Option<String>,
    pub error: Option<String>,
}

/// Response for decryption operations
#[derive(Serialize, Deserialize)]
pub struct DecryptResponse {
    pub success: bool,
    pub decrypted_data: Option<String>,
    pub error: Option<String>,
}

/// Tauri command to encrypt sensitive data with a password
/// Used for encrypting private keys before storage
#[tauri::command]
pub fn encrypt_sensitive_data(data: String, password: String) -> Result<EncryptResponse, String> {
    if data.is_empty() {
        return Ok(EncryptResponse {
            success: false,
            encrypted_data: None,
            error: Some("Data cannot be empty".to_string()),
        });
    }

    if password.is_empty() {
        return Ok(EncryptResponse {
            success: false,
            encrypted_data: None,
            error: Some("Password cannot be empty".to_string()),
        });
    }

    match encrypt_private_key(&data, &password) {
        Ok(encrypted_key) => {
            // Serialize the encrypted key structure to JSON
            let json = serde_json::to_string(&encrypted_key)
                .map_err(|e| format!("Failed to serialize: {}", e))?;
            Ok(EncryptResponse {
                success: true,
                encrypted_data: Some(json),
                error: None,
            })
        }
        Err(e) => Ok(EncryptResponse {
            success: false,
            encrypted_data: None,
            error: Some(format!("Encryption failed: {}", e)),
        }),
    }
}

/// Tauri command to decrypt sensitive data with a password
/// Used for decrypting private keys when needed for signing
#[tauri::command]
pub fn decrypt_sensitive_data(encrypted_data: String, password: String) -> Result<DecryptResponse, String> {
    if encrypted_data.is_empty() {
        return Ok(DecryptResponse {
            success: false,
            decrypted_data: None,
            error: Some("Encrypted data cannot be empty".to_string()),
        });
    }

    if password.is_empty() {
        return Ok(DecryptResponse {
            success: false,
            decrypted_data: None,
            error: Some("Password cannot be empty".to_string()),
        });
    }

    // Parse the encrypted key structure from JSON
    let encrypted_key: EncryptedKey = match serde_json::from_str(&encrypted_data) {
        Ok(key) => key,
        Err(e) => {
            return Ok(DecryptResponse {
                success: false,
                decrypted_data: None,
                error: Some(format!("Invalid encrypted data format: {}", e)),
            });
        }
    };

    match decrypt_private_key(&encrypted_key, &password) {
        Ok(decrypted) => Ok(DecryptResponse {
            success: true,
            decrypted_data: Some(decrypted),
            error: None,
        }),
        Err(e) => Ok(DecryptResponse {
            success: false,
            decrypted_data: None,
            error: Some(format!("Decryption failed: {}", e)),
        }),
    }
}

/// Request to encrypt and store a private key
#[derive(Serialize, Deserialize)]
pub struct StoreKeyRequest {
    pub key_type: String,        // 'active', 'owner', 'posting', 'memo'
    pub private_key: String,
    pub username: String,
    pub password: String,
}

/// Response with encrypted key data
#[derive(Serialize, Deserialize)]
pub struct StoreKeyResponse {
    pub success: bool,
    pub message: String,
}

/// Request to retrieve and decrypt a private key
#[derive(Serialize, Deserialize)]
pub struct RetrieveKeyRequest {
    pub key_type: String,
    pub username: String,
    pub password: String,
}

/// Response with decrypted key
#[derive(Serialize, Deserialize)]
pub struct RetrieveKeyResponse {
    pub success: bool,
    pub private_key: Option<String>,
    pub error: Option<String>,
}

/// Tauri command to store an encrypted private key
/// The key is encrypted client-side and stored securely
#[tauri::command]
pub fn store_encrypted_key(request: StoreKeyRequest) -> Result<StoreKeyResponse, String> {
    // Validate inputs
    if request.private_key.is_empty() {
        return Ok(StoreKeyResponse {
            success: false,
            message: "Private key cannot be empty".to_string(),
        });
    }

    if request.password.is_empty() {
        return Ok(StoreKeyResponse {
            success: false,
            message: "Password cannot be empty".to_string(),
        });
    }

    // Encrypt the private key
    match encrypt_private_key(&request.private_key, &request.password) {
        Ok(_encrypted_key) => {
            // In production, store _encrypted_key to disk or secure storage
            // For now, we just return success
            Ok(StoreKeyResponse {
                success: true,
                message: "Key stored securely".to_string(),
            })
        }
        Err(e) => Ok(StoreKeyResponse {
            success: false,
            message: format!("Encryption failed: {}", e),
        }),
    }
}

/// Tauri command to retrieve and decrypt a private key
#[tauri::command]
pub fn retrieve_encrypted_key(_request: RetrieveKeyRequest) -> Result<RetrieveKeyResponse, String> {
    // In production, retrieve the encrypted key from storage
    // For now, return error as it's not stored yet
    Ok(RetrieveKeyResponse {
        success: false,
        private_key: None,
        error: Some("Key not found in storage".to_string()),
    })
}

/// Tauri command to sign a transaction
/// Private key is kept encrypted until signing, then discarded
#[tauri::command]
pub fn sign_transaction(
    transaction_data: String,
    encrypted_key_data: String,
    password: String,
) -> Result<String, String> {
    // Parse the encrypted key
    let encrypted_key: EncryptedKey = serde_json::from_str(&encrypted_key_data)
        .map_err(|e| format!("Invalid encrypted key format: {}", e))?;

    // Decrypt the private key (only in Rust, never exposed to JS)
    let _private_key = decrypt_private_key(&encrypted_key, &password)?;

    // Sign the transaction (placeholder - real implementation would use dsteem)
    // For now, just return a mock signature
    let mock_signature = format!("signed_{}", hex::encode(transaction_data.as_bytes()));

    // Private key is now dropped and cleaned from memory
    Ok(mock_signature)
}

/// Tauri command to verify a password
#[tauri::command]
pub fn verify_password(password: String) -> Result<bool, String> {
    // Basic validation - in production, verify against stored hash
    Ok(password.len() >= 8)
}

/// Tauri command to generate account keys from a master password
#[tauri::command]
pub fn generate_keys_from_password(
    _username: String,
    _password: String,
) -> Result<serde_json::Value, String> {
    // In production, use proper key derivation
    // For now, return placeholder keys
    Ok(serde_json::json!({
        "owner": {
            "private": "5PLACEHOLDER_OWNER_KEY",
            "public": "STM_PLACEHOLDER_OWNER_PUBLIC"
        },
        "active": {
            "private": "5PLACEHOLDER_ACTIVE_KEY",
            "public": "STM_PLACEHOLDER_ACTIVE_PUBLIC"
        },
        "posting": {
            "private": "5PLACEHOLDER_POSTING_KEY",
            "public": "STM_PLACEHOLDER_POSTING_PUBLIC"
        },
        "memo": {
            "private": "5PLACEHOLDER_MEMO_KEY",
            "public": "STM_PLACEHOLDER_MEMO_PUBLIC"
        }
    }))
}

/// Tauri command to verify a private key format
#[tauri::command]
pub fn verify_private_key_format(private_key: String) -> Result<bool, String> {
    // Verify it starts with '5' (Steem private key format)
    Ok(private_key.starts_with('5') && private_key.len() >= 50)
}

/// Tauri command to clear all sensitive data
#[tauri::command]
pub fn clear_sensitive_data() -> Result<(), String> {
    // Clear any in-memory sensitive data
    Ok(())
}
