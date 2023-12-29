// https://github.com/bcnmy/scw-contracts/blob/main/contracts/smart-account/SmartAccount.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface ISmartAccount {
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata value,
        bytes[] calldata func
    ) external;
}