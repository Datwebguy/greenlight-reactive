// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IAggregatorV3 } from "./GreenlightTypes.sol";

/// @notice Test token whose supply is controlled by the venue that created it.
contract VenueToken is ERC20 {
    error OnlyVenue();

    address public immutable venue;
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        venue = msg.sender;
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != venue) revert OnlyVenue();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != venue) revert OnlyVenue();
        _burn(from, amount);
    }
}

/// @notice Fills ETH/USD trades at the live Chainlink price. Test dollars and test ether only.
contract GreenlightVenue {
    error StalePrice(uint256 updatedAt);
    error BadPrice();
    error PriceMoved(uint256 price, uint256 refPrice);
    error ZeroAmount();
    error FaucetTooSoon(uint256 nextAt);

    event Swapped(
        address indexed trader, uint8 side, uint256 usdAmount, uint256 ethAmount, uint256 price, uint256 updatedAt
    );
    event FaucetUsed(address indexed to, uint256 amount);

    uint8 public constant BUY = 0; // pay dollars, receive ether
    uint8 public constant SELL = 1; // pay ether, receive dollars

    IAggregatorV3 public immutable feed;
    uint8 public immutable feedDecimals;
    uint256 public immutable maxPriceAge;
    uint256 public immutable faucetAmount;
    VenueToken public immutable usd;
    VenueToken public immutable weth;

    mapping(address => uint256) public lastFaucet;

    constructor(IAggregatorV3 feed_, uint256 maxPriceAge_, uint256 faucetAmount_) {
        feed = feed_;
        feedDecimals = feed_.decimals();
        maxPriceAge = maxPriceAge_;
        faucetAmount = faucetAmount_;
        usd = new VenueToken("Greenlight Test Dollar", "tUSD", 6);
        weth = new VenueToken("Greenlight Test Ether", "tETH", 18);
    }

    /// @notice Latest price, rejected if it is older than `maxPriceAge`.
    function price() public view returns (uint256 answer, uint256 updatedAt) {
        (, int256 a,, uint256 u,) = feed.latestRoundData();
        if (a <= 0) revert BadPrice();
        if (block.timestamp > u + maxPriceAge) revert StalePrice(u);
        return (uint256(a), u);
    }

    /// @notice Trade `usdAmount` (6 decimals) worth of ether at the live price.
    /// @param refPrice Price the decision was made at, in feed decimals.
    /// @param maxSlippageBps Largest adverse move from `refPrice` that is accepted.
    function swap(uint8 side, uint256 usdAmount, uint256 refPrice, uint16 maxSlippageBps)
        external
        returns (uint256 fillPrice, uint256 ethAmount)
    {
        if (usdAmount == 0) revert ZeroAmount();
        if (refPrice == 0) revert BadPrice(); // a zero reference would switch off the price-move check
        uint256 updatedAt;
        (fillPrice, updatedAt) = price();
        // ether (18 decimals) = dollars (6 decimals) * 10^12 * 10^feedDecimals / price
        ethAmount = usdAmount * 1e12 * (10 ** feedDecimals) / fillPrice;
        if (ethAmount == 0) revert ZeroAmount();
        if (side == BUY) {
            if (fillPrice * 10_000 > refPrice * (10_000 + maxSlippageBps)) revert PriceMoved(fillPrice, refPrice);
            usd.burn(msg.sender, usdAmount);
            weth.mint(msg.sender, ethAmount);
        } else {
            if (fillPrice * 10_000 < refPrice * (10_000 - maxSlippageBps)) revert PriceMoved(fillPrice, refPrice);
            weth.burn(msg.sender, ethAmount);
            usd.mint(msg.sender, usdAmount);
        }
        emit Swapped(msg.sender, side, usdAmount, ethAmount, fillPrice, updatedAt);
    }

    /// @notice Test dollars for anyone, once a day per address.
    function faucet(address to) external {
        uint256 next = lastFaucet[to] + 1 days;
        if (lastFaucet[to] != 0 && block.timestamp < next) revert FaucetTooSoon(next);
        lastFaucet[to] = block.timestamp;
        usd.mint(to, faucetAmount);
        emit FaucetUsed(to, faucetAmount);
    }
}
