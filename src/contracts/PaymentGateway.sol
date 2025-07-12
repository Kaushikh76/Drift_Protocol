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
}

interface IHyperlaneWarpRoute {
    function transferRemote(
        uint32 destination,
        bytes32 recipient,
        uint256 amount
    ) external payable returns (bytes32 messageId);
}

contract PaymentGateway is ReentrancyGuard, Ownable {
    IUniswapV2Router02 constant UNISWAP_ROUTER = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    IHyperlaneWarpRoute constant HYPERLANE_BRIDGE = IHyperlaneWarpRoute(0xeb2a0b7aaaDd23851c08B963C3F4fbe00B897c04);
    
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant USDT = 0x7169D38820dfd117C3FA1f22a697dBA58d90BA06;
    address constant MCHZ = 0xDA1fe1Db9b04a810cbb214a294667833e4c8D8F7;
    
    uint32 constant CHILIZ_DOMAIN = 88882;
    address constant PAYMENT_PROCESSOR = 0x1234567890123456789012345678901234567890; // Deploy PaymentProcessor first
    
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
        
        // Setup swap path
        address[] memory path = new address[](2);
        path[0] = paymentToken;
        path[1] = MCHZ;
        
        // Execute swap
        uint[] memory amounts = UNISWAP_ROUTER.swapExactTokensForTokens(
            paymentAmount,
            minMchzOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        return amounts[1];
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
        
        // Encode payment data for Chiliz processor
        bytes memory paymentData = abi.encode(
            paymentId,
            merchant,
            fanToken,
            fanTokenAmount
        );
        
        // Bridge to Chiliz with encoded payment data
        bytes32 messageId = HYPERLANE_BRIDGE.transferRemote(
            CHILIZ_DOMAIN,
            bytes32(uint256(uint160(PAYMENT_PROCESSOR))),
            mchzAmount
        );
        
        return messageId;
    }
    
    function getQuote(
        address paymentToken,
        uint256 mchzAmount
    ) external view returns (uint256 paymentTokenNeeded) {
        address[] memory path = new address[](2);
        path[0] = paymentToken;
        path[1] = MCHZ;
        
        uint[] memory amounts = UNISWAP_ROUTER.getAmountsOut(mchzAmount, path);
        return amounts[0];
    }
    
    function getPayment(string calldata paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }
    
    function getPaymentByMessageId(bytes32 messageId) external view returns (Payment memory) {
        string memory paymentId = messageToPaymentId[messageId];
        return payments[paymentId];
    }
    
    // Emergency functions
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "Withdrawal failed");
    }
    
    function withdrawETH() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}