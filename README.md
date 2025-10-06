# 🚀 nexaView - Nexa Wallet Balance Tracker

**nexaView** is a Progressive Web App (PWA) that allows you to track multiple Nexa wallet balances in real-time. Read-only, secure, and no private information required.

## ✨ Features

- 📱 **Full PWA**: Installable on mobile and desktop
- 💼 **Multi-Wallet Tracking**: Save and monitor unlimited wallets
- 🔄 **Real-Time Updates**: Check balances instantly with manual refresh
- 💾 **Offline Support**: View saved wallets and last known balances without connection
- 🎨 **Modern Design**: Minimalist UI with golden Nexa theme
- 🔒 **Secure**: Public queries only, no private keys or seeds needed
- ⚡ **Lightweight**: Pure HTML/CSS/JS, no heavy frameworks

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js serverless function (Vercel)
- **API**: Nexa API (https://nexaapi.deno.dev)
- **Deployment**: Vercel
- **PWA**: Service Worker, Web App Manifest
- **Storage**: LocalStorage for wallet persistence

## 📁 Project Structure

```
nexaView/
├── index.html              # Main page
├── style.css               # Application styles
├── app.js                  # Application logic
├── manifest.json           # PWA configuration
├── service-worker.js       # Service Worker for offline cache
├── api/
│   └── balance.js          # Serverless function (API proxy)
├── icons/
│   ├── icon-128x128.png    # PWA icon 128x128
│   └── icon-512x512.png    # PWA icon 512x512
├── vercel.json             # Vercel configuration
├── package.json            # Project dependencies
├── .gitignore              # Ignored files
└── README.md               # This file
```

## 🚀 Deploy to Vercel

### Option 1: Deploy from GitHub (Recommended)

1. **Create GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: nexaView PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nexaView.git
   git push -u origin main
   ```

2. **Connect with Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will automatically detect the configuration
   - Click "Deploy"

3. **Automatic deployment**:
   - Every push to `main` will deploy automatically
   - Pull requests create automatic previews

### Option 2: Deploy with Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   # Test deployment
   vercel
   
   # Production deployment
   vercel --prod
   ```

### Option 3: Manual Deploy

1. Upload files to your Git repository
2. Connect the repository with Vercel from the dashboard
3. Vercel will deploy automatically

## 🧪 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   vercel dev
   ```

3. **Open in browser**:
   ```
   http://localhost:3000
   ```

**Note**: Use `vercel dev` instead of `npm run dev` to test the serverless API functions locally.

## 📱 Install as PWA

### On Mobile (Android/iOS):

1. Open the app in your browser
2. Tap the browser menu (⋮ or ⋯)
3. Select "Add to Home Screen" or "Install App"
4. Confirm installation

### On Desktop (Chrome/Edge):

1. Open the app in your browser
2. Click the install icon (➕) in the address bar
3. Or go to Menu → "Install nexaView"
4. Confirm installation

## 🔧 Configuration

### Environment Variables (Optional)

If you need to configure environment variables, create a `.env.local` file:

```env
# Nexa API (already configured by default)
NEXA_API_URL=https://nexaapi.deno.dev
```

### Customization

- **Colors**: Edit CSS variables in `style.css` (`:root`)
- **API Endpoint**: Modify `API_ENDPOINT` in `app.js` if using a different API

## 📖 How to Use

### 1. **Add a Wallet**
   - Click the **"Add Wallet"** button
   - Enter a Nexa address (format: `nexa:...`)
   - Click **"View Balance"**
   - The balance will be displayed instantly

### 2. **Save Wallets**
   - After viewing a balance, click the **Save** button (💾)
   - The wallet will be added to your saved list
   - Saved wallets persist in your browser's local storage

### 3. **Manage Saved Wallets**
   - **View**: Click on any saved wallet to see its current balance
   - **Refresh**: Click the refresh button (🔄) on individual wallets
   - **Refresh All**: Use the "Refresh All" button to update all wallets at once
   - **Delete**: Click the trash icon (🗑️) to remove a wallet from the list

### 4. **Offline Mode**
   - Saved wallets and their last known balances are available offline
   - The app will display cached data when there's no internet connection
   - Balances will update automatically when connection is restored

## 🔒 Security

- ✅ **No private information**: Only queries public addresses
- ✅ **No seeds or keys**: No sensitive information required
- ✅ **HTTPS**: All communications are secure
- ✅ **No tracking**: No personal data collection
- ✅ **Open Source**: Fully auditable code
- ✅ **Local storage only**: Wallet data never leaves your device

## 🐛 Troubleshooting

### Error: "Address must start with 'nexa:'"
- Make sure the address begins with `nexa:`
- Copy the complete address

### Error: "Error fetching balance"
- Check your internet connection
- The Nexa API might be temporarily unavailable
- Try again in a few seconds

### App won't install as PWA
- Verify you're using HTTPS (required for PWA)
- Make sure your browser supports PWA (Chrome, Edge, Safari)
- Clear browser cache and try again

### Service Worker not registering
- Open DevTools → Application → Service Workers
- Check for errors in the console
- Try "Unregister" and reload the page

### Saved wallets disappeared
- Check if browser data/cookies were cleared
- Wallets are stored in LocalStorage (browser-specific)
- Export important addresses as backup

## 📊 API Endpoint

The app uses a serverless proxy to avoid CORS issues:

```
GET /api/balance/:address
```

**Example**:
```bash
curl https://your-domain.vercel.app/api/balance/nexa:nqtsq5g5sjkqk7wzd9wwh9423rr0tda7m027ryljkfy84cjz
```

**Response**:
```json
{
  "success": true,
  "address": "nexa:...",
  "balance": 269369516318770,
  "unconfirmed": 0,
  "timestamp": "2025-10-06T14:52:43.000Z"
}
```

**Note**: Balance is returned in satoshis (1 NEX = 100 satoshis). The frontend automatically converts it for display.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## 🙏 Acknowledgments

- [Nexa](https://nexa.org) - For the blockchain and public API
- [Vercel](https://vercel.com) - For free hosting
- The Nexa developer community

## 📧 Contact

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/nexaView/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/nexaView/discussions)

---

**Made with ❤️ for the Nexa community**
