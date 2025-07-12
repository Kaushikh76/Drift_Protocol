// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
        
    function getAmountsIn(uint amountOut, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IHyperlaneWarpRoute {
    function transferRemote(
        uint32 destination,
        bytes32 recipient,
        uint256 amount
    ) external payable returns (bytes32 messageId);
}

contract PaymentGateway is ReentrancyGuard, Ownable {
    
    constructor() Ownable(msg.sender) {
        // Initialize with deployer as owner
    }
    // Fixed addresses for Sepolia testnet
    IUniswapV2Router02 constant UNISWAP_ROUTER = IUniswapV2Router02(0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008);
    IHyperlaneWarpRoute constant HYPERLANE_BRIDGE = IHyperlaneWarpRoute(0xeb2a0b7aaaDd23851c08B963C3F4fbe00B897c04);
    
    // Token addresses for Sepolia
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant USDT = 0x7169D38820dfd117C3FA1f22a697dBA58d90BA06;
    address constant MCHZ = 0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14; // Sepolia WETH for routing
    
    uint32 constant CHILIZ_DOMAIN = 88882;
    address public paymentProcessor; // Set this during deployment
    
    struct Payment {
        string paymentId;
        address user;
        address merchant;
        address paymentToken;
        uint256 paymentAmount;
        address fanToken;
        uint256 fanTokenAmount;
        uint256 mchzAmount;
        bytes32 hyperlaneMessageId;
        bool completed;
    }
    
    mapping(string => Payment) public payments;
    mapping(bytes32 => string) public messageToPaymentId;
    
    event PaymentInitiated(
        string indexed paymentId,
        address indexed user,
        address indexed merchant,
        address paymentToken,
        uint256 paymentAmount,
        address fanToken,
        uint256 fanTokenAmount
    );
    
    event SwapCompleted(
        string indexed paymentId,
        uint256 mchzAmount
    );
    
    event BridgeInitiated(
        string indexed paymentId,
        bytes32 indexed messageId,
        uint256 mchzAmount
    );
    
    // Add setter for payment processor
    function setPaymentProcessor(address _paymentProcessor) external onlyOwner {
        require(_paymentProcessor != address(0), "Invalid payment processor");
        paymentProcessor = _paymentProcessor;
    }
    
    function executePayment(
        string calldata paymentId,
        address paymentToken,
        uint256 paymentAmount,
        address merchant,
        address fanToken,
        uint256 fanTokenAmount,
        uint256 minMchzOut
    ) external nonReentrant {
        require(bytes(paymentId).length > 0, "Invalid payment ID");
        require(payments[paymentId].user == address(0), "Payment ID already exists");
        require(paymentToken == USDC || paymentToken == USDT, "Unsupported payment token");
        require(paymentAmount > 0, "Invalid payment amount");
        require(merchant != address(0), "Invalid merchant address");
        require(fanToken != address(0), "Invalid fan token address");
        require(fanTokenAmount > 0, "Invalid fan token amount");
        require(paymentProcessor != address(0), "Payment processor not set");
        
        // Store payment details
        payments[paymentId] = Payment({
            paymentId: paymentId,
            user: msg.sender,
            merchant: merchant,
            paymentToken: paymentToken,
            paymentAmount: paymentAmount,
            fanToken: fanToken,
            fanTokenAmount: fanTokenAmount,
            mchzAmount: 0,
            hyperlaneMessageId: bytes32(0),
            completed: false
        });
        
        emit PaymentInitiated(
            paymentId,
            msg.sender,
            merchant,
            paymentToken,
            paymentAmount,
            fanToken,
            fanTokenAmount
        );
        
        // Step 1: Transfer payment token from user
        require(
            IERC20(paymentToken).transferFrom(msg.sender, address(this), paymentAmount),
            "Payment token transfer failed"
        );
        
        // Step 2: Swap payment token to MCHZ via Uniswap
        uint256 mchzAmount = _swapToMCHZ(paymentToken, paymentAmount, minMchzOut);
        payments[paymentId].mchzAmount = mchzAmount;
        
        emit SwapCompleted(paymentId, mchzAmount);
        
        // Step 3: Bridge MCHZ to Chiliz via Hyperlane
        bytes32 messageId = _bridgeToChiliz(paymentId, mchzAmount, merchant, fanToken, fanTokenAmount);
        payments[paymentId].hyperlaneMessageId = messageId;
        messageToPaymentId[messageId] = paymentId;
        
        emit BridgeInitiated(paymentId, messageId, mchzAmount);
    }
    
    function _swapToMCHZ(
        address paymentToken,
        uint256 paymentAmount,
        uint256 minMchzOut
    ) internal returns (uint256) {
        // Approve Uniswap router
        require(
            IERC20(paymentToken).approve(address(UNISWAP_ROUTER), paymentAmount),
            "Approval failed"
        );
        
        // Try direct path first
        address[] memory path = new address[](2);
        path[0] = paymentToken;
        path[1] = MCHZ;
        
        uint[] memory amounts;
        
        try UNISWAP_ROUTER.getAmountsOut(paymentAmount, path) returns (uint[] memory directAmounts) {
            // Direct path exists, use it
            amounts = UNISWAP_ROUTER.swapExactTokensForTokens(
                paymentAmount,
                minMchzOut,
                path,
                address(this),
                block.timestamp + 300
            );
        } catch {
            // Direct path failed, try routing through WETH
            address[] memory wethPath = new address[](3);
            wethPath[0] = paymentToken;
            wethPath[1] = WETH;
            wethPath[2] = MCHZ;
            
            amounts = UNISWAP_ROUTER.swapExactTokensForTokens(
                paymentAmount,
                minMchzOut,
                wethPath,
                address(this),
                block.timestamp + 300
            );
        }
        
        return amounts[amounts.length - 1];
    }
    
    function _bridgeToChiliz(
        string memory paymentId,
        uint256 mchzAmount,
        address merchant,
        address fanToken,
        uint256 fanTokenAmount
    ) internal returns (bytes32) {
        // Approve Hyperlane bridge
        require(
            IERC20(MCHZ).approve(address(HYPERLANE_BRIDGE), mchzAmount),
            "Bridge approval failed"
        );
        
        // Bridge to Chiliz - the payment data will be handled off-chain
        // The Hyperlane bridge will convert MCHZ to native CHZ on Chiliz
        bytes32 messageId = HYPERLANE_BRIDGE.transferRemote(
            CHILIZ_DOMAIN,
            bytes32(uint256(uint160(paymentProcessor))),
            mchzAmount
        );
        
        return messageId;
    }
    
    // Enhanced quote function with routing support
    function getQuote(
        address paymentToken,
        uint256 mchzAmountOut
    ) external view returns (uint256 paymentTokenNeeded, bool useWethRoute) {
        // Try direct path first
        address[] memory directPath = new address[](2);
        directPath[0] = paymentToken;
        directPath[1] = MCHZ;
        
        try UNISWAP_ROUTER.getAmountsIn(mchzAmountOut, directPath) returns (uint[] memory directAmounts) {
            return (directAmounts[0], false);
        } catch {
            // Direct path failed, try WETH route
            address[] memory wethPath = new address[](3);
            wethPath[0] = paymentToken;
            wethPath[1] = WETH;
            wethPath[2] = MCHZ;
            
            uint[] memory wethAmounts = UNISWAP_ROUTER.getAmountsIn(mchzAmountOut, wethPath);
            return (wethAmounts[0], true);
        }
    }
    
    function getPayment(string calldata paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }
    
    function getPaymentByMessageId(bytes32 messageId) external view returns (Payment memory) {
        string memory paymentId = messageToPaymentId[messageId];
        return payments[paymentId];
    }
    
    // Check if a pool exists for given tokens
    function poolExists(address tokenA, address tokenB) external view returns (bool) {
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        
        try UNISWAP_ROUTER.getAmountsOut(1e6, path) returns (uint[] memory) {
            return true;
        } catch {
            return false;
        }
    }
    
    // Emergency functions
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "Withdrawal failed");
    }
    
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}