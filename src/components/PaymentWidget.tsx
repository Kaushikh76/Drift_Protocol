import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowRight, Loader2, Wallet as WalletIcon } from "lucide-react";
import { useDrift } from "../context/DriftContext";
import { DriftAPI } from "../services/api";
import { WalletService } from "../services/wallet";
import WalletModal from "./WalletModal";
import { DEFAULT_CLUB_TOKENS, DEFAULT_CHAINS, DEFAULT_TOKENS } from "../data/defaults";
import { ClubToken, PaymentChain, PaymentToken, QuoteResponse, WalletConnection } from "../types";

interface PaymentWidgetProps {
  className?: string;
  onPaymentSuccess?: (result: any) => void;
  onPaymentError?: (error: Error) => void;
  onWalletConnect?: (connection: WalletConnection) => void;
  onWalletDisconnect?: () => void;
}

const PaymentWidget: React.FC<PaymentWidgetProps> = ({
  className = "",
  onPaymentSuccess,
  onPaymentError,
  onWalletConnect,
  onWalletDisconnect
}) => {
  const { config } = useDrift();
  const [selectedClub, setSelectedClub] = useState<keyof typeof DEFAULT_CLUB_TOKENS>("PSG");
  const [selectedChain, setSelectedChain] = useState(DEFAULT_CHAINS[0]);
  const [selectedToken, setSelectedToken] = useState(DEFAULT_TOKENS[0]);
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false);
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Wallet states
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletConnection, setWalletConnection] = useState<WalletConnection | null>(null);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<string>("");

  const clubData = DEFAULT_CLUB_TOKENS[selectedClub];
  const api = new DriftAPI(config);
  const walletService = new WalletService(config.walletConnectProjectId);

  // Get quote when selections change
  useEffect(() => {
    const getQuote = async () => {
      try {
        setError(null);
        const quoteData = await api.getQuote(
          selectedClub,
          1, // Default to 1 token for display
          selectedToken.symbol
        );
        setQuote(quoteData);
      } catch (err) {
        console.error('Failed to get quote:', err);
        setError('Failed to get quote');
      }
    };

    getQuote();
  }, [selectedClub, selectedToken.symbol]);

  // Handle wallet connection
  const handleWalletConnect = async (walletId: 'metamask' | 'socios') => {
    setIsConnectingWallet(true);
    setConnectingWallet(walletId);
    setError(null);

    try {
      let connection: WalletConnection;

      if (walletId === 'metamask') {
        connection = await walletService.connectMetaMask();
      } else {
        connection = await walletService.connectSocios();
      }

      setWalletConnection(connection);
      setWalletModalOpen(false);
      onWalletConnect?.(connection);

      console.log(`✅ Connected to ${walletId}:`, connection.address);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      console.error(`Failed to connect to ${walletId}:`, error);
    } finally {
      setIsConnectingWallet(false);
      setConnectingWallet("");
    }
  };

  // Handle wallet disconnect
  const handleWalletDisconnect = async () => {
    try {
      await walletService.disconnect();
      setWalletConnection(null);
      onWalletDisconnect?.();
      console.log('👋 Wallet disconnected');
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  };

  // Handle payment flow
  const handlePayment = async () => {
    // If no wallet connected, show wallet modal
    if (!walletConnection) {
      setWalletModalOpen(true);
      return;
    }

    if (!quote) {
      setError("No quote available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create payment intent
      const paymentIntent = await api.createPayment(
        config.merchantWallet,
        selectedClub,
        1,
        selectedToken.symbol,
        walletConnection.address
      );

      console.log("Payment intent created:", paymentIntent);
      
      // In a real implementation, you would:
      // 1. Use the connected wallet to sign the transaction
      // 2. Execute the payment with the wallet's provider
      // 3. Handle the transaction flow
      
      // For now, we'll call the success callback with the payment intent
      config.onPending?.(paymentIntent.paymentId);
      onPaymentSuccess?.(paymentIntent);
      
      console.log("Payment flow initiated with wallet:", walletConnection.walletType);
      
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      config.onError?.(error);
      onPaymentError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayPrice = quote ? quote.paymentTokenNeeded : (clubData.price / selectedToken.rate).toFixed(2);
  const availableWallets = walletService.getAvailableWallets();

  return (
    <div className={`w-full max-w-2xl mx-auto p-4 ${className}`}>
      <motion.div
        className="relative bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 shadow-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Wallet Connection Status */}
        {walletConnection && (
          <div className="mb-4 flex items-center justify-between p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">
                {walletConnection.walletType === 'metamask' ? '🦊' : '⚽'} 
                {walletConnection.address.slice(0, 6)}...{walletConnection.address.slice(-4)}
              </span>
            </div>
            <button
              onClick={handleWalletDisconnect}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Main horizontal layout */}
        <div className="flex items-center gap-4">
          {/* Club Price Badge */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{
              backgroundColor: clubData.bgColor,
              borderColor: clubData.color + "40",
            }}
          >
            <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
              {selectedClub}
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white font-mono">
                1 {selectedClub}
              </div>
              <div className="text-xs text-slate-400">{clubData.name}</div>
            </div>
          </div>

          {/* Divider */}
          <ArrowRight className="w-4 h-4 text-slate-500" />

          {/* Chain Selector */}
          <div className="relative">
            <motion.button
              onClick={() => setChainDropdownOpen(!chainDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg hover:bg-slate-700/50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-lg">{selectedChain.icon}</span>
              <span className="text-sm text-slate-300">{selectedChain.name}</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </motion.button>

            <AnimatePresence>
              {chainDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 min-w-full"
                >
                  {DEFAULT_CHAINS.filter(chain => chain.supported).map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        setSelectedChain(chain);
                        setChainDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    >
                      <span className="text-lg">{chain.icon}</span>
                      <span className="text-sm text-slate-300">{chain.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Token Selector */}
          <div className="relative">
            <motion.button
              onClick={() => setTokenDropdownOpen(!tokenDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg hover:bg-slate-700/50 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
                {selectedToken.symbol.charAt(0)}
              </div>
              <div className="text-left">
                <div className="text-sm text-slate-300">{selectedToken.symbol}</div>
                <div className="text-xs text-slate-500 font-mono">{displayPrice}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </motion.button>

            <AnimatePresence>
              {tokenDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 left-0 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 min-w-full"
                >
                  {DEFAULT_TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        setSelectedToken(token);
                        setTokenDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    >
                      <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
                        {token.symbol.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-300">{token.symbol}</div>
                        <div className="text-xs text-slate-500">{token.name}</div>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {(clubData.price / token.rate).toFixed(2)}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pay Button */}
          <motion.button
            onClick={handlePayment}
            disabled={isLoading}
            className="px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wide text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: clubData.color }}
            whileHover={{
              scale: isLoading ? 1 : 1.05,
              boxShadow: isLoading ? undefined : `0 0 20px ${clubData.color}40`,
            }}
            whileTap={{ scale: isLoading ? 1 : 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {!walletConnection && !isLoading && <WalletIcon className="w-4 h-4" />}
            {isLoading ? "PROCESSING..." : !walletConnection ? "CONNECT & PAY" : "PAY NOW"}
          </motion.button>
        </div>

        {/* Club Selector Pills */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700/50">
          {Object.entries(DEFAULT_CLUB_TOKENS).map(([club, data]) => (
            <motion.button
              key={club}
              onClick={() => setSelectedClub(club as keyof typeof DEFAULT_CLUB_TOKENS)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedClub === club
                  ? "text-white border-2"
                  : "text-slate-400 border border-slate-600 hover:text-slate-300"
              }`}
              style={
                selectedClub === club
                  ? {
                      backgroundColor: data.bgColor,
                      borderColor: data.color,
                    }
                  : {}
              }
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {club}
            </motion.button>
          ))}
        </div>

        {/* Quote Info */}
        {quote && (
          <div className="mt-3 p-3 bg-slate-800/30 rounded-lg">
            <div className="text-xs text-slate-400 space-y-1">
              <div>Route: {quote.route}</div>
              <div>Slippage: {quote.slippage}</div>
            </div>
          </div>
        )}

        {/* Tagline */}
        <div className="text-right mt-3">
          <p className="text-xs text-slate-500 opacity-60">Payments powered by Drift</p>
        </div>
      </motion.div>

      {/* Wallet Connection Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onWalletSelect={handleWalletConnect}
        wallets={availableWallets}
        isConnecting={isConnectingWallet}
        connectingWallet={connectingWallet}
      />
    </div>
  );
};

export default PaymentWidget;
