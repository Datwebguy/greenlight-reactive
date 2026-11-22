// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/// @notice The rules an owner signs once. Amounts are US dollar cents.
struct Policy {
    uint64 startLimitCents; // daily limit the agent starts with
    uint64 ceilingCents; // the limit can never rise above this
    uint64 floorCents; // the limit can never be cut below this
    uint32 scoreWindow; // seconds after a trade before its result is judged
    uint16 maxSlippageBps; // worst price move accepted between decision and fill
    uint16 stepBps; // how much the limit rises or falls on each change
    uint8 raiseAfterWins; // winning trades in a row needed for a raise
    uint8 freezeAfterLosses; // losing trades in a row that freeze the agent
    uint64 maxLossCents; // total loss since the last unfreeze that freezes the agent (0 = no total)
}

/// @notice Why the agent's limit or frozen state changed.
library Reason {
    uint8 internal constant JOINED = 1;
    uint8 internal constant POLICY = 2;
    uint8 internal constant RAISED = 3;
    uint8 internal constant CUT = 4;
    uint8 internal constant FROZEN_STREAK = 5;
    uint8 internal constant FROZEN_LOSS = 6;
    uint8 internal constant OWNER_FROZE = 7;
    uint8 internal constant OWNER_UNFROZE = 8;
    uint8 internal constant RESYNC = 9;
}

library PolicyRules {
    error InvalidPolicy();

    /// @dev $10 billion a day: far above any real limit, and small enough that no raise can overflow.
    uint64 internal constant MAX_LIMIT_CENTS = 1e12;

    function check(Policy memory p) internal pure {
        if (
            p.ceilingCents == 0 || p.ceilingCents > MAX_LIMIT_CENTS || p.floorCents > p.startLimitCents || p.startLimitCents > p.ceilingCents
                || p.scoreWindow == 0 || p.maxSlippageBps > 2_000 || p.stepBps == 0 || p.stepBps >= 10_000
                || p.raiseAfterWins == 0 || p.freezeAfterLosses == 0
        ) revert InvalidPolicy();
    }
}

/// @notice Events emitted on the trading chains and read by the scorer on Reactive Network.
interface IGreenlightAccountEvents {
    event AccountCreated(address indexed owner, address indexed account, Policy policy);
    event TradeExecuted(
        uint64 indexed tradeId,
        uint8 side,
        uint64 amountCents,
        uint256 price,
        uint64 timestamp,
        bool verified,
        bool ownerApproved
    );
    event PolicySet(uint64 indexed version, Policy policy);
    event OwnerAction(uint64 indexed count, bool frozen);
    event ResyncRequested(uint64 appliedSeq);
}

/// @notice The single callback the scorer sends to every account.
interface IGreenlightSync {
    function sync(address rc, uint64 seq, uint64 limitCents, bool frozen, uint8 reason) external;
}

/// @notice Chainlink price feed (proxy or aggregator).
interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
