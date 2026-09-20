// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20Minimal
 * @notice Minimal ERC20 interface for stablecoin transfers on Celo
 */
interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SokoEscrow
 * @author SokoPay Protocol
 * @notice Trustless milestone-based social commerce escrow on Celo.
 * Designed for Opera MiniPay, WhatsApp & Instagram peer-to-peer commerce.
 * Compatible with ERC-8021 Attribution calldata suffixes.
 */
contract SokoEscrow {
    enum EscrowStatus {
        Created,
        Funded,
        Dispatched,
        Delivered,
        Released,
        Disputed,
        Refunded
    }

    struct Deal {
        bytes32 dealId;
        string dealRef;
        address buyer;
        address seller;
        address token;
        uint256 amount;
        uint256 feeAmount;
        uint256 createdAt;
        uint256 dispatchedAt;
        uint256 autoReleaseDuration;
        string trackingRef;
        EscrowStatus status;
    }

    address public owner;
    address public arbiter; // SokoPay Agent arbiter for dispute mediation
    address public feeRecipient;
    uint256 public feeBps = 50; // 0.5% protocol fee (50 basis points)
    uint256 public constant MAX_FEE_BPS = 500; // Max 5%

    // Reentrancy lock
    uint256 private _statusLock;

    mapping(bytes32 => Deal) public deals;
    bytes32[] public dealIds;

    // Track total volume moved through escrow
    uint256 public totalDealsCount;
    uint256 public totalCompletedDeals;

    event DealCreated(
        bytes32 indexed dealId,
        string dealRef,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        uint256 autoReleaseDuration
    );

    event DealFunded(
        bytes32 indexed dealId,
        address indexed buyer,
        uint256 amount
    );

    event DealDispatched(
        bytes32 indexed dealId,
        address indexed seller,
        string trackingRef,
        uint256 dispatchedAt
    );

    event DealReleased(
        bytes32 indexed dealId,
        address indexed seller,
        uint256 netPayout,
        uint256 feePaid
    );

    event DealRefunded(
        bytes32 indexed dealId,
        address indexed buyer,
        uint256 refundAmount
    );

    event DisputeRaised(
        bytes32 indexed dealId,
        address indexed initiator,
        string reason
    );

    event DisputeResolved(
        bytes32 indexed dealId,
        uint256 buyerPayout,
        uint256 sellerPayout
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter || msg.sender == owner, "Only arbiter");
        _;
    }

    modifier nonReentrant() {
        require(_statusLock != 2, "ReentrancyGuard: reentrant call");
        _statusLock = 2;
        _;
        _statusLock = 1;
    }

    constructor(address _arbiter, address _feeRecipient) {
        require(_arbiter != address(0), "Invalid arbiter");
        require(_feeRecipient != address(0), "Invalid feeRecipient");
        owner = msg.sender;
        arbiter = _arbiter;
        feeRecipient = _feeRecipient;
        _statusLock = 1;
    }

    /**
     * @notice Creates a new deal invoice. Can be created by buyer, seller, or SokoPay agent.
     */
    function createDeal(
        bytes32 dealId,
        string calldata dealRef,
        address buyer,
        address seller,
        address token,
        uint256 amount,
        uint256 autoReleaseDuration
    ) external returns (bytes32) {
        require(deals[dealId].amount == 0, "Deal already exists");
        require(buyer != address(0) && seller != address(0), "Invalid parties");
        require(buyer != seller, "Buyer and seller must be independent");
        require(amount > 0, "Amount must be > 0");
        require(token != address(0), "Invalid token address");

        // Default auto-release duration: 5 days if 0
        uint256 duration = autoReleaseDuration > 0 ? autoReleaseDuration : 5 days;
        uint256 fee = (amount * feeBps) / 10000;

        deals[dealId] = Deal({
            dealId: dealId,
            dealRef: dealRef,
            buyer: buyer,
            seller: seller,
            token: token,
            amount: amount,
            feeAmount: fee,
            createdAt: block.timestamp,
            dispatchedAt: 0,
            autoReleaseDuration: duration,
            trackingRef: "",
            status: EscrowStatus.Created
        });

        dealIds.push(dealId);
        totalDealsCount++;

        emit DealCreated(dealId, dealRef, buyer, seller, token, amount, duration);
        return dealId;
    }

    /**
     * @notice Buyer funds the deal by locking the designated ERC-20 stablecoin into the escrow contract.
     */
    function deposit(bytes32 dealId) external nonReentrant {
        Deal storage deal = deals[dealId];
        require(deal.amount > 0, "Deal does not exist");
        require(deal.status == EscrowStatus.Created, "Deal not in Created state");
        require(msg.sender == deal.buyer, "Only designated buyer can fund");

        deal.status = EscrowStatus.Funded;
        deal.createdAt = block.timestamp; // Reset dispatch window to start from deposit timestamp

        // Pull stablecoin from buyer to escrow
        bool success = IERC20Minimal(deal.token).transferFrom(msg.sender, address(this), deal.amount);
        require(success, "Token transfer failed");

        emit DealFunded(dealId, msg.sender, deal.amount);
    }

    /**
     * @notice Convenience function to create and immediately fund a deal in a single transaction.
     */
    function createAndFundDeal(
        bytes32 dealId,
        string calldata dealRef,
        address seller,
        address token,
        uint256 amount,
        uint256 autoReleaseDuration
    ) external nonReentrant returns (bytes32) {
        require(deals[dealId].amount == 0, "Deal already exists");
        require(seller != address(0), "Invalid seller");
        require(msg.sender != seller, "Buyer cannot be seller");
        require(amount > 0, "Amount must be > 0");
        require(token != address(0), "Invalid token");

        uint256 duration = autoReleaseDuration > 0 ? autoReleaseDuration : 5 days;
        uint256 fee = (amount * feeBps) / 10000;

        deals[dealId] = Deal({
            dealId: dealId,
            dealRef: dealRef,
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: amount,
            feeAmount: fee,
            createdAt: block.timestamp,
            dispatchedAt: 0,
            autoReleaseDuration: duration,
            trackingRef: "",
            status: EscrowStatus.Funded
        });

        dealIds.push(dealId);
        totalDealsCount++;

        emit DealCreated(dealId, dealRef, msg.sender, seller, token, amount, duration);

        bool success = IERC20Minimal(token).transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");

        emit DealFunded(dealId, msg.sender, amount);
        return dealId;
    }

    /**
     * @notice Seller marks the order as dispatched, providing tracking or package reference.
     */
    function markDispatched(bytes32 dealId, string calldata trackingRef) external {
        Deal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Funded, "Deal is not funded");
        require(msg.sender == deal.seller, "Only seller can mark dispatched");

        deal.status = EscrowStatus.Dispatched;
        deal.dispatchedAt = block.timestamp;
        deal.trackingRef = trackingRef;

        emit DealDispatched(dealId, msg.sender, trackingRef, block.timestamp);
    }

    /**
     * @notice Buyer confirms delivery and releases funds to the seller.
     */
    function confirmDeliveryAndRelease(bytes32 dealId) external nonReentrant {
        Deal storage deal = deals[dealId];
        require(
            deal.status == EscrowStatus.Funded || deal.status == EscrowStatus.Dispatched,
            "Cannot release in current status"
        );
        require(msg.sender == deal.buyer, "Only buyer can release");

        _executeRelease(dealId);
    }

    /**
     * @notice Seller or agent triggers auto-release if the auto-release window has expired after dispatch.
     */
    function triggerAutoRelease(bytes32 dealId) external nonReentrant {
        Deal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Dispatched, "Deal not dispatched");
        require(
            block.timestamp >= deal.dispatchedAt + deal.autoReleaseDuration,
            "Auto-release timeout not reached"
        );

        _executeRelease(dealId);
    }

    function _executeRelease(bytes32 dealId) internal {
        Deal storage deal = deals[dealId];
        deal.status = EscrowStatus.Released;
        totalCompletedDeals++;

        uint256 netPayout = deal.amount - deal.feeAmount;

        // Payout seller
        bool successSeller = IERC20Minimal(deal.token).transfer(deal.seller, netPayout);
        require(successSeller, "Seller payout failed");

        // Payout protocol fee
        if (deal.feeAmount > 0) {
            bool successFee = IERC20Minimal(deal.token).transfer(feeRecipient, deal.feeAmount);
            require(successFee, "Fee payout failed");
        }

        emit DealReleased(dealId, deal.seller, netPayout, deal.feeAmount);
    }

    /**
     * @notice Allows buyer or seller to cancel an unfunded invoice in Created status.
     */
    function cancelCreated(bytes32 dealId) external {
        Deal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Created, "Deal not in Created state");
        require(msg.sender == deal.buyer || msg.sender == deal.seller, "Only buyer or seller can cancel");

        deal.status = EscrowStatus.Refunded;
        emit DealRefunded(dealId, deal.buyer, 0);
    }

    /**
     * @notice If the seller fails to dispatch within 7 days of funding, buyer can cancel and refund.
     */
    function cancelUnfulfilled(bytes32 dealId) external nonReentrant {
        Deal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Funded, "Deal must be funded and undispatched");
        require(msg.sender == deal.buyer, "Only buyer can cancel unfulfilled");
        require(block.timestamp >= deal.createdAt + 7 days, "Seller still has dispatch window");

        deal.status = EscrowStatus.Refunded;

        bool success = IERC20Minimal(deal.token).transfer(deal.buyer, deal.amount);
        require(success, "Refund transfer failed");

        emit DealRefunded(dealId, deal.buyer, deal.amount);
    }

    /**
     * @notice Either buyer or seller can raise a dispute if there is an issue.
     */
    function raiseDispute(bytes32 dealId, string calldata reason) external {
        Deal storage deal = deals[dealId];
        require(
            deal.status == EscrowStatus.Funded || deal.status == EscrowStatus.Dispatched,
            "Cannot dispute in current status"
        );
        require(
            msg.sender == deal.buyer || msg.sender == deal.seller,
            "Only buyer or seller can dispute"
        );

        deal.status = EscrowStatus.Disputed;
        emit DisputeRaised(dealId, msg.sender, reason);
    }

    /**
     * @notice Arbiter (or SokoPay Agent) resolves dispute by deciding the percentage split.
     * @param buyerSharePercent Percent (0 to 100) allocated to the buyer. Remaining to seller.
     */
    function resolveDispute(bytes32 dealId, uint8 buyerSharePercent) external onlyArbiter nonReentrant {
        Deal storage deal = deals[dealId];
        require(deal.status == EscrowStatus.Disputed, "Deal is not disputed");
        require(buyerSharePercent <= 100, "Invalid split percent");

        deal.status = EscrowStatus.Released;
        totalCompletedDeals++;

        uint256 netTotal = deal.amount - deal.feeAmount;
        uint256 buyerPayout = (netTotal * buyerSharePercent) / 100;
        uint256 sellerPayout = netTotal - buyerPayout;

        if (buyerPayout > 0) {
            bool s1 = IERC20Minimal(deal.token).transfer(deal.buyer, buyerPayout);
            require(s1, "Buyer dispute payout failed");
        }

        if (sellerPayout > 0) {
            bool s2 = IERC20Minimal(deal.token).transfer(deal.seller, sellerPayout);
            require(s2, "Seller dispute payout failed");
        }

        if (deal.feeAmount > 0) {
            bool sFee = IERC20Minimal(deal.token).transfer(feeRecipient, deal.feeAmount);
            require(sFee, "Fee dispute payout failed");
        }

        emit DisputeResolved(dealId, buyerPayout, sellerPayout);
    }

    // View helper to get full deal details
    function getDeal(bytes32 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }

    function getAllDealIds() external view returns (bytes32[] memory) {
        return dealIds;
    }

    function setFeeBps(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= MAX_FEE_BPS, "Fee exceeds maximum");
        feeBps = _newFeeBps;
    }

    function setArbiter(address _newArbiter) external onlyOwner {
        require(_newArbiter != address(0), "Invalid arbiter");
        arbiter = _newArbiter;
    }

    function setFeeRecipient(address _newFeeRecipient) external onlyOwner {
        require(_newFeeRecipient != address(0), "Invalid feeRecipient");
        feeRecipient = _newFeeRecipient;
    }
}
