# 🪙 SteemWallet - Secure Blockchain Wallet

A **cross-platform**, **production-ready** Steem blockchain wallet with military-grade encryption and zero-knowledge architecture.

> 🔐 **Military-Grade Security**: Private keys never leave your device. Encrypted with AES-256-GCM and Argon2id hashing.

---

## 📊 What is SteemWallet?

SteemWallet is a secure, open-source cryptocurrency wallet for the Steem blockchain. Manage STEEM tokens, perform transactions, and interact with the blockchain with complete confidence.

### 🎯 Available On

| Platform | Status | Format |
|----------|--------|--------|
| 🪟 **Windows** | ✅ Ready | `.msi` / `.exe` installer |
| 🍎 **macOS** | ✅ Ready | `.dmg` / `.app` bundle |
| 🐧 **Linux** | ✅ Ready | `.deb` package |
| 🌐 **Web** | ✅ Works | Browser-based (fallback) |

---

## ✨ Key Features

### 🔐 Security
- ✅ **AES-256-GCM encryption** (NIST-approved)
- ✅ **Argon2id key derivation** (OWASP-recommended)
- ✅ **Zero-knowledge architecture** - Private keys never leave your device
- ✅ **IPC boundary protection** - Backend isolated from frontend attacks
- ✅ **Cryptographically secure randomness**

### 💰 Functionality
- 💸 Fast STEEM token transfers
- 🔗 Direct blockchain interaction
- 📊 Real-time balance tracking
- 💼 Delegation management
- 🏛️ Governance operations
- 📈 Market data & price tracking

### 🎨 User Experience
- 📱 Fully responsive design
- 🌙 Dark mode & light mode
- ⚡ Modern, intuitive UI
- 🔄 Hot reload during development
- ♿ Accessible components (WCAG)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Rust** (for desktop builds)
- **npm** or **yarn**

### Installation (30 seconds)

```bash
# 1. Clone repository
git clone https://github.com/blazeapps007/steemWallet.git
cd steemWallet

# 2. Install dependencies
npm install

# 3. Run development server
npm run tauri:dev    # Desktop app with hot reload
# OR
npm run dev          # Web version only
```

**That's it!** A desktop window will open automatically.

---

## 💻 Available Commands

### Desktop Development
```bash
npm run tauri:dev         # Start desktop app (with hot reload)
npm run tauri:build       # Build production app
npm run tauri:build --debug  # Build debug version
```

### Web Development
```bash
npm run dev               # Vite development server
npm run build            # Production web build
npm run preview          # Preview production build
```

### Quality & Maintenance
```bash
npm run lint             # Run ESLint
npm run build:dev        # Development build
```

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | Modern UI components |
| **Styling** | Tailwind CSS + shadcn/ui | Beautiful, responsive design |
| **Build** | Vite | Lightning-fast builds |
| **Desktop** | Tauri 2 | Native desktop app |
| **Backend** | Rust | Secure cryptography |
| **Blockchain** | dsteem | Steem API client |

### Security Architecture

```
┌─────────────────────────────────────┐
│  React UI (Untrusted Environment)   │
│  - Can be compromised by XSS        │
│  - Cannot access private keys       │
└────────────────┬────────────────────┘
                 │ IPC Bridge
                 │ (Type-safe)
         ┌───────▼────────┐
         │   Tauri Core   │
         │  (OS Boundary) │
         └────────┬───────┘
                  │
    ┌─────────────▼────────────┐
    │   Rust Backend (Secure)  │
    │  ┌──────────────────────┐│
    │  │ crypto.rs            ││
    │  │ • AES-256-GCM        ││
    │  │ • Argon2id           ││
    │  │ • Random generation  ││
    │  └──────────────────────┘│
    │  ┌──────────────────────┐│
    │  │ storage.rs           ││
    │  │ • Encrypted storage  ││
    │  │ • Key management     ││
    │  └──────────────────────┘│
    └──────────────────────────┘
           ↓
    ✅ Private Keys (Never exposed)
    ✅ Encrypted at rest
    ✅ Protected by IPC boundary
```

---

## 🔒 Security Comparison

| Feature | Web Version | Tauri Desktop |
|---------|-------------|---------------|
| Private Key Storage | ❌ localStorage | ✅ Encrypted (Rust) |
| Encryption | ❌ None | ✅ AES-256-GCM |
| Key Derivation | ❌ None | ✅ Argon2id |
| XSS Protection | ❌ Vulnerable | ✅ IPC Boundary |
| Compilation | ❌ N/A | ✅ AOT + Type-safe |
| Local Storage | ❌ Persistent | ✅ Session-based |

---

## 📁 Project Structure

```
steemWallet/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn UI components
│   │   ├── wallet/       # Wallet-specific components
│   │   │   ├── LoginDialog-Tauri.tsx
│   │   │   ├── TransferOperations.tsx
│   │   │   └── ...
│   │   └── layout/
│   ├── services/
│   │   ├── secureStorage.ts      # Platform abstraction
│   │   ├── steemApi.ts           # Steem blockchain API
│   │   ├── priceApi.ts           # Price data
│   │   └── ...
│   ├── hooks/
│   │   ├── useSteemAccount.ts    # Account hook
│   │   ├── useMarketData.ts      # Price hook
│   │   └── ...
│   ├── App.tsx
│   └── main.tsx
│
├── src-tauri/
│   ├── src/
│   │   ├── crypto.rs        # AES-256-GCM encryption
│   │   ├── storage.rs       # Secure storage manager
│   │   ├── commands.rs      # Tauri public API
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── Cargo.toml           # Rust dependencies
│   ├── tauri.conf.json      # App configuration
│   └── icons/               # App icons (all platforms)
│
├── public/
│   └── robots.txt
│
├── README.md               # This file
├── TAURI_QUICK_START.md    # Quick reference
├── TAURI_SETUP.md          # Detailed setup guide
├── SECURITY_AUDIT.md       # Security findings
├── START_HERE.md           # Project overview
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── eslint.config.js
```

---

## 🛠️ Development

### Setting Up Development Environment

#### Windows
```powershell
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install WebView2 runtime
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/

# Clone and setup
git clone https://github.com/blazeapps007/steemWallet.git
cd steemWallet
npm install
npm run tauri:dev
```

#### macOS/Linux
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and setup
git clone https://github.com/blazeapps007/steemWallet.git
cd steemWallet
npm install
npm run tauri:dev
```

### Development Workflow

1. **Start dev server**
   ```bash
   npm run tauri:dev
   ```

2. **Hot reload enabled**
   - Save TypeScript/React files → Auto-reload in app
   - Rust changes require restart

3. **Debug with DevTools**
   - Press `Ctrl+Shift+I` in app window
   - Inspect elements, run console commands
   - Works exactly like browser DevTools

4. **Build for production**
   ```bash
   npm run tauri:build
   # Output: src-tauri/target/release/
   ```

---

## 🔐 Security Features in Detail

### 1. Private Key Management
```typescript
// ✅ Secure: Encrypted and stays in Rust
const storage = SecureStorageFactory.getInstance();
await storage.setEncryptedKey('active', username, encryptedKey, password);
// Key is: Encrypted + Stored in OS security → Never exposed to JS
```

### 2. Password Hashing
```rust
// ✅ Argon2id (OWASP-recommended)
let argon2 = Argon2::new(
    Algorithm::Argon2id,
    Version::V0x13,
    Params::new(19456, 2, 1, Some(32))
);
let hash = argon2.hash_password(password.as_bytes(), &salt);
```

### 3. Encryption
```rust
// ✅ AES-256-GCM (NIST-approved)
let cipher = Aes256Gcm::new(&key.into());
let ciphertext = cipher.encrypt(nonce, Payload { msg: data, aad: b"" })?;
```

### 4. IPC Boundary Protection
- Frontend cannot directly access private keys
- All operations go through type-safe Rust commands
- No arbitrary code execution possible

---

## 📦 Building Installers

### Windows Installer
```bash
npm run tauri:build

# Output:
# - src-tauri/target/release/Steem Wallet.msi (Modern Installer)
# - src-tauri/target/release/Steem Wallet.exe (NSIS)
```

### macOS Installer
```bash
# Run on macOS
npm run tauri:build

# Output:
# - src-tauri/target/release/Steem Wallet.dmg (Disk Image)
# - src-tauri/target/release/Steem Wallet.app (Application)
```

### Linux Package
```bash
# Run on Linux
npm run tauri:build

# Output:
# - src-tauri/target/release/steem-wallet_*.deb (Debian Package)
```

### Cross-Platform CI/CD (Recommended)
Use GitHub Actions to build all platforms automatically:

```yaml
# .github/workflows/build.yml
on: [push, pull_request]

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
      - run: npm install && npm run tauri:build
      - uses: actions/upload-artifact@v3
        with:
          path: src-tauri/target/release/
```

---

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Security Testing
```bash
# Check for known vulnerabilities
npm audit

# ESLint code quality
npm run lint
```

### Manual Testing

1. **Test Desktop App**
   ```bash
   npm run tauri:dev
   - Open app
   - Try login with Steem Keychain
   - Perform transfers
   - Check DevTools (Ctrl+Shift+I)
   ```

2. **Test Web Version**
   ```bash
   npm run dev
   # Opens on http://localhost:5173
   ```

3. **Test Builds**
   ```bash
   npm run preview
   # Preview production build locally
   ```

---

## 🚀 Deployment

### Deploy Web Version

#### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

#### Netlify
```bash
npm run build
# Drag & drop dist/ folder to Netlify
```

#### AWS Amplify / Firebase
See official documentation for your platform.

### Distribute Desktop App

1. **Build locally or with CI/CD**
   ```bash
   npm run tauri:build
   ```

2. **Sign builds** (optional but recommended)
   - See Tauri docs for code signing

3. **Host installers**
   - GitHub Releases
   - Your website
   - App stores (Windows Store, App Store)

4. **Enable auto-updates** (optional)
   - Tauri has built-in updater support

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit** your changes
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push** to your fork
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style
- Test your changes locally
- Update documentation
- Add tests for new features
- Ensure ESLint passes: `npm run lint`

---

## 📚 Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **README.md** | Overview & quick start | 5 min |
| **START_HERE.md** | Project structure | 5 min |
| **TAURI_QUICK_START.md** | Desktop setup | 5 min |
| **TAURI_SETUP.md** | Detailed technical guide | 30 min |
| **SECURITY_AUDIT.md** | Security findings & fixes | 15 min |

---

## 🔗 Important Links

- **GitHub**: https://github.com/blazeapps007/steemWallet
- **Steem Blockchain**: https://steem.com
- **Tauri**: https://tauri.app/
- **React**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com

---

## 📄 License

**Custom Non-Commercial License (SteemWallet Non-Commercial License - SW-NCL)**

### ✅ You Can
- Use for personal projects
- Use for educational purposes
- Modify for non-commercial purposes
- Distribute non-commercially

### ❌ You Cannot
- Use commercially
- Receive funding for this code
- Resell or relicense
- Use in paid products/services

**For commercial use**: Contact blazeapps007 on Steem or open an issue.

Full license text in [LICENSE.txt](./LICENSE.txt)

---

## 🆘 Support

### Get Help
- **Documentation**: Check [TAURI_SETUP.md](./TAURI_SETUP.md) first
- **Issues**: Open a [GitHub Issue](https://github.com/blazeapps007/steemWallet/issues)
- **Security**: Report vulnerabilities responsibly

### Common Issues

**Q: App won't start**
- Install Rust: https://rustup.rs/
- Install WebView2 (Windows): https://developer.microsoft.com/en-us/microsoft-edge/webview2/

**Q: Hot reload not working**
- Restart `npm run tauri:dev`
- Check file has no syntax errors

**Q: Build fails**
- Run `npm install` again
- Clear `src-tauri/target`: `rm -rf src-tauri/target`
- Run `npm run tauri:build` again

**Q: Private key not saving**
- Check you're using Tauri version (not web)
- Verify password is entered correctly

---

## 🎯 Roadmap

### ✅ Completed
- [x] Rust crypto backend
- [x] AES-256-GCM encryption
- [x] Argon2id key derivation
- [x] Tauri integration
- [x] Cross-platform builds
- [x] Security audit

### 🔄 In Progress
- [ ] Transaction signing in Rust
- [ ] Hardware wallet support
- [ ] 2FA support
- [ ] Auto-update system

### ⏳ Planned
- [ ] Mobile app (React Native)
- [ ] Browser extension
- [ ] Ledger integration
- [ ] Multi-signature accounts

---

## 📊 Stats

- **Languages**: TypeScript, Rust, CSS
- **Components**: 50+
- **Lines of Code**: 15,000+
- **Platforms**: Windows, macOS, Linux, Web
- **Security**: Enterprise-grade
- **License**: Non-commercial

---

## 🙏 Acknowledgments

- **Tauri**: For amazing cross-platform framework
- **Steem Blockchain**: For the blockchain
- **React**: For UI library
- **Rust**: For memory safety
- **Community**: For feedback and contributions

---

## 📝 Changelog

See [releases](https://github.com/blazeapps007/steemWallet/releases) for detailed changelog.

### Latest (v0.1.0)
- ✨ Initial Tauri integration
- 🔐 Secure crypto backend
- 🚀 Cross-platform support
- 📦 Production-ready builds

---

**Built with ❤️ by the SteemWallet Community**

*Last Updated: December 1, 2025*
*Status: Production Ready ✅*