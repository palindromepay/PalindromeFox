# Amazon Crypto Cart - Browser Extension

A Chrome extension that lets you add Amazon products to a custom cart and checkout using cryptocurrency via **Palindrome Pay** escrow.

## Features

- **Custom "Add to Cart" Button**: Appears on Amazon product pages
- **Product Extraction**: Automatically captures title, price, image, quantity, and product URL
- **Cart Management**: View, update quantities, and remove items
- **Crypto Checkout**: Pay with USDC using secure escrow protection
- **Multi-Chain Support**: Base, Polygon, Ethereum, and more
- **Escrow Protection**: Funds held safely until delivery confirmation

## How It Works

1. **Browse Amazon**: A custom "Add to My Cart" button appears on product pages
2. **Build Your Cart**: Click the button to add products to your crypto cart
3. **Review Cart**: Click the extension icon to view your cart
4. **Checkout**: Connect your wallet and pay with USDC
5. **Escrow Protection**: Your payment is held in escrow until you confirm delivery

## Installation

### For Development/Testing:

1. **Download/Clone** this extension folder to your computer

2. **Open Chrome** and navigate to `chrome://extensions/`

3. **Enable Developer Mode** (toggle in the top-right corner)

4. **Click "Load unpacked"** and select the extension folder

5. **Pin the extension** to your toolbar for easy access

### Generate Better Icons (Optional):

1. Open `icons/generate-icons.html` in a browser
2. Right-click each canvas and "Save image as..."
3. Save as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

## Configuration

Before using the extension, configure your payment settings:

1. Click the extension icon
2. Go to the **Settings** tab
3. Configure:
   - **Seller Wallet Address**: The merchant's wallet to receive payments
   - **Payment Token**: USDC contract address (presets available)
   - **Arbiter Address**: Optional dispute resolver (uses Palindrome Pay default if empty)
   - **Escrow Maturity**: Days before auto-release to seller
   - **Blockchain Network**: Select your preferred chain

### Quick Presets

Use the preset buttons for common configurations:
- **Base (USDC)**: Base mainnet with native USDC
- **Base Sepolia (Test)**: Testnet for development
- **Polygon (USDC)**: Polygon mainnet with USDC

## Usage

### Adding Products to Cart

1. Navigate to any Amazon product page
2. Look for the purple **"Add to My Cart"** button below Amazon's cart button
3. Click it to add the product to your crypto cart
4. A confirmation message will appear

### Managing Your Cart

1. Click the extension icon in your browser toolbar
2. View all added products with images, titles, and prices
3. Adjust quantities using +/- buttons
4. Remove items with the "Remove" button
5. Clear entire cart with the trash icon

### Checkout Process

1. Review your cart and click **"Proceed to Crypto Checkout"**
2. Connect your Web3 wallet (MetaMask, etc.)
3. Ensure you're on the correct network
4. Click **"Create Escrow & Pay"**
5. Confirm the transaction in your wallet
6. Wait for confirmation

## Escrow Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   BUYER     │     │   ESCROW    │     │   SELLER    │
│  (You)      │     │  (Contract) │     │ (Merchant)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Create & Pay   │                   │
       │──────────────────>│                   │
       │                   │ 2. Accept Order   │
       │                   │<──────────────────│
       │                   │                   │
       │   (Product Ships) │                   │
       │                   │                   │
       │ 3. Confirm Receipt│                   │
       │──────────────────>│                   │
       │                   │ 4. Funds Released │
       │                   │──────────────────>│
       └───────────────────┴───────────────────┘
```

## Palindrome Pay SDK Integration

This extension is designed to work with the **Palindrome Pay SDK** for secure escrow payments. The key SDK functions used:

```javascript
// Create escrow and deposit payment (buyer flow)
const result = await sdk.createEscrowAndDeposit(walletClient, {
  token: usdcAddress,
  seller: merchantAddress,
  amount: paymentAmount,
  maturityTimeDays: 7n,
  arbiter: arbiterAddress,
  title: "Amazon Order: ...",
  ipfsHash: orderDetailsHash
});

// Confirm delivery (releases funds to seller)
await sdk.confirmDelivery(walletClient, escrowId);

// Request refund (if dispute)
await sdk.requestCancel(walletClient, escrowId);
```

## File Structure

```
amazon-cart-extension/
├── manifest.json        # Extension manifest (Chrome MV3)
├── background.js        # Service worker for cart storage
├── content.js           # Injected script for Amazon pages
├── content-styles.css   # Styles for injected button
├── popup.html           # Extension popup UI
├── popup.css            # Popup styles
├── popup.js             # Popup logic
├── checkout.html        # Full checkout page
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── placeholder.png
└── README.md
```

## Supported Chains

| Chain | Chain ID | USDC Address |
|-------|----------|--------------|
| Base | 8453 | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Base Sepolia | 84532 | 0x036CbD53842c5426634e7929541eC2318f3dCF7e |
| Polygon | 137 | 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 |
| Arbitrum | 42161 | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| Ethereum | 1 | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |

## Security Notes

- **Escrow Protection**: Funds are never sent directly to the seller; they're held in a smart contract
- **Dispute Resolution**: If issues arise, the arbiter can help resolve disputes
- **Auto-Release**: If you don't confirm or dispute within the maturity period, funds release to seller
- **Wallet Security**: Always verify transactions before signing in your wallet

## Limitations

- Currently supports Amazon.com (US store)
- Prices are extracted in USD and converted 1:1 to USDC
- Requires a Web3 wallet (MetaMask recommended)
- Extension popup has limited wallet access; full checkout opens in a new tab

## Development

### Testing Locally

1. Load the extension in Chrome developer mode
2. Use Base Sepolia testnet for testing
3. Get testnet USDC from a faucet
4. Configure test seller address in settings

### Building for Production

1. Replace placeholder icons with proper PNGs
2. Update the Palindrome Pay contract addresses
3. Add your merchant addresses
4. Package with `chrome.extension.getPackageDirectoryEntry()`

## License

MIT License - See LICENSE file for details

## Support

For issues with:
- **Extension**: Open an issue on GitHub
- **Palindrome Pay**: Visit [palindromepay.com](https://palindromepay.com)
- **Web3 Wallet**: Contact your wallet provider

---

**Disclaimer**: This extension is for demonstration purposes. Always verify transactions and only use with trusted merchants. Cryptocurrency transactions are irreversible.
