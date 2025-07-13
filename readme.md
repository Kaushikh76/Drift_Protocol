# Drift Payments

A React component library for seamless cross-chain fan token payments with integrated wallet connectivity.

## Installation

```bash
npm install drift-payments
```

## Quick Start

```tsx
import React from 'react';
import { DriftProvider, DriftPaymentWidget } from 'drift-payments';

const config = {
  apiUrl: 'https://your-drift-backend.com',
  merchantWallet: '0x742d35Cc6474C8c8d0C1234567890abcdef',
  walletConnectProjectId: 'your-walletconnect-project-id', // Get from WalletConnect Cloud
  environment: 'production',
  onSuccess: (result) => console.log('Payment successful:', result),
  onError: (error) => console.error('Payment failed:', error),
  onPending: (paymentId) => console.log('Payment pending:', paymentId),
};

function App() {
  return (
    <DriftProvider config={config}>
      <DriftPaymentWidget 
        onPaymentSuccess={(result) => {
          console.log('Payment completed:', result);
          // Redirect to success page, show confirmation, etc.
        }}
        onWalletConnect={(connection) => {
          console.log('Wallet connected:', connection.address);
        }}
        onWalletDisconnect={() => {
          console.log('Wallet disconnected');
        }}
      />
    </DriftProvider>
  );
}

export default App;
```

## 🔗 Wallet Integration

### Supported Wallets

- **🦊 MetaMask** - Browser extension wallet
- **⚽ Socios** - Official Socios mobile wallet via WalletConnect

### Wallet Connect Flow

1. User clicks "CONNECT & PAY" button
2. Wallet selection modal appears
3. User chooses MetaMask or Socios wallet
4. Connection is established
5. Payment can be executed

### WalletConnect Setup

1. Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Add it to your Drift config:

```tsx
const config = {
  // ... other config
  walletConnectProjectId: 'your-project-id-here'
};
```

## Environment Variables

Create a `.env` file in your backend:

```env
ALCHEMY_API_KEY=your_alchemy_api_key
PRIVATE_KEY=your_sepolia_private_key
CHILIZ_PRIVATE_KEY=your_chiliz_private_key_with_fan_tokens
JWT_SECRET=your_jwt_secret_minimum_32_characters
ADMIN_KEY=your_admin_access_key
PORT=3001
```

For frontend (if using Next.js):

```env
NEXT_PUBLIC_DRIFT_API_URL=https://your-drift-backend.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

## Configuration

### DriftConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `apiUrl` | string | Yes | Your Drift backend API URL |
| `merchantWallet` | string | Yes | Your merchant wallet address |
| `walletConnectProjectId` | string | No | WalletConnect project ID for Socios wallet |
| `environment` | 'development' \| 'production' | No | Environment mode |
| `onSuccess` | (result: PaymentResult) => void | No | Success callback |
| `onError` | (error: Error) => void | No | Error callback |
| `onPending` | (paymentId: string) => void | No | Pending callback |

### PaymentWidget Props

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `className` | string | No | Additional CSS classes |
| `onPaymentSuccess` | (result: any) => void | No | Payment success callback |
| `onPaymentError` | (error: Error) => void | No | Payment error callback |
| `onWalletConnect` | (connection: WalletConnection) => void | No | Wallet connection callback |
| `onWalletDisconnect` | () => void | No | Wallet disconnection callback |

## Supported Features

-  **11 Fan Tokens**: PSG, BAR, SPURS, ACM, OG, CITY, AFC, MENGO, JUV, NAP, ATM
-  **Multiple Payment Tokens**: USDC, USDT, ETH, DAI, ARB, CHZ
-  **Wallet Integration**: MetaMask and Socios wallet support
-  **Real-time Quotes**: Live pricing and conversion rates
-  **Cross-chain Support**: Ethereum Sepolia (more chains coming)
-  **Transaction Tracking**: Real blockchain transaction hashes
-  **TypeScript Support**: Full type safety
-  **Responsive Design**: Mobile-friendly interface

## Advanced Usage

### Custom Wallet Handling

```tsx
import { WalletService } from 'drift-payments';

const walletService = new WalletService('your-project-id');

// Get available wallets
const wallets = walletService.getAvailableWallets();

// Connect to specific wallet
const connection = await walletService.connectMetaMask();
// or
const connection = await walletService.connectSocios();

// Disconnect
await walletService.disconnect();
```

### Wallet Connection States

```tsx
const MyComponent = () => {
  const [walletConnection, setWalletConnection] = useState(null);

  return (
    <DriftPaymentWidget
      onWalletConnect={(connection) => {
        setWalletConnection(connection);
        // Store connection state, update UI, etc.
      }}
      onWalletDisconnect={() => {
        setWalletConnection(null);
        // Clear connection state
      }}
    />
  );
};
```

### Handle Wallet Events

```tsx
const config = {
  apiUrl: 'https://your-api.com',
  merchantWallet: '0x...',
  onSuccess: (result) => {
    // Payment completed successfully
    console.log('Transaction hash:', result.transactionHash);
    
    // Redirect or show success message
    window.location.href = '/success';
  },
  onError: (error) => {
    // Handle payment errors
    if (error.message.includes('User rejected')) {
      console.log('User cancelled the transaction');
    } else {
      console.error('Payment failed:', error.message);
    }
  },
  onPending: (paymentId) => {
    // Track pending payment
    localStorage.setItem('pendingPayment', paymentId);
    
    // Show loading state or redirect to pending page
    console.log('Payment initiated:', paymentId);
  }
};
```

### Custom Styling

The widget uses Tailwind CSS classes. You can override styles:

```tsx
<DriftPaymentWidget 
  className="my-custom-widget shadow-2xl"
/>
```

### Mobile App Integration

For mobile apps using Socios wallet:

```tsx
// The widget automatically handles deep linking to Socios app
// Users will be redirected to:
// - Socios app (if installed)
// - App store download (if not installed)

const mobileConfig = {
  // ... other config
  walletConnectProjectId: 'your-project-id',
  onWalletConnect: (connection) => {
    // Handle successful connection in mobile context
    if (connection.walletType === 'socios') {
      console.log('Connected via Socios mobile app');
    }
  }
};
```

## API Methods

Access the API and wallet services directly:

```tsx
import { DriftAPI, WalletService } from 'drift-payments';

const api = new DriftAPI(config);
const walletService = new WalletService('project-id');

// Get quote
const quote = await api.getQuote('PSG', 1, 'USDC');

// Create payment
const payment = await api.createPayment(
  merchantWallet, 
  'PSG', 
  1, 
  'USDC', 
  userAddress
);

// Check wallet installation
const wallets = walletService.getAvailableWallets();
const hasMetaMask = wallets.find(w => w.id === 'metamask')?.installed;

// Get transaction hash
const txInfo = await api.getTransactionHash(paymentId);
console.log('Explorer URL:', txInfo.explorerUrl);
```

## Error Handling

Common errors and how to handle them:

```tsx
const handleWalletError = (error) => {
  if (error.message.includes('MetaMask is not installed')) {
    // Show install MetaMask message
    window.open('https://metamask.io/download/', '_blank');
  } else if (error.message.includes('User rejected')) {
    // User cancelled connection
    console.log('Connection cancelled by user');
  } else if (error.message.includes('timeout')) {
    // Connection timeout
    console.log('Connection timed out, please try again');
  } else {
    // Generic error
    console.error('Wallet connection failed:', error.message);
  }
};
```

## Testing

```tsx
// For development/testing, you can simulate wallet connections
const testConfig = {
  apiUrl: 'http://localhost:3001',
  merchantWallet: '0x742d35Cc6474C8c8d0C1234567890abcdef',
  environment: 'development',
  // In development, wallet connection will use test addresses
};
```

## Backend Setup

1. Clone the Drift backend
2. Install dependencies: `npm install`
3. Configure environment variables
4. Set up Supabase database
5. Run: `npm run dev`

## Wallet Setup Instructions

### For MetaMask Users:
1. Install MetaMask browser extension
2. Create or import wallet
3. Switch to Ethereum Sepolia network
4. Click "CONNECT & PAY" and select MetaMask

### For Socios Users:
1. Download Socios app from App Store/Play Store
2. Create Socios account
3. Set up wallet in app
4. Click "CONNECT & PAY" and select Socios
5. Approve connection in Socios app

## License

MIT

