const { ethers } = require('ethers');
require('dotenv').config();

// Configuration
const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PAYMENT_GATEWAY_ADDRESS = "0xC57E7DE24946811540a38112aDb6828Bf149070E";

// Token addresses
const USDC_ADDRESS = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const PSG_ADDRESS = '0x6D124526a5948Cb82BB5B531Bf9989D8aB34C899';

// Contract ABIs
const PAYMENT_GATEWAY_ABI = [
  "function executePayment(string calldata paymentId, address paymentToken, uint256 paymentAmount, address merchant, address fanToken, uint256 fanTokenAmount, uint256 minMchzOut) external"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

async function executePayment() {
  try {
    console.log('🚀 Starting payment execution...');
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log('👤 Wallet address:', wallet.address);
    
    // Contract instances
    const paymentGateway = new ethers.Contract(PAYMENT_GATEWAY_ADDRESS, PAYMENT_GATEWAY_ABI, wallet);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    
    // Payment parameters (FROM YOUR API RESPONSE)
    const paymentParams = {
      paymentId: "pay_1752355937734_1hix28ph4",
      paymentToken: USDC_ADDRESS,
      paymentAmount: 1819637n, // 1.819637 USDC (6 decimals)
      merchant: "0xEa7A36ece4037AEe9E7298465dAd0beE82932429",
      fanToken: PSG_ADDRESS,
      fanTokenAmount: ethers.parseEther("100"), // 100 PSG tokens
      minMchzOut: ethers.parseEther("4.35") // Minimum MCHZ out
    };
    
    console.log('📝 Payment Parameters:');
    console.log('  Payment ID:', paymentParams.paymentId);
    console.log('  Payment Amount:', ethers.formatUnits(paymentParams.paymentAmount, 6), 'USDC');
    console.log('  Fan Token Amount:', ethers.formatEther(paymentParams.fanTokenAmount), 'PSG');
    console.log('  Min MCHZ Out:', ethers.formatEther(paymentParams.minMchzOut), 'MCHZ');
    
    // Check wallet ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('💰 ETH balance:', ethers.formatEther(ethBalance), 'ETH');
    
    if (ethBalance < ethers.parseEther("0.01")) {
      throw new Error("Insufficient ETH balance for gas fees");
    }
    
    // Check USDC balance and allowance
    const usdcBalance = await usdcContract.balanceOf(wallet.address);
    const allowance = await usdcContract.allowance(wallet.address, PAYMENT_GATEWAY_ADDRESS);
    
    console.log('💰 USDC balance:', ethers.formatUnits(usdcBalance, 6), 'USDC');
    console.log('🔓 USDC allowance:', ethers.formatUnits(allowance, 6), 'USDC');
    
    if (usdcBalance < paymentParams.paymentAmount) {
      throw new Error(`Insufficient USDC balance. Have: ${ethers.formatUnits(usdcBalance, 6)}, Need: ${ethers.formatUnits(paymentParams.paymentAmount, 6)}`);
    }
    
    if (allowance < paymentParams.paymentAmount) {
      throw new Error(`Insufficient USDC allowance. Have: ${ethers.formatUnits(allowance, 6)}, Need: ${ethers.formatUnits(paymentParams.paymentAmount, 6)}. Run 'approve' first.`);
    }
    
    // Execute the payment
    console.log('⏳ Executing payment...');
    const tx = await paymentGateway.executePayment(
      paymentParams.paymentId,
      paymentParams.paymentToken,
      paymentParams.paymentAmount,
      paymentParams.merchant,
      paymentParams.fanToken,
      paymentParams.fanTokenAmount,
      paymentParams.minMchzOut
    );
    
    console.log('📤 Transaction sent:', tx.hash);
    console.log('🔗 View on Etherscan:', `https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    console.log('✅ Payment executed successfully!');
    console.log('📋 Transaction details:');
    console.log('  Hash:', receipt.hash);
    console.log('  Block:', receipt.blockNumber);
    console.log('  Gas Used:', receipt.gasUsed.toString());
    console.log('  Status:', receipt.status === 1 ? 'Success' : 'Failed');
    
    // Check payment status via API
    console.log('🔍 Checking payment status...');
    try {
      const response = await fetch(`http://localhost:3001/api/payment-status/${paymentParams.paymentId}`);
      const paymentStatus = await response.json();
      console.log('📊 Payment Status:', paymentStatus.steps);
    } catch (apiError) {
      console.log('⚠️  Could not fetch payment status from API:', apiError.message);
    }
    
  } catch (error) {
    console.error('❌ Payment execution failed:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Solution: Add more ETH to your wallet for gas fees');
    } else if (error.message.includes('ERC20: insufficient allowance')) {
      console.log('💡 Solution: Approve USDC spending first');
    } else if (error.message.includes('Payment ID already exists')) {
      console.log('💡 Solution: Use a unique payment ID');
    } else if (error.message.includes('Unsupported payment token')) {
      console.log('💡 Solution: Check if USDC address is correct');
    }
  }
}

async function approveUSDC() {
  try {
    console.log('🔓 Approving USDC spending...');
    
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    
    console.log('👤 Wallet address:', wallet.address);
    
    // Check current balance
    const balance = await usdc.balanceOf(wallet.address);
    console.log('💰 Current USDC balance:', ethers.formatUnits(balance, 6), 'USDC');
    
    const approveAmount = ethers.parseUnits("10", 6); // Approve 10 USDC
    console.log('🔓 Approving', ethers.formatUnits(approveAmount, 6), 'USDC...');
    
    const tx = await usdc.approve(PAYMENT_GATEWAY_ADDRESS, approveAmount);
    
    console.log('📤 Approval transaction sent:', tx.hash);
    console.log('🔗 View on Etherscan:', `https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    await tx.wait();
    
    // Check new allowance
    const newAllowance = await usdc.allowance(wallet.address, PAYMENT_GATEWAY_ADDRESS);
    console.log('✅ USDC approval completed!');
    console.log('🔓 New allowance:', ethers.formatUnits(newAllowance, 6), 'USDC');
    
  } catch (error) {
    console.error('❌ USDC approval failed:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

if (command === 'approve') {
  approveUSDC();
} else if (command === 'execute') {
  executePayment();
} else {
  console.log('📖 Usage:');
  console.log('  node execute-payment.js approve  # Approve USDC spending first');
  console.log('  node execute-payment.js execute  # Execute the payment');
  console.log('');
  console.log('💡 Make sure you have USDC tokens and ETH for gas!');
}