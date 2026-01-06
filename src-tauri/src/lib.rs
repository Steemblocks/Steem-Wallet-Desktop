mod commands;
mod crypto;
mod storage;

use commands::*;
use storage::StorageManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(StorageManager::new())
        .setup(|app| {
            // Initialize storage with app data directory
            let storage = app.state::<StorageManager>();
            if let Err(e) = storage.init(app.handle()) {
                eprintln!("Failed to initialize storage: {}", e);
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Storage commands
            storage::storage_init,
            storage::storage_set,
            storage::storage_get,
            storage::storage_remove,
            storage::storage_clear,
            // Crypto commands
            encrypt_sensitive_data,
            decrypt_sensitive_data,
            store_encrypted_key,
            retrieve_encrypted_key,
            sign_transaction,
            verify_password,
            generate_keys_from_password,
            verify_private_key_format,
            clear_sensitive_data,
            http_post,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

