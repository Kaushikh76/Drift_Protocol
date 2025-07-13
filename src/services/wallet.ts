import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, sepolia, arbitrum } from '@reown/appkit/networks';
import { WalletConnection, Wallet } from '../types';
import { reconnect, getAccount, watchAccount, disconnect } from 'wagmi/actions';
import type { Config } from 'wagmi';

export class WalletService {
  private projectId: string;
  private wagmiAdapter: WagmiAdapter;
  private appKit: any;
  private config: Config;
  private initialized = false;

  constructor(projectId?: string) {
    this.projectId = projectId || 'default-project-id';
    
    if (!this.projectId || this.projectId === 'default-project-id') {
      console.warn('⚠️ No projectId provided. Get one from https://cloud.reown.com');
    }

    this.initializeAppKit();
  }

  private initializeAppKit(): void {
    if (this.initialized) return;

    // 1. Get projectId from https://cloud.reown.com
    const metadata = {
      name: 'Drift Payments',
      description: 'Cross-chain fan token payment widget',
      url: 'https://drift-payments.com',
      icons: ['https://drift-payments.com/icon.png']
    };

    // 2. Set up the Wagmi adapter
    this.wagmiAdapter = new WagmiAdapter({
      projectId: this.projectId,
      networks: [mainnet, sepolia, arbitrum]
    });

    this.config = this.wagmiAdapter.wagmiConfig;

    // 3. Create the AppKit instance
    this.appKit = createAppKit({
      adapters: [this.wagmiAdapter],
      projectId: this.projectId,
      networks: [mainnet, sepolia, arbitrum],
      defaultNetwork: sepolia,
      metadata,
      features: {
        analytics: true,
        email: false,
        socials: [],
      },
      themeMode: 'dark',
    });

    this.initialized = true;
  }

  /**
   * Get available wallets
   */
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

  /**
   * Check if MetaMask is installed
   */
  private isMetaMaskInstalled(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).ethereum !== 'undefined' && 
           (window as any).ethereum.isMetaMask;
  }

  /**
   * Open the AppKit modal
   */
  async openModal(): Promise<void> {
    if (!this.appKit) {
      throw new Error('AppKit not initialized');
    }
    
    this.appKit.open();
  }

  /**
   * Connect to MetaMask directly
   */
  async connectMetaMask(): Promise<WalletConnection> {
    if (!this.isMetaMaskInstalled()) {
      // Redirect to MetaMask installation
      window.open('https://metamask.io/download/', '_blank');
      throw new Error('MetaMask is not installed. Redirecting to installation page.');
    }

    try {
      // Open AppKit modal and let user select MetaMask
      this.appKit.open();
      
      // Wait for connection
      return new Promise((resolve, reject) => {
        const unwatch = watchAccount(this.config, {
          onChange: (account) => {
            if (account.isConnected && account.address) {
              unwatch();
              resolve({
                address: account.address,
                chainId: account.chainId || 1,
                walletType: 'metamask',
                provider: (window as any).ethereum
              });
            }
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          unwatch();
          reject(new Error('Connection timeout. Please try again.'));
        }, 30000);
      });
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected the connection request.');
      }
      throw new Error(`Failed to connect to MetaMask: ${error.message}`);
    }
  }

  /**
   * Connect to Socios wallet via WalletConnect
   */
  async connectSocios(): Promise<WalletConnection> {
    try {
      // Open AppKit modal specifically for WalletConnect
      this.appKit.open({ view: 'Connect' });
      
      // Wait for connection
      return new Promise((resolve, reject) => {
        const unwatch = watchAccount(this.config, {
          onChange: (account) => {
            if (account.isConnected && account.address) {
              unwatch();
              
              // Check if it's a WalletConnect connection (Socios uses WalletConnect)
              const connector = account.connector;
              if (connector?.id.includes('walletConnect')) {
                resolve({
                  address: account.address,
                  chainId: account.chainId || 1,
                  walletType: 'socios',
                  provider: connector
                });
              } else {
                // If not WalletConnect, still resolve but indicate it might not be Socios
                resolve({
                  address: account.address,
                  chainId: account.chainId || 1,
                  walletType: 'socios',
                  provider: connector
                });
              }
            }
          }
        });

        // Timeout after 60 seconds (WalletConnect can take longer)
        setTimeout(() => {
          unwatch();
          reject(new Error('Connection timeout. Please try again.'));
        }, 60000);
      });
    } catch (error: any) {
      throw new Error(`Failed to connect to Socios wallet: ${error.message}`);
    }
  }

  /**
   * Get current connection status
   */
  async getCurrentConnection(): Promise<WalletConnection | null> {
    try {
      const account = getAccount(this.config);
      
      if (account.isConnected && account.address) {
        const walletType = this.determineWalletType(account.connector?.id || '');
        
        return {
          address: account.address,
          chainId: account.chainId || 1,
          walletType,
          provider: account.connector
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current connection:', error);
      return null;
    }
  }

  /**
   * Determine wallet type from connector ID
   */
  private determineWalletType(connectorId: string): 'metamask' | 'socios' {
    if (connectorId.includes('metaMask') || connectorId.includes('injected')) {
      return 'metamask';
    }
    return 'socios'; // Default to Socios for WalletConnect connections
  }

  /**
   * Watch for account changes
   */
  watchConnection(callback: (connection: WalletConnection | null) => void): () => void {
    return watchAccount(this.config, {
      onChange: (account) => {
        if (account.isConnected && account.address) {
          const walletType = this.determineWalletType(account.connector?.id || '');
          callback({
            address: account.address,
            chainId: account.chainId || 1,
            walletType,
            provider: account.connector
          });
        } else {
          callback(null);
        }
      }
    });
  }

  /**
   * Disconnect wallet
   */
  async disconnect(): Promise<void> {
    try {
      await disconnect(this.config);
      console.log('👋 Wallet disconnected');
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(chainId: number): Promise<void> {
    try {
      // AppKit handles network switching automatically through the modal
      // For programmatic switching, we can use the switchChain method
      if (this.appKit && this.appKit.switchNetwork) {
        await this.appKit.switchNetwork(chainId);
      } else {
        // Fallback for MetaMask
        if (this.isMetaMaskInstalled()) {
          const ethereum = (window as any).ethereum;
          const hexChainId = `0x${chainId.toString(16)}`;

          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }],
          });
        }
      }
    } catch (error: any) {
      // If the chain hasn't been added to MetaMask, add it
      if (error.code === 4902) {
        const networkConfig = this.getNetworkConfig(chainId);
        if (networkConfig && this.isMetaMaskInstalled()) {
          const ethereum = (window as any).ethereum;
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

  /**
   * Get network configuration for adding to MetaMask
   */
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
      88882: { // Chiliz Chain
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

  /**
   * Reconnect to previously connected wallet
   */
  async reconnect(): Promise<void> {
    try {
      await reconnect(this.config);
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  }

  /**
   * Get the Wagmi config for use in providers
   */
  getWagmiConfig(): Config {
    return this.config;
  }

  /**
   * Get the AppKit instance
   */
  getAppKit(): any {
    return this.appKit;
  }
}