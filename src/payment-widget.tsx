"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ArrowRight } from "lucide-react"

// Mock data - in real implementation, this would come from backend
const clubTokens = {
  PSG: { name: "Paris Saint-Germain", price: 54.3, color: "#004170", bgColor: "#001a2e" },
  BAR: { name: "FC Barcelona", price: 42.85, color: "#a50044", bgColor: "#2d0012" },
  SPURS: { name: "Tottenham", price: 38.9, color: "#132257", bgColor: "#0a0f2a" },
  ACM: { name: "AC Milan", price: 45.6, color: "#fb090b", bgColor: "#4a0203" },
  OG: { name: "OG Esports", price: 28.75, color: "#00ff88", bgColor: "#003d1f" },
  CITY: { name: "Manchester City", price: 52.2, color: "#6cabdd", bgColor: "#1a3544" },
  AFC: { name: "Arsenal", price: 41.15, color: "#ef0107", bgColor: "#3d0102" },
  MENGO: { name: "Flamengo", price: 33.4, color: "#e31e24", bgColor: "#380608" },
  JUV: { name: "Juventus", price: 47.8, color: "#000000", bgColor: "#1a1a1a" },
  NAP: { name: "Napoli", price: 39.25, color: "#087eb8", bgColor: "#021f2e" },
  ATM: { name: "Atletico Madrid", price: 36.9, color: "#ce3524", bgColor: "#330d0a" },
}

const chains = [
  { id: "eth-sepolia", name: "Ethereum Sepolia", icon: "⟠" },
  { id: "arbitrum", name: "Arbitrum One", icon: "◆" },
  { id: "polygon", name: "Polygon", icon: "◇" },
  { id: "bsc", name: "BSC", icon: "◉" },
  { id: "base", name: "Base", icon: "◎" },
  { id: "optimism", name: "Optimism", icon: "○" },
]

const tokens = [
  { symbol: "USDC", name: "USD Coin", rate: 1.0 },
  { symbol: "USDT", name: "Tether", rate: 1.0 },
  { symbol: "ETH", name: "Ethereum", rate: 0.024 },
  { symbol: "DAI", name: "Dai", rate: 1.0 },
  { symbol: "ARB", name: "Arbitrum", rate: 0.89 },
  { symbol: "CHZ", name: "Chiliz", rate: 12.45 },
]

export default function PaymentWidget() {
  const [selectedClub, setSelectedClub] = useState<keyof typeof clubTokens>("PSG")
  const [selectedChain, setSelectedChain] = useState(chains[0])
  const [selectedToken, setSelectedToken] = useState(tokens[0])
  const [chainDropdownOpen, setChainDropdownOpen] = useState(false)
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false)

  const clubData = clubTokens[selectedClub]
  const convertedPrice = (clubData.price / selectedToken.rate).toFixed(2)

  const handlePayment = () => {
    console.log("Initiating payment:", {
      clubToken: selectedClub,
      chain: selectedChain.id,
      payToken: selectedToken.symbol,
      amount: convertedPrice,
    })
    // In real implementation, this would call the payment API
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <motion.div
        className="relative bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 shadow-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
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
                {clubData.price} {selectedClub}
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
                  {chains.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => {
                        setSelectedChain(chain)
                        setChainDropdownOpen(false)
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
                <div className="text-xs text-slate-500 font-mono">{convertedPrice}</div>
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
                  {tokens.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => {
                        setSelectedToken(token)
                        setTokenDropdownOpen(false)
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
                      <div className="text-xs text-slate-400 font-mono">{(clubData.price / token.rate).toFixed(2)}</div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pay Button */}
          <motion.button
            onClick={handlePayment}
            className="px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wide text-white shadow-lg"
            style={{ backgroundColor: clubData.color }}
            whileHover={{
              scale: 1.05,
              boxShadow: `0 0 20px ${clubData.color}40`,
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            PAY NOW
          </motion.button>
        </div>

        {/* Club Selector Pills */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-700/50">
          {Object.entries(clubTokens).map(([club, data]) => (
            <motion.button
              key={club}
              onClick={() => setSelectedClub(club as keyof typeof clubTokens)}
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

        {/* Tagline */}
        <div className="text-right mt-3">
          <p className="text-xs text-slate-500 opacity-60">Payments powered by Drift</p>
        </div>
      </motion.div>
    </div>
  )
}
