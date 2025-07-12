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
      console.warn('⚠️  Payment contract addresses not set. Some functionality will be limited.');
      console.warn('   Set PAYMENT_GATEWAY_ADDRESS and PAYMENT_PROCESSOR_ADDRESS in your .env file');
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
    
    // Your actual deployed Hyperlane bridge addresses
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
    console.log('🚀 Starting enhanced event listeners...');
    
    try {
      // Test connections first
      await this.testConnections();
      
      // Listen to Sepolia Payment Gateway events
      this.listenToSepoliaEvents();
      
      // Listen to Chiliz Payment Processor events
      this.listenToChilizEvents();
      
      // Listen to Hyperlane bridge events
      this.listenToHyperlaneEvents();
      
      console.log('✅ All event listeners started successfully');
      
      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to start event listeners:', error);
      throw error;
    }
  }
  
  private async testConnections(): Promise<void> {
    try {
      console.log('🔍 Testing blockchain connections...');
      
      const [sepoliaBlock, chilizBlock] = await Promise.all([
        this.sepoliaProvider.getBlockNumber(),
        this.chilizProvider.getBlockNumber()
      ]);
      
      console.log(`✅ Sepolia connected - Latest block: ${sepoliaBlock}`);
      console.log(`✅ Chiliz connected - Latest block: ${chilizBlock}`);
      
      // Test contract connections
      if (this.paymentGatewayAddress) {
        const code = await this.sepoliaProvider.getCode(this.paymentGatewayAddress);
        if (code === '0x') {
          console.warn('⚠️  Payment Gateway contract not found at address:', this.paymentGatewayAddress);
        } else {
          console.log('✅ Payment Gateway contract verified');
        }
      }
      
      if (this.paymentProcessorAddress) {
        const code = await this.chilizProvider.getCode(this.paymentProcessorAddress);
        if (code === '0x') {
          console.warn('⚠️  Payment Processor contract not found at address:', this.paymentProcessorAddress);
        } else {
          console.log('✅ Payment Processor contract verified');
        }
      }
      
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      throw error;
    }
  }
  
  private listenToSepoliaEvents(): void {
    console.log('👂 Listening to Sepolia Payment Gateway events...');
    
    if (!this.paymentGatewayAddress) {
      console.warn('⚠️  Skipping Sepolia events - no gateway address');
      return;
    }
    
    // Payment Initiated
    this.paymentGateway.on('PaymentInitiated', async (
      paymentId: string,
      user: string,
      merchant: string,
      paymentToken: string,
      paymentAmount: bigint,
      fanToken: string,
      fanTokenAmount: bigint,
      event: any
    ) => {
      try {
        console.log(`💰 Payment Initiated: ${paymentId}`);
        
        const payload: WebhookPayload = {
          eventType: 'payment_initiated',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            user,
            merchant,
            paymentToken,
            paymentAmount: ethers.formatUnits(paymentAmount, this.getTokenDecimals(paymentToken)),
            fanToken,
            fanTokenAmount: ethers.formatEther(fanTokenAmount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            gasUsed: event.log.gasUsed
          }
        };
        
        await this.sendWebhook('payment_initiated', payload);
      } catch (error) {
        console.error('Error handling PaymentInitiated event:', error);
      }
    });
    
    // Swap Completed
    this.paymentGateway.on('SwapCompleted', async (
      paymentId: string,
      mchzAmount: bigint,
      event: any
    ) => {
      try {
        console.log(`🔄 Swap Completed: ${paymentId} - ${ethers.formatEther(mchzAmount)} MCHZ`);
        
        const payload: WebhookPayload = {
          eventType: 'swap_completed',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            mchzAmount: ethers.formatEther(mchzAmount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('swap_completed', payload);
      } catch (error) {
        console.error('Error handling SwapCompleted event:', error);
      }
    });
    
    // Bridge Initiated
    this.paymentGateway.on('BridgeInitiated', async (
      paymentId: string,
      messageId: string,
      mchzAmount: bigint,
      event: any
    ) => {
      try {
        console.log(`🌉 Bridge Initiated: ${paymentId} - Message ID: ${messageId}`);
        
        const payload: WebhookPayload = {
          eventType: 'bridge_initiated',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            messageId,
            mchzAmount: ethers.formatEther(mchzAmount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('bridge_initiated', payload);
      } catch (error) {
        console.error('Error handling BridgeInitiated event:', error);
      }
    });
    
    // Error handling for contract events
    this.paymentGateway.on('error', (error: any) => {
      console.error('❌ Payment Gateway event error:', error);
    });
  }
  
  private listenToChilizEvents(): void {
    console.log('👂 Listening to Chiliz Payment Processor events...');
    
    if (!this.paymentProcessorAddress) {
      console.warn('⚠️  Skipping Chiliz events - no processor address');
      return;
    }
    
    // Payment Received
    this.paymentProcessor.on('PaymentReceived', async (
      paymentId: string,
      chzAmount: bigint,
      event: any
    ) => {
      try {
        console.log(`💰 Payment Received on Chiliz: ${paymentId} - ${ethers.formatEther(chzAmount)} CHZ`);
        
        const payload: WebhookPayload = {
          eventType: 'payment_received_chiliz',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            chzAmount: chzAmount.toString(),
            chzAmountFormatted: ethers.formatEther(chzAmount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('payment_received_chiliz', payload);
      } catch (error) {
        console.error('Error handling PaymentReceived event:', error);
      }
    });
    
    // Fan Token Swap Completed
    this.paymentProcessor.on('FanTokenSwapCompleted', async (
      paymentId: string,
      fanToken: string,
      fanTokenAmount: bigint,
      event: any
    ) => {
      try {
        console.log(`🎫 Fan Token Swap Completed: ${paymentId} - ${ethers.formatEther(fanTokenAmount)} tokens`);
        
        const payload: WebhookPayload = {
          eventType: 'fan_token_swap_completed',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            fanToken,
            fanTokenAmount: ethers.formatEther(fanTokenAmount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('fan_token_swap_completed', payload);
      } catch (error) {
        console.error('Error handling FanTokenSwapCompleted event:', error);
      }
    });
    
    // Payment Sent to Merchant
    this.paymentProcessor.on('PaymentSentToMerchant', async (
      paymentId: string,
      merchant: string,
      fanToken: string,
      amount: bigint,
      event: any
    ) => {
      try {
        console.log(`🏪 Payment Sent to Merchant: ${paymentId} - ${ethers.formatEther(amount)} tokens to ${merchant}`);
        
        const payload: WebhookPayload = {
          eventType: 'payment_sent_to_merchant',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            merchant,
            fanToken,
            amount: ethers.formatEther(amount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('payment_sent_to_merchant', payload);
      } catch (error) {
        console.error('Error handling PaymentSentToMerchant event:', error);
      }
    });
    
    // Payment Completed
    this.paymentProcessor.on('PaymentCompleted', async (
      paymentId: string,
      merchant: string,
      fanToken: string,
      totalFanTokens: bigint,
      event: any
    ) => {
      try {
        console.log(`✅ Payment Completed: ${paymentId} - ${ethers.formatEther(totalFanTokens)} total tokens`);
        
        const payload: WebhookPayload = {
          eventType: 'payment_completed',
          timestamp: new Date().toISOString(),
          data: {
            paymentId,
            merchant,
            fanToken,
            totalFanTokens: totalFanTokens.toString(),
            totalFanTokensFormatted: ethers.formatEther(totalFanTokens),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('payment_completed', payload);
      } catch (error) {
        console.error('Error handling PaymentCompleted event:', error);
      }
    });
    
    // Error handling for contract events
    this.paymentProcessor.on('error', (error: any) => {
      console.error('❌ Payment Processor event error:', error);
    });
  }
  
  private listenToHyperlaneEvents(): void {
    console.log('👂 Listening to Hyperlane bridge events...');
    
    // Sepolia -> Chiliz transfers
    this.hyperlaneWarpSepolia.on('SentTransferRemote', async (
      destination: number,
      recipient: string,
      amount: bigint,
      messageId: string,
      event: any
    ) => {
      try {
        console.log(`🚀 Hyperlane Transfer Sent: ${messageId} - ${ethers.formatEther(amount)} MCHZ`);
        
        const payload: WebhookPayload = {
          eventType: 'hyperlane_transfer_sent',
          timestamp: new Date().toISOString(),
          data: {
            messageId,
            destination,
            recipient,
            amount: ethers.formatEther(amount),
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('hyperlane_transfer_sent', payload);
      } catch (error) {
        console.error('Error handling SentTransferRemote event:', error);
      }
    });
    
    // Chiliz receives from Sepolia
    this.hyperlaneWarpChiliz.on('ReceivedTransferRemote', async (
      origin: number,
      recipient: string,
      amount: bigint,
      messageId: string,
      event: any
    ) => {
      try {
        console.log(`📥 Hyperlane Transfer Received: ${messageId} - ${ethers.formatEther(amount)} CHZ`);
        
        const payload: WebhookPayload = {
          eventType: 'hyperlane_message_delivered',
          timestamp: new Date().toISOString(),
          data: {
            messageId,
            origin,
            recipient,
            amount: ethers.formatEther(amount),
            destinationTxHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber
          }
        };
        
        await this.sendWebhook('hyperlane_message_delivered', payload);
      } catch (error) {
        console.error('Error handling ReceivedTransferRemote event:', error);
      }
    });
    
    // Error handling for bridge events
    this.hyperlaneWarpSepolia.on('error', (error: any) => {
      console.error('❌ Hyperlane Sepolia event error:', error);
    });
    
    this.hyperlaneWarpChiliz.on('error', (error: any) => {
      console.error('❌ Hyperlane Chiliz event error:', error);
    });
  }
  
  private async sendWebhook(endpoint: string, payload: WebhookPayload): Promise<void> {
    try {
      const url = `${this.webhookUrl}/${endpoint}`;
      
      console.log(`📡 Sending webhook to ${url}:`, {
        eventType: payload.eventType,
        paymentId: payload.data.paymentId || 'N/A'
      });
      
      const response = await axios.post(url, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ Webhook sent successfully: ${endpoint}`);
      } else {
        console.warn(`⚠️  Webhook response not OK: ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ Webhook failed for ${endpoint}:`, error);
      
      // Retry logic for critical events
      if (['payment_completed', 'payment_initiated'].includes(endpoint)) {
        console.log(`🔄 Retrying webhook for ${endpoint} in 5 seconds...`);
        setTimeout(() => this.sendWebhook(endpoint, payload), 5000);
      }
    }
  }
  
  private getTokenDecimals(tokenAddress: string): number {
    // Return appropriate decimals based on token address
    const tokenDecimals: { [key: string]: number } = {
      // Aave test tokens
      '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8': 6, // Aave USDC
      '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0': 6, // Aave USDT
      // mCHZ token
      [process.env.MCHZ_TOKEN_ADDRESS || '0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7']: 18, // mCHZ
      // Old addresses (keeping for backward compatibility)
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': 6, // Old USDC
      '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06': 6, // Old USDT
      '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14': 18  // WETH
    };
    
    return tokenDecimals[tokenAddress] || 18;
  }
  
  private startHealthMonitoring(): void {
    console.log('🏥 Starting health monitoring...');
    
    // Check health every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, 30000);
  }
  
  private async performHealthCheck(): Promise<void> {
    try {
      const [sepoliaBlock, chilizBlock] = await Promise.all([
        this.sepoliaProvider.getBlockNumber(),
        this.chilizProvider.getBlockNumber()
      ]);
      
      const healthStatus: HealthStatus = {
        sepolia: {
          connected: true,
          latestBlock: sepoliaBlock,
          paymentGateway: this.paymentGatewayAddress
        },
        chiliz: {
          connected: true,
          latestBlock: chilizBlock,
          paymentProcessor: this.paymentProcessorAddress
        },
        hyperlane: {
          monitoring: true
        },
        timestamp: new Date().toISOString()
      };
      
      // Send health status to webhook
      const payload: WebhookPayload = {
        eventType: 'health_check',
        timestamp: new Date().toISOString(),
        data: healthStatus
      };
      
      // Only log detailed health info every 5 minutes
      const now = Date.now();
      const lastDetailedLog = (this as any).lastDetailedHealthLog || 0;
      if (now - lastDetailedLog > 300000) { // 5 minutes
        console.log('💚 Health check passed:', {
          sepolia: sepoliaBlock,
          chiliz: chilizBlock
        });
        (this as any).lastDetailedHealthLog = now;
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      
      const healthStatus: HealthStatus = {
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      };
      
      const payload: WebhookPayload = {
        eventType: 'health_check_failed',
        timestamp: new Date().toISOString(),
        data: healthStatus
      };
      
      await this.sendWebhook('health_check_failed', payload);
    }
  }
  
  // Enhanced payment tracking methods
  async getPaymentDetails(paymentId: string): Promise<PaymentDetails | null> {
    try {
      if (!this.paymentGatewayAddress || !this.paymentProcessorAddress) {
        throw new Error('Contract addresses not configured');
      }
      
      const [sepoliaPayment, chilizPayment] = await Promise.all([
        (this.paymentGateway as any).getPayment(paymentId),
        (this.paymentProcessor as any).getProcessedPayment(paymentId)
      ]);
      
      return {
        sepolia: {
          paymentId: sepoliaPayment.paymentId,
          user: sepoliaPayment.user,
          merchant: sepoliaPayment.merchant,
          paymentToken: sepoliaPayment.paymentToken,
          paymentAmount: ethers.formatUnits(sepoliaPayment.paymentAmount, this.getTokenDecimals(sepoliaPayment.paymentToken)),
          fanToken: sepoliaPayment.fanToken,
          fanTokenAmount: ethers.formatEther(sepoliaPayment.fanTokenAmount),
          mchzAmount: ethers.formatEther(sepoliaPayment.mchzAmount),
          hyperlaneMessageId: sepoliaPayment.hyperlaneMessageId,
          completed: sepoliaPayment.completed
        },
        chiliz: {
          paymentId: chilizPayment.paymentId,
          merchant: chilizPayment.merchant,
          fanToken: chilizPayment.fanToken,
          fanTokenAmount: ethers.formatEther(chilizPayment.fanTokenAmount),
          chzReceived: ethers.formatEther(chilizPayment.chzReceived),
          fanTokensSent: ethers.formatEther(chilizPayment.fanTokensSent),
          completed: chilizPayment.completed,
          timestamp: new Date(Number(chilizPayment.timestamp) * 1000).toISOString()
        }
      };
      
    } catch (error) {
      console.error('Error getting payment details:', error);
      return null;
    }
  }
  
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const [sepoliaBlock, chilizBlock] = await Promise.all([
        this.sepoliaProvider.getBlockNumber(),
        this.chilizProvider.getBlockNumber()
      ]);
      
      return {
        sepolia: {
          connected: true,
          latestBlock: sepoliaBlock,
          paymentGateway: this.paymentGatewayAddress
        },
        chiliz: {
          connected: true,
          latestBlock: chilizBlock,
          paymentProcessor: this.paymentProcessorAddress
        },
        hyperlane: {
          monitoring: true
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      };
    }
  }
  
  // Graceful shutdown
  async stop(): Promise<void> {
    console.log('🛑 Stopping event listeners...');
    
    try {
      // Remove all listeners
      this.paymentGateway.removeAllListeners();
      this.paymentProcessor.removeAllListeners();
      this.hyperlaneWarpSepolia.removeAllListeners();
      this.hyperlaneWarpChiliz.removeAllListeners();
      
      console.log('✅ Event listeners stopped gracefully');
    } catch (error) {
      console.error('❌ Error stopping event listeners:', error);
    }
  }
}