// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import { ISystemContract } from "@reactive/src/interfaces/ISystemContract.sol";
import { IReactive } from "@reactive/src/interfaces/IReactive.sol";
import { AbstractReactive } from "@reactive/src/base/AbstractReactive.sol";
import { Policy, Reason, IGreenlightSync } from "./GreenlightTypes.sol";

/// @title Greenlight scorer
/// @notice Runs on Reactive Network. Watches every Greenlight account, judges each trade against the Chainlink
/// ETH/USD price once its scoring window has passed, and raises, cuts or freezes the agent's daily limit on all of
/// the owner's chains. It needs no server: price updates and account events drive it.
contract GreenlightScorer is AbstractReactive {
    error NotOwner(address caller);

    struct Book {
        Policy policy;
        uint64 limitCents;
        uint64 seq; // increases with every change; accounts apply only newer values
        uint64 lossSinceResetCents;
        uint32 winStreak;
        uint32 lossStreak;
        uint32 wins;
        uint32 losses;
        int128 pnlCents;
        bool frozen;
        bool exists;
    }

    struct AccountInfo {
        address owner;
        uint64 policyVersion;
        uint64 ownerActions;
    }

    struct Linked {
        uint256 chainId;
        address account;
    }

    struct PendingTrade {
        address owner;
        uint64 chainId;
        uint64 tradeId;
        address account;
        uint64 amountCents;
        uint64 maturity;
        uint8 side;
        uint256 entryPrice;
    }

    event FactoryAdded(uint256 indexed chainId, address factory);
    event PriceFeedSet(uint256 indexed chainId, address feed);
    event AccountLinked(address indexed owner, uint256 chainId, address account);
    event TradeQueued(address indexed owner, uint256 chainId, address account, uint64 tradeId, uint64 maturity);
    event TradeScored(
        address indexed owner,
        uint256 chainId,
        address account,
        uint64 tradeId,
        uint256 entryPrice,
        uint256 exitPrice,
        int256 returnBps,
        int256 pnlCents
    );
    event LimitUpdated(address indexed owner, uint64 indexed seq, uint64 limitCents, bool frozen, uint8 reason);

    // Topics of the events this contract reacts to. Checked against the real event selectors in the tests.
    uint256 internal constant ANSWER_UPDATED = uint256(keccak256("AnswerUpdated(int256,uint256,uint256)"));
    uint256 internal constant ACCOUNT_CREATED = uint256(keccak256("AccountCreated(address,address,(uint64,uint64,uint64,uint32,uint16,uint16,uint8,uint8,uint64))"));
    uint256 internal constant TRADE_EXECUTED = uint256(keccak256("TradeExecuted(uint64,uint8,uint64,uint256,uint64,bool,bool)"));
    uint256 internal constant POLICY_SET = uint256(keccak256("PolicySet(uint64,(uint64,uint64,uint64,uint32,uint16,uint16,uint8,uint8,uint64))"));
    uint256 internal constant OWNER_ACTION = uint256(keccak256("OwnerAction(uint64,bool)"));
    uint256 internal constant RESYNC_REQUESTED = uint256(keccak256("ResyncRequested(uint64)"));

    address public immutable owner;
    uint64 public immutable callbackGasLimit;
    uint256 public immutable maxSettlePerPrice;

    uint256 public priceChainId;
    address public priceFeed;

    mapping(uint256 chainId => address) public factoryOf;
    mapping(address owner => Book) private _books;
    mapping(address owner => Linked[]) private _linked;
    mapping(uint256 chainId => mapping(address account => AccountInfo)) public accountInfo;
    mapping(bytes32 => bool) public tradeSeen;
    mapping(address owner => uint8) private _lastReason;

    PendingTrade[] private _queue;
    uint256 public queueHead;

    uint256 public lastPrice;
    uint256 public lastPriceAt;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    /// @param priceChainId_ Chain of the Chainlink aggregator whose updates settle trades.
    /// @param priceFeed_ The aggregator contract that emits `AnswerUpdated` (not the proxy).
    /// @param callbackGasLimit_ Gas for each update sent to an account (at least 100,000).
    /// @param maxSettlePerPrice_ Most trades judged per price update, to keep each reaction within its gas limit.
    constructor(uint256 priceChainId_, address priceFeed_, uint64 callbackGasLimit_, uint256 maxSettlePerPrice_)
        payable
    {
        owner = msg.sender;
        callbackGasLimit = callbackGasLimit_;
        maxSettlePerPrice = maxSettlePerPrice_;
        priceChainId = priceChainId_;
        priceFeed = priceFeed_;
        _subscribe(priceChainId_, priceFeed_, ANSWER_UPDATED);
        emit PriceFeedSet(priceChainId_, priceFeed_);
    }

    // ------------------------------------------------------------------ operator

    /// @notice Start watching a chain's factory for new accounts.
    function addFactory(uint256 chainId, address factory) external onlyOwner {
        address old = factoryOf[chainId];
        if (old != address(0)) _unsubscribe(chainId, old, ACCOUNT_CREATED);
        factoryOf[chainId] = factory;
        _subscribe(chainId, factory, ACCOUNT_CREATED);
        emit FactoryAdded(chainId, factory);
    }

    /// @notice Follow a new aggregator, for example after Chainlink upgrades the feed.
    function setPriceFeed(uint256 chainId, address feed) external onlyOwner {
        _unsubscribe(priceChainId, priceFeed, ANSWER_UPDATED);
        priceChainId = chainId;
        priceFeed = feed;
        _subscribe(chainId, feed, ANSWER_UPDATED);
        emit PriceFeedSet(chainId, feed);
    }

    /// @notice Settle any debt from the balance; a contract in debt receives no events.
    function coverDebt() external payable {
        _coverDebt();
    }

    // ------------------------------------------------------------------ Reactive Network

    /// @inheritdoc IReactive
    /// @dev Never reverts on unexpected input: a reverted reaction is still charged.
    function react(LogRecord calldata log) external onlySystem {
        uint256 topic0 = log.topic0;
        if (topic0 == ANSWER_UPDATED) {
            if (log.chainId == priceChainId && log.contractAddress == priceFeed) _onPrice(log);
            return;
        }
        if (topic0 == ACCOUNT_CREATED) {
            if (factoryOf[log.chainId] == log.contractAddress) _onAccountCreated(log);
            return;
        }
        AccountInfo storage info = accountInfo[log.chainId][log.contractAddress];
        address acctOwner = info.owner;
        if (acctOwner == address(0)) return;

        if (topic0 == TRADE_EXECUTED) _onTrade(log, acctOwner);
        else if (topic0 == POLICY_SET) _onPolicy(log, info, acctOwner);
        else if (topic0 == OWNER_ACTION) _onOwnerAction(log, info, acctOwner);
        else if (topic0 == RESYNC_REQUESTED) _onResync(log, acctOwner);
    }

    // ------------------------------------------------------------------ handlers

    function _onAccountCreated(LogRecord calldata log) private {
        address acctOwner = address(uint160(log.topic1));
        address account = address(uint160(log.topic2));
        AccountInfo storage info = accountInfo[log.chainId][account];
        if (info.owner != address(0)) return; // already linked: a repeated event

        info.owner = acctOwner;
        info.policyVersion = 1;
        _linked[acctOwner].push(Linked(log.chainId, account));
        _subscribe(log.chainId, account, TRADE_EXECUTED);
        _subscribe(log.chainId, account, POLICY_SET);
        _subscribe(log.chainId, account, OWNER_ACTION);
        _subscribe(log.chainId, account, RESYNC_REQUESTED);
        emit AccountLinked(acctOwner, log.chainId, account);

        Book storage b = _books[acctOwner];
        if (!b.exists) {
            Policy memory p = abi.decode(log.data, (Policy));
            b.exists = true;
            b.policy = p;
            b.limitCents = p.startLimitCents;
            b.seq = 1;
            emit LimitUpdated(acctOwner, 1, p.startLimitCents, false, Reason.JOINED);
        }
        _send(log.chainId, account, b, Reason.JOINED);
    }

    function _onTrade(LogRecord calldata log, address acctOwner) private {
        uint64 tradeId = uint64(log.topic1);
        bytes32 key = keccak256(abi.encode(log.chainId, log.contractAddress, tradeId));
        if (tradeSeen[key]) return;
        tradeSeen[key] = true;

        (uint8 side, uint64 amountCents, uint256 price, uint64 timestamp,,) =
            abi.decode(log.data, (uint8, uint64, uint256, uint64, bool, bool));
        uint64 maturity = timestamp + _books[acctOwner].policy.scoreWindow;
        _queue.push(
            PendingTrade({
                owner: acctOwner,
                chainId: uint64(log.chainId),
                tradeId: tradeId,
                account: log.contractAddress,
                amountCents: amountCents,
                maturity: maturity,
                side: side,
                entryPrice: price
            })
        );
        emit TradeQueued(acctOwner, log.chainId, log.contractAddress, tradeId, maturity);
    }

    function _onPolicy(LogRecord calldata log, AccountInfo storage info, address acctOwner) private {
        uint64 version = uint64(log.topic1);
        if (version <= info.policyVersion) return;
        info.policyVersion = version;

        Policy memory p = abi.decode(log.data, (Policy));
        Book storage b = _books[acctOwner];
        b.policy = p;
        if (b.limitCents > p.ceilingCents) b.limitCents = p.ceilingCents;
        if (b.limitCents < p.floorCents) b.limitCents = p.floorCents;
        _changed(acctOwner, b, Reason.POLICY);
    }

    function _onOwnerAction(LogRecord calldata log, AccountInfo storage info, address acctOwner) private {
        uint64 count = uint64(log.topic1);
        if (count <= info.ownerActions) return;
        info.ownerActions = count;

        bool freeze = abi.decode(log.data, (bool));
        Book storage b = _books[acctOwner];
        if (freeze) {
            b.frozen = true;
            _changed(acctOwner, b, Reason.OWNER_FROZE);
        } else {
            b.frozen = false;
            b.winStreak = 0;
            b.lossStreak = 0;
            b.lossSinceResetCents = 0;
            if (b.limitCents > b.policy.floorCents) b.limitCents = b.policy.floorCents;
            _changed(acctOwner, b, Reason.OWNER_UNFROZE);
        }
    }

    function _onResync(LogRecord calldata log, address acctOwner) private {
        uint64 appliedSeq = abi.decode(log.data, (uint64));
        Book storage b = _books[acctOwner];
        if (b.seq > appliedSeq) _send(log.chainId, log.contractAddress, b, Reason.RESYNC);
    }

    function _onPrice(LogRecord calldata log) private {
        int256 answer = int256(log.topic1);
        if (answer <= 0) return;
        uint256 exitPrice = uint256(answer);
        uint256 updatedAt = abi.decode(log.data, (uint256));
        if (updatedAt < lastPriceAt) return; // an older round arriving late
        lastPrice = exitPrice;
        lastPriceAt = updatedAt;

        uint256 head = queueHead;
        uint256 end = _queue.length;
        uint256 limit = maxSettlePerPrice;
        address[] memory touched = new address[](limit);
        uint256 nTouched;

        for (uint256 n; n < limit && head < end; ++n) {
            PendingTrade memory t = _queue[head];
            if (t.maturity > updatedAt) break;
            delete _queue[head];
            ++head;
            if (_score(t, exitPrice)) {
                bool seen;
                for (uint256 i; i < nTouched; ++i) {
                    if (touched[i] == t.owner) seen = true;
                }
                if (!seen) touched[nTouched++] = t.owner;
            }
        }
        queueHead = head;

        for (uint256 i; i < nTouched; ++i) {
            Book storage b = _books[touched[i]];
            _broadcast(touched[i], b, _lastReason[touched[i]]);
        }
    }

    /// @return changed True when the owner's limit or frozen state changed.
    function _score(PendingTrade memory t, uint256 exitPrice) private returns (bool changed) {
        int256 move = int256(exitPrice) - int256(t.entryPrice);
        if (t.side == 1) move = -move; // a sale wins when the price falls
        int256 returnBps = move * 10_000 / int256(t.entryPrice);
        int256 pnlCents = int256(uint256(t.amountCents)) * move / int256(t.entryPrice);
        emit TradeScored(t.owner, t.chainId, t.account, t.tradeId, t.entryPrice, exitPrice, returnBps, pnlCents);

        Book storage b = _books[t.owner];
        b.pnlCents += int128(pnlCents);
        if (move == 0) return false;

        Policy memory p = b.policy;
        uint64 before = b.limitCents;
        bool wasFrozen = b.frozen;
        uint8 reason;

        if (move > 0) {
            b.wins += 1;
            b.lossStreak = 0;
            b.winStreak += 1;
            if (!b.frozen && b.winStreak >= p.raiseAfterWins) {
                b.winStreak = 0;
                uint64 raised = before + uint64(uint256(before) * p.stepBps / 10_000);
                if (raised == before) raised = before + 1;
                b.limitCents = raised > p.ceilingCents ? p.ceilingCents : raised;
                reason = Reason.RAISED;
            }
        } else {
            b.losses += 1;
            b.winStreak = 0;
            b.lossStreak += 1;
            b.lossSinceResetCents += uint64(uint256(-pnlCents));
            if (!b.frozen) {
                uint64 cut = before - uint64(uint256(before) * p.stepBps / 10_000);
                b.limitCents = cut < p.floorCents ? p.floorCents : cut;
                reason = Reason.CUT;
                if (b.lossStreak >= p.freezeAfterLosses) {
                    b.frozen = true;
                    reason = Reason.FROZEN_STREAK;
                } else if (p.maxLossCents != 0 && b.lossSinceResetCents >= p.maxLossCents) {
                    b.frozen = true;
                    reason = Reason.FROZEN_LOSS;
                }
            }
        }

        if (b.limitCents == before && b.frozen == wasFrozen) return false;
        b.seq += 1;
        _lastReason[t.owner] = reason;
        emit LimitUpdated(t.owner, b.seq, b.limitCents, b.frozen, reason);
        return true;
    }

    // ------------------------------------------------------------------ sending updates

    function _changed(address acctOwner, Book storage b, uint8 reason) private {
        b.seq += 1;
        emit LimitUpdated(acctOwner, b.seq, b.limitCents, b.frozen, reason);
        _broadcast(acctOwner, b, reason);
    }

    function _broadcast(address acctOwner, Book storage b, uint8 reason) private {
        Linked[] storage list = _linked[acctOwner];
        for (uint256 i; i < list.length; ++i) {
            _send(list[i].chainId, list[i].account, b, reason);
        }
    }

    function _send(uint256 chainId, address account, Book storage b, uint8 reason) private {
        bytes memory payload = abi.encodeCall(
            IGreenlightSync.sync,
            (address(0), b.seq, b.limitCents, b.frozen, reason) // address(0) is replaced with this contract
        );
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: chainId,
                recipient: account,
                gasLimit: callbackGasLimit,
                payload: payload
            })
        );
    }

    // ------------------------------------------------------------------ subscriptions

    function _subscribe(uint256 chainId, address target, uint256 topic0) private {
        SYSTEM.subscribe(chainId, target, topic0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    function _unsubscribe(uint256 chainId, address target, uint256 topic0) private {
        SYSTEM.unsubscribe(chainId, target, topic0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
    }

    // ------------------------------------------------------------------ views

    function bookOf(address acctOwner) external view returns (Book memory) {
        return _books[acctOwner];
    }

    function accountsOf(address acctOwner) external view returns (Linked[] memory) {
        return _linked[acctOwner];
    }

    function queueLength() external view returns (uint256) {
        return _queue.length - queueHead;
    }

    function pendingAt(uint256 index) external view returns (PendingTrade memory) {
        return _queue[queueHead + index];
    }
}
