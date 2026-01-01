use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Persistent storage manager for wallet data
/// Data is stored in the app's data directory as a JSON file
pub struct StorageManager {
    data: Mutex<HashMap<String, Value>>,
    storage_path: Mutex<Option<PathBuf>>,
}

impl StorageManager {
    pub fn new() -> Self {
        StorageManager {
            data: Mutex::new(HashMap::new()),
            storage_path: Mutex::new(None),
        }
    }

    /// Initialize storage with the app's data directory
    pub fn init(&self, app_handle: &AppHandle) -> Result<(), String> {
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        // Create directory if it doesn't exist
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        let storage_file = app_data_dir.join("wallet_storage.json");

        // Store the path
        {
            let mut path = self.storage_path.lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            *path = Some(storage_file.clone());
        }

        // Load existing data if file exists
        if storage_file.exists() {
            let content = fs::read_to_string(&storage_file)
                .map_err(|e| format!("Failed to read storage file: {}", e))?;
            
            if !content.is_empty() {
                let loaded_data: HashMap<String, Value> = serde_json::from_str(&content)
                    .map_err(|e| format!("Failed to parse storage file: {}", e))?;
                
                let mut data = self.data.lock()
                    .map_err(|e| format!("Failed to acquire lock: {}", e))?;
                *data = loaded_data;
            }
        }

        Ok(())
    }

    /// Save data to disk
    fn save_to_disk(&self) -> Result<(), String> {
        let path = self.storage_path.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        
        let storage_file = match path.as_ref() {
            Some(p) => p.clone(),
            None => return Err("Storage not initialized".to_string()),
        };
        drop(path);

        let data = self.data.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        
        let json = serde_json::to_string_pretty(&*data)
            .map_err(|e| format!("Failed to serialize data: {}", e))?;
        
        fs::write(&storage_file, json)
            .map_err(|e| format!("Failed to write storage file: {}", e))?;

        Ok(())
    }

    pub fn set(&self, key: String, value: Value) -> Result<(), String> {
        {
            let mut data = self.data.lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            data.insert(key, value);
        }
        self.save_to_disk()
    }

    pub fn get(&self, key: &str) -> Result<Option<Value>, String> {
        let data = self.data.lock()
            .map_err(|e| format!("Failed to acquire lock: {}", e))?;
        Ok(data.get(key).cloned())
    }

    pub fn remove(&self, key: &str) -> Result<(), String> {
        {
            let mut data = self.data.lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            data.remove(key);
        }
        self.save_to_disk()
    }

    pub fn clear(&self) -> Result<(), String> {
        {
            let mut data = self.data.lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            data.clear();
        }
        self.save_to_disk()
    }
}

impl Default for StorageManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Initialize storage when app starts
#[tauri::command]
pub fn storage_init(app_handle: AppHandle, storage: State<StorageManager>) -> Result<(), String> {
    storage.init(&app_handle)
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
