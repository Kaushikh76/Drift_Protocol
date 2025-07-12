import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface EventData {
  [key: string]: any;
}

interface WebhookPayload {
  eventType: string;
  timestamp: string;
  data: EventData;
}

interface PaymentDetails {
  sepolia: {
    paymentId: string;
    user: string;
    merchant: string;
    paymentToken: string;
    paymentAmount: string;
    fanToken: string;
    fanTokenAmount: string;
    mchzAmount: string;
    hyperlaneMessageId: string;
    completed: boolean;
  };
  chiliz: {
    paymentId: string;
    merchant: string;
    fanToken: string;
    fanTokenAmount: string;
    chzReceived: string;
    fanTokensSent: string;
    completed: boolean;
    timestamp: string;
  };
}

interface HealthStatus {
  sepolia?: {
    connected: boolean;
    latestBlock: number;
    paymentGateway: string;
  };
  chiliz?: {
    connected: boolean;
    latestBlock: number;
    paymentProcessor: string;
  };
  hyperlane?: {
    monitoring: boolean;
  };
  timestamp: string;
  error?: string;
}

export class EventListenerService {
  private sepoliaProvider: ethers.JsonRpcProvider;
  private chilizProvider: ethers.JsonRpcProvider;
  private paymentGatewayAddress: string;
  private paymentProcessorAddress: string;
  
  private paymentGateway: ethers.Contract;
  private paymentProcessor: ethers.Contract;
  private hyperlaneWarpSepolia: ethers.Contract;
  private hyperlaneWarpChiliz: ethers.Contract;
  
  private webhookUrl: string;
  
  private readonly paymentGatewayABI = [
    "event PaymentInitiated(string indexed paymentId, address indexed user, address indexed merchant, address paymentToken, uint256 paymentAmount, address fanToken, uint256 fanTokenAmount)",
    "event SwapCompleted(string indexed paymentId, uint256 mchzAmount)",
    "event BridgeInitiated(string indexed paymentId, bytes32 indexed messageId, uint256 mchzAmount)",
    "function getPayment(string calldata paymentId) external view returns (tuple(string paymentId, address user, address merchant, address paymentToken, uint256 paymentAmount, address fanToken, uint256 fanTokenAmount, uint256 mchzAmount, bytes32 hyperlaneMessageId, bool completed))"
  ];
  
  private readonly paymentProcessorABI = [
    "event PaymentReceived(string indexed paymentId, uint256 chzAmount)",
    "event FanTokenSwapCompleted(string indexed paymentId, address indexed fanToken, uint256 fanTokenAmount)",
    "event PaymentSentToMerchant(string indexed paymentId, address indexed merchant, address fanToken, uint256 amount)",
    "event PaymentCompleted(string indexed paymentId, address indexed merchant, address fanToken, uint256 totalFanTokens)",
    "function getProcessedPayment(string calldata paymentId) external view returns (tuple(string paymentId, address merchant, address fanToken, uint256 fanTokenAmount, uint256 chzReceived, uint256 fanTokensSent, bool completed, uint256 timestamp))"
  ];
  
  private readonly hyperlaneWarpABI = [
    "event SentTransferRemote(uint32 indexed destination, bytes32 indexed recipient, uint256 amount, bytes32 indexed messageId)",
    "event ReceivedTransferRemote(uint32 indexed origin, bytes32 indexed recipient, uint256 amount, bytes32 indexed messageId)"
  ];

  constructor() {
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
    if (!ALCHEMY_API_KEY) {
      throw new Error('ALCHEMY_API_KEY is required in .env file');
    }

    const SEPOLIA_RPC = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    const CHILIZ_RPC = process.env.CHILIZ_RPC || 'https://spicy-rpc.chiliz.com';
    
    this.sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    this.chilizProvider = new ethers.JsonRpcProvider(CHILIZ_RPC);
    
    this.paymentGatewayAddress = process.env.PAYMENT_GATEWAY_ADDRESS || '';
    this.paymentProcessorAddress = process.env.PAYMENT_PROCESSOR_ADDRESS || '';
    
    if (!this.paymentGatewayAddress || !this.paymentProcessorAddress) {
      console.warn('Payment contract addresses not set. Some functionality will be limited.');
    }
    
    this.paymentGateway = new ethers.Contract(
      this.paymentGatewayAddress,
      this.paymentGatewayABI,
      this.sepoliaProvider
    );
    
    this.paymentProcessor = new ethers.Contract(
      this.paymentProcessorAddress,
      this.paymentProcessorABI,
      this.chilizProvider
    );
    
    this.hyperlaneWarpSepolia = new ethers.Contract(
      '0xeb2a0b7aaaDd23851c08B963C3F4fbe00B897c04',
      this.hyperlaneWarpABI,
      this.sepoliaProvider
    );
    
    this.hyperlaneWarpChiliz = new ethers.Contract(
      '0x286757c8D8f506a756AB00A7eaC22ce1F9ee3F16',
      this.hyperlaneWarpABI,
      this.chilizProvider
    );
    
    this.webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhook';
  }
  
  async startListening(): Promise<void> {
    console.log('Starting TypeScript event listeners...');
    
    // Listen to Sepolia Payment Gateway events
    this.listenToSepoliaEvents();
    
    // Listen to Chiliz Payment Processor events
    this.listenToChilizEvents();
    
    // Listen to Hyperlane bridge events
    this.listenToHyperlaneEvents();
    
    console.log('All TypeScript event listeners started successfully ✅');
  }
  
  private listenToSepoliaEvents(): void {
    console.log('Listening to Sepolia Payment Gateway events...');
    
    // Payment Initiated
    this.paymentGateway.on('PaymentInitiated', async (
      paymentId: string,
      user: string,
      merchant: string,