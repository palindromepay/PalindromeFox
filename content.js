// content.js - Injects custom "Add to Cart" button on Amazon product pages

(function() {
  'use strict';

  // Check if we're on a product page
  function isProductPage() {
    return document.getElementById('productTitle') !== null ||
           document.getElementById('title') !== null ||
           document.querySelector('[data-asin]') !== null;
  }

  // Extract product information from the page
  function extractProductInfo() {
    // Get product title
    const titleElement = document.getElementById('productTitle') || 
                         document.getElementById('title') ||
                         document.querySelector('h1.a-size-large');
    const title = titleElement ? titleElement.textContent.trim() : 'Unknown Product';

    // Get product image
    const imageElement = document.getElementById('landingImage') ||
                         document.getElementById('imgBlkFront') ||
                         document.querySelector('#main-image-container img') ||
                         document.querySelector('#imageBlock img') ||
                         document.querySelector('.a-dynamic-image');
    const imageUrl = imageElement ? (imageElement.src || imageElement.dataset.src || imageElement.dataset.oldHires) : '';

    // Get product price
    const priceElement = document.querySelector('.a-price .a-offscreen') ||
                         document.getElementById('priceblock_ourprice') ||
                         document.getElementById('priceblock_dealprice') ||
                         document.querySelector('.a-price-whole') ||
                         document.querySelector('[data-a-color="price"] .a-offscreen');
    let price = priceElement ? priceElement.textContent.trim() : 'Price not available';
    
    // Clean up price if needed
    if (price && !price.startsWith('$')) {
      const priceWhole = document.querySelector('.a-price-whole');
      const priceFraction = document.querySelector('.a-price-fraction');
      if (priceWhole) {
        price = '$' + priceWhole.textContent.replace(',', '').trim();
        if (priceFraction) {
          price += priceFraction.textContent.trim();
        }
      }
    }

    // Get ASIN (Amazon product ID) - prioritize URL extraction for accuracy
    let asin = '';
    // First try to get from URL (most reliable)
    const urlMatch = window.location.pathname.match(/\/dp\/([A-Z0-9]{10})/);
    if (urlMatch) {
      asin = urlMatch[1];
    } else {
      // Fallback to hidden input or data attribute
      const asinInput = document.querySelector('input[name="ASIN"]');
      if (asinInput) {
        asin = asinInput.value;
      } else {
        // Last resort: get from main product container (not recommendations)
        const mainProduct = document.querySelector('#dp-container [data-asin]') ||
                           document.querySelector('#ppd [data-asin]');
        if (mainProduct && mainProduct.dataset.asin) {
          asin = mainProduct.dataset.asin;
        }
      }
    }

    // Get product URL
    const productUrl = window.location.href.split('?')[0];

    // Get quantity (default to 1)
    const quantitySelect = document.getElementById('quantity');
    const quantity = quantitySelect ? parseInt(quantitySelect.value) || 1 : 1;

    // Get delivery fee
    const deliveryFee = extractDeliveryFee();

    return {
      title,
      imageUrl,
      price,
      asin,
      productUrl,
      quantity,
      deliveryFee,
      addedAt: new Date().toISOString()
    };
  }

  // Extract delivery fee from Amazon product page
  function extractDeliveryFee() {
    const selectors = [
      '#deliveryBlockMessage',
      '#mir-layout-DELIVERY_BLOCK',
      '[data-csa-c-delivery-price]',
      '#delivery-message',
      '.delivery-message'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent || '';
        // Check for FREE delivery
        if (/free/i.test(text)) return 0;
        // Extract price like "$5.99" or "5.99"
        const match = text.match(/\$?([\d,]+\.?\d*)/);
        if (match) return parseFloat(match[1].replace(',', ''));
      }
    }
    return 0; // No delivery fee found = Free
  }

  // Create and inject the custom Add to Cart button
  function injectCustomButton() {
    // Don't inject if already exists
    if (document.getElementById('custom-cart-btn-container')) {
      return;
    }

    // Find Amazon's Add to Cart feature div
    const amazonCartDiv = document.getElementById('addToCart_feature_div');

    if (!amazonCartDiv) {
      console.log('Custom Cart: Could not find Amazon Add to Cart section');
      return;
    }

    // Create our custom button
    const container = document.createElement('div');
    container.id = 'custom-cart-btn-container';
    container.innerHTML = `
      <button id="custom-add-to-cart-btn" class="custom-cart-btn">
        <span class="btn-text">Add to Cart</span>
      </button>
      <div id="custom-cart-feedback" class="feedback-message"></div>
      <div class="powered-by">
        Powered by <img src="${chrome.runtime.getURL('palindromepay-crypto-escrow-payment.png')}" alt="Palindrome Pay" class="powered-by-brand-logo" />
      </div>
    `;

    // Hide Amazon's entire add to cart section and insert ours in its place
    amazonCartDiv.style.display = 'none';
    amazonCartDiv.parentElement.insertBefore(container, amazonCartDiv.nextSibling);

    // Also hide Amazon's Buy Now button
    const buyNowDiv = document.getElementById('buyNow_feature_div');
    if (buyNowDiv) {
      buyNowDiv.style.display = 'none';
    }

    // Add click handler
    const customBtn = document.getElementById('custom-add-to-cart-btn');
    const feedbackEl = document.getElementById('custom-cart-feedback');

    customBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      // Show loading state
      customBtn.classList.add('loading');
      customBtn.querySelector('.btn-text').textContent = 'Adding...';

      const productInfo = extractProductInfo();

      // Validate product info
      if (!productInfo.title || productInfo.title === 'Unknown Product') {
        showFeedback(feedbackEl, 'Could not extract product info', 'error');
        resetButton(customBtn);
        return;
      }

      try {
        // Send to background script
        const response = await chrome.runtime.sendMessage({
          action: 'addToCart',
          product: productInfo
        });

        if (response.success) {
          showFeedback(feedbackEl, `Added to cart! (${response.cartCount} items)`, 'success');
          customBtn.classList.add('success');
          customBtn.querySelector('.btn-text').textContent = 'Added ✓';
          
          // Reset after delay
          setTimeout(() => {
            resetButton(customBtn);
          }, 2000);
        } else {
          showFeedback(feedbackEl, response.error || 'Failed to add', 'error');
          resetButton(customBtn);
        }
      } catch (error) {
        console.error('Custom Cart Error:', error);
        showFeedback(feedbackEl, 'Extension error', 'error');
        resetButton(customBtn);
      }
    });
  }

  function showFeedback(element, message, type) {
    element.textContent = message;
    element.className = `feedback-message ${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
      element.style.display = 'none';
    }, 3000);
  }

  function resetButton(btn) {
    btn.classList.remove('loading', 'success');
    btn.querySelector('.btn-text').textContent = 'Add to My Cart';
  }

  // Initialize
  function init() {
    if (isProductPage()) {
      // Wait a bit for page to fully load
      setTimeout(injectCustomButton, 500);
    }
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also watch for dynamic page changes (Amazon uses SPA-like navigation)
  const observer = new MutationObserver(function(mutations) {
    if (isProductPage() && !document.getElementById('custom-cart-btn-container')) {
      injectCustomButton();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Listen for messages from popup to open checkout
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openCheckoutModal') {
      // Skip modal - go directly to Palindrome Pay
      openPalindromePayCheckout(request.checkoutData);
      sendResponse({ success: true });
    }
    return true;
  });

  // Open Palindrome Pay hosted checkout directly
  async function openPalindromePayCheckout(checkoutData) {
    const { cart, totalUSD } = checkoutData;

    // Get config from background
    const configResponse = await chrome.runtime.sendMessage({ action: 'getConfig' });
    const config = configResponse.config || {};

    // Get saved shipping address
    const addressResponse = await chrome.runtime.sendMessage({ action: 'getAddress' });
    const shippingAddress = addressResponse.address || null;

    const sellerAddress = config.sellerAddress || '0x9Ca3100BfD6A2b00b9a6ED3Fc90F44617Bc8839C';
    const tokenAddress = config.tokenAddress || '0xf8a8519313befc293bbe86fd40e993655cf7436b';
    const checkoutBaseUrl = config.checkoutUrl || 'http://localhost:3000/crypto-pay';

    // Calculate delivery fee from cart items (use max delivery fee)
    const deliveryFee = Math.max(...cart.map(item => item.deliveryFee || 0), 0);
    const total = totalUSD + deliveryFee;

    // Build order title from cart (short version for display)
    const orderTitle = cart.length > 0
      ? 'Amazon Order: ' + cart.map(i => `${i.quantity}x ${i.title.substring(0, 30)}`).join(', ').substring(0, 200)
      : 'Amazon Order';

    // Prepare cart items for JSON (compact format)
    const items = cart.map(item => ({
      title: item.title,
      qty: item.quantity,
      price: item.price,
      asin: item.asin,
      img: item.imageUrl,
      url: item.productUrl,
      delivery: item.deliveryFee || 0
    }));

    // Build Palindrome Pay URL with parameters
    const params = new URLSearchParams({
      seller: sellerAddress,
      amount: total.toFixed(2),
      title: orderTitle,
      token: tokenAddress,
      redirect: window.location.href,
      source: 'commerce'
    });

    // Add items as JSON (URL encoded automatically by URLSearchParams)
    params.set('items', JSON.stringify(items));

    // Add shipping address if saved
    if (shippingAddress) {
      params.set('address', JSON.stringify(shippingAddress));
    }

    // Add delivery fee
    params.set('deliveryFee', deliveryFee.toFixed(2));

    // Open Palindrome Pay hosted checkout
    const checkoutUrl = `${checkoutBaseUrl}?${params.toString()}`;
    console.log('Opening Palindrome Pay:', checkoutUrl);
    window.open(checkoutUrl, '_blank');

    // Clear cart after redirecting
    chrome.runtime.sendMessage({ action: 'clearCart' });
  }

  // Checkout Modal Implementation
  function openCheckoutModal(checkoutData) {
    // Remove existing modal if any
    const existingModal = document.getElementById('palindrome-checkout-modal');
    if (existingModal) existingModal.remove();

    const { cart, totalUSD } = checkoutData;
    const sellerAddress = checkoutData.seller || '0x9Ca3100BfD6A2b00b9a6ED3Fc90F44617Bc8839C';
    const tokenAddress = checkoutData.token || '0xf8a8519313befc293bbe86fd40e993655cf7436b';
    const fee = totalUSD * 0.01;
    const total = totalUSD + fee;

    console.log('Checkout data:', { sellerAddress, tokenAddress, totalUSD });

    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'palindrome-checkout-modal';
    modal.dataset.seller = sellerAddress;
    modal.dataset.token = tokenAddress;
    modal.dataset.amount = total.toString();
    modal.innerHTML = `
      <div class="pp-modal-overlay">
        <div class="pp-modal-container">
          <button class="pp-modal-close" id="pp-close-modal">&times;</button>

          <div class="pp-modal-header">
            <h2>Crypto Checkout</h2>
            <p class="pp-powered-by"><img src="${chrome.runtime.getURL('palindromepay-crypto-escrow-payment.png')}" alt="Palindrome Pay" /></p>
          </div>

          <div class="pp-order-summary">
            <h3>Order Summary</h3>
            <div class="pp-order-items">
              ${cart.map(item => `
                <div class="pp-order-item">
                  <span class="pp-item-name">${item.title.substring(0, 40)}${item.title.length > 40 ? '...' : ''}</span>
                  <span class="pp-item-price">${item.quantity}x ${item.price || 'N/A'}</span>
                </div>
              `).join('')}
            </div>
            <div class="pp-order-totals">
              <div class="pp-total-row">
                <span>Subtotal</span>
                <span>$${totalUSD.toFixed(2)}</span>
              </div>
              <div class="pp-total-row">
                <span>Escrow Fee (1%)</span>
                <span>${fee.toFixed(2)} USDT</span>
              </div>
              <div class="pp-total-row pp-total-final">
                <span>Total</span>
                <span>${total.toFixed(2)} USDT</span>
              </div>
            </div>
          </div>

          <div class="pp-wallet-section">
            <div class="pp-wallet-status" id="pp-wallet-status">
              <span class="pp-status-dot disconnected"></span>
              <span id="pp-wallet-address">Not Connected</span>
            </div>
            <button class="pp-btn pp-btn-secondary" id="pp-connect-wallet">
              Connect Wallet
            </button>
          </div>

          <button class="pp-btn pp-btn-primary" id="pp-pay-btn" disabled>
            Create Escrow & Pay
          </button>

          <div class="pp-status-message" id="pp-status-message"></div>
        </div>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      .pp-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .pp-modal-container {
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 420px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .pp-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      .pp-modal-close:hover {
        background: #f0f0f0;
      }
      .pp-modal-header {
        text-align: center;
        margin-bottom: 20px;
      }
      .pp-modal-header h2 {
        font-size: 24px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0 0 8px 0;
      }
      .pp-powered-by {
        font-size: 12px;
        color: #888;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .pp-powered-by img {
        height: 28px;
      }
      .pp-order-summary {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .pp-order-summary h3 {
        font-size: 14px;
        margin: 0 0 12px 0;
        color: #333;
      }
      .pp-order-items {
        max-height: 120px;
        overflow-y: auto;
        margin-bottom: 12px;
      }
      .pp-order-item {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding: 6px 0;
        border-bottom: 1px solid #eee;
      }
      .pp-item-name {
        color: #333;
        flex: 1;
        margin-right: 8px;
      }
      .pp-item-price {
        color: #666;
        white-space: nowrap;
      }
      .pp-order-totals {
        border-top: 2px solid #ddd;
        padding-top: 12px;
      }
      .pp-total-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        padding: 4px 0;
      }
      .pp-total-final {
        font-weight: 700;
        font-size: 16px;
        color: #667eea;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #ddd;
      }
      .pp-wallet-section {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .pp-wallet-status {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      }
      .pp-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .pp-status-dot.disconnected {
        background: #ef4444;
      }
      .pp-status-dot.connected {
        background: #10b981;
      }
      .pp-btn {
        width: 100%;
        padding: 14px 20px;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .pp-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .pp-btn-primary {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
      }
      .pp-btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      .pp-btn-secondary {
        background: white;
        color: #667eea;
        border: 2px solid #667eea;
        padding: 8px 16px;
        width: auto;
        font-size: 13px;
      }
      .pp-btn-secondary:hover {
        background: #667eea;
        color: white;
      }
      .pp-status-message {
        margin-top: 12px;
        padding: 10px;
        border-radius: 8px;
        font-size: 13px;
        text-align: center;
        display: none;
      }
      .pp-status-message.error {
        display: block;
        background: #fef2f2;
        color: #ef4444;
      }
      .pp-status-message.success {
        display: block;
        background: #f0fdf4;
        color: #10b981;
      }
      .pp-status-message.info {
        display: block;
        background: #eff6ff;
        color: #3b82f6;
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(modal);

    // Event Listeners
    let walletConnected = false;
    let userAddress = null;

    document.getElementById('pp-close-modal').addEventListener('click', () => {
      modal.remove();
      styles.remove();
    });

    modal.querySelector('.pp-modal-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('pp-modal-overlay')) {
        modal.remove();
        styles.remove();
      }
    });

    // Inject external script into page context to access MetaMask (bypasses CSP)
    const injectScript = document.createElement('script');
    injectScript.src = chrome.runtime.getURL('injected.js');
    document.head.appendChild(injectScript);

    // Listen for messages from injected script
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      if (event.data.type === 'PP_WALLET_CONNECTED') {
        userAddress = event.data.address;
        document.getElementById('pp-wallet-address').textContent =
          userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        document.querySelector('.pp-status-dot').classList.remove('disconnected');
        document.querySelector('.pp-status-dot').classList.add('connected');
        document.getElementById('pp-connect-wallet').textContent = 'Connected';
        document.getElementById('pp-pay-btn').disabled = false;
        document.getElementById('pp-status-message').textContent = 'Wallet connected! Ready to pay.';
        document.getElementById('pp-status-message').className = 'pp-status-message success';
      }

      if (event.data.type === 'PP_WALLET_ERROR') {
        document.getElementById('pp-status-message').textContent = event.data.error;
        document.getElementById('pp-status-message').className = 'pp-status-message error';
        document.getElementById('pp-connect-wallet').textContent = 'Connect Wallet';
        document.getElementById('pp-connect-wallet').disabled = false;
      }

      if (event.data.type === 'PP_TX_SUCCESS') {
        document.getElementById('pp-status-message').textContent = 'Payment successful! Escrow created.';
        document.getElementById('pp-status-message').className = 'pp-status-message success';
        document.getElementById('pp-pay-btn').textContent = 'Payment Complete ✓';
        chrome.runtime.sendMessage({ action: 'clearCart' });
        setTimeout(() => {
          modal.remove();
          styles.remove();
        }, 3000);
      }

      if (event.data.type === 'PP_TX_ERROR') {
        document.getElementById('pp-status-message').textContent = 'Transaction failed: ' + event.data.error;
        document.getElementById('pp-status-message').className = 'pp-status-message error';
        document.getElementById('pp-pay-btn').disabled = false;
        document.getElementById('pp-pay-btn').textContent = 'Create Escrow & Pay';
      }

      // When injected script is ready, auto-connect
      if (event.data.type === 'PP_SCRIPT_READY') {
        triggerWalletConnect();
      }
    });

    // Function to trigger wallet connection via postMessage
    function triggerWalletConnect() {
      const connectBtn = document.getElementById('pp-connect-wallet');
      const statusEl = document.getElementById('pp-status-message');
      connectBtn.textContent = 'Connecting...';
      connectBtn.disabled = true;
      statusEl.textContent = 'Opening MetaMask...';
      statusEl.className = 'pp-status-message';

      // Send message to injected script
      window.postMessage({ type: 'PP_CONNECT_REQUEST' }, '*');
    }

    // Connect wallet button
    document.getElementById('pp-connect-wallet').addEventListener('click', triggerWalletConnect);

    // Pay button - Open Palindrome Pay hosted checkout
    document.getElementById('pp-pay-btn').addEventListener('click', async () => {
      const payBtn = document.getElementById('pp-pay-btn');
      const statusEl = document.getElementById('pp-status-message');
      const modalEl = document.getElementById('palindrome-checkout-modal');

      // Get checkout data from modal
      const sellerAddr = modalEl.dataset.seller;
      const tokenAddr = modalEl.dataset.token;
      const totalUSD = parseFloat(modalEl.dataset.amount) || 0;

      console.log('Opening Palindrome Pay checkout:', { sellerAddr, tokenAddr, totalUSD });

      if (!sellerAddr) {
        statusEl.textContent = 'Error: Seller address not configured';
        statusEl.className = 'pp-status-message error';
        return;
      }

      payBtn.disabled = true;
      payBtn.textContent = 'Opening checkout...';
      statusEl.textContent = 'Redirecting to Palindrome Pay...';
      statusEl.className = 'pp-status-message info';

      try {
        // Get cart data for title
        const cartResponse = await chrome.runtime.sendMessage({ action: 'getCart' });
        const cart = cartResponse.cart || [];

        // Build order title from cart
        const orderTitle = cart.length > 0
          ? 'Amazon Order: ' + cart.map(i => `${i.quantity}x ${i.title.substring(0, 30)}`).join(', ').substring(0, 200)
          : 'Amazon Order';

        // Close modal
        modalEl.remove();

        // Build Palindrome Pay URL with parameters
        const params = new URLSearchParams({
          seller: sellerAddr,
          amount: totalUSD.toFixed(2),
          title: orderTitle,
          token: tokenAddr,
          redirect: window.location.href
        });

        // Open Palindrome Pay hosted checkout
        const checkoutUrl = `https://palindromepay.com/crypto-pay?${params.toString()}`;
        window.open(checkoutUrl, '_blank');

        // Clear cart after redirecting
        chrome.runtime.sendMessage({ action: 'clearCart' });

      } catch (error) {
        console.error('Error opening checkout:', error);
        statusEl.textContent = 'Error: ' + error.message;
        statusEl.className = 'pp-status-message error';
        payBtn.disabled = false;
        payBtn.textContent = 'Pay with Crypto';
      }
    });
  }

})();
