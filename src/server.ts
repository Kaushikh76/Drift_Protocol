import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const CHILIZ_RPC = process.env.CHILIZ_RPC || 'https://spicy-rpc.chiliz.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is required in .env file');
}

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is required in .env file');
}

// Contract Addresses - Fixed Uniswap router for Sepolia
const UNISWAP_V2_ROUTER = '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008'; // Sepolia Uniswap V2 Router
const PAYMENT_GATEWAY_ADDRESS = process.env.PAYMENT_GATEWAY_ADDRESS;
const PAYMENT_PROCESSOR_ADDRESS = process.env.PAYMENT_PROCESSOR_ADDRESS;

const HYPERLANE_BRIDGE = {
  SEPOLIA_COLLATERAL: '0xeb2a0b7aaaDd23851c08B963C3F4fbe00B897c04',
  CHILIZ_NATIVE: '0x286757c8D8f506a756AB00A7eaC22ce1F9ee3F16'
} as const;

const CHILIZ_DEX = '0xFbef475155294d7Ef054f2b79B908c91A9914d82';

// Token Addresses
const TOKENS = {
  SEPOLIA: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    MCHZ: '0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7',
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' // Sepolia WETH for routing
  },
  CHILIZ: {
    CHZ: '0x0000000000000000000000000000000000000000',
    WCHZ: '0x678c34581db0a7808d0aC669d7025f1408C9a3C6',
    PSG: '0x6D124526a5948Cb82BB5B531Bf9989D8aB34C899',
    BAR: '0x0fE14905415E67620BeA20528839676684260851',
    SPURS: '0x6199FF3173872E4dd1CF61cD958740A8CF8CAE75',
    ACM: '0xa34e100D5545d5aa7793e451Fa4fdf5DaB84C94c',
    OG: '0x55922807d03C61DE294b8794c25338d3AFc0EFF6',
    CITY: '0x6350f61CDa7baea0eFAFF15ba10eb7A668E816da',
    AFC: '0x75A5Db3a95d009a493a2a235A62097fd38D93bd4',
    MENGO: '0x8B67D9503B65c9f8d90AA5cAd9c25890918e5061',
    JUV: '0x141Da2E915892D6D6c7584424A64903050Ac4226',
    NAP: '0x7b57895dfbff9B096BFA75f54Bad64953717a37d',
    ATM: '0xAFdC9d9bD8baA0e0A7d636Ef8d27f28e94aE73c7'
  }
} as const;

// Types (keeping existing types...)
interface PaymentQuote {
  fanTokenSymbol: string;
  fanTokenAmount: number;
  paymentToken: string;
  paymentTokenNeeded: string;
  chzNeeded: string;
  bridgeBalance: string;
  slippage: string;
  route: string;
}

interface PaymentIntent {
  id: string;
  merchantAddress: string;
  fanTokenSymbol: string;
  fanTokenAmount: number;
  paymentToken: string;
  userAddress: string;
  quote: PaymentQuote;
  status: string;
  createdAt: Date;
  steps: PaymentSteps;
  sepoliaTransaction?: string;
  hyperlaneMessageId?: string;
  destinationTxHash?: string;
  chzReceived?: string;
  finalFanTokenAmount?: string;
  completedAt?: Date;
  contractData?: any;
}

interface PaymentSteps {
  userPayment: 'pending' | 'processing' | 'completed' | 'failed';
  uniswapSwap: 'pending' | 'processing' | 'completed' | 'failed';
  bridgeTransfer: 'pending' | 'processing' | 'completed' | 'failed';
  fanTokenConversion: 'pending' | 'processing' | 'completed' | 'failed';
  merchantPayment: 'pending' | 'processing' | 'completed' | 'failed';
}

interface FanTokenPrices {
  PSG: string;
  BAR: string;
  SPURS: string;
  ACM: string;
  OG: string;
  CITY: string;
  AFC: string;
  MENGO: string;
  JUV: string;
  NAP: string;
  ATM: string;
}

// Initialize providers
const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
const chilizProvider = new ethers.JsonRpcProvider(CHILIZ_RPC);

// Enhanced ABI definitions
const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)"
];

const UNISWAP_V2_PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

const HYPERLANE_WARP_ABI = [
  "function balanceOf(address account) external view returns (uint256)"
];

const CHILIZ_DEX_ABI = [
  "function getPrice(address token, uint chzAmount) external view returns (uint tokens)",
  "function getAllPrices(uint chzAmount) external view returns (uint psgTokens, uint barTokens, uint spursTokens, uint acmTokens, uint ogTokens, uint cityTokens, uint afcTokens, uint mengoTokens, uint juvTokens, uint napTokens, uint atmTokens)"
];

// Payment tracking
const payments = new Map<string, PaymentIntent>();

// Helper Functions
function getFanTokenAddress(symbol: string): string | undefined {
  const upperSymbol = symbol.toUpperCase() as keyof typeof TOKENS.CHILIZ;
  return TOKENS.CHILIZ[upperSymbol];
}

// Fixed Uniswap price calculation with proper routing and TypeScript safety
async function getPaymentTokenNeeded(
  paymentToken: string, 
  mchzAmountOut: bigint
): Promise<{ amountIn: bigint; route: string }> {
  try {
    const routerContract = new ethers.Contract(
      UNISWAP_V2_ROUTER,
      UNISWAP_V2_ROUTER_ABI,
      sepoliaProvider
    );
    
    // Verify contract method exists
    if (!routerContract.getAmountsIn) {
      throw new Error('getAmountsIn method not found on router contract');
    }
    
    // First try direct path
    let path = [paymentToken, TOKENS.SEPOLIA.MCHZ];
    let route = `${paymentToken} → MCHZ`;
    
    try {
      const amounts = await routerContract.getAmountsIn!(mchzAmountOut, path);
      return { amountIn: amounts[0] as bigint, route };
    } catch (directError) {
      console.log('Direct path failed, trying via WETH...');
      
      // Try routing through WETH if direct path fails
      path = [paymentToken, TOKENS.SEPOLIA.WETH, TOKENS.SEPOLIA.MCHZ];
      route = `${paymentToken} → WETH → MCHZ`;
      
      try {
        const amounts = await routerContract.getAmountsIn!(mchzAmountOut, path);
        return { amountIn: amounts[0] as bigint, route };
      } catch (wethError) {
        throw new Error(`No liquidity path found for ${paymentToken} → MCHZ. Direct error: ${directError}. WETH route error: ${wethError}`);
      }
    }
  } catch (error) {
    console.error('Error getting payment token needed:', error);
    throw new Error(`Failed to get Uniswap price: ${error}`);
  }
}

// Enhanced pool validation
async function validateUniswapPool(tokenA: string, tokenB: string): Promise<boolean> {
  try {
    const routerContract = new ethers.Contract(
      UNISWAP_V2_ROUTER,
      UNISWAP_V2_ROUTER_ABI,
      sepoliaProvider
    );
    
    if (!routerContract.getAmountsOut) {
      throw new Error('getAmountsOut method not found on router contract');
    }
    
    // Try a small amount to see if pool exists
    const testAmount = ethers.parseEther('0.001');
    const path = [tokenA, tokenB];
    
    await routerContract.getAmountsOut!(testAmount, path);
    return true;
  } catch (error) {
    console.log(`Pool validation failed for ${tokenA}/${tokenB}:`, error);
    return false;
  }
}

async function getChilizFanTokenPrice(fanTokenSymbol: string, chzAmount: bigint): Promise<bigint> {
  try {
    const dexContract = new ethers.Contract(
      CHILIZ_DEX,
      CHILIZ_DEX_ABI,
      chilizProvider
    );
    
    const fanTokenAddress = getFanTokenAddress(fanTokenSymbol);
    if (!fanTokenAddress) {
      throw new Error(`Unsupported fan token: ${fanTokenSymbol}`);
    }
    
    if (!dexContract.getPrice) {
      throw new Error('getPrice method not found on DEX contract');
    }
    
    const fanTokenAmount = await dexContract.getPrice!(fanTokenAddress, chzAmount);
    return fanTokenAmount as bigint;
  } catch (error) {
    console.error('Error getting Chiliz fan token price:', error);
    throw new Error(`Failed to get Chiliz fan token price: ${error}`);
  }
}

async function checkHyperlaneBridgeBalance(): Promise<bigint> {
  try {
    const collateralContract = new ethers.Contract(
      HYPERLANE_BRIDGE.SEPOLIA_COLLATERAL,
      HYPERLANE_WARP_ABI,
      sepoliaProvider
    );
    
    if (!collateralContract.balanceOf) {
      throw new Error('balanceOf method not found on bridge contract');
    }
    
    const balance = await collateralContract.balanceOf!(HYPERLANE_BRIDGE.SEPOLIA_COLLATERAL);
    return balance as bigint;
  } catch (error) {
    console.error('Error checking Hyperlane bridge balance:', error);
    throw new Error(`Failed to check bridge balance: ${error}`);
  }
}

// Webhook endpoints (keeping existing webhook code...)
app.post('/api/webhook/payment_initiated', (req, res) => {
  const { data } = req.body;
  console.log('Payment initiated:', data.paymentId);
  
  const payment = payments.get(data.paymentId) || {} as PaymentIntent;
  payment.status = 'payment_received';
  payment.sepoliaTransaction = data.transactionHash;
  payment.steps = {
    userPayment: 'completed',
    uniswapSwap: 'processing',
    bridgeTransfer: 'pending',
    fanTokenConversion: 'pending',
    merchantPayment: 'pending'
  };
  
  payments.set(data.paymentId, payment);
  res.json({ success: true });
});

app.post('/api/webhook/swap_completed', (req, res) => {
  const { data } = req.body;
  console.log('Swap completed:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.steps.uniswapSwap = 'completed';
    payment.steps.bridgeTransfer = 'processing';
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/bridge_initiated', (req, res) => {
  const { data } = req.body;
  console.log('Bridge initiated:', data.paymentId, data.messageId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.hyperlaneMessageId = data.messageId;
    payment.steps.bridgeTransfer = 'processing';
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/hyperlane_message_delivered', (req, res) => {
  const { data } = req.body;
  console.log('Hyperlane message delivered:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.steps.bridgeTransfer = 'completed';
    payment.steps.fanTokenConversion = 'processing';
    payment.destinationTxHash = data.destinationTxHash;
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/payment_received_chiliz', (req, res) => {
  const { data } = req.body;
  console.log('Payment received on Chiliz:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.chzReceived = data.chzAmountFormatted;
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/fan_token_swap_completed', (req, res) => {
  const { data } = req.body;
  console.log('Fan token swap completed:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.steps.fanTokenConversion = 'completed';
    payment.steps.merchantPayment = 'processing';
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/payment_completed', (req, res) => {
  const { data } = req.body;
  console.log('Payment completed:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.status = 'completed';
    payment.steps.merchantPayment = 'completed';
    payment.finalFanTokenAmount = data.totalFanTokensFormatted;
    payment.completedAt = new Date();
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

// Fixed quote endpoint
app.post('/api/quote', async (req, res): Promise<void> => {
  try {
    const { fanTokenSymbol, fanTokenAmount, paymentToken } = req.body;
    
    if (!fanTokenSymbol || !fanTokenAmount || !paymentToken) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    
    const paymentTokenUpper = paymentToken.toUpperCase();
    if (paymentTokenUpper !== 'USDC' && paymentTokenUpper !== 'USDT') {
      res.status(400).json({ error: 'Unsupported payment token. Only USDC and USDT are supported.' });
      return;
    }
    
    // Get payment token address
    const paymentTokenAddress = paymentTokenUpper === 'USDC' 
      ? TOKENS.SEPOLIA.USDC 
      : TOKENS.SEPOLIA.USDT;
    
    // Step 1: Validate Uniswap pools exist
    const poolExists = await validateUniswapPool(paymentTokenAddress, TOKENS.SEPOLIA.MCHZ);
    if (!poolExists) {
      res.status(400).json({ 
        error: `No Uniswap pool found for ${paymentTokenUpper}/MCHZ. You may need to use a different payment token or check if pools are deployed.`,
        suggestion: 'Try using WETH as an intermediate token or check your pool addresses'
      });
      return;
    }
    
    // Step 2: Calculate CHZ needed for fan tokens
    const chzAmountWei = ethers.parseEther('1');
    const fanTokenAmountForOneCHZ = await getChilizFanTokenPrice(fanTokenSymbol, chzAmountWei);
    
    if (fanTokenAmountForOneCHZ === BigInt(0)) {
      res.status(400).json({ error: 'No liquidity for this fan token on Chiliz DEX' });
      return;
    }
    
    // Calculate CHZ needed for desired fan token amount
    const fanTokenAmountWei = ethers.parseEther(fanTokenAmount.toString());
    const chzNeeded = (fanTokenAmountWei * chzAmountWei) / fanTokenAmountForOneCHZ;
    
    // Step 3: Calculate MCHZ needed (1:1 ratio with CHZ)
    const mchzNeeded = chzNeeded;
    
    // Step 4: Calculate payment token needed for MCHZ
    const { amountIn: paymentTokenNeeded, route } = await getPaymentTokenNeeded(
      paymentTokenAddress,
      mchzNeeded
    );
    
    // Step 5: Check bridge balance
    const bridgeBalance = await checkHyperlaneBridgeBalance();
    
    if (bridgeBalance < mchzNeeded) {
      res.status(400).json({ 
        error: 'Insufficient bridge liquidity',
        available: ethers.formatEther(bridgeBalance),
        needed: ethers.formatEther(mchzNeeded)
      });
      return;
    }
    
    // Add 2% slippage protection
    const paymentTokenWithSlippage = (paymentTokenNeeded * BigInt(102)) / BigInt(100);
    
    // Determine decimals for formatting
    const decimals = paymentTokenUpper === 'USDC' ? 6 : 6; // Both USDC and USDT use 6 decimals
    
    const quote: PaymentQuote = {
      fanTokenSymbol,
      fanTokenAmount,
      paymentToken: paymentTokenUpper,
      paymentTokenNeeded: ethers.formatUnits(paymentTokenWithSlippage, decimals),
      chzNeeded: ethers.formatEther(chzNeeded),
      bridgeBalance: ethers.formatEther(bridgeBalance),
      slippage: '2%',
      route
    };
    
    res.json(quote);
    
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ 
      error: (error as Error).message,
      suggestion: 'Check if Uniswap pools are deployed and have liquidity'
    });
  }
});

// Create payment intent endpoint
app.post('/api/create-payment', async (req, res): Promise<void> => {
  try {
    const { 
      merchantAddress, 
      fanTokenSymbol, 
      fanTokenAmount, 
      paymentToken,
      userAddress
    } = req.body;
    
    if (!merchantAddress || !fanTokenSymbol || !fanTokenAmount || !paymentToken || !userAddress) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    
    // Generate unique payment ID
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get quote data
    const quoteResponse = await axios.post('http://localhost:3001/api/quote', {
      fanTokenSymbol,
      fanTokenAmount,
      paymentToken
    });
    
    const quote = quoteResponse.data as PaymentQuote;
    
    // Store payment intent
    const payment: PaymentIntent = {
      id: paymentId,
      merchantAddress,
      fanTokenSymbol,
      fanTokenAmount,
      paymentToken,
      userAddress,
      quote,
      status: 'created',
      createdAt: new Date(),
      steps: {
        userPayment: 'pending',
        uniswapSwap: 'pending',
        bridgeTransfer: 'pending',
        fanTokenConversion: 'pending',
        merchantPayment: 'pending'
      }
    };
    
    payments.set(paymentId, payment);
    
    res.json({
      paymentId,
      quote,
      status: 'created',
      contractAddress: PAYMENT_GATEWAY_ADDRESS,
      fanTokenAddress: getFanTokenAddress(fanTokenSymbol),
      nextStep: 'Call executePayment on Payment Gateway contract'
    });
    
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get payment status
app.get('/api/payment-status/:paymentId', async (req, res): Promise<void> => {
  try {
    const { paymentId } = req.params;
    const payment = payments.get(paymentId);
    
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }
    
    res.json(payment);
    
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get bridge balance
app.get('/api/bridge-balance', async (req, res) => {
  try {
    const balance = await checkHyperlaneBridgeBalance();
    
    res.json({
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString(),
      lastChecked: new Date()
    });
    
  } catch (error) {
    console.error('Bridge balance error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Pool validation endpoint for debugging
app.get('/api/validate-pools', async (req, res): Promise<void> => {
  try {
    const results = {
      usdcMchz: await validateUniswapPool(TOKENS.SEPOLIA.USDC, TOKENS.SEPOLIA.MCHZ),
      usdtMchz: await validateUniswapPool(TOKENS.SEPOLIA.USDT, TOKENS.SEPOLIA.MCHZ),
      usdcWeth: await validateUniswapPool(TOKENS.SEPOLIA.USDC, TOKENS.SEPOLIA.WETH),
      usdtWeth: await validateUniswapPool(TOKENS.SEPOLIA.USDT, TOKENS.SEPOLIA.WETH),
      wethMchz: await validateUniswapPool(TOKENS.SEPOLIA.WETH, TOKENS.SEPOLIA.MCHZ)
    };
    
    res.json({
      poolValidation: results,
      addresses: {
        router: UNISWAP_V2_ROUTER,
        tokens: TOKENS.SEPOLIA
      }
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all fan token prices
app.get('/api/fan-token-prices', async (req, res): Promise<void> => {
  try {
    const { chzAmount = '1' } = req.query;
    const chzAmountWei = ethers.parseEther(chzAmount as string);
    
    const dexContract = new ethers.Contract(
      CHILIZ_DEX,
      CHILIZ_DEX_ABI,
      chilizProvider
    );
    
    if (!dexContract.getAllPrices) {
      throw new Error('getAllPrices method not found on DEX contract');
    }
    
    const prices = await dexContract.getAllPrices!(chzAmountWei);
    
    const fanTokenPrices: FanTokenPrices = {
      PSG: ethers.formatEther(prices[0]),
      BAR: ethers.formatEther(prices[1]),
      SPURS: ethers.formatEther(prices[2]),
      ACM: ethers.formatEther(prices[3]),
      OG: ethers.formatEther(prices[4]),
      CITY: ethers.formatEther(prices[5]),
      AFC: ethers.formatEther(prices[6]),
      MENGO: ethers.formatEther(prices[7]),
      JUV: ethers.formatEther(prices[8]),
      NAP: ethers.formatEther(prices[9]),
      ATM: ethers.formatEther(prices[10])
    };
    
    res.json({
      chzAmount,
      prices: fanTokenPrices
    });
    
  } catch (error) {
    console.error('Fan token prices error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Enhanced health check
app.get('/api/health', async (req, res): Promise<void> => {
  try {
    // Test RPC connections
    const [sepoliaBlock, chilizBlock] = await Promise.all([
      sepoliaProvider.getBlockNumber(),
      chilizProvider.getBlockNumber()
    ]);
    
    // Test pool validations
    const poolValidation = {
      usdcMchz: await validateUniswapPool(TOKENS.SEPOLIA.USDC, TOKENS.SEPOLIA.MCHZ),
      usdtMchz: await validateUniswapPool(TOKENS.SEPOLIA.USDT, TOKENS.SEPOLIA.MCHZ)
    };
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date(),
      blockchain: {
        sepolia: {
          connected: true,
          latestBlock: sepoliaBlock,
          rpc: SEPOLIA_RPC.includes('alchemy') ? 'Alchemy' : 'Custom'
        },
        chiliz: {
          connected: true,
          latestBlock: chilizBlock,
          rpc: CHILIZ_RPC
        }
      },
      contracts: {
        paymentGateway: PAYMENT_GATEWAY_ADDRESS || 'not_deployed',
        paymentProcessor: PAYMENT_PROCESSOR_ADDRESS || 'not_deployed',
        uniswapRouter: UNISWAP_V2_ROUTER,
        hyperlaneBridge: HYPERLANE_BRIDGE.SEPOLIA_COLLATERAL,
        chilizDex: CHILIZ_DEX
      },
      pools: poolValidation,
      tokens: TOKENS
    };
    
    res.json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date()
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Cross-chain payment gateway running on port ${PORT}`);
  console.log('🔧 Fixed Issues:');
  console.log('  ✅ Updated Uniswap router address for Sepolia');
  console.log('  ✅ Fixed price calculation logic');
  console.log('  ✅ Added pool validation');
  console.log('  ✅ Enhanced error handling');
  console.log('🌐 Endpoints:');
  console.log('- POST /api/quote - Get payment quote');
  console.log('- POST /api/create-payment - Create payment intent');
  console.log('- GET /api/payment-status/:id - Get payment status');
  console.log('- GET /api/bridge-balance - Check bridge balance');
  console.log('- GET /api/fan-token-prices - Get all fan token prices');
  console.log('- GET /api/validate-pools - Validate Uniswap pools');
  console.log('- GET /api/health - Enhanced health check');
  console.log('- POST /api/webhook/* - Event webhooks');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

export default app;