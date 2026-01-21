// popup.js - Cart UI and Palindrome Pay Integration

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
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCart' });
    if (response.success) {
      cart = response.cart;
    }
  } catch (error) {
    console.error('Error loading cart:', error);
    cart = [];
  }
}

async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    if (response.success) {
      config = response.config;
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

async function loadEmail() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getEmail' });
    if (response.success && response.email) {
      const emailData = response.email;
      document.getElementById('recipientName').value = emailData.recipientName || '';
      document.getElementById('deliveryEmail').value = emailData.email || '';
      document.getElementById('confirmEmail').value = emailData.email || '';

      // Show saved email display
      if (emailData.email) {
        const savedDisplay = document.getElementById('savedEmailDisplay');
        const savedText = document.getElementById('savedEmailText');
        savedDisplay.style.display = 'block';
        savedText.textContent = `${emailData.recipientName} - ${emailData.email}`;
      }
    }
  } catch (error) {
    console.error('Error loading email:', error);
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

  // Pay button
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

  // Validate recipient name
  if (!recipientName) {
    errorEl.textContent = 'Please enter a recipient name.';
    errorEl.style.display = 'block';
    return;
  }

  // Validate email
  if (!email) {
    errorEl.textContent = 'Please enter an email address.';
    errorEl.style.display = 'block';
    return;
  }

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

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveEmail',
      email: emailData
    });

    if (response.success) {
      showToast('Email saved successfully!', 'success');

      // Update saved email display
      const savedDisplay = document.getElementById('savedEmailDisplay');
      const savedText = document.getElementById('savedEmailText');
      savedDisplay.style.display = 'block';
      savedText.textContent = `${recipientName} - ${email}`;
    } else {
      showToast('Failed to save email', 'error');
    }
  } catch (error) {
    console.error('Error saving email:', error);
    showToast('Failed to save email. Please try again.', 'error');
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
  const subtotal = calculateTotal();
  const deliveryFee = Math.max(...cart.map(item => item.deliveryFee || 0), 0);
  const total = subtotal + deliveryFee;

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('deliveryFee').textContent = deliveryFee > 0 ? `$${deliveryFee.toFixed(2)}` : 'Free';
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

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'updateQuantity',
      productId,
      quantity: newQuantity
    });

    if (response.success) {
      cart = response.cart;
      renderCart();
    }
  } catch (error) {
    console.error('Error updating quantity:', error);
  }
}

async function removeFromCart(productId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'removeFromCart',
      productId
    });

    if (response.success) {
      cart = response.cart;
      renderCart();
    }
  } catch (error) {
    console.error('Error removing from cart:', error);
  }
}

async function clearCart() {
  if (!confirm('Are you sure you want to clear your cart?')) return;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'clearCart' });
    if (response.success) {
      cart = [];
      renderCart();
    }
  } catch (error) {
    console.error('Error clearing cart:', error);
  }
}

// ============================================================================
// PAYMENT - Open Palindrome Pay checkout
// ============================================================================

async function initiatePayment() {
  const payBtn = document.getElementById('payWithCrypto');

  // Validate cart
  if (cart.length === 0) {
    showToast('Your cart is empty.', 'error');
    return;
  }

  // Check email is configured
  try {
    const emailResponse = await chrome.runtime.sendMessage({ action: 'getEmail' });
    if (!emailResponse.success || !emailResponse.email || !emailResponse.email.email) {
      showToast('Please configure your email in Settings first.', 'error');
      switchTab('settings');
      return;
    }

    const savedEmailData = emailResponse.email;
    const totalUSD = calculateTotal();

    // Get delivery fee from cart items
    const deliveryFee = Math.max(...cart.map(item => item.deliveryFee || 0), 0);
    const total = totalUSD + deliveryFee;

    // Build order title
    const orderTitle = 'Amazon Order: ' + cart.map(i => `${i.quantity}x ${truncate(i.title, 30)}`).join(', ').substring(0, 200);

    // Prepare items for JSON
    const items = cart.map(item => ({
      title: item.title,
      qty: item.quantity,
      price: item.price,
      asin: item.asin,
      img: item.imageUrl,
      url: item.productUrl,
      delivery: item.deliveryFee || 0
    }));

    // Get config
    const sellerAddress = config.sellerAddress || '0x9Ca3100BfD6A2b00b9a6ED3Fc90F44617Bc8839C';
    const tokenAddress = config.tokenAddress || '0xf8a8519313befc293bbe86fd40e993655cf7436b';
    const checkoutBaseUrl = config.checkoutUrl || 'https://palindromepay.com/crypto-pay';

    // Build Palindrome Pay URL
    const params = new URLSearchParams({
      seller: sellerAddress,
      amount: total.toFixed(2),
      title: orderTitle,
      token: tokenAddress,
      redirect: 'https://www.amazon.com',
      product: 'true',
      egift: 'true'
    });

    params.set('items', JSON.stringify(items));

    if (savedEmailData.email) {
      params.set('email', savedEmailData.email);
    }
    if (savedEmailData.recipientName) {
      params.set('recipientName', savedEmailData.recipientName);
    }

    params.set('deliveryFee', deliveryFee.toFixed(2));

    // Open checkout
    const checkoutUrl = `${checkoutBaseUrl}?${params.toString()}`;
    chrome.tabs.create({ url: checkoutUrl });

    // Clear cart after opening checkout
    await chrome.runtime.sendMessage({ action: 'clearCart' });
    cart = [];
    renderCart();

    showToast('Checkout opened!', 'success');

  } catch (error) {
    console.error('Payment error:', error);
    showToast('Error opening checkout. Please try again.', 'error');
  }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);

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
