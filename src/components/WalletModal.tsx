import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Download } from 'lucide-react';
import { Wallet } from '../types';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletSelect: (walletId: 'metamask' | 'socios') => void;
  wallets: Wallet[];
  isConnecting: boolean;
  connectingWallet?: string;
}

const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  onWalletSelect,
  wallets,
  isConnecting,
  connectingWallet
}) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                disabled={isConnecting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wallet Options */}
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <WalletOption
                  key={wallet.id}
                  wallet={wallet}
                  onClick={() => onWalletSelect(wallet.id)}
                  isConnecting={isConnecting && connectingWallet === wallet.id}
                  disabled={isConnecting}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-400 text-center">
                By connecting a wallet, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface WalletOptionProps {
  wallet: Wallet;
  onClick: () => void;
  isConnecting: boolean;
  disabled: boolean;
}

const WalletOption: React.FC<WalletOptionProps> = ({
  wallet,
  onClick,
  isConnecting,
  disabled
}) => {
  const handleClick = () => {
    if (disabled) return;

    if (wallet.id === 'metamask' && !wallet.installed) {
      // Open MetaMask download page
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={disabled}
      className={`
        w-full p-4 rounded-xl border transition-all flex items-center gap-4
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-slate-800/50 hover:border-slate-600'
        }
        ${wallet.installed 
          ? 'border-slate-600 bg-slate-800/30' 
          : 'border-slate-700 bg-slate-800/10'
        }
      `}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {/* Wallet Icon */}
      <div className="text-3xl">{wallet.icon}</div>

      {/* Wallet Info */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{wallet.name}</span>
          {!wallet.installed && wallet.id === 'metamask' && (
            <Download className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <p className="text-sm text-slate-400">{wallet.description}</p>
        {!wallet.installed && wallet.id === 'metamask' && (
          <p className="text-xs text-orange-400 mt-1">Click to install</p>
        )}
      </div>

      {/* Loading/Status */}
      <div className="flex items-center">
        {isConnecting ? (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : wallet.installed ? (
          <ExternalLink className="w-5 h-5 text-slate-400" />
        ) : (
          <Download className="w-5 h-5 text-slate-400" />
        )}
      </div>
    </motion.button>
  );
};

export default WalletModal;
