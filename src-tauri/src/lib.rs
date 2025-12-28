mod commands;
mod crypto;
mod storage;

use commands::*;
use storage::StorageManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(StorageManager::new())
        .invoke_handler(tauri::generate_handler![
            // Storage commands
            storage::storage_set,
            storage::storage_get,
            storage::storage_remove,
            storage::storage_clear,
            // Crypto commands
            store_encrypted_key,
            retrieve_encrypted_key,
            sign_transaction,
            verify_password,
            generate_keys_from_password,
            verify_private_key_format,
            clear_sensitive_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

