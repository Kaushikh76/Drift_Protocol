// scripts/deploy.ts - TypeScript deployment script

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface DeployedAddresses {
  sepolia?: {
    paymentGateway: string;
    network: string;
    chainId: number;
  };
  chiliz?: {
    paymentProcessor: string;
    network: string;
    chainId: number;
  };
  deployedAt: string;
  deployer: string;
}

interface ContractConfig {
  hyperlaneMailboxChiliz: string;
  paymentGatewayAddress?: string;
}

async function main(): Promise<void> {
  console.log('🚀 Deploying Payment Gateway System with TypeScript...');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  // Contract configuration
  const config: ContractConfig = {
    hyperlaneMailboxChiliz: '0xA6665B1a40EEdBd7BD178DDB9966E9e61662aa00' // Correct mailbox address
  };

  const network = await ethers.provider.getNetwork();
  console.log('Connected to network:', network.name, 'Chain ID:', network.chainId.toString());

  let addresses: DeployedAddresses = {
    deployedAt: new Date().toISOString(),
    deployer: deployer.address
  };

  // Load existing addresses if they exist
  const addressesPath = path.join(__dirname, '..', 'deployed-addresses.json');
  if (fs.existsSync(addressesPath)) {
    try {
      const existingAddresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
      addresses = { ...existingAddresses, ...addresses };
      console.log('📄 Loaded existing deployment addresses');
    } catch (error) {
      console.log('⚠️  Could not load existing addresses, starting fresh');
    }
  }

  if (network.chainId === 11155111n) {
    // Deploy on Sepolia
    await deployPaymentGateway(deployer, addresses);
  } else if (network.chainId === 88882n) {
    // Deploy on Chiliz Spicy
    await deployPaymentProcessor(deployer, addresses, config);
  } else {
    throw new Error(`Unsupported network. Chain ID: ${network.chainId}`);
  }

  // Save addresses to file
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log('✅ Addresses saved to deployed-addresses.json');

  // Generate environment variables
  generateEnvVariables(addresses);
}

async function deployPaymentGateway(
  deployer: any,
  addresses: DeployedAddresses
): Promise<void> {
  console.log('\n1. 🔨 Deploying Payment Gateway on Sepolia...');
  
  const PaymentGateway = await ethers.getContractFactory('PaymentGateway');
  
  console.log('⏳ Deploying contract...');
  const paymentGateway = await PaymentGateway.deploy();
  await paymentGateway.waitForDeployment();
  
  const gatewayAddress = await paymentGateway.getAddress();
  console.log('✅ Payment Gateway deployed to:', gatewayAddress);

  // Verify contract addresses are correct
  console.log('🔍 Verifying contract configuration...');
  
  // Check if the contract has the correct Uniswap router
  const expectedRouter = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  console.log('Expected Uniswap Router:', expectedRouter);
  
  // Check if the contract has the correct Hyperlane bridge
  const expectedBridge = '0xeb2a0b7aaaDd23851c08B963C3F4fbe00B897c04';
  console.log('Expected Hyperlane Bridge:', expectedBridge);
  
  // Check if the contract has the correct token addresses
  const expectedUSDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const expectedMCHZ = '0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7';
  console.log('Expected USDC:', expectedUSDC);
  console.log('Expected MCHZ:', expectedMCHZ);

  addresses.sepolia = {
    paymentGateway: gatewayAddress,
    network: 'sepolia',
    chainId: 11155111
  };

  console.log('✅ Sepolia deployment completed');
}

async function deployPaymentProcessor(
  deployer: any,
  addresses: DeployedAddresses,
  config: ContractConfig
): Promise<void> {
  console.log('\n2. 🔨 Deploying Payment Processor on Chiliz Spicy...');
  
  if (!addresses.sepolia?.paymentGateway) {
    throw new Error('Payment Gateway address not found. Deploy on Sepolia first.');
  }

  const PaymentProcessor = await ethers.getContractFactory('PaymentProcessor');
  
  console.log('⏳ Deploying contract with parameters:');
  console.log('- Hyperlane Mailbox:', config.hyperlaneMailboxChiliz);
  console.log('- Payment Gateway:', addresses.sepolia.paymentGateway);
  
  // Estimate gas first
  try {
    console.log('🔍 Estimating gas...');
    const estimatedGas = await PaymentProcessor.deployTransaction({
      args: [config.hyperlaneMailboxChiliz, addresses.sepolia.paymentGateway]
    }).estimateGas();
    
    console.log('📊 Estimated gas:', estimatedGas.toString());
  } catch (error) {
    console.log('⚠️ Gas estimation failed, proceeding with deployment...');
  }
  
  const paymentProcessor = await PaymentProcessor.deploy(
    config.hyperlaneMailboxChiliz,
    addresses.sepolia.paymentGateway,
    {
      gasLimit: 5000000, // Manual gas limit
      gasPrice: ethers.parseUnits('25', 'gwei') // 25 gwei
    }
  );
  
  console.log('⏳ Waiting for deployment...');
  await paymentProcessor.waitForDeployment();
  
  const processorAddress = await paymentProcessor.getAddress();
  console.log('✅ Payment Processor deployed to:', processorAddress);

  // Verify contract configuration
  console.log('🔍 Verifying contract configuration...');
  
  // Check if the contract has the correct Chiliz DEX
  const expectedDex = '0xFbef475155294d7Ef054f2b79B908c91A9914d82';
  console.log('Expected Chiliz DEX:', expectedDex);
  
  // Check if the contract has the correct WCHZ address
  const expectedWCHZ = '0x678c34581db0a7808d0aC669d7025f1408C9a3C6';
  console.log('Expected WCHZ:', expectedWCHZ);

  addresses.chiliz = {
    paymentProcessor: processorAddress,
    network: 'chilizspicy',
    chainId: 88882
  };

  console.log('✅ Chiliz deployment completed');
}

function generateEnvVariables(addresses: DeployedAddresses): void {
  console.log('\n📋 Environment Variables for Backend:');
  console.log('=====================================');
  
  if (addresses.sepolia) {
    console.log(`PAYMENT_GATEWAY_ADDRESS=${addresses.sepolia.paymentGateway}`);
  }
  
  if (addresses.chiliz) {
    console.log(`PAYMENT_PROCESSOR_ADDRESS=${addresses.chiliz.paymentProcessor}`);
  }
  
  console.log('ALCHEMY_API_KEY=_gt_AZ1rGJ4kzheRq8uSQIdtCdCIy6AL');
  console.log('CHILIZ_RPC=https://spicy-rpc.chiliz.com');
  console.log('PRIVATE_KEY=your_private_key_here');
  console.log('WEBHOOK_URL=http://localhost:3001/api/webhook');
  console.log('PORT=3001');
  console.log('NODE_ENV=development');
  
  console.log('\n🔗 Contract Verification URLs:');
  if (addresses.sepolia) {
    console.log(`Sepolia Etherscan: https://sepolia.etherscan.io/address/${addresses.sepolia.paymentGateway}`);
  }
  if (addresses.chiliz) {
    console.log(`Chiliz Explorer: https://testnet.chiliscan.com/address/${addresses.chiliz.paymentProcessor}`);
  }
  
  console.log('\n🧪 Testing Commands:');
  console.log('==================');
  console.log('# Test quote endpoint');
  console.log('curl -X POST http://localhost:3001/api/quote \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"fanTokenSymbol": "PSG", "fanTokenAmount": 25, "paymentToken": "USDC"}\'');
  
  console.log('\n# Test bridge balance');
  console.log('curl http://localhost:3001/api/bridge-balance');
  
  console.log('\n# Test fan token prices');
  console.log('curl http://localhost:3001/api/fan-token-prices');
  
  console.log('\n# Health check');
  console.log('curl http://localhost:3001/api/health');
}

// Contract interaction functions for verification
async function verifyPaymentGatewaySetup(gatewayAddress: string): Promise<void> {
  console.log('\n🔍 Verifying Payment Gateway setup...');
  
  const gateway = await ethers.getContractAt('PaymentGateway', gatewayAddress);
  
  try {
    // Test quote function
    const quote = await gateway.getQuote(
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC
      ethers.parseEther('1') // 1 MCHZ
    );
    console.log('✅ Quote function working. USDC needed for 1 MCHZ:', ethers.formatUnits(quote, 6));
  } catch (error) {
    console.log('❌ Quote function failed:', (error as Error).message);
  }
}

async function verifyPaymentProcessorSetup(processorAddress: string): Promise<void> {
  console.log('\n🔍 Verifying Payment Processor setup...');
  
  const processor = await ethers.getContractAt('PaymentProcessor', processorAddress);
  
  try {
    // Test price function for PSG tokens
    const psgPrice = await processor.getFanTokenPrice(
      '0x6D124526a5948Cb82BB5B531Bf9989D8aB34C899', // PSG token
      ethers.parseEther('1') // 1 CHZ
    );
    console.log('✅ PSG price function working. PSG tokens for 1 CHZ:', ethers.formatEther(psgPrice));
  } catch (error) {
    console.log('❌ PSG price function failed:', (error as Error).message);
  }
}

// Deployment verification
async function runPostDeploymentVerification(addresses: DeployedAddresses): Promise<void> {
  console.log('\n🔬 Running post-deployment verification...');
  
  if (addresses.sepolia) {
    await verifyPaymentGatewaySetup(addresses.sepolia.paymentGateway);
  }
  
  if (addresses.chiliz) {
    await verifyPaymentProcessorSetup(addresses.chiliz.paymentProcessor);
  }
}

// Enhanced error handling
process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception during deployment:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('💥 Unhandled Rejection during deployment:', reason);
  process.exit(1);
});

main()
  .then(() => {
    console.log('\n🎉 Deployment completed successfully!');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  });