// config.js - Extension configuration

const CONFIG = {
  // Palindrome Pay contract settings
  sellerAddress: '0x9Ca3100BfD6A2b00b9a6ED3Fc90F44617Bc8839C',
  tokenAddress: '0xf8a8519313befc293bbe86fd40e993655cf7436b', // USDT on Base
  arbiterAddress: '',
  maturityDays: 7,
  chainId: 8453, // Base mainnet

  // Checkout URL (change to production when ready)
  checkoutUrl: 'http://localhost:3000/crypto-pay',
  // checkoutUrl: 'https://www.palindromepay.com/crypto-pay',

  // Fees
  escrowFeePercent: 0.01, // 1%
  shippingFee: 5.99
};
