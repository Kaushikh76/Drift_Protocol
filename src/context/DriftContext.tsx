import React, { createContext, useContext, ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DriftConfig } from '../types';
import { WalletService } from '../services/wallet';

interface DriftContextType {
  config: DriftConfig;
  walletService: WalletService;
}

const DriftContext = createContext<DriftContextType | undefined>(undefined);

interface DriftProviderProps {
  config: DriftConfig;
  children: ReactNode;
}

// Create a single QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: false,
    },
  },
});

export const DriftProvider: React.FC<DriftProviderProps> = ({ config, children }) => {
  // Initialize wallet service with project ID
  const walletService = React.useMemo(() => {
    return new WalletService(config.walletConnectProjectId);
  }, [config.walletConnectProjectId]);

  // Get Wagmi config from wallet service
  const wagmiConfig = walletService.getWagmiConfig();

  const contextValue = React.useMemo(() => ({
    config,
    walletService,
  }), [config, walletService]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DriftContext.Provider value={contextValue}>
          {children}
        </DriftContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export const useDrift = (): DriftContextType => {
  const context = useContext(DriftContext);
  if (!context) {
    throw new Error('useDrift must be used within a DriftProvider');
  }
  return context;
};