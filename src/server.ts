import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Production Configuration
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

// Production Contract Addresses
const UNISWAP_V2_ROUTER = '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3';
const PAYMENT_GATEWAY_ADDRESS = process.env.PAYMENT_GATEWAY_ADDRESS;
const PAYMENT_PROCESSOR_ADDRESS = process.env.PAYMENT_PROCESSOR_ADDRESS;

// Production Hyperlane Addresses (from your deployment)
const HYPERLANE_BRIDGE = {
  SEPOLIA_COLLATERAL: '0xeb2a0b7aaaDd23851c08B963C3F4fbe00B897c04',
  CHILIZ_NATIVE: '0x286757c8D8f506a756AB00A7eaC22ce1F9ee3F16'
} as const;

const HYPERLANE_MAILBOX = {
  SEPOLIA: '0xA6665B1a40EEdBd7BD178DDB9966E9e61662aa00',
  CHILIZ: '0xA6665B1a40EEdBd7BD178DDB9966E9e61662aa00'
} as const;

const CHILIZ_DEX = '0xFbef475155294d7Ef054f2b79B908c91A9914d82';

// Production Pool Addresses
const DEPLOYED_POOLS = {
  USDC_MCHZ: '0x77F279E0a8140748507FAAf254172285b4B9Ab87',
  USDT_MCHZ: '0xE7afa9b942B09eBA7B6E1A0180C922B2E962a6c8'
} as const;

// Production Token Addresses - Aligned with contracts
const TOKENS = {
  SEPOLIA: {
    USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', // Aave test USDC
    USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Aave test USDT
    MCHZ: '0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7', // Your deployed mCHZ
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'  // Sepolia WETH
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

const TOKEN_DECIMALS = {
  USDC: 6,
  USDT: 6,
  MCHZ: 18,
  WETH: 18
} as const;

// Types
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

// Production ABIs
const UNISWAP_V2_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)"
];

const UNISWAP_V2_PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function totalSupply() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
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

function getTokenDecimals(tokenAddress: string): number {
  // Convert address to lowercase for comparison
  const lowerAddress = tokenAddress.toLowerCase();
  
  // Map token addresses to their decimals
  const tokenDecimalMap: { [key: string]: number } = {
    // Sepolia tokens
    '0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8': 6,  // USDC
    '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0': 6,  // USDT
    '0xda1fe1db9b04a810cbb214a294667833e4c8d8f7': 18, // MCHZ
    '0xfff9976782d46cc05630d1f6ebab18b2324d6b14': 18, // WETH
    
    // Chiliz tokens (all 18 decimals)
    '0x678c34581db0a7808d0ac669d7025f1408c9a3c6': 18, // WCHZ
    '0x6d124526a5948cb82bb5b531bf9989d8ab34c899': 18, // PSG
    '0x0fe14905415e67620bea20528839676684260851': 18, // BAR
    '0x6199ff3173872e4dd1cf61cd958740a8cf8cae75': 18, // SPURS
    '0xa34e100d5545d5aa7793e451fa4fdf5dab84c94c': 18, // ACM
    '0x55922807d03c61de294b8794c25338d3afc0eff6': 18, // OG
    '0x6350f61cda7baea0efaff15ba10eb7a668e816da': 18, // CITY
    '0x75a5db3a95d009a493a2a235a62097fd38d93bd4': 18, // AFC
    '0x8b67d9503b65c9f8d90aa5cad9c25890918e5061': 18, // MENGO
    '0x141da2e915892d6d6c7584424a64903050ac4226': 18, // JUV
    '0x7b57895dfbff9b096bfa75f54bad64953717a37d': 18, // NAP
    '0xafdc9d9bd8baa0e0a7d636ef8d27f28e94ae73c7': 18, // ATM
  };
  
  return tokenDecimalMap[lowerAddress] || 18; // Default to 18 if not found
}


function getPoolAddress(paymentToken: string): string | null {
  const upperToken = paymentToken.toUpperCase();
  switch (upperToken) {
    case 'USDC':
      return DEPLOYED_POOLS.USDC_MCHZ;
    case 'USDT':
      return DEPLOYED_POOLS.USDT_MCHZ;
    default:
      return null;
  }
}

// Production pool validation
async function validateUniswapPool(paymentToken: string): Promise<{ exists: boolean; reserves?: any; error?: string }> {
  try {
    const poolAddress = getPoolAddress(paymentToken);
    if (!poolAddress) {
      return { exists: false, error: `No pool deployed for ${paymentToken}/MCHZ` };
    }

    const pairContract = new ethers.Contract(
      poolAddress,
      UNISWAP_V2_PAIR_ABI,
      sepoliaProvider
    );

    const [reserves, token0, token1, totalSupply] = await Promise.all([
      (pairContract as any).getReserves(),
      (pairContract as any).token0(),
      (pairContract as any).token1(),
      (pairContract as any).totalSupply()
    ]);

    const hasLiquidity = reserves[0] > 0 && reserves[1] > 0 && totalSupply > 0;

    const token0Decimals = getTokenDecimals(token0);
    const token1Decimals = getTokenDecimals(token1);

    return {
      exists: true,
      reserves: {
        reserve0: ethers.formatUnits(reserves[0], token0Decimals),
        reserve1: ethers.formatUnits(reserves[1], token1Decimals),
        reserve0Raw: reserves[0].toString(),
        reserve1Raw: reserves[1].toString(),
        token0,
        token1,
        token0Decimals,
        token1Decimals,
        totalSupply: ethers.formatEther(totalSupply),
        hasLiquidity
      }
    };

  } catch (error) {
    return { exists: false, error: (error as Error).message };
  }
}

// Production price calculation
async function getPaymentTokenNeeded(
  paymentToken: string, 
  mchzAmountOut: bigint
): Promise<{ amountIn: bigint; route: string }> {
  try {
    const poolAddress = getPoolAddress(paymentToken);
    if (!poolAddress) {
      throw new Error(`No pool found for ${paymentToken}/MCHZ`);
    }

    const pairContract = new ethers.Contract(
      poolAddress,
      UNISWAP_V2_PAIR_ABI,
      sepoliaProvider
    );

    const [reserves, token0, token1] = await Promise.all([
      (pairContract as any).getReserves(),
      (pairContract as any).token0(),
      (pairContract as any).token1()
    ]);

    const paymentTokenAddress = paymentToken.toUpperCase() === 'USDC' 
      ? TOKENS.SEPOLIA.USDC 
      : TOKENS.SEPOLIA.USDT;
    
    let paymentTokenReserve: bigint;
    let mchzReserve: bigint;

    if (token0.toLowerCase() === paymentTokenAddress.toLowerCase()) {
      paymentTokenReserve = reserves[0];
      mchzReserve = reserves[1];
    } else if (token1.toLowerCase() === paymentTokenAddress.toLowerCase()) {
      paymentTokenReserve = reserves[1];
      mchzReserve = reserves[0];
    } else {
      if (token0.toLowerCase() === TOKENS.SEPOLIA.MCHZ.toLowerCase()) {
        mchzReserve = reserves[0];
        paymentTokenReserve = reserves[1];
      } else if (token1.toLowerCase() === TOKENS.SEPOLIA.MCHZ.toLowerCase()) {
        mchzReserve = reserves[1];
        paymentTokenReserve = reserves[0];
      } else {
        throw new Error(`Token address mismatch`);
      }
    }

    if (mchzReserve < mchzAmountOut) {
      throw new Error(`Insufficient MCHZ liquidity`);
    }

    // Calculate required payment token using constant product formula
    const numerator = mchzAmountOut * paymentTokenReserve;
    const denominator = mchzReserve - mchzAmountOut;
    
    if (denominator <= 0) {
      throw new Error('Insufficient output amount');
    }

    // Add 0.3% fee (Uniswap V2 fee)
    const amountInWithoutFee = numerator / denominator;
    const amountIn = (amountInWithoutFee * BigInt(1000)) / BigInt(997);

    return { 
      amountIn, 
      route: `${paymentToken} → MCHZ (Direct Pool: ${poolAddress})` 
    };

  } catch (error) {
    console.error('Error getting payment token needed:', error);
    throw new Error(`Failed to calculate price: ${error}`);
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
    
    const fanTokenAmount = await (dexContract as any).getPrice(fanTokenAddress, chzAmount);
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
    
    const balance = await (collateralContract as any).balanceOf(HYPERLANE_BRIDGE.SEPOLIA_COLLATERAL);
    return balance as bigint;
  } catch (error) {
    console.error('Error checking Hyperlane bridge balance:', error);
    throw new Error(`Failed to check bridge balance: ${error}`);
  }
}

// Production webhook endpoints
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

app.post('/api/webhook/payment_message_received', (req, res) => {
  const { data } = req.body;
  console.log('Payment message received:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.steps.bridgeTransfer = 'completed';
    payment.steps.fanTokenConversion = 'processing';
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/payment_tokens_received', (req, res) => {
  const { data } = req.body;
  console.log('Payment tokens received:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.chzReceived = data.chzAmountFormatted;
    payments.set(data.paymentId, payment);
  }
  
  res.json({ success: true });
});

app.post('/api/webhook/payment_received_chiliz', (req, res) => {
  const { data } = req.body;
  console.log('Payment processing started on Chiliz:', data.paymentId);
  
  const payment = payments.get(data.paymentId);
  if (payment) {
    payment.steps.fanTokenConversion = 'processing';
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

// Production quote endpoint
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
    
    // Validate pool exists and has liquidity
    const poolValidation = await validateUniswapPool(paymentTokenUpper);
    if (!poolValidation.exists) {
      res.status(400).json({ 
        error: `Pool validation failed: ${poolValidation.error}`,
        suggestion: 'Check if your deployed pools have liquidity and are properly configured'
      });
      return;
    }
    
    if (!poolValidation.reserves?.hasLiquidity) {
      res.status(400).json({ 
        error: `Pool has no liquidity`,
        poolInfo: poolValidation.reserves
      });
      return;
    }
    
    // Calculate CHZ needed for fan tokens
    const chzAmountWei = ethers.parseEther('1');
    const fanTokenAmountForOneCHZ = await getChilizFanTokenPrice(fanTokenSymbol, chzAmountWei);
    
    if (fanTokenAmountForOneCHZ === BigInt(0)) {
      res.status(400).json({ error: 'No liquidity for this fan token on Chiliz DEX' });
      return;
    }
    
    // Calculate CHZ needed for desired fan token amount
    const fanTokenAmountWei = ethers.parseEther(fanTokenAmount.toString());
    const chzNeeded = (fanTokenAmountWei * chzAmountWei) / fanTokenAmountForOneCHZ;
    
    // Calculate MCHZ needed (1:1 ratio with CHZ)
    const mchzNeeded = chzNeeded;
    
    // Calculate payment token needed for MCHZ
    const { amountIn: paymentTokenNeeded, route } = await getPaymentTokenNeeded(
      paymentTokenUpper,
      mchzNeeded
    );
    
    // Check bridge balance
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
    
    // Get correct decimals for formatting
    const decimals = getTokenDecimals(paymentTokenUpper);
    
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
    
    res.json({
      ...quote,
      poolInfo: poolValidation.reserves
    });
    
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ 
      error: (error as Error).message,
      suggestion: 'Check if pools have sufficient liquidity and contracts are deployed correctly'
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

// Pool validation endpoint
app.get('/api/validate-pools', async (req, res): Promise<void> => {
  try {
    const [usdcValidation, usdtValidation] = await Promise.all([
      validateUniswapPool('USDC'),
      validateUniswapPool('USDT')
    ]);
    
    res.json({
      pools: {
        USDC_MCHZ: {
          address: DEPLOYED_POOLS.USDC_MCHZ,
          validation: usdcValidation
        },
        USDT_MCHZ: {
          address: DEPLOYED_POOLS.USDT_MCHZ,
          validation: usdtValidation
        }
      },
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
    
    const prices = await (dexContract as any).getAllPrices(chzAmountWei);
    
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

// Production health check
app.get('/api/health', async (req, res): Promise<void> => {
  try {
    const [sepoliaBlock, chilizBlock] = await Promise.all([
      sepoliaProvider.getBlockNumber(),
      chilizProvider.getBlockNumber()
    ]);
    
    const [usdcValidation, usdtValidation] = await Promise.all([
      validateUniswapPool('USDC'),
      validateUniswapPool('USDT')
    ]);
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date(),
      blockchain: {
        sepolia: {
          connected: true,
          latestBlock: sepoliaBlock,
          rpc: 'Alchemy'
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
        hyperlaneMailbox: HYPERLANE_MAILBOX.SEPOLIA,
        chilizDex: CHILIZ_DEX
      },
      pools: {
        USDC_MCHZ: usdcValidation,
        USDT_MCHZ: usdtValidation
      },
      deployedPools: DEPLOYED_POOLS,
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
  console.log(`🚀 Production Payment Gateway running on port ${PORT}`);
  console.log('✅ All simulation code removed');
  console.log('✅ Production addresses configured');
  console.log('✅ Real Hyperlane integration');
  console.log('🌐 Endpoints:');
  console.log('- POST /api/quote - Get payment quote');
  console.log('- POST /api/create-payment - Create payment intent');
  console.log('- GET /api/payment-status/:id - Get payment status');
  console.log('- GET /api/bridge-balance - Check bridge balance');
  console.log('- GET /api/fan-token-prices - Get all fan token prices');
  console.log('- GET /api/validate-pools - Validate deployed pools');
  console.log('- GET /api/health - Production health check');
  console.log('- POST /api/webhook/* - Event webhooks');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

export default app;