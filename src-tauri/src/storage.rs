use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

/// In-memory storage for wallet data
/// In production, use tauri-plugin-store for persistent storage
pub struct StorageManager {
    data: Mutex<HashMap<String, Value>>,
}

impl StorageManager {
    pub fn new() -> Self {
        StorageManager {
            data: Mutex::new(HashMap::new()),
        }
    }

    pub fn set(&self, key: String, value: Value) -> Result<(), String> {
        let mut data = self
            .data
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        data.insert(key, value);
        Ok(())
    }

    pub fn get(&self, key: &str) -> Result<Option<Value>, String> {
        let data = self
            .data
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        Ok(data.get(key).cloned())
    }

    pub fn remove(&self, key: &str) -> Result<(), String> {
        let mut data = self
            .data
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        data.remove(key);
        Ok(())
    }

    pub fn clear(&self) -> Result<(), String> {
        let mut data = self
            .data
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        data.clear();
        Ok(())
    }
}

impl Default for StorageManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Tauri commands for storage operations
#[tauri::command]
pub fn storage_set(
    key: String,
    value: String,
    storage: State<StorageManager>,
) -> Result<(), String> {
    let json_value: Value = serde_json::from_str(&value)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    storage.set(key, json_value)
}

#[tauri::command]
pub fn storage_get(key: String, storage: State<StorageManager>) -> Result<Option<String>, String> {
    match storage.get(&key)? {
        Some(value) => Ok(Some(value.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn storage_remove(key: String, storage: State<StorageManager>) -> Result<(), String> {
    storage.remove(&key)
}

#[tauri::command]
pub fn storage_clear(storage: State<StorageManager>) -> Result<(), String> {
    storage.clear()
}
