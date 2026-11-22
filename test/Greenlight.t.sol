// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import { Test, Vm } from "forge-std/Test.sol";
import { IReactive } from "@reactive/src/interfaces/IReactive.sol";
import { ISystemContract } from "@reactive/src/interfaces/ISystemContract.sol";
import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { GreenlightAccount } from "../contracts/GreenlightAccount.sol";
import { GreenlightFactory } from "../contracts/GreenlightFactory.sol";
import { GreenlightScorer } from "../contracts/GreenlightScorer.sol";
import { GreenlightVenue } from "../contracts/GreenlightVenue.sol";
import { Policy, Reason, IGreenlightAccountEvents, IAggregatorV3 } from "../contracts/GreenlightTypes.sol";

// ---------------------------------------------------------------- test stand-ins for Reactive Network

/// @dev Stands in for the Reactive system contract: records subscriptions and callback requests.
contract SystemStandIn {
    struct Sub {
        uint256 chainId;
        address target;
        uint256 topic0;
    }

    Sub[] public subs;
    ISystemContract.CallbackConfiguration_V_1_0[] public callbacks;

    receive() external payable { }

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    function subscribe(uint256 chainId, address target, uint256 topic0, uint256, uint256, uint256) external {
        subs.push(Sub(chainId, target, topic0));
    }

    function unsubscribe(uint256 chainId, address target, uint256 topic0, uint256, uint256, uint256) external {
        for (uint256 i; i < subs.length; ++i) {
            if (subs[i].chainId == chainId && subs[i].target == target && subs[i].topic0 == topic0) {
                subs[i] = subs[subs.length - 1];
                subs.pop();
                return;
            }
        }
    }

    function isSubscribed(uint256 chainId, address target, uint256 topic0) public view returns (bool) {
        for (uint256 i; i < subs.length; ++i) {
            if (subs[i].chainId == chainId && subs[i].target == target && subs[i].topic0 == topic0) return true;
        }
        return false;
    }

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory config) external {
        callbacks.push(config);
    }

    function callbackCount() external view returns (uint256) {
        return callbacks.length;
    }

    function callbackAt(uint256 i) external view returns (ISystemContract.CallbackConfiguration_V_1_0 memory) {
        return callbacks[i];
    }
}

/// @dev Stands in for a destination chain's callback proxy: writes the sender into the first argument and calls.
contract ProxyStandIn {
    receive() external payable { }

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    function deliver(address rc, address recipient, bytes memory payload) external returns (bool ok) {
        assembly {
            mstore(add(payload, 36), rc) // first argument sits after the 4-byte selector
        }
        (ok,) = recipient.call(payload);
    }
}

/// @dev A Chainlink-style feed whose answers the test sets. Emits AnswerUpdated like a real aggregator.
contract FeedStandIn is IAggregatorV3 {
    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);

    int256 public answer;
    uint256 public updatedAt;
    uint80 public round;

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function set(int256 answer_) external {
        answer = answer_;
        updatedAt = block.timestamp;
        round += 1;
        emit AnswerUpdated(answer_, round, block.timestamp);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (round, answer, updatedAt, updatedAt, round);
    }
}

// ---------------------------------------------------------------- tests

contract GreenlightTest is Test {
    address constant SYSTEM = 0x8888888888888888888888888888888888888888;

    SystemStandIn sys;
    ProxyStandIn proxy;
    FeedStandIn feed;
    GreenlightVenue venue;
    GreenlightScorer scorer;
    GreenlightFactory factory;

    address owner = makeAddr("owner");
    address agent = makeAddr("agent");
    uint256 teeKey = 0xA11CE;
    address teeSigner;
    string constant MODEL = "Qwen/Qwen3.8-27B";

    uint256 delivered; // callbacks already handed to the proxy

    function setUp() public {
        vm.warp(1_763_700_000);
        teeSigner = vm.addr(teeKey);
        vm.etch(SYSTEM, address(new SystemStandIn()).code);
        sys = SystemStandIn(payable(SYSTEM));
        proxy = new ProxyStandIn();
        feed = new FeedStandIn();
        feed.set(1_678_00000000); // $1,678.00

        venue = new GreenlightVenue(feed, 1 hours, 10_000e6);
        scorer = new GreenlightScorer(block.chainid, address(feed), 300_000, 5, 4);
        factory = new GreenlightFactory(IPayable(payable(address(proxy))), address(scorer), venue);
        scorer.addFactory(block.chainid, address(factory));
    }

    function policy() internal pure returns (Policy memory) {
        return Policy({
            startLimitCents: 100_00,
            ceilingCents: 500_00,
            floorCents: 20_00,
            scoreWindow: 10 minutes,
            maxSlippageBps: 100,
            stepBps: 2_500,
            raiseAfterWins: 2,
            freezeAfterLosses: 3,
            maxLossCents: 0
        });
    }

    // ------------------------------------------------ helpers

    /// Opens an account and runs the network until the scorer has linked it.
    function open(Policy memory p) internal returns (GreenlightAccount a) {
        vm.recordLogs();
        vm.prank(owner);
        a = factory.createAccount(agent, teeSigner, MODEL, p);
        venue.faucet(address(a));
        relay();
    }

    /// Feeds every recorded log to the scorer as the system contract, then delivers its callbacks.
    function relay() internal {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length == 0) continue;
            if (!sys.isSubscribed(block.chainid, logs[i].emitter, uint256(logs[i].topics[0]))) continue;
            vm.prank(SYSTEM);
            scorer.react(toRecord(logs[i]));
        }
        deliverAll();
        vm.recordLogs();
    }

    function deliverAll() internal {
        uint256 n = sys.callbackCount();
        for (; delivered < n; ++delivered) {
            ISystemContract.CallbackConfiguration_V_1_0 memory c = sys.callbackAt(delivered);
            assertGe(c.gasLimit, 100_000);
            assertTrue(proxy.deliver(address(scorer), c.recipient, c.payload), "callback reverted");
        }
    }

    function toRecord(Vm.Log memory l) internal view returns (IReactive.LogRecord memory r) {
        r.chainId = block.chainid;
        r.contractAddress = l.emitter;
        r.topic0 = uint256(l.topics[0]);
        if (l.topics.length > 1) r.topic1 = uint256(l.topics[1]);
        if (l.topics.length > 2) r.topic2 = uint256(l.topics[2]);
        if (l.topics.length > 3) r.topic3 = uint256(l.topics[3]);
        r.data = l.data;
    }

    function order(GreenlightAccount a, uint8 side, uint64 cents) internal view returns (GreenlightAccount.Order memory) {
        return GreenlightAccount.Order({
            side: side,
            amountCents: cents,
            refPriceCents: uint64(uint256(feed.answer()) / 1e6),
            nonce: a.nextNonce(),
            deadline: uint64(block.timestamp + 5 minutes)
        });
    }

    /// A model response with the order text inside, signed the way NEAR AI Cloud signs it.
    function signedProof(GreenlightAccount a, GreenlightAccount.Order memory o, uint256 key)
        internal
        pure
        returns (GreenlightAccount.Proof memory p)
    {
        string memory text = a.orderText(o);
        bytes memory prefix = bytes('{"id":"chat-1","choices":[{"message":{"role":"assistant","content":"{\\"action\\":\\"buy\\",\\"order\\": \\"');
        p.response = bytes.concat(prefix, bytes(text), bytes('\\"}","reasoning_content":"thinking"}}]}'));
        p.orderOffset = prefix.length;
        p.requestHash = sha256("request bytes");
        bytes memory signed = abi.encodePacked(MODEL, ":", hexOf(p.requestHash), ":", hexOf(sha256(p.response)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, MessageHashUtils.toEthSignedMessageHash(signed));
        p.signature = abi.encodePacked(r, s, v);
    }

    function hexOf(bytes32 h) internal pure returns (bytes memory out) {
        bytes16 d = "0123456789abcdef";
        out = new bytes(64);
        for (uint256 i; i < 32; ++i) {
            out[2 * i] = d[uint8(h[i]) >> 4];
            out[2 * i + 1] = d[uint8(h[i]) & 0x0f];
        }
    }

    function agentTrade(GreenlightAccount a, uint8 side, uint64 cents) internal returns (bool) {
        GreenlightAccount.Order memory o = order(a, side, cents);
        GreenlightAccount.Proof memory p = signedProof(a, o, teeKey);
        vm.prank(agent);
        return a.trade(o, p);
    }

    /// Moves time past the scoring window and publishes a new price, which settles matured trades.
    function settleAt(int256 price) internal {
        vm.warp(block.timestamp + 10 minutes + 1);
        feed.set(price);
        relay();
    }

    // ------------------------------------------------ event topics

    function test_topicsMatchEventSelectors() public pure {
        assertEq(
            uint256(keccak256("AccountCreated(address,address,(uint64,uint64,uint64,uint32,uint16,uint16,uint8,uint8,uint64))")),
            uint256(IGreenlightAccountEvents.AccountCreated.selector)
        );
        assertEq(
            uint256(keccak256("TradeExecuted(uint64,uint8,uint64,uint256,uint64,bool,bool)")),
            uint256(IGreenlightAccountEvents.TradeExecuted.selector)
        );
        assertEq(
            uint256(keccak256("PolicySet(uint64,(uint64,uint64,uint64,uint32,uint16,uint16,uint8,uint8,uint64))")),
            uint256(IGreenlightAccountEvents.PolicySet.selector)
        );
        assertEq(uint256(keccak256("OwnerAction(uint64,bool)")), uint256(IGreenlightAccountEvents.OwnerAction.selector));
        assertEq(
            uint256(keccak256("ResyncRequested(uint64)")), uint256(IGreenlightAccountEvents.ResyncRequested.selector)
        );
        assertEq(uint256(keccak256("AnswerUpdated(int256,uint256,uint256)")), uint256(FeedStandIn.AnswerUpdated.selector));
    }

    // ------------------------------------------------ joining

    function test_newAccountIsLinkedAndSynced() public {
        GreenlightAccount a = open(policy());
        (address linkedOwner,,) = scorer.accountInfo(block.chainid, address(a));
        assertEq(linkedOwner, owner);
        assertTrue(sys.isSubscribed(block.chainid, address(a), uint256(IGreenlightAccountEvents.TradeExecuted.selector)));
        assertEq(a.appliedSeq(), 1);
        assertEq(a.limitCents(), 100_00);
        assertEq(scorer.bookOf(owner).limitCents, 100_00);
    }

    function test_rejectsInvalidPolicy() public {
        Policy memory p = policy();
        p.floorCents = p.startLimitCents + 1;
        vm.expectRevert();
        vm.prank(owner);
        factory.createAccount(agent, teeSigner, MODEL, p);
    }

    // ------------------------------------------------ trading

    function test_verifiedTradeWithinLimitRunsAtOnce() public {
        GreenlightAccount a = open(policy());
        assertTrue(agentTrade(a, 0, 40_00));
        assertEq(a.remainingToday(), 60_00);
        assertGt(venue.weth().balanceOf(address(a)), 0);
    }

    function test_unsignedTradeWaitsForOwner() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        GreenlightAccount.Proof memory none;
        vm.prank(agent);
        assertFalse(a.trade(o, none));
        assertEq(a.remainingToday(), 100_00);

        vm.prank(owner);
        a.approve(o.nonce);
        assertEq(a.remainingToday(), 90_00);
    }

    function test_wrongSignerOrEditedResponseIsNotVerified() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        GreenlightAccount.Proof memory p = signedProof(a, o, 0xBAD);
        assertFalse(a.isVerified(o, p));

        p = signedProof(a, o, teeKey);
        assertTrue(a.isVerified(o, p));
        p.response[3] = "X"; // any change to the response breaks the signature
        assertFalse(a.isVerified(o, p));

        p = signedProof(a, o, teeKey);
        o.amountCents += 1; // the order must be exactly what the model wrote
        assertFalse(a.isVerified(o, p));
    }

    function test_orderOnlyInTheModelsReasoningIsNotVerified() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        string memory text = a.orderText(o);
        bytes memory prefix = bytes(
            '{"id":"c","choices":[{"message":{"role":"assistant","content":"{\\"action\\":\\"hold\\",\\"order\\":\\"\\"}","reasoning_content":"maybe \\"'
        );
        GreenlightAccount.Proof memory p;
        p.response = bytes.concat(prefix, bytes(text), bytes('\\" but no"}}]}'));
        p.orderOffset = prefix.length;
        p.requestHash = sha256("request bytes");
        bytes memory signed = abi.encodePacked(MODEL, ":", hexOf(p.requestHash), ":", hexOf(sha256(p.response)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teeKey, MessageHashUtils.toEthSignedMessageHash(signed));
        p.signature = abi.encodePacked(r, s, v);
        assertFalse(a.isVerified(o, p));
    }

    function test_orderMustEndWhereTheAnswerEnds() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        GreenlightAccount.Proof memory p = signedProof(a, o, teeKey);
        assertTrue(a.isVerified(o, p));
        o.deadline = o.deadline / 10; // a shorter number would otherwise match the start of the real one
        assertFalse(a.isVerified(o, p));
    }

    function test_aZeroReferencePriceIsRefused() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 1, 1_00);
        o.refPriceCents = 0;
        GreenlightAccount.Proof memory none;
        vm.prank(agent);
        vm.expectRevert(GreenlightAccount.BadPrice.selector);
        a.trade(o, none);
        vm.expectRevert(GreenlightVenue.BadPrice.selector);
        venue.swap(1, 1e6, 0, 100);
    }

    function test_overLimitWaitsForOwner() public {
        GreenlightAccount a = open(policy());
        assertFalse(agentTrade(a, 0, 150_00));
        assertEq(a.remainingToday(), 100_00);
    }

    function test_dailyLimitResetsNextDay() public {
        GreenlightAccount a = open(policy());
        assertTrue(agentTrade(a, 0, 100_00));
        assertFalse(agentTrade(a, 0, 1_00));
        vm.warp(block.timestamp + 1 days);
        feed.set(1_678_00000000);
        assertTrue(agentTrade(a, 0, 1_00));
    }

    function test_onlyAgentTradesAndNoncesCannotRepeat() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        GreenlightAccount.Proof memory p = signedProof(a, o, teeKey);
        vm.expectRevert(GreenlightAccount.OnlyAgent.selector);
        a.trade(o, p);
        vm.prank(agent);
        a.trade(o, p);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(GreenlightAccount.BadNonce.selector, 1));
        a.trade(o, p);
    }

    function test_priceMoveBeyondSlippageIsRefused() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        GreenlightAccount.Proof memory p = signedProof(a, o, teeKey);
        feed.set(1_700_00000000); // +1.3%, policy allows 1%
        vm.prank(agent);
        vm.expectRevert();
        a.trade(o, p);
    }

    function test_stalePriceIsRefused() public {
        GreenlightAccount a = open(policy());
        vm.warp(block.timestamp + 2 hours);
        GreenlightAccount.Order memory o = order(a, 0, 10_00);
        GreenlightAccount.Proof memory p = signedProof(a, o, teeKey);
        vm.prank(agent);
        vm.expectRevert();
        a.trade(o, p);
    }

    // ------------------------------------------------ scoring

    function test_winningStreakRaisesTheLimit() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 20_00);
        agentTrade(a, 0, 20_00);
        relay();
        assertEq(scorer.queueLength(), 2);

        settleAt(1_700_00000000); // both buys are up
        assertEq(scorer.queueLength(), 0);
        assertEq(scorer.bookOf(owner).limitCents, 125_00);
        assertEq(a.limitCents(), 125_00);
        assertEq(a.appliedSeq(), 2);
    }

    function test_tradesAreNotJudgedBeforeTheirWindow() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 20_00);
        relay();
        vm.warp(block.timestamp + 5 minutes);
        feed.set(1_690_00000000);
        relay();
        assertEq(scorer.queueLength(), 1);
    }

    function test_sellWinsWhenPriceFalls() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 50_00); // buy some ether first
        relay();
        settleAt(1_670_00000000); // the buy loses
        assertEq(scorer.bookOf(owner).limitCents, 75_00);

        agentTrade(a, 1, 10_00);
        agentTrade(a, 1, 10_00);
        relay();
        settleAt(1_650_00000000); // both sells win
        assertEq(scorer.bookOf(owner).wins, 2);
        assertEq(a.limitCents(), 93_75);
    }

    function test_losingStreakCutsThenFreezes() public {
        GreenlightAccount a = open(policy());
        int256 price = 1_678_00000000;
        for (uint256 i; i < 3; ++i) {
            agentTrade(a, 0, 10_00);
            relay();
            price -= 5_00000000;
            settleAt(price);
        }
        assertTrue(a.frozen());
        assertEq(a.limitCents(), 42_19);

        GreenlightAccount.Order memory o = order(a, 0, 1_00);
        GreenlightAccount.Proof memory p = signedProof(a, o, teeKey);
        vm.prank(agent);
        vm.expectRevert(GreenlightAccount.Frozen.selector);
        a.trade(o, p);
    }

    function test_largeTotalLossFreezes() public {
        Policy memory pol = policy();
        pol.maxLossCents = 1_00;
        GreenlightAccount a = open(pol);
        agentTrade(a, 0, 100_00);
        relay();
        settleAt(1_660_00000000); // about -$1.07
        assertTrue(a.frozen());
        assertEq(scorer.bookOf(owner).lossStreak, 1);
    }

    function test_limitNeverPassesCeilingOrFloor() public {
        Policy memory pol = policy();
        pol.raiseAfterWins = 1;
        pol.ceilingCents = 110_00;
        GreenlightAccount a = open(pol);
        agentTrade(a, 0, 10_00);
        relay();
        settleAt(1_700_00000000);
        assertEq(a.limitCents(), 110_00);
    }

    // ------------------------------------------------ owner controls, across accounts

    function test_ownerFreezeReachesEveryAccount() public {
        GreenlightAccount a = open(policy());
        GreenlightAccount b = open(policy()); // the same owner's second account
        assertEq(b.appliedSeq(), 1);

        vm.prank(owner);
        a.freeze();
        relay();
        assertTrue(a.frozen());
        assertTrue(b.frozen());
        assertTrue(b.scorerFrozen());

        vm.prank(owner);
        a.unfreeze();
        relay();
        assertFalse(b.frozen());
        assertEq(b.limitCents(), 20_00); // restarts at the floor
        assertEq(a.limitCents(), 20_00);
    }

    function test_policyChangeReachesTheScorer() public {
        GreenlightAccount a = open(policy());
        Policy memory pol = policy();
        pol.startLimitCents = 60_00;
        pol.ceilingCents = 80_00;
        vm.prank(owner);
        a.setPolicy(pol);
        relay();
        assertEq(scorer.bookOf(owner).policy.ceilingCents, 80_00);
        assertEq(a.limitCents(), 80_00);
    }

    function test_scorerCannotLiftTheOwnersFreeze() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 20_00);
        agentTrade(a, 0, 20_00);
        vm.prank(owner);
        a.freeze();
        // the price update is processed before the owner's freeze reaches the scorer
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == IGreenlightAccountEvents.TradeExecuted.selector) {
                vm.prank(SYSTEM);
                scorer.react(toRecord(logs[i]));
            }
        }
        settleAt(1_700_00000000);
        assertTrue(a.frozen());
    }

    // ------------------------------------------------ delivery safety

    function test_repeatedEventsAndCallbacksChangeNothing() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 20_00);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] != IGreenlightAccountEvents.TradeExecuted.selector) continue;
            vm.startPrank(SYSTEM);
            scorer.react(toRecord(logs[i]));
            scorer.react(toRecord(logs[i]));
            vm.stopPrank();
        }
        assertEq(scorer.queueLength(), 1);

        // deliver the first update a second time
        ISystemContract.CallbackConfiguration_V_1_0 memory c = sys.callbackAt(0);
        proxy.deliver(address(scorer), c.recipient, c.payload);
        assertEq(a.appliedSeq(), 1);
    }

    function test_lostUpdateIsRecoveredByResync() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 20_00);
        agentTrade(a, 0, 20_00);
        relay();
        vm.warp(block.timestamp + 10 minutes + 1);
        vm.recordLogs();
        feed.set(1_700_00000000);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        vm.prank(SYSTEM);
        scorer.react(toRecord(logs[0]));
        delivered = sys.callbackCount(); // the update to the account is lost
        assertEq(a.limitCents(), 100_00);

        vm.recordLogs();
        vm.prank(makeAddr("anyone"));
        a.requestResync();
        relay();
        assertEq(a.limitCents(), 125_00);
    }

    function test_onlyTheScorerThroughTheProxyCanSync() public {
        GreenlightAccount a = open(policy());
        vm.expectRevert();
        a.sync(address(scorer), 99, 500_00, false, Reason.RESYNC);

        bytes memory forged = abi.encodeCall(a.sync, (address(0), 99, 500_00, false, Reason.RESYNC));
        assertFalse(proxy.deliver(makeAddr("other reactive contract"), address(a), forged));
        assertEq(a.limitCents(), 100_00);
    }

    function test_eventsFromUnknownContractsAreIgnored() public {
        open(policy());
        IReactive.LogRecord memory r;
        r.chainId = block.chainid;
        r.contractAddress = makeAddr("impostor");
        r.topic0 = uint256(IGreenlightAccountEvents.TradeExecuted.selector);
        r.topic1 = 7;
        r.data = abi.encode(uint8(0), uint64(1_00), uint256(1), uint64(block.timestamp), true, false);
        vm.prank(SYSTEM);
        scorer.react(r);
        assertEq(scorer.queueLength(), 0);

        vm.expectRevert();
        scorer.react(r); // only the system contract may call react
    }

    function test_settlementIsBoundedPerPriceUpdate() public {
        GreenlightAccount a = open(policy());
        for (uint256 i; i < 7; ++i) {
            agentTrade(a, 0, 5_00);
        }
        relay();
        settleAt(1_690_00000000);
        assertEq(scorer.queueLength(), 2);
        settleAt(1_690_00000000);
        assertEq(scorer.queueLength(), 0);
        assertEq(scorer.bookOf(owner).wins, 7);
    }


    // ------------------------------------------------ cost and fairness

    function openAs(address who, Policy memory p) internal returns (GreenlightAccount a) {
        vm.recordLogs();
        vm.prank(who);
        a = factory.createAccount(agent, teeSigner, MODEL, p);
        venue.faucet(address(a));
        relay();
    }

    function test_pricesAreFollowedOnlyWhileTradesWait() public {
        uint256 topic = uint256(keccak256("AnswerUpdated(int256,uint256,uint256)"));
        GreenlightAccount a = open(policy());
        assertFalse(sys.isSubscribed(block.chainid, address(feed), topic), "no trades, no price updates");
        agentTrade(a, 0, 10_00);
        relay();
        assertTrue(scorer.watchingPrice());
        assertTrue(sys.isSubscribed(block.chainid, address(feed), topic));
        settleAt(1_700_00000000);
        assertEq(scorer.queueLength(), 0);
        assertFalse(scorer.watchingPrice());
        assertFalse(sys.isSubscribed(block.chainid, address(feed), topic), "stops paying once the queue is empty");
    }

    function test_aLongWindowDoesNotHoldUpOtherOwners() public {
        Policy memory slow = policy();
        slow.scoreWindow = 7 days;
        GreenlightAccount patient = openAs(makeAddr("patient owner"), slow);
        GreenlightAccount a = open(policy());
        agentTrade(patient, 0, 10_00);
        agentTrade(a, 0, 10_00);
        agentTrade(a, 0, 10_00);
        relay();
        settleAt(1_700_00000000);
        assertEq(scorer.bookOf(owner).wins, 2, "the quick owner's trades are judged");
        assertEq(scorer.queueLength(), 1, "only the week-long trade still waits");
        assertTrue(scorer.watchingPrice());
    }

    function test_accountsPerOwnerAreCapped() public {
        for (uint256 i; i < 5; ++i) open(policy());
        assertEq(scorer.accountsOf(owner).length, 4);
    }

    function test_operatorCanRecoverUnusedFunds() public {
        vm.deal(address(scorer), 1 ether);
        address payable to = payable(makeAddr("treasury"));
        scorer.withdraw(to, 0.4 ether);
        assertEq(to.balance, 0.4 ether);
        vm.prank(owner);
        vm.expectRevert();
        scorer.withdraw(to, 0.1 ether);
    }

    function test_changingTheFeedResetsItsClock() public {
        GreenlightAccount a = open(policy());
        agentTrade(a, 0, 10_00);
        relay();
        settleAt(1_700_00000000);
        assertGt(scorer.lastPriceAt(), 0);
        scorer.setPriceFeed(block.chainid, address(feed));
        assertEq(scorer.lastPriceAt(), 0);
    }

    // ------------------------------------------------ a real NEAR AI Cloud response

    /// A decision returned and signed by NEAR AI Cloud's TEE (Qwen/Qwen3.8-27B), recorded byte for byte.
    function test_realSignedModelResponseVerifiesOnChain() public {
        string memory json = vm.readFile("test/fixtures/near-decision.json");
        address signer = vm.parseJsonAddress(json, ".signingAddress");
        string memory model = vm.parseJsonString(json, ".model");

        vm.prank(owner);
        GreenlightAccount a = factory.createAccount(agent, signer, model, policy());

        GreenlightAccount.Order memory o = GreenlightAccount.Order({
            side: uint8(vm.parseJsonUint(json, ".order.side")),
            amountCents: uint64(vm.parseJsonUint(json, ".order.amountCents")),
            refPriceCents: uint64(vm.parseJsonUint(json, ".order.refPriceCents")),
            nonce: uint64(vm.parseJsonUint(json, ".order.nonce")),
            deadline: uint64(vm.parseJsonUint(json, ".order.deadline"))
        });
        GreenlightAccount.Proof memory p = GreenlightAccount.Proof({
            requestHash: vm.parseJsonBytes32(json, ".requestHash"),
            response: vm.parseJsonBytes(json, ".response"),
            orderOffset: vm.parseJsonUint(json, ".orderOffset"),
            signature: vm.parseJsonBytes(json, ".signature")
        });
        assertTrue(a.isVerified(o, p), "real response should verify");

        o.amountCents = 5_000; // the model chose $25.00, not $50.00
        assertFalse(a.isVerified(o, p));
        o.amountCents = uint64(vm.parseJsonUint(json, ".order.amountCents"));

        vm.prank(owner);
        a.setSigner(makeAddr("some other enclave"), model);
        assertFalse(a.isVerified(o, p), "only the attested signer counts");
    }
}
