import WalletConnect from '@walletconnect/client';
import { WalletConnection, Wallet } from '../types';

export class WalletService {
  private walletConnect?: WalletConnect;
  private projectId: string;

  constructor(projectId?: string) {
    this.projectId = projectId || 'default-project-id';
  }

  // Available wallets
  getAvailableWallets(): Wallet[] {
    const wallets: Wallet[] = [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: '🦊',
        description: 'Connect using MetaMask wallet',
        installed: this.isMetaMaskInstalled()
      },
      {
        id: 'socios',
        name: 'Socios',
        icon: '⚽',
        description: 'Connect using Socios wallet',
        installed: true // Always available via WalletConnect
      }
    ];

    return wallets;
  }

  // Check if MetaMask is installed
  private isMetaMaskInstalled(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined' && (window as any).ethereum.isMetaMask;
  }

  // Connect to MetaMask
  async connectMetaMask(): Promise<WalletConnection> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    try {
      const ethereum = (window as any).ethereum;

      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      // Get chain ID
      const chainId = await ethereum.request({
        method: 'eth_chainId',
      });

      return {
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        walletType: 'metamask',
        provider: ethereum
      };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request.');
      }
      throw new Error(`Failed to connect to MetaMask: ${error.message}`);
    }
  }

  // Connect to Socios wallet via WalletConnect
  async connectSocios(): Promise<WalletConnection> {
    try {
      // Create WalletConnect instance
      this.walletConnect = new WalletConnect({
        bridge: 'https://bridge.walletconnect.org',
        qrcodeModal: {
          open: (uri: string, cb: () => void) => {
            // For Socios wallet, we'll open the specific Socios app
            this.openSociosApp(uri);
            cb();
          },
          close: () => {
            // Close QR modal
          }
        },
      });

      // Check if already connected
      if (this.walletConnect.connected) {
        return {
          address: this.walletConnect.accounts[0],
          chainId: this.walletConnect.chainId,
          walletType: 'socios',
          provider: this.walletConnect
        };
      }

      // Create connection
      await this.walletConnect.createSession();

      return new Promise((resolve, reject) => {
        // Subscribe to connection events
        this.walletConnect!.on('connect', (error, payload) => {
          if (error) {
            reject(new Error(`Failed to connect to Socios wallet: ${error.message}`));
            return;
          }

          const { accounts, chainId } = payload.params[0];
          resolve({
            address: accounts[0],
            chainId,
            walletType: 'socios',
            provider: this.walletConnect
          });
        });

        this.walletConnect!.on('session_request', (error, payload) => {
          if (error) {
            reject(error);
            return;
          }

          // Auto approve session for Socios
          this.walletConnect!.approveSession({
            accounts: payload.params[0].accounts,
            chainId: payload.params[0].chainId
          });
        });

        this.walletConnect!.on('disconnect', (error) => {
          if (error) {
            reject(new Error('Connection was rejected or failed'));
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Connection timeout. Please try again.'));
        }, 30000);
      });
    } catch (error: any) {
      throw new Error(`Failed to connect to Socios wallet: ${error.message}`);
    }
  }

  // Open Socios app or redirect to download
  private openSociosApp(uri: string): void {
    const sociosAppUrl = `socios://wc?uri=${encodeURIComponent(uri)}`;
    const sociosWebUrl = `https://www.socios.com/download`;
    
    // Try to open Socios app
    window.location.href = sociosAppUrl;
    
    // Fallback to web download after 1 second
    setTimeout(() => {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('android')) {
        window.open('https://play.google.com/store/apps/details?id=com.socios.mobile', '_blank');
      } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        window.open('https://apps.apple.com/app/socios-com/id1476678006', '_blank');
      } else {
        window.open(sociosWebUrl, '_blank');
      }
    }, 1000);
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    if (this.walletConnect && this.walletConnect.connected) {
      await this.walletConnect.killSession();
    }
    this.walletConnect = undefined;
  }

  // Switch network for MetaMask
  async switchNetwork(chainId: number): Promise<void> {
    if (!this.isMetaMaskInstalled()) {
      throw new Error('MetaMask is not installed');
    }

    const ethereum = (window as any).ethereum;
    const hexChainId = `0x${chainId.toString(16)}`;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (error: any) {
      // If the chain hasn't been added to MetaMask, add it
      if (error.code === 4902) {
        const networkConfig = this.getNetworkConfig(chainId);
        if (networkConfig) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        }
      } else {
        throw error;
      }
    }
  }

  // Get network configuration for adding to MetaMask
  private getNetworkConfig(chainId: number): any {
    const networks: { [key: number]: any } = {
      11155111: { // Sepolia
        chainId: '0xaa36a7',
        chainName: 'Sepolia Test Network',
        nativeCurrency: {
          name: 'Sepolia Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        blockExplorerUrls: ['https://sepolia.etherscan.io/']
      },
      88888: { // Chiliz Chain
        chainId: '0x15b38',
        chainName: 'Chiliz Chain',
        nativeCurrency: {
          name: 'Chiliz',
          symbol: 'CHZ',
          decimals: 18
        },
        rpcUrls: ['https://rpc.chiliz.com'],
        blockExplorerUrls: ['https://scan.chiliz.com/']
      }
    };

    return networks[chainId];
  }
}
