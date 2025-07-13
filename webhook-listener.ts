import express from 'express';

interface WebhookPayload {
  paymentId: string;
  status: string;
  step: 'userPayment' | 'uniswapSwap' | 'bridgeTransfer' | 'fanTokenConversion' | 'merchantPayment';
  stepStatus: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: string;
  transactionHash?: string;
  error?: string;
}

class PaymentWebhookListener {
  private app: express.Application;
  private port: number;

  constructor(port: number = 3002) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // Add basic logging middleware
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Main webhook endpoint
    this.app.post('/webhooks/payment-updates', this.handlePaymentWebhook.bind(this));
    
    // Health check for webhook service
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        service: 'webhook-listener',
        timestamp: new Date().toISOString()
      });
    });

    // Test endpoint
    this.app.post('/test', (req, res) => {
      console.log('🧪 Test webhook received:', JSON.stringify(req.body, null, 2));
      res.json({ message: 'Test webhook received successfully' });
    });
  }

  private handlePaymentWebhook(req: express.Request, res: express.Response): void {
    try {
      const webhook: WebhookPayload = req.body;
      
      console.log('\n' + '='.repeat(60));
      console.log(`📨 PAYMENT WEBHOOK RECEIVED`);
      console.log('='.repeat(60));
      console.log(`💳 Payment ID: ${webhook.paymentId}`);
      console.log(`📊 Overall Status: ${webhook.status}`);
      console.log(`🔄 Current Step: ${webhook.step}`);
      console.log(`✅ Step Status: ${webhook.stepStatus}`);
      console.log(`🕐 Timestamp: ${webhook.timestamp}`);
      
      if (webhook.transactionHash) {
        console.log(`🔗 Transaction Hash: ${webhook.transactionHash}`);
      }
      
      if (webhook.error) {
        console.log(`❌ Error: ${webhook.error}`);
      }
      
      // Handle different steps with detailed messaging
      this.processPaymentStep(webhook);
      
      console.log('='.repeat(60) + '\n');
      
      // Respond to the webhook
      res.json({ 
        success: true, 
        received: true,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      res.status(500).json({ 
        error: 'Failed to process webhook',
        message: (error as Error).message
      });
    }
  }

  private processPaymentStep(webhook: WebhookPayload): void {
    const { step, stepStatus, paymentId } = webhook;
    
    switch (step) {
      case 'userPayment':
        this.handleUserPaymentStep(stepStatus, paymentId);
        break;
        
      case 'uniswapSwap':
        this.handleUniswapStep(stepStatus, paymentId);
        break;
        
      case 'bridgeTransfer':
        this.handleBridgeStep(stepStatus, paymentId);
        break;
        
      case 'fanTokenConversion':
        this.handleFanTokenStep(stepStatus, paymentId);
        break;
        
      case 'merchantPayment':
        this.handleMerchantPaymentStep(stepStatus, paymentId);
        break;
        
      default:
        console.log(`🔍 Unknown step: ${step}`);
    }
  }

  private handleUserPaymentStep(status: string, paymentId: string): void {
    switch (status) {
      case 'processing':
        console.log('💰 User is transferring payment tokens...');
        break;
      case 'completed':
        console.log('✅ User payment received! Starting Uniswap swap...');
        // Here you could:
        // - Update your database
        // - Send notification to user
        // - Log for analytics
        break;
      case 'failed':
        console.log('❌ User payment failed! Please check user balance and allowances.');
        // Handle failure:
        // - Notify user of failure
        // - Update payment status in your system
        // - Send support notification
        break;
    }
  }

  private handleUniswapStep(status: string, paymentId: string): void {
    switch (status) {
      case 'processing':
        console.log('🔄 Swapping payment tokens to MCHZ on Uniswap...');
        break;
      case 'completed':
        console.log('✅ Uniswap swap completed! Preparing bridge transfer...');
        break;
      case 'failed':
        console.log('❌ Uniswap swap failed! Check pool liquidity and slippage.');
        break;
    }
  }

  private handleBridgeStep(status: string, paymentId: string): void {
    switch (status) {
      case 'processing':
        console.log('🌉 Bridging tokens via Hyperlane...');
        console.log('   ⏳ This may take 30-60 seconds...');
        break;
      case 'completed':
        console.log('✅ Bridge transfer completed! Tokens arrived on Chiliz!');
        break;
      case 'failed':
        console.log('❌ Bridge transfer failed! Check Hyperlane status.');
        break;
    }
  }

  private handleFanTokenStep(status: string, paymentId: string): void {
    switch (status) {
      case 'processing':
        console.log('🎫 Converting CHZ to fan tokens on Chiliz DEX...');
        break;
      case 'completed':
        console.log('✅ Fan token conversion completed! Sending to merchant...');
        break;
      case 'failed':
        console.log('❌ Fan token conversion failed! Check Chiliz DEX liquidity.');
        break;
    }
  }

  private handleMerchantPaymentStep(status: string, paymentId: string): void {
    switch (status) {
      case 'processing':
        console.log('🏪 Sending fan tokens to merchant...');
        break;
      case 'completed':
        console.log('🎉 PAYMENT COMPLETED SUCCESSFULLY!');
        console.log('   💫 Merchant has received fan tokens!');
        console.log('   📧 Consider sending confirmation emails');
        console.log('   📊 Update your analytics and reporting');
        // Handle completion:
        // - Send confirmation to user and merchant
        // - Update order status
        // - Trigger fulfillment process
        // - Update analytics
        break;
      case 'failed':
        console.log('❌ Merchant payment failed! Manual intervention may be required.');
        // Handle failure:
        // - Alert support team
        // - Check token balances
        // - Initiate refund process if needed
        break;
    }
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log('\n' + '🎣'.repeat(20));
      console.log(`🎣 WEBHOOK LISTENER STARTED`);
      console.log('🎣'.repeat(20));
      console.log(`📡 Listening on port: ${this.port}`);
      console.log(`🔗 Webhook URL: http://localhost:${this.port}/webhooks/payment-updates`);
      console.log(`🏥 Health check: http://localhost:${this.port}/health`);
      console.log(`🧪 Test endpoint: http://localhost:${this.port}/test`);
      console.log('\n📝 To use this webhook in your payments:');
      console.log(`   Add "http://localhost:${this.port}/webhooks/payment-updates" to webhookUrls`);
      console.log('\n⏳ Waiting for payment webhooks...\n');
    });
  }

  public stop(): void {
    console.log('🛑 Stopping webhook listener...');
    process.exit(0);
  }
}

// Example usage
function startWebhookListener() {
  const listener = new PaymentWebhookListener(3002);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    listener.stop();
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    listener.stop();
  });
  
  listener.start();
}

// Export for use
export { PaymentWebhookListener, startWebhookListener };

// If running directly
if (require.main === module) {
  startWebhookListener();
}