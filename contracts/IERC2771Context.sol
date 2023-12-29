// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/metatx/ERC2771Context.sol
// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.1) (metatx/ERC2771Context.sol)
pragma solidity ^0.8.20;

interface IERC2771Context {
    function isTrustedForwarder(address forwarder) external view returns (bool);
}