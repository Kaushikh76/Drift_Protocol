// supabase-integration.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Supabase Configuration
const SUPABASE_URL = 'https://hugcyjkenzxbjndududo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1Z2N5amtlbnp4YmpuZHVkdWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNzAzMzksImV4cCI6MjA2Nzk0NjMzOX0.xfW090TocXSlJeYDcctaEl8A9CiOUdpqlrgHE3933ts';
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this';

// Initialize Supabase client
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database Types
interface Merchant {
  id: string;
  email: string;
  business_name: string;
  wallet_address: string;
  password_hash: string;
  total_earnings_usd: number;
  total_transactions: number;
  supported_tokens: string[];
  created_at: string;
  updated_at: string;
  status: 'active' | 'suspended' | 'pending';
}

interface Transaction {
  id: string;
  payment_id: string;
  merchant_id: string;
  user_address: string;
  fan_token_symbol: string;
  fan_token_amount: number;
  payment_token: string;
  payment_token_amount: number;
  usd_value: number;
  transaction_hash?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  gas_fee?: number;
  network_fee?: number;
}

interface Analytics {
  total_merchants: number;
  active_merchants: number;
  total_transactions: number;
  active_transactions: number;
  total_volume_usd: number;
  top_tokens: Array<{
    token: string;
    count: number;
    volume: number;
  }>;
}

// Authentication middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    (req as any).merchant = decoded;
    next();
  });
};

// Admin authentication middleware
const authenticateAdmin = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  
  next();
};

export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = supabase;
  }

  // Initialize database tables
  async initializeDatabase(): Promise<void> {
    console.log('🗄️ Initializing Supabase database...');
    console.log('✅ Database tables should be created manually in Supabase SQL editor');
  }

  // Merchant Management
  async createMerchant(merchantData: {
    email: string;
    business_name: string;
    wallet_address: string;
    password: string;
    supported_tokens?: string[];
  }): Promise<{ merchant: Merchant; token: string } | { error: string }> {
    try {
      // Check if merchant already exists
      const { data: existingMerchant } = await this.supabase
        .from('merchants')
        .select('id')
        .eq('email', merchantData.email)
        .single();

      if (existingMerchant) {
        return { error: 'Merchant with this email already exists' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(merchantData.password, 10);

      // Create merchant
      const { data: merchant, error } = await this.supabase
        .from('merchants')
        .insert({
          email: merchantData.email,
          business_name: merchantData.business_name,
          wallet_address: merchantData.wallet_address,
          password_hash: passwordHash,
          supported_tokens: merchantData.supported_tokens || ['PSG', 'BAR', 'SPURS'],
          total_earnings_usd: 0,
          total_transactions: 0,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        return { error: error.message };
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          merchantId: merchant.id, 
          email: merchant.email,
          wallet_address: merchant.wallet_address 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return { merchant, token };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  async authenticateMerchant(email: string, password: string): Promise<{ merchant: Merchant; token: string } | { error: string }> {
    try {
      const { data: merchant, error } = await this.supabase
        .from('merchants')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !merchant) {
        return { error: 'Invalid credentials' };
      }

      const validPassword = await bcrypt.compare(password, merchant.password_hash);
      if (!validPassword) {
        return { error: 'Invalid credentials' };
      }

      const token = jwt.sign(
        { 
          merchantId: merchant.id, 
          email: merchant.email,
          wallet_address: merchant.wallet_address 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return { merchant, token };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  async getMerchantByWallet(walletAddress: string): Promise<Merchant | null> {
    try {
      const { data: merchant, error } = await this.supabase
        .from('merchants')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        console.error('Error fetching merchant:', error);
        return null;
      }

      return merchant;
    } catch (error) {
      console.error('Error in getMerchantByWallet:', error);
      return null;
    }
  }

  // Transaction Management
  async createTransaction(transactionData: {
    payment_id: string;
    merchant_wallet: string;
    user_address: string;
    fan_token_symbol: string;
    fan_token_amount: number;
    payment_token: string;
    payment_token_amount: number;
    usd_value: number;
  }): Promise<string | null> {
    try {
      // Get merchant by wallet address
      const merchant = await this.getMerchantByWallet(transactionData.merchant_wallet);
      if (!merchant) {
        console.error('Merchant not found for wallet:', transactionData.merchant_wallet);
        return null;
      }

      const { data: transaction, error } = await this.supabase
        .from('transactions')
        .insert({
          payment_id: transactionData.payment_id,
          merchant_id: merchant.id,
          user_address: transactionData.user_address,
          fan_token_symbol: transactionData.fan_token_symbol,
          fan_token_amount: transactionData.fan_token_amount,
          payment_token: transactionData.payment_token,
          payment_token_amount: transactionData.payment_token_amount,
          usd_value: transactionData.usd_value,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating transaction:', error);
        return null;
      }

      return transaction.id;
    } catch (error) {
      console.error('Error in createTransaction:', error);
      return null;
    }
  }

  async updateTransaction(paymentId: string, updates: {
    status?: string;
    transaction_hash?: string;
    completed_at?: string;
    gas_fee?: number;
    network_fee?: number;
  }): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('transactions')
        .update(updates)
        .eq('payment_id', paymentId);

      if (error) {
        console.error('Error updating transaction:', error);
        return false;
      }

      // If transaction is completed, update merchant stats
      if (updates.status === 'completed') {
        await this.updateMerchantStats(paymentId);
      }

      return true;
    } catch (error) {
      console.error('Error in updateTransaction:', error);
      return false;
    }
  }

  private async updateMerchantStats(paymentId: string): Promise<void> {
    try {
      // Get transaction details
      const { data: transaction } = await this.supabase
        .from('transactions')
        .select('merchant_id, usd_value')
        .eq('payment_id', paymentId)
        .single();

      if (!transaction) return;

      // Update merchant total earnings and transaction count manually
      const { data: merchant } = await this.supabase
        .from('merchants')
        .select('total_earnings_usd, total_transactions')
        .eq('id', transaction.merchant_id)
        .single();

      if (merchant) {
        await this.supabase
          .from('merchants')
          .update({
            total_earnings_usd: merchant.total_earnings_usd + transaction.usd_value,
            total_transactions: merchant.total_transactions + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.merchant_id);
      }
    } catch (error) {
      console.error('Error updating merchant stats:', error);
    }
  }

  // Analytics
  async getAnalytics(): Promise<Analytics> {
    try {
      // Get merchant counts
      const { data: merchantCounts } = await this.supabase
        .from('merchants')
        .select('status')
        .eq('status', 'active');

      // Get transaction counts and volume
      const { data: transactionStats } = await this.supabase
        .from('transactions')
        .select('status, usd_value, fan_token_symbol');

      const totalMerchants = merchantCounts?.length || 0;
      const activeMerchants = merchantCounts?.length || 0;
      const totalTransactions = transactionStats?.length || 0;
      const activeTransactions = transactionStats?.filter((t: any) => t.status === 'processing' || t.status === 'pending').length || 0;
      const totalVolumeUsd = transactionStats?.reduce((sum: number, t: any) => sum + (t.usd_value || 0), 0) || 0;

      // Calculate top tokens
      const tokenStats: { [key: string]: { count: number; volume: number } } = {};
      transactionStats?.forEach((t: any) => {
        if (!tokenStats[t.fan_token_symbol]) {
          tokenStats[t.fan_token_symbol] = { count: 0, volume: 0 };
        }
        const tokenStat = tokenStats[t.fan_token_symbol];
        if (tokenStat) {
          tokenStat.count++;
          tokenStat.volume += t.usd_value || 0;
        }
      });

      const topTokens = Object.entries(tokenStats)
        .map(([token, stats]) => ({ token, ...stats }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);

      return {
        total_merchants: totalMerchants,
        active_merchants: activeMerchants,
        total_transactions: totalTransactions,
        active_transactions: activeTransactions,
        total_volume_usd: totalVolumeUsd,
        top_tokens: topTokens
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return {
        total_merchants: 0,
        active_merchants: 0,
        total_transactions: 0,
        active_transactions: 0,
        total_volume_usd: 0,
        top_tokens: []
      };
    }
  }

  async getMerchantTransactions(merchantId: string, limit: number = 50): Promise<Transaction[]> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching merchant transactions:', error);
        return [];
      }

      return transactions || [];
    } catch (error) {
      console.error('Error in getMerchantTransactions:', error);
      return [];
    }
  }
}

// Initialize service
const supabaseService = new SupabaseService();

// API Routes
export function addSupabaseRoutes(app: express.Application): void {
  // Merchant Registration
  app.post('/api/merchants/register', async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { email, business_name, wallet_address, password, supported_tokens } = req.body;

      if (!email || !business_name || !wallet_address || !password) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const result = await supabaseService.createMerchant({
        email,
        business_name,
        wallet_address,
        password,
        supported_tokens
      });

      if ('error' in result) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        message: 'Merchant registered successfully',
        merchant: {
          id: result.merchant.id,
          email: result.merchant.email,
          business_name: result.merchant.business_name,
          wallet_address: result.merchant.wallet_address,
          supported_tokens: result.merchant.supported_tokens
        },
        token: result.token
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Merchant Login
  app.post('/api/merchants/login', async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const result = await supabaseService.authenticateMerchant(email, password);

      if ('error' in result) {
        res.status(401).json({ error: result.error });
        return;
      }

      res.json({
        message: 'Login successful',
        merchant: {
          id: result.merchant.id,
          email: result.merchant.email,
          business_name: result.merchant.business_name,
          wallet_address: result.merchant.wallet_address,
          total_earnings_usd: result.merchant.total_earnings_usd,
          total_transactions: result.merchant.total_transactions,
          supported_tokens: result.merchant.supported_tokens
        },
        token: result.token
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get Merchant Dashboard
  app.get('/api/merchants/dashboard', authenticateToken, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const merchantId = (req as any).merchant.merchantId;

      // Get merchant details
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', merchantId)
        .single();

      if (merchantError) {
        res.status(404).json({ error: 'Merchant not found' });
        return;
      }

      // Get recent transactions
      const transactions = await supabaseService.getMerchantTransactions(merchantId, 20);

      res.json({
        merchant: {
          id: merchant.id,
          email: merchant.email,
          business_name: merchant.business_name,
          wallet_address: merchant.wallet_address,
          total_earnings_usd: merchant.total_earnings_usd,
          total_transactions: merchant.total_transactions,
          supported_tokens: merchant.supported_tokens,
          status: merchant.status
        },
        recent_transactions: transactions
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get Merchant Transactions
  app.get('/api/merchants/transactions', authenticateToken, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const merchantId = (req as any).merchant.merchantId;
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await supabaseService.getMerchantTransactions(merchantId, limit);

      res.json({
        transactions,
        total: transactions.length
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Admin Analytics
  app.get('/api/admin/analytics', authenticateAdmin, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const analytics = await supabaseService.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Admin - Get All Merchants
  app.get('/api/admin/merchants', authenticateAdmin, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { data: merchants, error } = await supabase
        .from('merchants')
        .select('id, email, business_name, wallet_address, total_earnings_usd, total_transactions, status, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({
        merchants: merchants || [],
        total: merchants?.length || 0
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Admin - Get All Transactions
  app.get('/api/admin/transactions', authenticateAdmin, async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          *,
          merchants (
            business_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({
        transactions: transactions || [],
        total: transactions?.length || 0
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });
}

// Initialize and export
export { supabaseService, authenticateToken, authenticateAdmin };

