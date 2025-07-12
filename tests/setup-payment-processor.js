// setup-payment-processor.js
const { ethers } = require('ethers');
require('dotenv').config();

const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PAYMENT_GATEWAY_ADDRESS = "0xC57E7DE24946811540a38112aDb6828Bf149070E";
const PAYMENT_PROCESSOR_ADDRESS = "0x901A8Eb98DAAD6a608A1C8c1bb9adBa5deeC4709";

const PAYMENT_GATEWAY_ABI = [
  "function setPaymentProcessor(address _paymentProcessor) external",
  "function paymentProcessor() external view returns (address)"
];

async function setupPaymentProcessor() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const gateway = new ethers.Contract(PAYMENT_GATEWAY_ADDRESS, PAYMENT_GATEWAY_ABI, wallet);
  
  console.log('Setting payment processor...');
  const tx = await gateway.setPaymentProcessor(PAYMENT_PROCESSOR_ADDRESS);
  await tx.wait();
  
  console.log('✅ Payment processor set!');
  const currentProcessor = await gateway.paymentProcessor();
  console.log('Current processor:', currentProcessor);
}

setupPaymentProcessor();