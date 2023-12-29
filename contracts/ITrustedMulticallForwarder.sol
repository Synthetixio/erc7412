// https://github.com/Synthetixio/synthetix-v3/blob/main/auxiliary/TrustedMulticallForwarder/src/TrustedMulticallForwarder.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ITrustedMulticallForwarder {
    struct Call3Value {
        address target;
        bool requireSuccess;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3Value(
        Call3Value[] calldata calls
    ) public payable returns (Result[] memory returnData);
}