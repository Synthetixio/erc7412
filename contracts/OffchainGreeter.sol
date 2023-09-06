// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC7412.sol";

contract OffchainGreeter is IERC7412 {
	string[] greetings;

	uint constant FEE = 1 ether / 100;

	function greet(uint greetingCount) public view returns (string memory) {
        if (greetingCount > greetings.length || greetingCount == 0) {
            revert IERC7412.OracleDataRequired(address(this), abi.encodePacked(greetings.length + 1));
        }

        return greetings[greetingCount - 1];
	}

	function oracleId() pure external returns (bytes32) {
		return "TEST";
	}
	
	function fulfillOracleQuery(bytes calldata signedOffchainData) payable external {
		// charge a fee for the oracle service
		if (msg.value < FEE) {
			revert FeeRequired(FEE);
		}

		// this greeter doesn't care about security so we just push the data
		// a real oracle contract would carve off and verify a bunch of signatures
		greetings.push(abi.decode(signedOffchainData, (string)));
	}
}