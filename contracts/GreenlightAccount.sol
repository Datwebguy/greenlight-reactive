// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { AbstractCallback } from "@reactive/src/base/AbstractCallback.sol";
import { GreenlightVenue } from "./GreenlightVenue.sol";
import { Policy, PolicyRules, Reason, IGreenlightAccountEvents, IGreenlightSync } from "./GreenlightTypes.sol";

/// @title Greenlight account
/// @notice Holds the owner's funds on one chain. The AI agent can trade within its daily limit; the limit itself
/// is set by the Greenlight scorer on Reactive Network, based on how the agent's past trades turned out.
contract GreenlightAccount is AbstractCallback, IGreenlightAccountEvents, IGreenlightSync {
    using SafeERC20 for IERC20;

    error OnlyOwner();
    error OnlyAgent();
    error Frozen();
    error BadNonce(uint64 expected);
    error Expired();
    error ZeroAmount();
    error UnknownRequest();
    error BadSide();
    error BadPrice();

    /// @notice A trade the agent wants to make. `refPriceCents` is the ETH price the decision was based on.
    struct Order {
        uint8 side; // 0 buy ether with dollars, 1 sell ether for dollars
        uint64 amountCents;
        uint64 refPriceCents;
        uint64 nonce;
        uint64 deadline;
    }

    /// @notice The AI's signed reply. `orderOffset` is where the order text sits inside `response`.
    struct Proof {
        bytes32 requestHash; // sha256 of the exact request bytes sent to the model
        bytes response; // exact response bytes returned by the model
        uint256 orderOffset;
        bytes signature; // empty when no signed decision is available
    }

    struct Request {
        Order order;
        bool verified;
        bool open;
    }

    event ApprovalRequested(uint64 indexed id, Order order, bool verified, bool overLimit);
    event RequestResolved(uint64 indexed id, bool approved);
    event Synced(uint64 indexed seq, uint64 limitCents, bool frozen, uint8 reason);
    event SyncIgnored(uint64 indexed seq, uint64 appliedSeq);
    event AgentChanged(address agent);
    event SignerChanged(address signer, string modelId);
    event PositionClosed(uint256 ethSold, uint256 usdReceived, uint256 price);
    event AccountClosed(address to, uint256 usd, uint256 eth, uint256 gas);

    address public immutable owner;
    GreenlightVenue public immutable venue;
    IERC20 public immutable usd;
    IERC20 public immutable weth;
    uint256 private immutable _priceScale; // converts cents to feed decimals

    address public agent;
    address public teeSigner;
    string public modelId;

    Policy public policy;
    uint64 public policyVersion;

    uint64 public limitCents;
    bool public ownerFrozen; // set and cleared only by the owner
    bool public scorerFrozen; // set by the scorer after a losing streak or too large a loss
    uint64 public appliedSeq;
    uint64 public ownerActions;

    uint64 public nextNonce;
    uint64 public spentDay;
    uint64 public spentCents;

    mapping(uint64 => Request) public requests;

    modifier onlyOwner() {
        if (msg.sender != owner && msg.sender != address(this)) revert OnlyOwner();
        _;
    }

    constructor(
        IPayable callbackProxy_,
        address scorer_,
        address owner_,
        address agent_,
        address teeSigner_,
        string memory modelId_,
        GreenlightVenue venue_,
        Policy memory policy_
    ) payable AbstractCallback(callbackProxy_, scorer_) {
        PolicyRules.check(policy_);
        owner = owner_;
        agent = agent_;
        teeSigner = teeSigner_;
        modelId = modelId_;
        venue = venue_;
        usd = IERC20(address(venue_.usd()));
        weth = IERC20(address(venue_.weth()));
        _priceScale = 10 ** (venue_.feedDecimals() - 2);
        policy = policy_;
        policyVersion = 1;
        limitCents = policy_.startLimitCents;
    }

    // ------------------------------------------------------------------ agent

    /// @notice Make a trade. A trade with a valid signed decision that fits the daily limit runs at once;
    /// anything else waits for the owner.
    function trade(Order calldata order, Proof calldata proof) external returns (bool executed) {
        if (msg.sender != agent) revert OnlyAgent();
        if (frozen()) revert Frozen();
        if (order.side > 1) revert BadSide();
        if (order.refPriceCents == 0) revert BadPrice();
        if (order.nonce != nextNonce) revert BadNonce(nextNonce);
        if (order.deadline < block.timestamp) revert Expired();
        if (order.amountCents == 0) revert ZeroAmount();
        nextNonce = order.nonce + 1;

        bool verified = proof.signature.length != 0 && isVerified(order, proof);
        bool fits = order.amountCents <= remainingToday();
        if (verified && fits) {
            _execute(order, true, false);
            return true;
        }
        requests[order.nonce] = Request(order, verified, true);
        emit ApprovalRequested(order.nonce, order, verified, !fits);
        return false;
    }

    /// @notice True when `proof` is a response signed by the attested model and contains exactly this order.
    function isVerified(Order calldata order, Proof calldata proof) public view returns (bool) {
        bytes memory text = bytes(orderText(order));
        bytes calldata response = proof.response;
        uint256 start = proof.orderOffset;
        if (start < 2 || start > response.length || text.length >= response.length - start) return false;
        uint256 end = start + text.length;
        // The order must be a whole JSON string value of its own inside the answer: opened by \" and closed by \".
        if (response[start - 2] != 0x5c || response[start - 1] != 0x22 || response[end] != 0x5c) return false;
        if (keccak256(response[start:end]) != keccak256(text)) return false;
        // It must sit in the model's final answer, not in its reasoning, which follows the answer.
        if (!_contains(response[:start], '"content":"') || _contains(response[:start], '"reasoning')) {
            return false;
        }
        bytes memory signed = abi.encodePacked(
            modelId,
            ":",
            _hex(proof.requestHash),
            ":",
            _hex(sha256(proof.response))
        );
        (address signer, ECDSA.RecoverError err,) =
            ECDSA.tryRecover(MessageHashUtils.toEthSignedMessageHash(signed), proof.signature);
        return err == ECDSA.RecoverError.NoError && signer == teeSigner && signer != address(0);
    }

    /// @notice The exact text the model must write for this order. It names the chain and this account, so a decision
    /// made for one account can never be used on another: `GL2:84532:0xabc…:buy:2500:167812:7:1763700000`.
    function orderText(Order calldata order) public view returns (string memory) {
        return string.concat(
            "GL2:",
            Strings.toString(block.chainid),
            ":",
            Strings.toHexString(address(this)),
            ":",
            order.side == 0 ? "buy" : "sell",
            ":",
            Strings.toString(order.amountCents),
            ":",
            Strings.toString(order.refPriceCents),
            ":",
            Strings.toString(order.nonce),
            ":",
            Strings.toString(order.deadline)
        );
    }

    // ------------------------------------------------------------------ owner

    function approve(uint64 id) external onlyOwner {
        Request storage r = requests[id];
        if (!r.open) revert UnknownRequest();
        if (r.order.deadline < block.timestamp) revert Expired();
        r.open = false;
        emit RequestResolved(id, true);
        _execute(r.order, r.verified, true);
    }

    function reject(uint64 id) external onlyOwner {
        Request storage r = requests[id];
        if (!r.open) revert UnknownRequest();
        r.open = false;
        emit RequestResolved(id, false);
    }

    /// @notice Stop the agent everywhere. The scorer passes this on to the owner's accounts on other chains.
    function freeze() external onlyOwner {
        ownerFrozen = true;
        emit OwnerAction(++ownerActions, true);
    }

    /// @notice Let the agent trade again. The scorer restarts it at the floor limit on every chain.
    function unfreeze() external onlyOwner {
        ownerFrozen = false;
        scorerFrozen = false;
        if (limitCents > policy.floorCents) limitCents = policy.floorCents;
        emit OwnerAction(++ownerActions, false);
    }

    function setPolicy(Policy calldata policy_) external onlyOwner {
        PolicyRules.check(policy_);
        policy = policy_;
        if (limitCents > policy_.ceilingCents) limitCents = policy_.ceilingCents;
        if (limitCents < policy_.floorCents) limitCents = policy_.floorCents;
        emit PolicySet(++policyVersion, policy_);
    }

    function setAgent(address agent_) external onlyOwner {
        agent = agent_;
        emit AgentChanged(agent_);
    }

    function setSigner(address teeSigner_, string calldata modelId_) external onlyOwner {
        teeSigner = teeSigner_;
        modelId = modelId_;
        emit SignerChanged(teeSigner_, modelId_);
    }

    function withdraw(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    /// @notice Sell all the ETH the account holds back to dollars at the live price.
    function closePosition() public onlyOwner returns (uint256 usdOut) {
        uint256 eth = weth.balanceOf(address(this));
        if (eth == 0) return 0;
        (uint256 p,) = venue.price();
        usdOut = eth * p / (1e12 * _priceScale * 100);
        if (usdOut == 0) return 0;
        (uint256 fill, uint256 ethIn) = venue.swap(1, usdOut, p, 0);
        emit PositionClosed(ethIn, usdOut, fill);
    }

    /// @notice Leave in one step: stop the agent on every chain, take away its permission to trade, sell back to
    /// dollars if the price is available, and send everything to `to`.
    function closeAccount(address payable to) external onlyOwner {
        if (!ownerFrozen) {
            ownerFrozen = true;
            emit OwnerAction(++ownerActions, true);
        }
        agent = address(0);
        emit AgentChanged(address(0));
        // Selling back needs a fresh price; without one, the ETH is withdrawn as it is.
        try this.closePosition() { } catch { }
        uint256 u = usd.balanceOf(address(this));
        if (u > 0) usd.safeTransfer(to, u);
        uint256 w = weth.balanceOf(address(this));
        if (w > 0) weth.safeTransfer(to, w);
        uint256 n = address(this).balance;
        if (n > 0) _pay(to, n);
        emit AccountClosed(to, u, w, n);
    }

    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        _pay(to, amount);
    }

    // ------------------------------------------------------------------ Reactive Network

    /// @inheritdoc IGreenlightSync
    /// @dev Delivered by the callback proxy. Applies only newer updates, so a repeated delivery changes nothing.
    function sync(address rc, uint64 seq, uint64 limitCents_, bool frozen_, uint8 reason)
        external
        onlyServiceProvider
        onlyCallbackSender(rc)
    {
        if (seq <= appliedSeq) {
            emit SyncIgnored(seq, appliedSeq);
            return;
        }
        appliedSeq = seq;
        // The scorer already keeps the limit inside the owner's range; the account checks again.
        uint64 cap = policy.ceilingCents;
        uint64 floor_ = policy.floorCents;
        limitCents = limitCents_ > cap ? cap : limitCents_ < floor_ ? floor_ : limitCents_;
        scorerFrozen = frozen_;
        emit Synced(seq, limitCents, frozen_, reason);
    }

    /// @notice Anyone can ask the scorer to resend the latest limit, for example if a delivery failed.
    function requestResync() external {
        emit ResyncRequested(appliedSeq);
    }

    // ------------------------------------------------------------------ views

    /// @notice True while the agent may not trade.
    function frozen() public view returns (bool) {
        return ownerFrozen || scorerFrozen;
    }

    function remainingToday() public view returns (uint64) {
        uint64 spent = spentDay == _today() ? spentCents : 0;
        return spent >= limitCents ? 0 : limitCents - spent;
    }

    // ------------------------------------------------------------------ internal

    function _execute(Order memory order, bool verified, bool ownerApproved) private {
        uint64 day = _today();
        if (spentDay != day) {
            spentDay = day;
            spentCents = 0;
        }
        spentCents += order.amountCents;
        (uint256 price,) = venue.swap(
            order.side, uint256(order.amountCents) * 1e4, uint256(order.refPriceCents) * _priceScale, policy.maxSlippageBps
        );
        emit TradeExecuted(
            order.nonce, order.side, order.amountCents, price, uint64(block.timestamp), verified, ownerApproved
        );
    }

    function _today() private view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    /// @dev True when `needle` (at most 32 bytes) occurs in `haystack`.
    function _contains(bytes calldata haystack, bytes memory needle) private pure returns (bool found) {
        uint256 n = needle.length;
        if (n == 0 || n > 32 || haystack.length < n) return n == 0;
        bytes32 want;
        assembly {
            want := mload(add(needle, 32))
        }
        bytes32 mask = ~bytes32(type(uint256).max >> (n * 8));
        want &= mask;
        uint256 last = haystack.length - n;
        for (uint256 i; i <= last; ++i) {
            bytes32 word;
            assembly {
                word := calldataload(add(haystack.offset, i))
            }
            if (word & mask == want) return true;
        }
    }

    function _hex(bytes32 value) private pure returns (bytes memory out) {
        bytes16 digits = "0123456789abcdef";
        out = new bytes(64);
        for (uint256 i; i < 32; ++i) {
            out[2 * i] = digits[uint8(value[i]) >> 4];
            out[2 * i + 1] = digits[uint8(value[i]) & 0x0f];
        }
    }
}
