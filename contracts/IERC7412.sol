// SPDX-License-Identifier: MIT
pragma solidity ^0.4.24;

interface IERC7412 {
  function oracleId() view external returns (bytes32 oracleId);
  function fulfillOracleData(bytes oracleQuery, bytes signedOffchainData) payable external;
}
