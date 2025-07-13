export interface DriftConfig {
  apiUrl: string;
  merchantWallet: string;
  environment?: 'development' | 'production';
  walletConnectProjectId?: string; // WalletConnect project ID
  onSuccess?: (result: PaymentResult) => void;
  onError?: (error: Error) => void;
  onPending?: (paymentId: string) => void;
}

export interface ClubToken {
  symbol: string;
  name: string;
  price: number;
  color: string;
  bgColor: string;
  contractAddress: string;
}

export interface PaymentChain {
  id: string;
  name: string;
  icon: string;
  rpcUrl: string;
  supported: boolean;
}

export interface PaymentToken {
  symbol: string;
  name: string;
  rate: number;
  contractAddress?: string;
  decimals: number;
}

export interface PaymentResult {
  paymentId: string;
  transactionHash?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  clubToken: string;
  amount: number;
  paymentToken: string;
  merchantAddress: string;
}

export interface QuoteResponse {
  fanTokenSymbol: string;
  fanTokenAmount: number;
  paymentToken: string;
  paymentTokenNeeded: string;
  chzNeeded: string;
  bridgeBalance: string;
  slippage: string;
  route: string;
}

export interface PaymentIntent {
  paymentId: string;
  quote: QuoteResponse;
  status: string;
  serverWalletAddress: string;
  fanTokenAddress: string;
  nextStep: string;
}

export interface Wallet {
  id: 'metamask' | 'socios';
  name: string;
  icon: string;
  description: string;
  installed?: boolean;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  walletType: 'metamask' | 'socios';
  provider: any;
}
