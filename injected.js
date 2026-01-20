// injected.js - Runs in page context to access MetaMask

let connectedAddress = null;

window.ppConnectWallet = async function() {
  if (!window.ethereum) {
    window.postMessage({ type: 'PP_WALLET_ERROR', error: 'MetaMask not found. Please install MetaMask.' }, '*');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts.length > 0) {
      connectedAddress = accounts[0];
      window.postMessage({ type: 'PP_WALLET_CONNECTED', address: accounts[0] }, '*');
    }
  } catch (error) {
    window.postMessage({ type: 'PP_WALLET_ERROR', error: error.message }, '*');
  }
};

window.ppSendTransaction = async function(to, value, data) {
  console.log('ppSendTransaction called with:', { to, value, data, from: connectedAddress });

  if (!to || to === 'undefined' || to === 'null') {
    window.postMessage({ type: 'PP_TX_ERROR', error: 'Invalid seller address: ' + to }, '*');
    return;
  }

  if (!connectedAddress) {
    window.postMessage({ type: 'PP_TX_ERROR', error: 'Wallet not connected. Please connect first.' }, '*');
    return;
  }

  try {
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: connectedAddress,
        to: to,
        value: value,
        data: data
      }]
    });
    window.postMessage({ type: 'PP_TX_SUCCESS', txHash: txHash }, '*');
  } catch (error) {
    window.postMessage({ type: 'PP_TX_ERROR', error: error.message }, '*');
  }
};

// Listen for commands from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  if (event.data.type === 'PP_CONNECT_REQUEST') {
    window.ppConnectWallet();
  }

  if (event.data.type === 'PP_TX_REQUEST') {
    console.log('PP_TX_REQUEST received:', event.data);
    window.ppSendTransaction(event.data.to, event.data.value, event.data.data);
  }
});

// Signal that script is ready
window.postMessage({ type: 'PP_SCRIPT_READY' }, '*');
