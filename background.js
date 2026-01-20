// background.js - Service worker for cart management

// Initialize cart storage
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    cart: [],
    settings: {
      sellerAddress: '0x9Ca3100BfD6A2b00b9a6ED3Fc90F44617Bc8839C', // Seller's wallet address
      arbiterAddress: '', // Optional arbiter address
      tokenAddress: '0xf8a8519313befc293bbe86fd40e993655cf7436b', // USDT contract address on Base
      maturityDays: 7, // Default escrow maturity
      chainId: 8453 // Base mainnet by default
    }
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addToCart') {
    addToCart(request.product).then(sendResponse);
    return true; // Keep channel open for async response
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
  
  if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  
  if (request.action === 'saveSettings') {
    saveSettings(request.settings).then(sendResponse);
    return true;
  }
});

async function addToCart(product) {
  try {
    const { cart } = await chrome.storage.local.get('cart');
    const existingIndex = cart.findIndex(p => p.asin === product.asin);
    
    if (existingIndex >= 0) {
      // Update quantity if product exists
      cart[existingIndex].quantity += product.quantity || 1;
    } else {
      // Add new product with unique ID
      product.id = `${product.asin}-${Date.now()}`;
      cart.push(product);
    }
    
    await chrome.storage.local.set({ cart });
    
    // Update badge
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

async function getSettings() {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    return { success: true, settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function saveSettings(newSettings) {
  try {
    await chrome.storage.local.set({ settings: newSettings });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
}
