import axios, { AxiosInstance } from 'axios';
import { DriftConfig, QuoteResponse, PaymentIntent } from '../types';

export class DriftAPI {
  private client: AxiosInstance;
  private config: DriftConfig;

  constructor(config: DriftConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get quote for a payment
   */
  async getQuote(
    fanTokenSymbol: string,
    fanTokenAmount: number,
    paymentToken: string
  ): Promise<QuoteResponse> {
    try {
      const response = await this.client.post('/api/quote', {
        fanTokenSymbol,
        fanTokenAmount,
        paymentToken,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get quote: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }

  /**
   * Create a payment intent
   */
  async createPayment(
    merchantAddress: string,
    fanTokenSymbol: string,
    fanTokenAmount: number,
    paymentToken: string,
    userAddress: string,
    webhookUrls?: string[]
  ): Promise<PaymentIntent> {
    try {
      const response = await this.client.post('/api/create-payment', {
        merchantAddress,
        fanTokenSymbol,
        fanTokenAmount,
        paymentToken,
        userAddress,
        webhookUrls,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create payment: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }

  /**
   * Execute a payment
   */
  async executePayment(paymentId: string, userPrivateKey: string): Promise<any> {
    try {
      const response = await this.client.post('/api/execute-payment', {
        paymentId,
        userPrivateKey,
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to execute payment: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/payment-status/${paymentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get payment status: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }

  /**
   * Get final transaction hash
   */
  async getTransactionHash(paymentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/payment-txhash/${paymentId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get transaction hash: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(): Promise<any> {
    try {
      const response = await this.client.get('/api/exchange-rates');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get exchange rates: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }

  /**
   * Get system health
   */
  async getHealth(): Promise<any> {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get health status: ${(error as any).response?.data?.error || (error as Error).message}`);
    }
  }
}