// src/checkout.js - Checkout page logic with Palindrome Pay SDK integration
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import { PalindromePaySDK } from '@palindromepay/sdk';

// ============================================================================
// CONFIGURATION
// ============================================================================
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

// Escrow contract address on Base Sepolia
const ESCROW_CONTRACT_ADDRESS = '0x37b042086227b650397e835b36674cd55ec2edfb';

// Subgraph URL for querying escrow data
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/121986/palindrome-pay-base/version/latest';

const CHAINS = {
  8453: {
    name: 'Base',
    chain: base,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    usdt: '0xf8a8519313befc293bbe86fd40e993655cf7436b'
  },
  84532: {
    name: 'Base Sepolia',
    chain: baseSepolia,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    usdt: '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  },
};

// ============================================================================
// STATE
// ============================================================================
let checkoutData = null;
let settings = null;
let walletConnected = false;
let userAddress = null;
let currentChain = null;
let publicClient = null;
let walletClient = null;
let sdk = null;

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const elements = {
  orderItems: document.getElementById('orderItems'),
  subtotalUSD: document.getElementById('subtotalUSD'),
  paymentAmount: document.getElementById('paymentAmount'),
  escrowFee: document.getElementById('escrowFee'),
  totalAmount: document.getElementById('totalAmount'),
  maturityDays: document.getElementById('maturityDays'),
  connectBtn: document.getElementById('connectBtn'),
  walletTitle: document.getElementById('walletTitle'),
  walletAddress: document.getElementById('walletAddress'),
  networkInfo: document.getElementById('networkInfo'),
  networkName: document.getElementById('networkName'),
  approvalSection: document.getElementById('approvalSection'),
  approveBtn: document.getElementById('approveBtn'),
  payBtn: document.getElementById('payBtn'),
  errorMessage: document.getElementById('errorMessage'),
  statusCard: document.getElementById('statusCard'),
  statusIcon: document.getElementById('statusIcon'),
  statusText: document.getElementById('statusText'),
  statusDetails: document.getElementById('statusDetails'),
  txHashSection: document.getElementById('txHashSection'),
  txHashLink: document.getElementById('txHashLink'),
  step1: document.getElementById('step1'),
  step2: document.getElementById('step2'),
  step3: document.getElementById('step3'),
  step4: document.getElementById('step4'),
  line1: document.getElementById('line1'),
  line2: document.getElementById('line2'),
  line3: document.getElementById('line3'),
  // Address form elements
  fullName: document.getElementById('fullName'),
  streetAddress: document.getElementById('streetAddress'),
  streetAddress2: document.getElementById('streetAddress2'),
  city: document.getElementById('city'),
  state: document.getElementById('state'),
  zipCode: document.getElementById('zipCode'),
  country: document.getElementById('country'),
  phone: document.getElementById('phone'),
  // Success modal elements
  successModal: document.getElementById('successModal'),
  modalTxHash: document.getElementById('modalTxHash'),
  modalExplorerLink: document.getElementById('modalExplorerLink'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
};

// ============================================================================
// IPFS UTILITIES (Pinata)
// ============================================================================
async function uploadToIPFS(data, jwt) {
  const response = await fetch(PINATA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: `palindrome-pay-shipping-${Date.now()}`
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`IPFS upload failed: ${error.message || error.error?.message || response.statusText}`);
  }

  const result = await response.json();
  return result.IpfsHash;
}

// ============================================================================
// ENCRYPTION UTILITIES (AES-GCM)
// ============================================================================
const TEXT_ENCODER = new TextEncoder();

function uint8ToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encryptWithAesGcm(data, keyBase64) {
  const keyBytes = base64ToUint8(keyBase64);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = TEXT_ENCODER.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plainBytes,
  );

  return {
    cipherText: arrayBufferToBase64(cipherBuffer),
    iv: uint8ToBase64(iv),
  };
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
const toastContainer = document.getElementById('toastContainer');

function showToast(type, title, message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';

  let iconHtml = '';
  if (type === 'loading') {
    iconHtml = '<div class="toast-icon loading"></div>';
  } else {
    const icons = {
      success: '<polyline points="20 6 9 17 4 12"></polyline>',
      error: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
      info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
    };
    iconHtml = `<div class="toast-icon ${type}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">${icons[type]}</svg></div>`;
  }

  toast.innerHTML = `
    ${iconHtml}
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

  toastContainer.appendChild(toast);

  if (type !== 'loading' && duration > 0) {
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

function removeToast(toast) {
  if (toast && toast.parentNode) {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }
}

// ============================================================================
// SUCCESS MODAL
// ============================================================================
function showSuccessModal(txHash) {
  const explorer = CHAINS[currentChain]?.explorer || 'https://sepolia.basescan.org';
  elements.modalTxHash.textContent = txHash;
  elements.modalExplorerLink.href = `${explorer}/tx/${txHash}`;
  elements.successModal.classList.remove('hidden');
  elements.statusCard.classList.add('hidden');

  elements.modalCloseBtn.onclick = () => {
    window.close();
    elements.successModal.classList.add('hidden');
  };

  elements.successModal.onclick = (e) => {
    if (e.target === elements.successModal) {
      window.close();
      elements.successModal.classList.add('hidden');
    }
  };
}

// ============================================================================
// ADDRESS COLLECTION
// ============================================================================
function collectShippingAddress() {
  const fields = {
    fullName: elements.fullName?.value?.trim(),
    streetAddress: elements.streetAddress?.value?.trim(),
    streetAddress2: elements.streetAddress2?.value?.trim() || '',
    city: elements.city?.value?.trim(),
    state: elements.state?.value?.trim(),
    zipCode: elements.zipCode?.value?.trim(),
    country: elements.country?.value,
    phone: elements.phone?.value?.trim() || ''
  };

  const required = ['fullName', 'streetAddress', 'city', 'state', 'zipCode', 'country'];
  let valid = true;

  for (const field of required) {
    const el = elements[field];
    if (!fields[field]) {
      el?.classList.add('error');
      valid = false;
    } else {
      el?.classList.remove('error');
    }
  }

  if (!valid) return null;

  return {
    ...fields,
    timestamp: new Date().toISOString(),
    orderRef: `PP-${Date.now()}`
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================
async function init() {
  const storage = await chrome.storage.local.get(['pendingCheckout', 'settings']);
  checkoutData = storage.pendingCheckout;
  settings = storage.settings;

  if (!checkoutData || !checkoutData.cart || checkoutData.cart.length === 0) {
    showError('No checkout data found. Please try again from the cart.');
    return;
  }

  renderOrder();
  setupEventListeners();
}

function renderOrder() {
  const { cart, totalUSD } = checkoutData;

  elements.orderItems.innerHTML = cart.map(item => `
    <div class="order-item">
      <img class="order-item-image" src="${item.imageUrl || ''}" alt=""
           onerror="this.style.display='none'">
      <div class="order-item-details">
        <div class="order-item-title">${escapeHtml(item.title)}</div>
        <div class="order-item-qty">Qty: ${item.quantity}</div>
      </div>
      <div class="order-item-price">${item.price || 'N/A'}</div>
    </div>
  `).join('');

  const fee = totalUSD * 0.01;
  const total = totalUSD + fee;

  elements.subtotalUSD.textContent = `$${totalUSD.toFixed(2)}`;
  elements.paymentAmount.textContent = `${totalUSD.toFixed(2)} USDT`;
  elements.escrowFee.textContent = `${fee.toFixed(2)} USDT`;
  elements.totalAmount.textContent = `${total.toFixed(2)} USDT`;
  elements.maturityDays.textContent = settings?.maturityDays || 7;
}

function setupEventListeners() {
  elements.connectBtn.addEventListener('click', connectWallet);
  elements.approveBtn.addEventListener('click', approveTokens);
  elements.payBtn.addEventListener('click', createEscrow);
}

// ============================================================================
// WALLET CONNECTION
// ============================================================================
async function connectWallet() {
  try {
    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = 'Connecting...';

    if (typeof window.ethereum === 'undefined') {
      showError('No wallet detected. Please install MetaMask.');
      elements.connectBtn.disabled = false;
      elements.connectBtn.textContent = 'Connect Wallet';
      return;
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

    if (accounts.length > 0) {
      userAddress = accounts[0];
      walletConnected = true;

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      currentChain = parseInt(chainId, 16);

      // Create viem clients
      const chainConfig = CHAINS[currentChain];
      if (chainConfig?.chain) {
        publicClient = createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpcUrl),
        });

        walletClient = createWalletClient({
          account: userAddress,
          chain: chainConfig.chain,
          transport: custom(window.ethereum),
        });
      }

      updateWalletUI();
      updateSteps(2);

      const targetChain = settings?.chainId || 84532; // Default to Base Sepolia
      if (currentChain !== targetChain) {
        await switchChain(targetChain);
      }

      elements.payBtn.disabled = false;
    }
  } catch (error) {
    showError('Failed to connect wallet: ' + error.message);
  } finally {
    elements.connectBtn.disabled = false;
    elements.connectBtn.innerHTML = walletConnected ?
      '✓ Connected' :
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M2 10h20"></path></svg> Connect Wallet';
  }
}

async function switchChain(targetChainId) {
  const chainConfig = CHAINS[targetChainId];
  if (!chainConfig) return;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + targetChainId.toString(16) }]
    });
    currentChain = targetChainId;

    // Recreate clients for new chain
    if (chainConfig.chain) {
      publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.rpcUrl),
      });

      walletClient = createWalletClient({
        account: userAddress,
        chain: chainConfig.chain,
        transport: custom(window.ethereum),
      });
    }

    updateWalletUI();
  } catch (error) {
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + targetChainId.toString(16),
            chainName: chainConfig.name,
            rpcUrls: [chainConfig.rpcUrl],
            blockExplorerUrls: [chainConfig.explorer]
          }]
        });
        currentChain = targetChainId;
        updateWalletUI();
      } catch (addError) {
        showError('Failed to add network: ' + addError.message);
      }
    } else {
      showError('Failed to switch network: ' + error.message);
    }
  }
}

function updateWalletUI() {
  if (walletConnected) {
    elements.walletTitle.textContent = 'Wallet Connected';
    elements.walletAddress.innerHTML = `<span class="address">${truncateAddress(userAddress)}</span>`;
    elements.networkInfo.classList.remove('hidden');
    elements.networkName.textContent = CHAINS[currentChain]?.name || `Chain ${currentChain}`;
  }
}

async function approveTokens() {
  elements.approvalSection.classList.add('hidden');
}

// ============================================================================
// CREATE ESCROW
// ============================================================================
async function createEscrow() {
  let currentToast = null;

  try {
    elements.payBtn.disabled = true;

    // Step 1: Validate and collect shipping address
    const shippingAddress = collectShippingAddress();
    if (!shippingAddress) {
      showToast('error', 'Missing Information', 'Please fill in all required shipping address fields.');
      elements.payBtn.disabled = false;
      return;
    }

    // Step 2: Upload to IPFS
    currentToast = showToast('loading', 'Uploading to IPFS', 'Securely storing your shipping address...');
    updateSteps(2);

    let ipfsHash;
    try {
      if (!settings.pinataJwt) {
        throw new Error('Pinata JWT not configured. Please set it in extension settings.');
      }
      ipfsHash = await uploadToIPFS(shippingAddress, settings.pinataJwt);
      console.log('IPFS Hash:', ipfsHash);
      removeToast(currentToast);
      showToast('success', 'Uploaded to IPFS', `CID: ${ipfsHash.substring(0, 12)}...`, 2000);
    } catch (ipfsError) {
      removeToast(currentToast);
      showToast('error', 'IPFS Upload Failed', ipfsError.message);
      elements.payBtn.disabled = false;
      return;
    }

    // Step 3: Encrypt the IPFS hash
    await new Promise(r => setTimeout(r, 500));
    currentToast = showToast('loading', 'Encrypting Data', 'Securing your shipping information...');
    updateSteps(3);

    let encryptedData;
    try {
      if (!settings.aesKeyBase64) {
        throw new Error('Encryption key not configured.');
      }
      encryptedData = await encryptWithAesGcm({ ipfsHash }, settings.aesKeyBase64);
      console.log('Encrypted IPFS data:', encryptedData);
      removeToast(currentToast);
      showToast('success', 'Data Encrypted', 'Your information is secured', 2000);
    } catch (encryptError) {
      removeToast(currentToast);
      showToast('error', 'Encryption Failed', encryptError.message);
      elements.payBtn.disabled = false;
      return;
    }

    const encryptedIpfsHash = JSON.stringify(encryptedData);

    // Step 4: Create escrow transaction
    await new Promise(r => setTimeout(r, 500));
    currentToast = showToast('loading', 'Creating Escrow', 'Please confirm in your wallet...');

    const { totalUSD, cart } = checkoutData;
    const amountInUnits = BigInt(Math.floor(totalUSD * 1e6));

    const orderTitle = 'Amazon Order: ' + cart.map(i =>
      `${i.quantity}x ${i.title.substring(0, 30)}`
    ).join(', ').substring(0, 200);

    let txHash;

    try {
      // Initialize Apollo Client for subgraph queries
      const apolloClient = new ApolloClient({
        link: new HttpLink({ uri: SUBGRAPH_URL }),
        cache: new InMemoryCache(),
      });

      // Initialize SDK
      const sdk = new PalindromePaySDK({
        publicClient,
        walletClient,
        contractAddress: ESCROW_CONTRACT_ADDRESS,
        apolloClient,
        chain: CHAINS[currentChain]?.chain,
        skipSimulation: true, // Skip simulation for Base Sepolia reliability
      });

      removeToast(currentToast);
      currentToast = showToast('loading', 'Awaiting Wallet', 'Please confirm the transaction...');

      // Create escrow and deposit in one transaction
      const result = await sdk.createEscrowAndDeposit(walletClient, {
        token: settings.tokenAddress,
        seller: settings.sellerAddress,
        amount: amountInUnits,
        maturityTimeDays: BigInt(settings.maturityDays || 7),
        arbiter: settings.arbiterAddress || undefined,
        title: orderTitle,
        ipfsHash: encryptedIpfsHash,
      });

      txHash = result.txHash;
      console.log('Escrow created:', {
        escrowId: result.escrowId?.toString(),
        txHash: result.txHash,
        walletAddress: result.walletAddress,
      });
    } catch (sdkError) {
      removeToast(currentToast);
      console.error('SDK error:', sdkError);
      throw new Error('Escrow creation failed: ' + (sdkError.message || sdkError));
    }

    removeToast(currentToast);
    updateSteps(4);

    showToast('success', 'Transaction Confirmed!', 'Opening details...', 1500);

    await chrome.storage.local.set({ cart: [] });
    await chrome.storage.local.remove('pendingCheckout');

    setTimeout(() => {
      showSuccessModal(txHash);
    }, 500);

  } catch (error) {
    if (currentToast) removeToast(currentToast);
    showToast('error', 'Transaction Failed', error.message);
    elements.payBtn.disabled = false;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================
function showStatus(type, title, details) {
  elements.statusCard.classList.remove('hidden');
  elements.statusIcon.className = 'status-icon ' + type;

  if (type === 'success') {
    elements.statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
  } else if (type === 'error') {
    elements.statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
  }

  elements.statusText.textContent = title;
  elements.statusDetails.textContent = details;
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove('hidden');
}

function updateSteps(currentStep) {
  [1, 2, 3, 4].forEach(step => {
    const el = elements[`step${step}`];
    el.classList.remove('active', 'completed');
    if (step < currentStep) {
      el.classList.add('completed');
      el.innerHTML = '✓';
    } else if (step === currentStep) {
      el.classList.add('active');
    }
  });

  if (currentStep > 1) elements.line1.classList.add('completed');
  if (currentStep > 2) elements.line2.classList.add('completed');
  if (currentStep > 3) elements.line3.classList.add('completed');
}

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// START
// ============================================================================
init();
