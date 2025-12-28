use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::SaltString, Algorithm, Argon2, PasswordHasher, Version,
};
use rand::Rng;
use serde::{Deserialize, Serialize};

/// Represents an encrypted private key with metadata
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EncryptedKey {
    pub ciphertext: String,
    pub nonce: String,
    pub tag: String,
    pub salt: String,
}

/// Initialize a new encryption key from a password
pub fn derive_key_from_password(password: &str) -> Result<[u8; 32], String> {
    let salt = SaltString::generate(rand::thread_rng());

    let argon2 = Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        argon2::Params::new(
            19456,
            2,
            1,
            Some(32),
        )
        .map_err(|e| format!("Failed to create Argon2 params: {}", e))?,
    );

    // Hash password to get key bytes
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Password hashing failed: {}", e))?;

    // Extract the hash as key material
    let hash_string = password_hash.to_string();
    let key_bytes = hash_string.as_bytes();

    // Create a [u8; 32] from the hash
    let mut key = [0u8; 32];
    for (i, &byte) in key_bytes.iter().take(32).enumerate() {
        key[i] = byte;
    }

    Ok(key)
}

/// Encrypt a private key with a password
pub fn encrypt_private_key(private_key: &str, password: &str) -> Result<EncryptedKey, String> {
    // Generate random nonce
    let mut rng = rand::thread_rng();
    let nonce_bytes: [u8; 12] = rng.gen();
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Derive key from password
    let key = derive_key_from_password(password)?;
    let cipher = Aes256Gcm::new(&key.into());

    // Encrypt the private key
    let ciphertext = cipher
        .encrypt(
            nonce,
            Payload {
                msg: private_key.as_bytes(),
                aad: b"",
            },
        )
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Generate salt for storage
    let salt = SaltString::generate(rand::thread_rng());

    Ok(EncryptedKey {
        ciphertext: hex::encode(&ciphertext),
        nonce: hex::encode(nonce.as_slice()),
        tag: String::new(), // Tag is embedded in AES-GCM ciphertext
        salt: salt.to_string(),
    })
}

/// Decrypt a private key with a password
pub fn decrypt_private_key(
    encrypted_key: &EncryptedKey,
    password: &str,
) -> Result<String, String> {
    // Derive key from password
    let key = derive_key_from_password(password)?;
    let cipher = Aes256Gcm::new(&key.into());

    // Decode hex strings
    let ciphertext = hex::decode(&encrypted_key.ciphertext)
        .map_err(|e| format!("Failed to decode ciphertext: {}", e))?;
    let nonce_bytes = hex::decode(&encrypted_key.nonce)
        .map_err(|e| format!("Failed to decode nonce: {}", e))?;

    if nonce_bytes.len() != 12 {
        return Err("Invalid nonce length".to_string());
    }

    let nonce = Nonce::from_slice(&nonce_bytes);

    // Decrypt
    let plaintext = cipher
        .decrypt(
            nonce,
            Payload {
                msg: ciphertext.as_ref(),
                aad: b"",
            },
        )
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let private_key = "5JdeC19p7v5sGdkYjezapQTMQ7aXF2sDM6F1V5Q5ZH2mUZpWkCJ";
        let password = "my-secure-password";

        let encrypted = encrypt_private_key(private_key, password).unwrap();
        let decrypted = decrypt_private_key(&encrypted, password).unwrap();

        assert_eq!(private_key, decrypted);
    }

    #[test]
    fn test_wrong_password() {
        let private_key = "5JdeC19p7v5sGdkYjezapQTMQ7aXF2sDM6F1V5Q5ZH2mUZpWkCJ";
        let password = "correct-password";
        let wrong_password = "wrong-password";

        let encrypted = encrypt_private_key(private_key, password).unwrap();
        let result = decrypt_private_key(&encrypted, wrong_password);

        assert!(result.is_err());
    }
}
