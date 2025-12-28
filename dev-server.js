#!/usr/bin/env node

/**
 * Dev server launcher for Tauri
 * Starts Vite dev server and waits for it to be ready
 */

const { spawn } = require('child_process');
const http = require('http');

// Start Vite dev server
const vite = spawn('npm', ['run', 'dev:server'], {
  stdio: 'inherit',
  shell: true,
});

// Wait for server to be ready
const checkServer = () => {
  http
    .get('http://localhost:5173', (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Dev server is ready!');
        process.exit(0);
      }
    })
    .on('error', () => {
      setTimeout(checkServer, 500);
    });
};

setTimeout(checkServer, 1000);

vite.on('error', (err) => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
