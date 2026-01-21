// popup.js - Cart UI and Crypto Checkout Integration

// ============================================================================
// STATE
// ============================================================================

let cart = [];
let config = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadCart();
  await loadConfig();
  await loadEmail();
  setupEventListeners();
  renderCart();
});

async function loadCart() {
  const response = await chrome.runtime.sendMessage({ action: 'getCart' });
  if (response.success) {
    cart = response.cart;
  }
}

async function loadConfig() {
  const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
  if (response.success) {
    config = response.config;
  }
}

async function loadEmail() {
  const response = await chrome.runtime.sendMessage({ action: 'getEmail' });
  if (response.success && response.email) {
    const emailData = response.email;
    document.getElementById('recipientName').value = emailData.recipientName || '';
    document.getElementById('deliveryEmail').value = emailData.email || '';
    document.getElementById('confirmEmail').value = emailData.email || '';
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

  // Email form
  document.getElementById('emailForm').addEventListener('submit', saveEmail);
}

async function saveEmail(e) {
  e.preventDefault();

  const email = document.getElementById('deliveryEmail').value.trim();
  const confirmEmail = document.getElementById('confirmEmail').value.trim();
  const recipientName = document.getElementById('recipientName').value.trim();
  const errorEl = document.getElementById('emailError');

  // Validate emails match
  if (email !== confirmEmail) {
    errorEl.textContent = 'Email addresses do not match. Please check and try again.';
    errorEl.style.display = 'block';
    return;
  }

  // Hide error if previously shown
  errorEl.style.display = 'none';

  const emailData = {
    recipientName: recipientName,
    email: email
  };

  const response = await chrome.runtime.sendMessage({
    action: 'saveEmail',
    email: emailData
  });

  if (response.success) {
    showToast('Email saved successfully!', 'success');
  } else {
    showToast('Failed to save email', 'error');
  }
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

  // Get delivery fee from cart items (use max delivery fee)
  const deliveryFee = Math.max(...cart.map(item => item.deliveryFee || 0), 0);
  const total = subtotal + deliveryFee;

  // Render checkout items summary
  checkoutItemsEl.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <span class="checkout-item-name">${escapeHtml(truncate(item.title, 30))}</span>
      <span>${item.quantity}x ${item.price || 'N/A'}</span>
    </div>
  `).join('');

  // Update totals
  document.getElementById('checkoutTotal').textContent = `$${subtotal.toFixed(2)}`;

  // Show delivery fee (Free if 0)
  const deliveryDisplay = deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : 'Free';
  document.getElementById('deliveryFee').textContent = deliveryDisplay;

  // Convert to USDT (1:1 with USD for stablecoins)
  document.getElementById('cryptoAmount').textContent = `${total.toFixed(2)} USDT`;
}

// ============================================================================
// CRYPTO PAYMENT (Palindrome Pay Integration)
// ============================================================================

async function initiatePayment() {
  const payBtn = document.getElementById('payWithCrypto');
  const txStatusEl = document.getElementById('txStatus');
  const txStatusTextEl = document.getElementById('txStatusText');

  // Validate cart
  if (cart.length === 0) {
    showToast('Your cart is empty.', 'error');
    return;
  }

  try {
    payBtn.disabled = true;
    txStatusEl.classList.remove('hidden', 'success', 'error');
    txStatusTextEl.textContent = 'Preparing transaction...';

    const subtotal = calculateTotal();
    // Get delivery fee from cart items (use max delivery fee)
    const deliveryFee = Math.max(...cart.map(item => item.deliveryFee || 0), 0);
    const total = subtotal + deliveryFee;

    // Create order summary for IPFS/title
    const orderSummary = cart.map(item =>
      `${item.quantity}x ${truncate(item.title, 50)}`
    ).join('; ');

    // Build checkout data
    const checkoutData = {
      token: config.tokenAddress,
      seller: config.sellerAddress,
      title: `Amazon Order: ${truncate(orderSummary, 200)}`,
      cart: cart,
      totalUSD: total,
      deliveryFee: deliveryFee,
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
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);
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
