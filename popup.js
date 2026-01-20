// popup.js - Cart UI and Crypto Checkout Integration

// ============================================================================
// STATE
// ============================================================================

let cart = [];
let settings = {};
let walletConnected = false;
let userAddress = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadCart();
  await loadSettings();
  setupEventListeners();
  renderCart();
});

async function loadCart() {
  const response = await chrome.runtime.sendMessage({ action: 'getCart' });
  if (response.success) {
    cart = response.cart;
  }
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
  if (response.success) {
    settings = response.settings;
    populateSettingsForm();
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Cart actions
  document.getElementById('clearCartBtn').addEventListener('click', clearCart);
  document.getElementById('proceedCheckout').addEventListener('click', () => switchTab('checkout'));

  // Checkout actions
  document.getElementById('payWithCrypto').addEventListener('click', initiatePayment);

  // Settings actions
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('settingsBtn').addEventListener('click', () => switchTab('settings'));

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Special handling for checkout tab
  if (tabName === 'checkout') {
    renderCheckout();
  }
}

// ============================================================================
// CART RENDERING
// ============================================================================

function renderCart() {
  const cartItemsEl = document.getElementById('cartItems');
  const emptyCartEl = document.getElementById('emptyCart');
  const cartSummaryEl = document.getElementById('cartSummary');
  const cartBadgeEl = document.getElementById('cartBadge');

  // Update badge
  cartBadgeEl.textContent = cart.length;

  if (cart.length === 0) {
    emptyCartEl.style.display = 'flex';
    cartItemsEl.innerHTML = '';
    cartSummaryEl.classList.add('hidden');
    return;
  }

  emptyCartEl.style.display = 'none';
  cartSummaryEl.classList.remove('hidden');

  // Render items
  cartItemsEl.innerHTML = cart.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img 
        class="cart-item-image" 
        src="${item.imageUrl || 'icons/placeholder.png'}" 
        alt="${escapeHtml(item.title)}"
        onerror="this.src='icons/placeholder.png'"
      />
      <div class="cart-item-details">
        <div class="cart-item-title">
          <a href="${item.productUrl}" target="_blank" title="${escapeHtml(item.title)}">
            ${escapeHtml(truncate(item.title, 60))}
          </a>
        </div>
        <div class="cart-item-price">${item.price || 'Price N/A'}</div>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control">
          <button class="quantity-btn minus" data-id="${item.id}">−</button>
          <span class="quantity-value">${item.quantity}</span>
          <button class="quantity-btn plus" data-id="${item.id}">+</button>
        </div>
        <button class="remove-btn" data-id="${item.id}">Remove</button>
      </div>
    </div>
  `).join('');

  // Add quantity event listeners
  cartItemsEl.querySelectorAll('.quantity-btn.minus').forEach(btn => {
    btn.addEventListener('click', () => updateQuantity(btn.dataset.id, -1));
  });

  cartItemsEl.querySelectorAll('.quantity-btn.plus').forEach(btn => {
    btn.addEventListener('click', () => updateQuantity(btn.dataset.id, 1));
  });

  cartItemsEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });

  // Update summary
  const total = calculateTotal();
  document.getElementById('subtotal').textContent = `$${total.toFixed(2)}`;
  document.getElementById('totalPrice').textContent = `$${total.toFixed(2)}`;
}

function calculateTotal() {
  return cart.reduce((sum, item) => {
    const price = parsePrice(item.price);
    return sum + (price * item.quantity);
  }, 0);
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const match = priceStr.match(/[\d,]+\.?\d*/);
  if (match) {
    return parseFloat(match[0].replace(',', ''));
  }
  return 0;
}

// ============================================================================
// CART ACTIONS
// ============================================================================

async function updateQuantity(productId, delta) {
  const item = cart.find(p => p.id === productId);
  if (!item) return;

  const newQuantity = item.quantity + delta;
  
  const response = await chrome.runtime.sendMessage({
    action: 'updateQuantity',
    productId,
    quantity: newQuantity
  });

  if (response.success) {
    cart = response.cart;
    renderCart();
  }
}

async function removeFromCart(productId) {
  const response = await chrome.runtime.sendMessage({
    action: 'removeFromCart',
    productId
  });

  if (response.success) {
    cart = response.cart;
    renderCart();
  }
}

async function clearCart() {
  if (!confirm('Are you sure you want to clear your cart?')) return;

  const response = await chrome.runtime.sendMessage({ action: 'clearCart' });
  if (response.success) {
    cart = [];
    renderCart();
  }
}

// ============================================================================
// CHECKOUT RENDERING
// ============================================================================

function renderCheckout() {
  const checkoutItemsEl = document.getElementById('checkoutItems');
  const subtotal = calculateTotal();
  const shippingFee = 5.99; // Standard delivery fee
  const total = subtotal + shippingFee;

  // Render checkout items summary
  checkoutItemsEl.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <span class="checkout-item-name">${escapeHtml(truncate(item.title, 30))}</span>
      <span>${item.quantity}x ${item.price || 'N/A'}</span>
    </div>
  `).join('');

  // Update totals
  document.getElementById('checkoutTotal').textContent = `$${subtotal.toFixed(2)}`;

  // Convert to USDT (1:1 with USD for stablecoins) - includes shipping
  const usdtAmount = total;
  const fee = usdtAmount * 0.01; // 1% escrow fee

  document.getElementById('cryptoAmount').textContent = `${usdtAmount.toFixed(2)} USDT`;
  document.getElementById('escrowFee').textContent = `${fee.toFixed(2)} USDT`;

  // Update wallet status
  updateWalletUI();
}

// ============================================================================
// WALLET CONNECTION
// ============================================================================

async function connectWallet() {
  // Extension popups cannot access window.ethereum (MetaMask)
  // Wallet connection happens in the checkout modal on the Amazon page
  // This button now just initiates the checkout flow
  initiatePayment();
}

function updateWalletUI() {
  const payBtn = document.getElementById('payWithCrypto');

  // Enable pay button if cart has items and seller is configured
  if (payBtn) {
    payBtn.disabled = cart.length === 0 || !settings.sellerAddress;
  }
}

// ============================================================================
// CRYPTO PAYMENT (Palindrome Pay Integration)
// ============================================================================

async function initiatePayment() {
  const payBtn = document.getElementById('payWithCrypto');
  const txStatusEl = document.getElementById('txStatus');
  const txStatusTextEl = document.getElementById('txStatusText');

  // Validate settings
  if (!settings.sellerAddress) {
    alert('Please configure the seller wallet address in Settings first.');
    switchTab('settings');
    return;
  }

  if (!settings.tokenAddress) {
    alert('Please configure the payment token address in Settings first.');
    switchTab('settings');
    return;
  }

  try {
    payBtn.disabled = true;
    txStatusEl.classList.remove('hidden', 'success', 'error');
    txStatusTextEl.textContent = 'Preparing transaction...';

    const subtotal = calculateTotal();
    const shippingFee = 5.99; // Standard delivery fee
    const total = subtotal + shippingFee;

    // Create order summary for IPFS/title
    const orderSummary = cart.map(item =>
      `${item.quantity}x ${truncate(item.title, 50)}`
    ).join('; ');

    // Build checkout data (use strings for BigInt values to allow serialization)
    const checkoutData = {
      token: settings.tokenAddress,
      seller: settings.sellerAddress,
      amount: parseUnits(total.toString(), 6).toString(), // Convert BigInt to string - includes shipping
      maturityTimeDays: settings.maturityDays || 14,
      arbiter: settings.arbiterAddress || '',
      title: `Amazon Order: ${truncate(orderSummary, 200)}`,
      ipfsHash: '',
      cart: cart,
      totalUSD: total,
      shippingFee: shippingFee,
      timestamp: new Date().toISOString(),
    };

    txStatusTextEl.textContent = 'Please confirm in your wallet...';

    // Store checkout data for the checkout modal
    await chrome.storage.local.set({ pendingCheckout: checkoutData });

    txStatusTextEl.textContent = 'Opening checkout...';

    // Get current active tab (should be Amazon page)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url && tab.url.includes('amazon.com')) {
      // Inject checkout modal into Amazon page where MetaMask is available
      await chrome.tabs.sendMessage(tab.id, {
        action: 'openCheckoutModal',
        checkoutData: checkoutData
      });

      txStatusEl.classList.add('success');
      txStatusTextEl.textContent = 'Checkout opened! Check the Amazon tab.';

      // Close popup after a short delay
      setTimeout(() => window.close(), 1500);
    } else {
      // Fallback: open checkout.html in new tab (limited wallet support)
      chrome.tabs.create({
        url: chrome.runtime.getURL('checkout.html')
      });

      txStatusEl.classList.add('success');
      txStatusTextEl.textContent = 'Checkout opened in new tab!';
    }

  } catch (error) {
    console.error('Payment error:', error);
    txStatusEl.classList.add('error');
    txStatusTextEl.textContent = `Error: ${error.message}`;
  } finally {
    setTimeout(() => {
      payBtn.disabled = !walletConnected || cart.length === 0;
    }, 2000);
  }
}

// Helper to convert to token units (simulated)
function parseUnits(value, decimals) {
  const parts = value.split('.');
  let integer = parts[0];
  let fraction = parts[1] || '';
  
  fraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  
  return BigInt(integer + fraction);
}

// ============================================================================
// SETTINGS
// ============================================================================

function populateSettingsForm() {
  document.getElementById('sellerAddress').value = settings.sellerAddress || '';
  document.getElementById('tokenAddress').value = settings.tokenAddress || '';
  document.getElementById('arbiterAddress').value = settings.arbiterAddress || '';
  document.getElementById('maturityDays').value = settings.maturityDays || 7;
  document.getElementById('chainSelect').value = settings.chainId || '8453';
}

async function saveSettings() {
  const statusEl = document.getElementById('settingsStatus');
  
  const newSettings = {
    sellerAddress: document.getElementById('sellerAddress').value.trim(),
    tokenAddress: document.getElementById('tokenAddress').value.trim(),
    arbiterAddress: document.getElementById('arbiterAddress').value.trim(),
    maturityDays: parseInt(document.getElementById('maturityDays').value) || 7,
    chainId: parseInt(document.getElementById('chainSelect').value)
  };

  // Validate addresses
  if (newSettings.sellerAddress && !isValidAddress(newSettings.sellerAddress)) {
    showSettingsStatus('Invalid seller address', 'error');
    return;
  }

  if (newSettings.tokenAddress && !isValidAddress(newSettings.tokenAddress)) {
    showSettingsStatus('Invalid token address', 'error');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    action: 'saveSettings',
    settings: newSettings
  });

  if (response.success) {
    settings = newSettings;
    showSettingsStatus('Settings saved successfully!', 'success');
    updateWalletUI();
  } else {
    showSettingsStatus('Failed to save settings', 'error');
  }
}

function showSettingsStatus(message, type) {
  const statusEl = document.getElementById('settingsStatus');
  statusEl.textContent = message;
  statusEl.className = `settings-status ${type}`;
  statusEl.classList.remove('hidden');
  
  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 3000);
}

function applyPreset(preset) {
  const presets = {
    'base': {
      chainId: 8453,
      tokenAddress: '0xf8a8519313befc293bbe86fd40e993655cf7436b', // USDT on Base
    },
    'base-testnet': {
      chainId: 84532,
      tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Test token on Base Sepolia
    },
    'polygon': {
      chainId: 137,
      tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT on Polygon
    },
  };

  const preset_data = presets[preset];
  if (preset_data) {
    document.getElementById('chainSelect').value = preset_data.chainId;
    document.getElementById('tokenAddress').value = preset_data.tokenAddress;
    showSettingsStatus(`Applied ${preset} preset. Don't forget to save!`, 'success');
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
