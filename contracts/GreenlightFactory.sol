// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import { IPayable } from "@reactive/src/interfaces/IPayable.sol";
import { GreenlightAccount } from "./GreenlightAccount.sol";
import { GreenlightVenue } from "./GreenlightVenue.sol";
import { Policy, IGreenlightAccountEvents } from "./GreenlightTypes.sol";

/// @notice Opens Greenlight accounts on one chain. The scorer watches this contract to learn about new accounts.
contract GreenlightFactory is IGreenlightAccountEvents {
    IPayable public immutable callbackProxy;
    address public immutable scorer;
    GreenlightVenue public immutable venue;

    mapping(address => address[]) private _accountsOf;

    constructor(IPayable callbackProxy_, address scorer_, GreenlightVenue venue_) {
        callbackProxy = callbackProxy_;
        scorer = scorer_;
        venue = venue_;
    }

    /// @notice Open an account owned by the caller. Any ether sent pays for the scorer's updates on this chain.
    function createAccount(address agent, address teeSigner, string calldata modelId, Policy calldata policy)
        external
        payable
        returns (GreenlightAccount account)
    {
        account = new GreenlightAccount{ value: msg.value }(
            callbackProxy, scorer, msg.sender, agent, teeSigner, modelId, venue, policy
        );
        _accountsOf[msg.sender].push(address(account));
        emit AccountCreated(msg.sender, address(account), policy);
    }

    function accountsOf(address owner) external view returns (address[] memory) {
        return _accountsOf[owner];
    }
}
