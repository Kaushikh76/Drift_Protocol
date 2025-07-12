// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IChilizDex {
    function getPrice(address token, uint chzAmount) external view returns (uint tokens);
    function _swap(address token) external payable;
}

interface IMailbox {
    function process(bytes calldata metadata, bytes calldata message) external;
}

contract PaymentProcessor is ReentrancyGuard, Ownable {
    IChilizDex constant CHILIZ_DEX = IChilizDex(0xFbef475155294d7Ef054f2b79B908c91A9914d82);
    address constant WCHZ = 0x678c34581db0a7808d0aC669d7025f1408C9a3C6;
    
    // Hyperlane configuration
    address public hyperlaneMailbox;
    uint32 public sepoliaDomain = 11155111;
    address public paymentGateway; // Sepolia Payment Gateway address
    
    struct ProcessedPayment {
        string paymentId;
        address merchant;
        address fanToken;
        uint256 fanTokenAmount;
        uint256 chzReceived;
        uint256 fanTokensSent;
        bool completed;
        uint256 timestamp;
    }
    
    mapping(string => ProcessedPayment) public processedPayments;
    mapping(bytes32 => bool) public processedMessages;
    
    event PaymentReceived(
        string indexed paymentId,
        uint256 chzAmount
    );
    
    event FanTokenSwapCompleted(
        string indexed paymentId,
        address indexed fanToken,
        uint256 fanTokenAmount
    );
    
    event PaymentSentToMerchant(
        string indexed paymentId,
        address indexed merchant,
        address fanToken,
        uint256 amount
    );
    
    event PaymentCompleted(
        string indexed paymentId,
        address indexed merchant,
        address fanToken,
        uint256 totalFanTokens
    );
    
    modifier onlyHyperlane() {
        require(msg.sender == hyperlaneMailbox, "Only Hyperlane mailbox");
        _;
    }
    
    constructor(address _hyperlaneMailbox, address _paymentGateway) {
        require(_hyperlaneMailbox != address(0), "Invalid mailbox address");
        require(_paymentGateway != address(0), "Invalid gateway address");
        
        hyperlaneMailbox = _hyperlaneMailbox;
        paymentGateway = _paymentGateway;
    }
    
    // Hyperlane message handler
    function handle(
        uint32 origin,
        bytes32 sender,
        bytes calldata message
    ) external onlyHyperlane nonReentrant {
        require(origin == sepoliaDomain, "Invalid origin domain");
        require(address(uint160(uint256(sender))) == paymentGateway, "Invalid sender");
        
        // Decode message
        bytes32 messageHash = keccak256(message);
        require(!processedMessages[messageHash], "Message already processed");
        processedMessages[messageHash] = true;
        
        // Decode payment data
        (
            string memory paymentId,
            address merchant,
            address fanToken,
            uint256 fanTokenAmount
        ) = abi.decode(message, (string, address, address, uint256));
        
        require(bytes(paymentId).length > 0, "Invalid payment ID");
        require(merchant != address(0), "Invalid merchant");
        require(fanToken != address(0), "Invalid fan token");
        require(fanTokenAmount > 0, "Invalid fan token amount");
        
        // Get CHZ balance received
        uint256 chzReceived = address(this).balance;
        require(chzReceived > 0, "No CHZ received");
        
        emit PaymentReceived(paymentId, chzReceived);
        
        // Process the payment
        _processPayment(paymentId, merchant, fanToken, fanTokenAmount, chzReceived);
    }
    
    function _processPayment(
        string memory paymentId,
        address merchant,
        address fanToken,
        uint256 fanTokenAmount,
        uint256 chzReceived
    ) internal {
        // Store payment details
        processedPayments[paymentId] = ProcessedPayment({
            paymentId: paymentId,
            merchant: merchant,
            fanToken: fanToken,
            fanTokenAmount: fanTokenAmount,
            chzReceived: chzReceived,
            fanTokensSent: 0,
            completed: false,
            timestamp: block.timestamp
        });
        
        // Convert CHZ to fan tokens via Chiliz DEX
        uint256 fanTokensReceived = _convertToFanTokens(fanToken, chzReceived);
        
        emit FanTokenSwapCompleted(paymentId, fanToken, fanTokensReceived);
        
        // Send fan tokens to merchant
        _sendToMerchant(paymentId, merchant, fanToken, fanTokensReceived);
        
        // Mark payment as completed
        processedPayments[paymentId].fanTokensSent = fanTokensReceived;
        processedPayments[paymentId].completed = true;
        
        emit PaymentCompleted(paymentId, merchant, fanToken, fanTokensReceived);
    }
    
    function _convertToFanTokens(
        address fanToken,
        uint256 chzAmount
    ) internal returns (uint256) {
        // Get expected fan token amount
        uint256 expectedFanTokens = CHILIZ_DEX.getPrice(fanToken, chzAmount);
        require(expectedFanTokens > 0, "No liquidity for fan token");
        
        // Get fan token balance before swap
        uint256 balanceBefore = IERC20(fanToken).balanceOf(address(this));
        
        // Execute swap on Chiliz DEX
        CHILIZ_DEX._swap{value: chzAmount}(fanToken);
        
        // Calculate actual fan tokens received
        uint256 balanceAfter = IERC20(fanToken).balanceOf(address(this));
        uint256 fanTokensReceived = balanceAfter - balanceBefore;
        
        require(fanTokensReceived > 0, "Fan token swap failed");
        
        return fanTokensReceived;
    }
    
    function _sendToMerchant(
        string memory paymentId,
        address merchant,
        address fanToken,
        uint256 amount
    ) internal {
        require(
            IERC20(fanToken).transfer(merchant, amount),
            "Transfer to merchant failed"
        );
        
        emit PaymentSentToMerchant(paymentId, merchant, fanToken, amount);
    }
    
    // View functions
    function getProcessedPayment(string calldata paymentId) 
        external 
        view 
        returns (ProcessedPayment memory) 
    {
        return processedPayments[paymentId];
    }
    
    function getFanTokenPrice(address fanToken, uint256 chzAmount) 
        external 
        view 
        returns (uint256) 
    {
        return CHILIZ_DEX.getPrice(fanToken, chzAmount);
    }
    
    // Admin functions
    function setHyperlaneMailbox(address _mailbox) external onlyOwner {
        hyperlaneMailbox = _mailbox;
    }
    
    function setPaymentGateway(address _gateway) external onlyOwner {
        paymentGateway = _gateway;
    }
    
    function setSepoliaDomain(uint32 _domain) external onlyOwner {
        sepoliaDomain = _domain;
    }
    
    // Emergency functions
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(owner(), amount), "Withdrawal failed");
    }
    
    function withdrawCHZ() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // Receive CHZ from Hyperlane bridge
    receive() external payable {
        // CHZ received from bridge
    }
}