// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {DoomToken} from "./DoomToken.sol";

/// @title DoomLaunchpad
/// @notice Memecoin launchpad on BNB Chain. Every launch gets:
///         - a pump-style virtual-reserve constant-product bonding curve (1% fee to treasury)
///         - a time-weighted average market-cap accumulator
///         - a sealed (commit-reveal) survival prediction market, settled on the TWAP market cap
/// @dev    All protocol fees accrue to `protocolFeesAccrued` and are pushed to the immutable
///         treasury via `withdrawFees()` (callable by anyone). User funds are always pulled.
contract DoomLaunchpad is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------

    uint256 public constant BPS = 10_000;
    uint256 public constant TRADE_FEE_BPS = 100; // 1%
    uint256 public constant MARKET_FEE_BPS = 200; // 2% of the losing pool

    uint256 public constant VIRTUAL_BNB = 30 ether;
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000 ether;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    /// @notice Max tokens sellable through the curve (rest stays in the launchpad).
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether;

    uint256 public constant REVEAL_WINDOW = 24 hours;
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 30 days;
    /// @notice TWAP covers the last 1/TWAP_DIVISOR of the launch window.
    uint256 public constant TWAP_DIVISOR = 4;
    uint256 public constant MIN_BET = 0.001 ether;

    uint8 public constant SIDE_YES = 1; // survives
    uint8 public constant SIDE_NO = 2; // dies

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum LaunchState {
        Active,
        Survived,
        Died
    }

    struct Launch {
        uint256 id;
        address token;
        address creator;
        uint256 bond;
        uint256 targetMcap;
        uint64 createdAt;
        uint64 deadline;
        uint64 commitEnd;
        uint64 revealEnd;
        LaunchState state;
    }

    struct Curve {
        uint256 realBnb; // BNB held as curve reserve
        uint256 tokensSold; // tokens currently out of the curve
        // TWAP accumulator (market cap in wei * seconds)
        uint256 cumMcap;
        uint64 lastTs;
        uint64 twapStart;
        bool startSnap;
        bool endSnap;
        uint256 cumAtStart;
        uint256 cumAtEnd;
    }

    struct Market {
        uint256 totalCommitted;
        uint256 yesPool; // revealed YES stake
        uint256 noPool; // revealed NO stake
        uint256 winPool; // set at settle
        uint256 distributable; // losers + forfeits (+bond if died) minus fee, set at settle
        uint256 twapMcap; // set at settle
        bool refundMode; // no winners revealed: revealed stakes refundable
        bool bondClaimed;
    }

    struct Commit {
        address user;
        uint256 amount;
        bool revealed;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    address public immutable treasury;

    uint256 public minBond = 0.05 ether;
    uint256 public launchCount;
    uint256 public protocolFeesAccrued;

    mapping(uint256 => Launch) internal _launches;
    mapping(uint256 => Curve) internal _curves;
    mapping(uint256 => Market) internal _markets;
    mapping(uint256 => mapping(bytes32 => Commit)) public commits;
    mapping(uint256 => mapping(address => uint256)) public yesStake;
    mapping(uint256 => mapping(address => uint256)) public noStake;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256) public tokenToLaunch; // token => id (ids start at 1)

    mapping(address => uint256) public launchedCount;
    mapping(address => uint256) public survivedCount;

    // ---------------------------------------------------------------------
    // Events (signatures are stable; frontend/backend depend on them)
    // ---------------------------------------------------------------------

    event LaunchCreated(
        uint256 indexed id,
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 bond,
        uint256 targetMcap,
        uint64 deadline,
        uint64 revealEnd,
        uint256 creatorLaunched,
        uint256 creatorSurvived
    );
    event Trade(uint256 indexed id, address indexed trader, bool isBuy, uint256 bnb, uint256 tokens, uint256 priceAfter);
    event Committed(uint256 indexed id, address indexed user, bytes32 commitment, uint256 amount);
    event Revealed(uint256 indexed id, address indexed user, uint8 side, uint256 amount);
    event Settled(
        uint256 indexed id,
        bool survived,
        uint256 twapMcap,
        uint256 yesPool,
        uint256 noPool,
        uint256 forfeited,
        uint256 fee,
        address indexed creator,
        uint256 creatorLaunched,
        uint256 creatorSurvived
    );
    event Claimed(uint256 indexed id, address indexed user, uint256 amount);
    event BondClaimed(uint256 indexed id, address indexed creator, uint256 amount);
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event MinBondUpdated(uint256 oldMinBond, uint256 newMinBond);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error ZeroAddress();
    error BondTooLow();
    error BadDuration();
    error BadTarget();
    error UnknownLaunch();
    error ZeroAmount();
    error Slippage();
    error CurveSoldOut();
    error InsufficientReserve();
    error CommitClosed();
    error BetTooSmall();
    error BadCommitment();
    error NotRevealPhase();
    error BadSide();
    error AlreadyRevealed();
    error TooEarly();
    error AlreadySettled();
    error NotSettled();
    error NothingToClaim();
    error NotCreator();
    error TransferFailed();

    // ---------------------------------------------------------------------
    // Constructor / admin
    // ---------------------------------------------------------------------

    constructor(address treasury_) Ownable(treasury_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
    }

    function setMinBond(uint256 newMinBond) external onlyOwner {
        emit MinBondUpdated(minBond, newMinBond);
        minBond = newMinBond;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Push all accrued protocol fees to the immutable treasury. Callable by anyone.
    function withdrawFees() external nonReentrant {
        uint256 amount = protocolFeesAccrued;
        if (amount == 0) revert ZeroAmount();
        protocolFeesAccrued = 0;
        _send(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

    // ---------------------------------------------------------------------
    // Launch
    // ---------------------------------------------------------------------

    function createLaunch(string calldata name, string calldata symbol, uint256 targetMcapWei, uint256 durationSecs)
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256 id)
    {
        if (msg.value < minBond) revert BondTooLow();
        if (durationSecs < MIN_DURATION || durationSecs > MAX_DURATION) revert BadDuration();
        if (targetMcapWei == 0) revert BadTarget();

        id = ++launchCount;
        DoomToken token = new DoomToken(name, symbol);

        uint64 nowTs = uint64(block.timestamp);
        uint64 deadline = uint64(block.timestamp + durationSecs);
        uint64 revealEnd = uint64(block.timestamp + durationSecs + REVEAL_WINDOW);

        _launches[id] = Launch({
            id: id,
            token: address(token),
            creator: msg.sender,
            bond: msg.value,
            targetMcap: targetMcapWei,
            createdAt: nowTs,
            deadline: deadline,
            commitEnd: deadline,
            revealEnd: revealEnd,
            state: LaunchState.Active
        });

        Curve storage c = _curves[id];
        c.lastTs = nowTs;
        c.twapStart = uint64(block.timestamp + durationSecs - durationSecs / TWAP_DIVISOR);

        tokenToLaunch[address(token)] = id;
        uint256 launched = ++launchedCount[msg.sender];

        emit LaunchCreated(
            id,
            address(token),
            msg.sender,
            name,
            symbol,
            msg.value,
            targetMcapWei,
            deadline,
            revealEnd,
            launched,
            survivedCount[msg.sender]
        );
    }

    // ---------------------------------------------------------------------
    // Bonding curve
    // ---------------------------------------------------------------------

    function buy(uint256 id, uint256 minOut) external payable whenNotPaused nonReentrant returns (uint256 tokensOut) {
        Launch storage l = _launch(id);
        if (msg.value == 0) revert ZeroAmount();
        Curve storage c = _curves[id];
        _accumulate(c, l.deadline);

        uint256 remaining = CURVE_SUPPLY - c.tokensSold;
        if (remaining == 0) revert CurveSoldOut();

        uint256 vBnb = VIRTUAL_BNB + c.realBnb;
        uint256 vTok = VIRTUAL_TOKENS - c.tokensSold;

        uint256 fee = (msg.value * TRADE_FEE_BPS) / BPS;
        uint256 netIn = msg.value - fee;
        tokensOut = (vTok * netIn) / (vBnb + netIn);
        uint256 refund;

        if (tokensOut > remaining) {
            tokensOut = remaining;
            // BNB needed (rounded up) to take exactly `remaining` tokens
            netIn = (vBnb * remaining + (vTok - remaining) - 1) / (vTok - remaining);
            fee = (netIn * TRADE_FEE_BPS + (BPS - TRADE_FEE_BPS) - 1) / (BPS - TRADE_FEE_BPS);
            refund = msg.value - netIn - fee;
        }
        if (tokensOut == 0 || tokensOut < minOut) revert Slippage();

        c.realBnb += netIn;
        c.tokensSold += tokensOut;
        protocolFeesAccrued += fee;

        IERC20(l.token).safeTransfer(msg.sender, tokensOut);
        if (refund > 0) _send(msg.sender, refund);

        emit Trade(id, msg.sender, true, msg.value - refund, tokensOut, _price(c));
    }

    function sell(uint256 id, uint256 amount, uint256 minOut) external whenNotPaused nonReentrant returns (uint256 bnbOut) {
        Launch storage l = _launch(id);
        if (amount == 0) revert ZeroAmount();
        Curve storage c = _curves[id];
        _accumulate(c, l.deadline);

        uint256 vBnb = VIRTUAL_BNB + c.realBnb;
        uint256 vTok = VIRTUAL_TOKENS - c.tokensSold;

        uint256 gross = (vBnb * amount) / (vTok + amount);
        if (gross > c.realBnb) revert InsufficientReserve();
        uint256 fee = (gross * TRADE_FEE_BPS) / BPS;
        bnbOut = gross - fee;
        if (bnbOut == 0 || bnbOut < minOut) revert Slippage();

        c.realBnb -= gross;
        c.tokensSold -= amount;
        protocolFeesAccrued += fee;

        IERC20(l.token).safeTransferFrom(msg.sender, address(this), amount);
        _send(msg.sender, bnbOut);

        emit Trade(id, msg.sender, false, bnbOut, amount, _price(c));
    }

    // ---------------------------------------------------------------------
    // Sealed survival market
    // ---------------------------------------------------------------------

    /// @param commitment keccak256(abi.encode(uint8 side, bytes32 salt, address user))
    function commit(uint256 id, bytes32 commitment) external payable whenNotPaused nonReentrant {
        Launch storage l = _launch(id);
        if (block.timestamp >= l.commitEnd) revert CommitClosed();
        if (msg.value < MIN_BET) revert BetTooSmall();
        if (commitment == bytes32(0)) revert BadCommitment();
        Commit storage cm = commits[id][commitment];
        if (cm.user != address(0)) revert BadCommitment();

        cm.user = msg.sender;
        cm.amount = msg.value;
        _markets[id].totalCommitted += msg.value;

        emit Committed(id, msg.sender, commitment, msg.value);
    }

    function reveal(uint256 id, uint8 side, bytes32 salt) external nonReentrant {
        Launch storage l = _launch(id);
        if (block.timestamp < l.commitEnd || block.timestamp >= l.revealEnd) revert NotRevealPhase();
        if (side != SIDE_YES && side != SIDE_NO) revert BadSide();

        bytes32 commitment = computeCommitment(side, salt, msg.sender);
        Commit storage cm = commits[id][commitment];
        if (cm.user != msg.sender) revert BadCommitment();
        if (cm.revealed) revert AlreadyRevealed();
        cm.revealed = true;

        Market storage m = _markets[id];
        if (side == SIDE_YES) {
            m.yesPool += cm.amount;
            yesStake[id][msg.sender] += cm.amount;
        } else {
            m.noPool += cm.amount;
            noStake[id][msg.sender] += cm.amount;
        }
        emit Revealed(id, msg.sender, side, cm.amount);
    }

    function settle(uint256 id) external nonReentrant {
        Launch storage l = _launch(id);
        if (l.state != LaunchState.Active) revert AlreadySettled();
        if (block.timestamp < l.revealEnd) revert TooEarly();

        Curve storage c = _curves[id];
        _accumulate(c, l.deadline);
        uint256 twap = (c.cumAtEnd - c.cumAtStart) / (uint256(l.deadline) - uint256(c.twapStart));
        bool survived = twap >= l.targetMcap;

        Market storage m = _markets[id];
        m.twapMcap = twap;
        uint256 forfeited = m.totalCommitted - m.yesPool - m.noPool;

        uint256 winPool;
        uint256 losers;
        if (survived) {
            l.state = LaunchState.Survived;
            winPool = m.yesPool;
            losers = m.noPool + forfeited;
            survivedCount[l.creator] += 1;
        } else {
            l.state = LaunchState.Died;
            winPool = m.noPool;
            losers = m.yesPool + forfeited + l.bond;
            m.bondClaimed = true; // bond is consumed by the NO pool
        }

        uint256 fee;
        if (winPool == 0) {
            // Nobody on the winning side revealed: revealed stakes are refunded,
            // forfeits (and bond if died) go to the treasury.
            m.refundMode = true;
            fee = forfeited + (survived ? 0 : l.bond);
        } else {
            fee = (losers * MARKET_FEE_BPS) / BPS;
            m.winPool = winPool;
            m.distributable = losers - fee;
        }
        protocolFeesAccrued += fee;

        emit Settled(
            id,
            survived,
            twap,
            m.yesPool,
            m.noPool,
            forfeited,
            fee,
            l.creator,
            launchedCount[l.creator],
            survivedCount[l.creator]
        );
    }

    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        _launch(id);
        amount = claimable(id, msg.sender);
        if (amount == 0) revert NothingToClaim();
        claimed[id][msg.sender] = true;
        _send(msg.sender, amount);
        emit Claimed(id, msg.sender, amount);
    }

    function claimBond(uint256 id) external nonReentrant {
        Launch storage l = _launch(id);
        if (l.state != LaunchState.Survived) revert NotSettled();
        if (msg.sender != l.creator) revert NotCreator();
        Market storage m = _markets[id];
        if (m.bondClaimed) revert NothingToClaim();
        m.bondClaimed = true;
        _send(msg.sender, l.bond);
        emit BondClaimed(id, msg.sender, l.bond);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function computeCommitment(uint8 side, bytes32 salt, address user) public pure returns (bytes32) {
        return keccak256(abi.encode(side, salt, user));
    }

    function getLaunch(uint256 id) external view returns (Launch memory) {
        return _launches[id];
    }

    function getCurve(uint256 id) external view returns (Curve memory) {
        return _curves[id];
    }

    function getMarket(uint256 id) external view returns (Market memory) {
        return _markets[id];
    }

    function claimable(uint256 id, address user) public view returns (uint256) {
        Launch storage l = _launches[id];
        if (l.state == LaunchState.Active || claimed[id][user]) return 0;
        Market storage m = _markets[id];
        if (m.refundMode) {
            return yesStake[id][user] + noStake[id][user];
        }
        uint256 stake = l.state == LaunchState.Survived ? yesStake[id][user] : noStake[id][user];
        if (stake == 0) return 0;
        return stake + (stake * m.distributable) / m.winPool;
    }

    /// @notice Spot price in wei per whole token (1e18 units).
    function currentPrice(uint256 id) external view returns (uint256) {
        return _price(_curves[id]);
    }

    /// @notice Spot market cap in wei (price * total supply).
    function currentMcap(uint256 id) public view returns (uint256) {
        return _mcap(_curves[id]);
    }

    /// @notice TWAP market cap over [twapStart, min(now, deadline)]. Returns spot if window not started.
    function twapMcap(uint256 id) external view returns (uint256) {
        Launch storage l = _launches[id];
        Curve storage c = _curves[id];
        if (l.state != LaunchState.Active) return _markets[id].twapMcap;
        uint256 t = block.timestamp < l.deadline ? block.timestamp : l.deadline;
        if (t <= c.twapStart) return _mcap(c);
        uint256 startCum = c.startSnap ? c.cumAtStart : c.cumMcap + _mcap(c) * (c.twapStart - c.lastTs);
        uint256 nowCum = c.endSnap ? c.cumAtEnd : c.cumMcap + _mcap(c) * (t - c.lastTs);
        return (nowCum - startCum) / (t - c.twapStart);
    }

    function quoteBuy(uint256 id, uint256 bnbIn) external view returns (uint256 tokensOut) {
        Curve storage c = _curves[id];
        uint256 netIn = bnbIn - (bnbIn * TRADE_FEE_BPS) / BPS;
        uint256 vBnb = VIRTUAL_BNB + c.realBnb;
        uint256 vTok = VIRTUAL_TOKENS - c.tokensSold;
        tokensOut = (vTok * netIn) / (vBnb + netIn);
        uint256 remaining = CURVE_SUPPLY - c.tokensSold;
        if (tokensOut > remaining) tokensOut = remaining;
    }

    function quoteSell(uint256 id, uint256 amount) external view returns (uint256 bnbOut) {
        Curve storage c = _curves[id];
        uint256 vBnb = VIRTUAL_BNB + c.realBnb;
        uint256 vTok = VIRTUAL_TOKENS - c.tokensSold;
        uint256 gross = (vBnb * amount) / (vTok + amount);
        if (gross > c.realBnb) return 0;
        bnbOut = gross - (gross * TRADE_FEE_BPS) / BPS;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _launch(uint256 id) internal view returns (Launch storage l) {
        l = _launches[id];
        if (l.token == address(0)) revert UnknownLaunch();
    }

    function _price(Curve storage c) internal view returns (uint256) {
        return ((VIRTUAL_BNB + c.realBnb) * 1e18) / (VIRTUAL_TOKENS - c.tokensSold);
    }

    function _mcap(Curve storage c) internal view returns (uint256) {
        return ((VIRTUAL_BNB + c.realBnb) * TOTAL_SUPPLY) / (VIRTUAL_TOKENS - c.tokensSold);
    }

    /// @dev Must be called BEFORE reserves change. Advances the mcap*time accumulator and
    ///      snapshots it at twapStart and deadline the first time those instants are crossed.
    function _accumulate(Curve storage c, uint64 deadline) internal {
        uint256 nowTs = block.timestamp;
        if (nowTs <= c.lastTs) return;
        uint256 mc = _mcap(c);
        if (!c.startSnap && nowTs >= c.twapStart) {
            c.cumAtStart = c.cumMcap + mc * (uint256(c.twapStart) - c.lastTs);
            c.startSnap = true;
        }
        if (!c.endSnap && nowTs >= deadline) {
            c.cumAtEnd = c.cumMcap + mc * (uint256(deadline) - c.lastTs);
            c.endSnap = true;
        }
        c.cumMcap += mc * (nowTs - c.lastTs);
        c.lastTs = uint64(nowTs);
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
