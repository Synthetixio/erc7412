// https://github.com/Synthetixio/synthetix-v3/blob/main/auxiliary/TrustedMulticallForwarder/src/TrustedMulticallForwarder.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ITrustedMulticallForwarder {
    struct Call3 {
        address target;
        bool requireSuccess;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(
        Call3[] calldata calls
    ) external payable returns (Result[] memory returnData);
}
