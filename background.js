// background.js - Service worker for Palindrome Pay extension

// Import config
importScripts('config.js');

// Initialize cart storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ cart: [] });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addToCart') {
    addToCart(request.product).then(sendResponse);
    return true;
  }

  if (request.action === 'getCart') {
    getCart().then(sendResponse);
    return true;
  }

  if (request.action === 'removeFromCart') {
    removeFromCart(request.productId).then(sendResponse);
    return true;
  }

  if (request.action === 'updateQuantity') {
    updateQuantity(request.productId, request.quantity).then(sendResponse);
    return true;
  }

  if (request.action === 'clearCart') {
    clearCart().then(sendResponse);
    return true;
  }

  if (request.action === 'getConfig') {
    sendResponse({ success: true, config: CONFIG });
    return true;
  }

  if (request.action === 'getEmail') {
    getEmail().then(sendResponse);
    return true;
  }

  if (request.action === 'saveEmail') {
    saveEmail(request.email).then(sendResponse);
    return true;
  }
});

// Cart functions
async function addToCart(product) {
  try {
    const result = await chrome.storage.local.get('cart');
    const cart = result.cart || [];

    // Calculate current cart total
    const currentTotal = cart.reduce((sum, item) => {
      const price = parseFloat((item.price || '0').replace(/[^0-9.]/g, ''));
      return sum + (price * (item.quantity || 1));
    }, 0);

    // Calculate new item price
    const newItemPrice = parseFloat((product.price || '0').replace(/[^0-9.]/g, ''));
    const newItemQuantity = product.quantity || 1;

    // Check if adding this item would exceed $500 limit
    // Match on both ASIN and price (different gift card amounts = different items)
    const existingIndex = cart.findIndex(p => p.asin === product.asin && p.price === product.price);
    let additionalAmount = newItemPrice * newItemQuantity;

    if (currentTotal + additionalAmount > 500) {
      return { success: false, error: `Cart total cannot exceed $500. Current total: $${currentTotal.toFixed(2)}` };
    }

    if (existingIndex >= 0) {
      cart[existingIndex].quantity += newItemQuantity;
    } else {
      product.id = `${product.asin}-${Date.now()}`;
      cart.push(product);
    }

    await chrome.storage.local.set({ cart });
    updateBadge(cart.length);

    return { success: true, cartCount: cart.length };
  } catch (error) {
    console.error('Error adding to cart:', error);
    return { success: false, error: error.message };
  }
}

async function getCart() {
  try {
    const { cart } = await chrome.storage.local.get('cart');
    return { success: true, cart: cart || [] };
  } catch (error) {
    return { success: false, error: error.message, cart: [] };
  }
}

async function removeFromCart(productId) {
  try {
    const { cart } = await chrome.storage.local.get('cart');
    const newCart = cart.filter(p => p.id !== productId);
    await chrome.storage.local.set({ cart: newCart });
    updateBadge(newCart.length);
    return { success: true, cart: newCart };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function updateQuantity(productId, quantity) {
  try {
    const { cart } = await chrome.storage.local.get('cart');
    const index = cart.findIndex(p => p.id === productId);

    if (index >= 0) {
      if (quantity <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].quantity = quantity;
      }
    }

    await chrome.storage.local.set({ cart });
    updateBadge(cart.length);
    return { success: true, cart };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function clearCart() {
  try {
    await chrome.storage.local.set({ cart: [] });
    updateBadge(0);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
}

// Email storage functions
async function getEmail() {
  try {
    const { deliveryEmail } = await chrome.storage.local.get('deliveryEmail');
    return { success: true, email: deliveryEmail || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveEmail(email) {
  try {
    await chrome.storage.local.set({ deliveryEmail: email });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
