const { ethers } = require('ethers');
require('dotenv').config();

// Configuration
const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PAYMENT_GATEWAY_ADDRESS = process.env.PAYMENT_GATEWAY_ADDRESS;

// Token addresses
const USDC_ADDRESS = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const USDT_ADDRESS = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
const PSG_ADDRESS = '0x6D124526a5948Cb82BB5B531Bf9989D8aB34C899';

// Contract ABIs
const PAYMENT_GATEWAY_ABI = [
  "function executePayment(string calldata paymentId, address paymentToken, uint256 paymentAmount, address merchant, address fanToken, uint256 fanTokenAmount, uint256 minMchzOut) external",
  "function getPayment(string calldata paymentId) external view returns (tuple(string paymentId, address user, address merchant, address paymentToken, uint256 paymentAmount, address fanToken, uint256 fanTokenAmount, uint256 mchzAmount, bytes32 hyperlaneMessageId, bool completed))",
  "function poolExists(address tokenA, address tokenB) external view returns (bool)",
  "function getQuote(address paymentToken, uint256 mchzAmountOut) external view returns (uint256 paymentTokenNeeded, bool useWethRoute)",
  "function paymentProcessor() external view returns (address)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

async function debugPaymentGateway() {
  try {
    console.log('🔍 Debugging Payment Gateway...');
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log('👤 Wallet address:', wallet.address);
    console.log('🏭 Payment Gateway:', PAYMENT_GATEWAY_ADDRESS);
    
    // Contract instances
    const paymentGateway = new ethers.Contract(PAYMENT_GATEWAY_ADDRESS, PAYMENT_GATEWAY_ABI, wallet);
    const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
    
    // 1. Check if contract is deployed
    const code = await provider.getCode(PAYMENT_GATEWAY_ADDRESS);
    console.log('📜 Contract deployed:', code !== '0x');
    
    // 2. Check payment processor is set
    try {
      const processor = await paymentGateway.paymentProcessor();
      console.log('🔧 Payment Processor set:', processor);
      console.log('🔧 Is zero address:', processor === ethers.ZeroAddress);
    } catch (error) {
      console.log('❌ Error getting payment processor:', error.message);
    }
    
    // 3. Check token details
    console.log('\n📊 Token Information:');
    try {
      const usdcSymbol = await usdcContract.symbol();
      const usdcDecimals = await usdcContract.decimals();
      console.log(`💰 USDC (${USDC_ADDRESS}): ${usdcSymbol}, ${usdcDecimals} decimals`);
    } catch (error) {
      console.log('❌ USDC token error:', error.message);
    }
    
    try {
      const usdtSymbol = await usdtContract.symbol();
      const usdtDecimals = await usdtContract.decimals();
      console.log(`💰 USDT (${USDT_ADDRESS}): ${usdtSymbol}, ${usdtDecimals} decimals`);
    } catch (error) {
      console.log('❌ USDT token error:', error.message);
    }
    
    // 4. Check wallet balances
    console.log('\n💰 Wallet Balances:');
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('ETH:', ethers.formatEther(ethBalance));
    
    try {
      const usdcBalance = await usdcContract.balanceOf(wallet.address);
      console.log('USDC:', ethers.formatUnits(usdcBalance, 6));
    } catch (error) {
      console.log('❌ USDC balance error:', error.message);
    }
    
    // 5. Check allowances
    console.log('\n🔓 Allowances:');
    try {
      const usdcAllowance = await usdcContract.allowance(wallet.address, PAYMENT_GATEWAY_ADDRESS);
      console.log('USDC allowance:', ethers.formatUnits(usdcAllowance, 6));
    } catch (error) {
      console.log('❌ USDC allowance error:', error.message);
    }
    
    // 6. Test pool existence
    console.log('\n🏊 Pool Checks:');
    const MCHZ_ADDRESS = '0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7';
    
    try {
      const usdcPoolExists = await paymentGateway.poolExists(USDC_ADDRESS, MCHZ_ADDRESS);
      console.log('USDC/MCHZ pool exists:', usdcPoolExists);
    } catch (error) {
      console.log('❌ USDC pool check error:', error.message);
    }
    
    try {
      const usdtPoolExists = await paymentGateway.poolExists(USDT_ADDRESS, MCHZ_ADDRESS);
      console.log('USDT/MCHZ pool exists:', usdtPoolExists);
    } catch (error) {
      console.log('❌ USDT pool check error:', error.message);
    }
    
    // 7. Test quote function
    console.log('\n💱 Quote Test:');
    try {
      const mchzAmount = ethers.parseEther("4.35");
      const [paymentTokenNeeded, useWethRoute] = await paymentGateway.getQuote(USDC_ADDRESS, mchzAmount);
      console.log('Quote for 4.35 MCHZ:');
      console.log('  USDC needed:', ethers.formatUnits(paymentTokenNeeded, 6));
      console.log('  Use WETH route:', useWethRoute);
    } catch (error) {
      console.log('❌ Quote error:', error.message);
    }
    
    // 8. Simulate transaction parameters
    console.log('\n🎯 Transaction Simulation:');
    const paymentParams = {
      paymentId: "debug_test_" + Date.now(),
      paymentToken: USDC_ADDRESS,
      paymentAmount: ethers.parseUnits("1.819637", 6),
      merchant: "0xEa7A36ece4037AEe9E7298465dAd0beE82932429",
      fanToken: PSG_ADDRESS,
      fanTokenAmount: ethers.parseEther("100"),
      minMchzOut: ethers.parseEther("4.35")
    };
    
    console.log('Payment parameters:');
    console.log('  Payment ID:', paymentParams.paymentId);
    console.log('  Payment Token:', paymentParams.paymentToken);
    console.log('  Payment Amount:', ethers.formatUnits(paymentParams.paymentAmount, 6), 'USDC');
    console.log('  Merchant:', paymentParams.merchant);
    console.log('  Fan Token:', paymentParams.fanToken);
    console.log('  Fan Token Amount:', ethers.formatEther(paymentParams.fanTokenAmount));
    console.log('  Min MCHZ Out:', ethers.formatEther(paymentParams.minMchzOut));
    
    // 9. Try gas estimation
    console.log('\n⛽ Gas Estimation:');
    try {
      const gasEstimate = await paymentGateway.executePayment.estimateGas(
        paymentParams.paymentId,
        paymentParams.paymentToken,
        paymentParams.paymentAmount,
        paymentParams.merchant,
        paymentParams.fanToken,
        paymentParams.fanTokenAmount,
        paymentParams.minMchzOut
      );
      console.log('✅ Gas estimate successful:', gasEstimate.toString());
    } catch (error) {
      console.log('❌ Gas estimation failed:', error.message);
      console.log('Error data:', error.data);
      
      // Try to decode the error
      if (error.data) {
        try {
          const errorInterface = new ethers.Interface([
            "error Error(string reason)"
          ]);
          const decodedError = errorInterface.parseError(error.data);
          console.log('Decoded error:', decodedError.args[0]);
        } catch (decodeError) {
          console.log('Could not decode error data');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugPaymentGateway();