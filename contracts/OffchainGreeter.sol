// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC7412.sol";

contract OffchainGreeter is IERC7412 {
		string[] greetings;

		uint constant FEE = 1 ether / 100;

		function greet(uint greetingCount) public returns (string[] memory) {
				if (greetings.length < greetingCount) {
						revert IERC7412.OracleDataRequired(address(this), abi.encodePacked(greetingCount));
				}

				string[] memory result = new string[](greetingCount);
				for (uint i = 0; i < greetingCount; i++) {
						result[i] = greetings[greetings.length - greetingCount + i];
				}

				while(greetings.length > 0) {
					greetings.pop();
				}

				return result;
		}

		function oracleId() pure external returns (bytes32) {
				return "TEST";
		}
		
		function fulfillOracleData(bytes calldata, bytes calldata signedOffchainData) payable external {
				
				// charge a fee for the oracle service
				if (msg.value < FEE) {
						revert OracleFeeRequired(FEE);
				}

				// this greeter doesn't care about security so we just push the data
				// a real oracle contract would carve off and verify a bunch of signatures
				greetings.push(abi.decode(signedOffchainData, (string)));
		}
}
