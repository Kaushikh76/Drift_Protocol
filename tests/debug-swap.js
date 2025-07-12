// debug-swap.js
const { ethers } = require('ethers');
require('dotenv').config();

const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Addresses
const UNISWAP_ROUTER = '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3';
const USDC_ADDRESS = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const MCHZ_ADDRESS = '0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7';
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';

const ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)"
];

async function debugSwap() {
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const router = new ethers.Contract(UNISWAP_ROUTER, ROUTER_ABI, provider);
    
    const paymentAmount = ethers.parseUnits("1.819637", 6); // 1.819637 USDC
    const minMchzOut = ethers.parseEther("4.35"); // 4.35 MCHZ expected
    
    console.log('🔍 Testing Uniswap swap paths...');
    console.log('Payment amount:', ethers.formatUnits(paymentAmount, 6), 'USDC');
    console.log('Expected MCHZ out:', ethers.formatEther(minMchzOut), 'MCHZ');
    
    // Test direct path: USDC -> MCHZ
    try {
      console.log('\n📊 Testing direct path: USDC -> MCHZ');
      const directPath = [USDC_ADDRESS, MCHZ_ADDRESS];
      const directAmounts = await router.getAmountsOut(paymentAmount, directPath);
      
      console.log('✅ Direct path works!');
      console.log('USDC in:', ethers.formatUnits(directAmounts[0], 6));
      console.log('MCHZ out:', ethers.formatEther(directAmounts[1]));
      console.log('Price impact:', ((Number(ethers.formatEther(minMchzOut)) - Number(ethers.formatEther(directAmounts[1]))) / Number(ethers.formatEther(minMchzOut)) * 100).toFixed(2) + '%');
      
      if (directAmounts[1] >= minMchzOut) {
        console.log('✅ Direct path meets minimum output requirement');
      } else {
        console.log('❌ Direct path does NOT meet minimum output requirement');
        console.log('Expected:', ethers.formatEther(minMchzOut));
        console.log('Got:', ethers.formatEther(directAmounts[1]));
      }
      
    } catch (error) {
      console.log('❌ Direct path failed:', error.message);
      
      // Test WETH path: USDC -> WETH -> MCHZ
      try {
        console.log('\n📊 Testing WETH path: USDC -> WETH -> MCHZ');
        const wethPath = [USDC_ADDRESS, WETH_ADDRESS, MCHZ_ADDRESS];
        const wethAmounts = await router.getAmountsOut(paymentAmount, wethPath);
        
        console.log('✅ WETH path works!');
        console.log('USDC in:', ethers.formatUnits(wethAmounts[0], 6));
        console.log('WETH intermediate:', ethers.formatEther(wethAmounts[1]));
        console.log('MCHZ out:', ethers.formatEther(wethAmounts[2]));
        
        if (wethAmounts[2] >= minMchzOut) {
          console.log('✅ WETH path meets minimum output requirement');
        } else {
          console.log('❌ WETH path does NOT meet minimum output requirement');
        }
        
      } catch (wethError) {
        console.log('❌ WETH path also failed:', wethError.message);
      }
    }
    
    // Test reverse calculation - how much USDC needed for 4.35 MCHZ
    try {
      console.log('\n📊 Testing reverse calculation: How much USDC for 4.35 MCHZ?');
      const directPath = [USDC_ADDRESS, MCHZ_ADDRESS];
      const reverseAmounts = await router.getAmountsIn(minMchzOut, directPath);
      
      console.log('USDC needed for 4.35 MCHZ:', ethers.formatUnits(reverseAmounts[0], 6));
      console.log('We have:', ethers.formatUnits(paymentAmount, 6));
      
      if (paymentAmount >= reverseAmounts[0]) {
        console.log('✅ We have enough USDC for the swap');
      } else {
        console.log('❌ We do NOT have enough USDC for the swap');
      }
      
    } catch (reverseError) {
      console.log('❌ Reverse calculation failed:', reverseError.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugSwap();