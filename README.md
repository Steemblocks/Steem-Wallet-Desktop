# Steem Wallet Desktop

A secure, cross-platform desktop wallet for the Steem blockchain built with Tauri, React, and Rust.

## Overview

Steem Wallet Desktop is an open-source cryptocurrency wallet designed for managing STEEM tokens securely. The application uses a zero-knowledge architecture where private keys are encrypted and never leave your device.

### Supported Platforms

| Platform | Format |
|----------|--------|
| Windows | `.msi` / `.exe` installer |
| macOS | `.dmg` / `.app` bundle |
| Linux | `.deb` package |

## Features

### Wallet Operations
- STEEM and SBD token transfers
- Power up and power down operations
- Delegation management
- Witness voting
- Account history and transaction tracking
- Real-time balance and market data

### User Interface
- Responsive design for various screen sizes
- Dark and light theme support
- Accessible components following WCAG guidelines

---

## Security Architecture

Steem Wallet Desktop implements a layered security model with strict separation between the user interface and cryptographic operations.

### Overview

```
+-------------------------------------+
|  React UI (Frontend)                |
|  - User interface rendering         |
|  - No access to private keys        |
|  - Communicates via IPC only        |
+----------------+--------------------+
                 |
                 | IPC Bridge (Type-safe)
                 |
+----------------v--------------------+
|  Tauri Core (OS Boundary)           |
+----------------+--------------------+
                 |
+----------------v--------------------+
|  Rust Backend (Secure Environment)  |
|                                     |
|  crypto.rs                          |
|  - AES-256-GCM encryption           |
|  - Argon2id key derivation          |
|  - Cryptographically secure RNG     |
|                                     |
|  storage.rs                         |
|  - Encrypted key storage            |
|  - Session management               |
+-------------------------------------+
```

### Encryption Details

**Algorithm: AES-256-GCM**
- NIST-approved authenticated encryption
- 256-bit key length
- Galois/Counter Mode provides both confidentiality and integrity
- Each encryption operation uses a unique 96-bit nonce

**Key Derivation: Argon2id**
- OWASP-recommended password hashing algorithm
- Resistant to GPU and ASIC attacks
- Parameters: 19456 KB memory, 2 iterations, 1 parallelism
- Produces 32-byte derived keys

### IPC Boundary Protection

The Inter-Process Communication (IPC) boundary ensures that:
- The frontend JavaScript environment cannot directly access private keys
- All cryptographic operations execute in the Rust backend
- Type-safe command interfaces prevent arbitrary code execution
- Even if the frontend is compromised (XSS), private keys remain protected

---

## Local Storage

### How Data is Stored

Steem Wallet Desktop uses a secure storage system implemented in Rust that differs significantly from browser-based localStorage.

**Desktop Application (Tauri)**
- Private keys are encrypted using AES-256-GCM before storage
- The encryption key is derived from the user's password using Argon2id
- Encrypted data is stored in the application's data directory
- Storage location varies by OS:
  - Windows: `%APPDATA%\com.steemwallet.desktop\`
  - macOS: `~/Library/Application Support/com.steemwallet.desktop/`
  - Linux: `~/.local/share/com.steemwallet.desktop/`

**Storage Flow**
```
User Password
     |
     v
Argon2id Key Derivation (salt + password)
     |
     v
256-bit Encryption Key
     |
     v
AES-256-GCM Encryption
     |
     v
Encrypted Data -> Application Data Directory
```

### What is Stored

| Data Type | Storage Method | Encryption |
|-----------|---------------|------------|
| Private Keys | Encrypted in app data | AES-256-GCM |
| Account Username | Plain text | No |
| App Settings | Plain text | No |
| Session Data | Memory only | Cleared on exit |

### Session Management

- Sensitive data is held in memory during active sessions
- Session data is cleared when the application closes
- Auto-lock feature clears session after configurable inactivity period
- Password re-entry required to decrypt keys after lock

---

## Installation

### Prerequisites
- Node.js v20 or later
- Rust (for building from source)
- npm or yarn

### Download Releases

Download pre-built installers from the [Releases](https://github.com/Steemblocks/Steem-Wallet-Desktop/releases) page.

### Build from Source

```bash
# Clone repository
git clone https://github.com/Steemblocks/Steem-Wallet-Desktop.git
cd Steem-Wallet-Desktop

# Install dependencies
npm install

# Run development version
npm run tauri:dev

# Build production installer
npm run tauri:build
```

---

## Development

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | Start desktop app with hot reload |
| `npm run tauri:build` | Build production installer |
| `npm run dev` | Start Vite development server only |
| `npm run build` | Build frontend for production |
| `npm run lint` | Run ESLint |

### Project Structure

```
Steem-Wallet-Desktop/
├── src/                      # React frontend
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   ├── wallet/           # Wallet-specific components
│   │   └── layout/           # Layout components
│   ├── services/
│   │   ├── secureStorage.ts  # Storage abstraction layer
│   │   ├── steemApi.ts       # Blockchain API client
│   │   └── steemOperations.ts
│   ├── hooks/                # React hooks
│   └── contexts/             # React contexts
│
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── crypto.rs         # Encryption implementation
│   │   ├── storage.rs        # Secure storage manager
│   │   ├── commands.rs       # IPC command handlers
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Build Tool | Vite |
| Desktop Runtime | Tauri 2 |
| Backend | Rust |
| Blockchain Client | dsteem |

---

## Security Considerations

### Best Practices for Users

1. **Use a strong, unique password** - The security of your encrypted keys depends on password strength
2. **Keep your password safe** - There is no password recovery; losing your password means losing access to stored keys
3. **Verify downloads** - Only download releases from official sources
4. **Keep the application updated** - Updates may include security patches

### Security Model Limitations

- The application trusts the operating system's security
- If your device is compromised at the OS level, encrypted data may be at risk
- The application does not protect against keyloggers or screen capture malware
- Physical access to an unlocked device may expose data

### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by opening a private issue or contacting the maintainers directly.

---

## Building Installers

### Windows
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/msi/
# Output: src-tauri/target/release/bundle/nsis/
```

### macOS
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/dmg/
# Output: src-tauri/target/release/bundle/macos/
```

### Linux
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/deb/
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

### Guidelines
- Follow existing code style
- Test changes locally before submitting
- Update documentation for new features
- Ensure `npm run lint` passes

---

## License

This project is licensed under a Custom Non-Commercial License. See [LICENSE.txt](./LICENSE.txt) for details.

**Permitted:**
- Personal use
- Educational use
- Non-commercial modifications and distribution

**Not Permitted:**
- Commercial use
- Resale or relicensing
- Use in paid products or services

For commercial licensing inquiries, contact the maintainers.

---

## Support

### Common Issues

**Application fails to start**
- Ensure Rust is installed: https://rustup.rs/
- Windows users: Install WebView2 runtime

**Build fails**
- Run `npm install` to ensure dependencies are installed
- Clear build cache: `rm -rf src-tauri/target`
- Verify Node.js version is 20 or later

**Private keys not saving**
- Confirm you are using the desktop application, not a web browser
- Verify the password is entered correctly

### Getting Help
- Check existing [Issues](https://github.com/Steemblocks/Steem-Wallet-Desktop/issues)
- Open a new issue with detailed information about the problem

---

## Links

- Repository: https://github.com/Steemblocks/Steem-Wallet-Desktop
- Steem Blockchain: https://steem.com
- Tauri Framework: https://tauri.app

---

Version: 0.1.0
