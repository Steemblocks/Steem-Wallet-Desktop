
import 'regenerator-runtime/runtime';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SecureStorageFactory } from '@/services/secureStorage';

// Initialize storage immediately if Tauri is available
if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
  SecureStorageFactory.reinitialize();
}

// Render immediately - don't wait for async operations
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
