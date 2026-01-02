
import 'regenerator-runtime/runtime';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SecureStorageFactory } from '@/services/secureStorage';
import { dataCache } from '@/services/dataCache';

// Initialize storage immediately if Tauri is available
if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) {
  SecureStorageFactory.reinitialize();
}

// Initialize the data cache service
dataCache.initialize().catch(console.warn);

// Smoothly fade out and remove the initial HTML loader
const hideInitialLoader = () => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    // Add fade-out class for smooth transition
    loader.classList.add('fade-out');
    // Remove from DOM after transition completes
    setTimeout(() => {
      loader.remove();
    }, 150);
  }
};

// Render immediately - don't wait for async operations
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Hide the initial loader after React has rendered
// Use requestAnimationFrame to ensure React has painted
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideInitialLoader();
  });
});
