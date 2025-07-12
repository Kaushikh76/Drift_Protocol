// hardhat.config.ts
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import dotenv from 'dotenv';

dotenv.config();

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!ALCHEMY_API_KEY) {
  throw new Error('ALCHEMY_API_KEY is required in .env file');
}

if (!PRIVATE_KEY) {
  console.warn('PRIVATE_KEY not set in .env file. Deployment will not be available.');
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 1337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
      gas: 6000000,
      timeout: 60000,
      confirmations: 2
    },
    chilizspicy: {
      url: process.env.CHILIZ_RPC || 'https://spicy-rpc.chiliz.com',
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 88882,
      gasPrice: 30000000000, // 30 gwei (increased for reliability)
      gas: 8000000,
      timeout: 180000, // 3 minutes timeout
      confirmations: 1,
      // Additional network settings for reliability
      httpHeaders: {
        'User-Agent': 'Hardhat/TypeScript'
      }
    }
  },
  paths: {
    sources: "./src/contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  typechain: {
    outDir: 'src/types/contracts',
    target: 'ethers-v6',
    alwaysGenerateOverloads: false,
    externalArtifacts: ['externalArtifacts/*.json'],
    dontOverrideCompile: false
  },
  mocha: {
    timeout: 40000
  }
};

export default config;