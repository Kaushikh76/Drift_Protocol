import { ClubToken, PaymentChain, PaymentToken } from '../types';

export const DEFAULT_CLUB_TOKENS: Record<string, ClubToken> = {
  PSG: { 
    symbol: "PSG",
    name: "Paris Saint-Germain", 
    price: 54.3, 
    color: "#004170", 
    bgColor: "#001a2e",
    contractAddress: "0xb0Fa395a3386800658B9617F90e834E2CeC76Dd3"
  },
  BAR: { 
    symbol: "BAR",
    name: "FC Barcelona", 
    price: 42.85, 
    color: "#a50044", 
    bgColor: "#2d0012",
    contractAddress: "0x7F73C50748560BD2B286a4c7bF6a805cFb6f735d"
  },
  SPURS: { 
    symbol: "SPURS",
    name: "Tottenham", 
    price: 38.9, 
    color: "#132257", 
    bgColor: "#0a0f2a",
    contractAddress: "0x9B9C9AAa74678FcF4E1c76eEB1fa969A8E7254f8"
  },
  ACM: { 
    symbol: "ACM",
    name: "AC Milan", 
    price: 45.6, 
    color: "#fb090b", 
    bgColor: "#4a0203",
    contractAddress: "0x641d040dB51398Ba3a4f2d7839532264EcdCc3aE"
  },
  OG: { 
    symbol: "OG",
    name: "OG Esports", 
    price: 28.75, 
    color: "#00ff88", 
    bgColor: "#003d1f",
    contractAddress: "0xEc1C46424E20671d9b21b9336353EeBcC8aEc7b5"
  },
  CITY: { 
    symbol: "CITY",
    name: "Manchester City", 
    price: 52.2, 
    color: "#6cabdd", 
    bgColor: "#1a3544",
    contractAddress: "0x66F80ddAf5ccfbb082A0B0Fae3F21eA19f6B88ef"
  },
  AFC: { 
    symbol: "AFC",
    name: "Arsenal", 
    price: 41.15, 
    color: "#ef0107", 
    bgColor: "#3d0102",
    contractAddress: "0x44B190D30198F2E585De8974999a28f5c68C6E0F"
  },
  MENGO: { 
    symbol: "MENGO",
    name: "Flamengo", 
    price: 33.4, 
    color: "#e31e24", 
    bgColor: "#380608",
    contractAddress: "0x1CC71168281dd78fF004ba6098E113bbbCBDc914"
  },
  JUV: { 
    symbol: "JUV",
    name: "Juventus", 
    price: 47.8, 
    color: "#000000", 
    bgColor: "#1a1a1a",
    contractAddress: "0x945EeD98f5CBada87346028aD0BeE0eA66849A0e"
  },
  NAP: { 
    symbol: "NAP",
    name: "Napoli", 
    price: 39.25, 
    color: "#087eb8", 
    bgColor: "#021f2e",
    contractAddress: "0x8DBe49c4Dcde110616fafF53b39270E1c48F861a"
  },
  ATM: { 
    symbol: "ATM",
    name: "Atletico Madrid", 
    price: 36.9, 
    color: "#ce3524", 
    bgColor: "#330d0a",
    contractAddress: "0xc926130FA2240e16A41c737d54c1d9b1d4d45257"
  }
};

export const DEFAULT_CHAINS: PaymentChain[] = [
  { id: "eth-sepolia", name: "Ethereum Sepolia", icon: "⟠", rpcUrl: "", supported: true },
  { id: "arbitrum", name: "Arbitrum One", icon: "◆", rpcUrl: "", supported: false },
  { id: "polygon", name: "Polygon", icon: "◇", rpcUrl: "", supported: false },
  { id: "bsc", name: "BSC", icon: "◉", rpcUrl: "", supported: false },
  { id: "base", name: "Base", icon: "◎", rpcUrl: "", supported: false },
  { id: "optimism", name: "Optimism", icon: "○", rpcUrl: "", supported: false },
];

export const DEFAULT_TOKENS: PaymentToken[] = [
  { symbol: "USDC", name: "USD Coin", rate: 1.0, decimals: 6 },
  { symbol: "USDT", name: "Tether", rate: 1.0, decimals: 6 },
  { symbol: "ETH", name: "Ethereum", rate: 0.024, decimals: 18 },
  { symbol: "DAI", name: "Dai", rate: 1.0, decimals: 18 },
  { symbol: "ARB", name: "Arbitrum", rate: 0.89, decimals: 18 },
  { symbol: "CHZ", name: "Chiliz", rate: 12.45, decimals: 18 },
];