import viem from "viem";

import IERC7412 from '../out/IERC7412.sol/IERC7412.json';

export class Augment7412Converter {
	providers: Map<string, string>;

	constructor(providers: Map<string, string>) {
		this.providers = providers;
	}

	function augment7412(
		client: viem.PublicClient,
		tx: viem.Transaction,
		multicallFunc: (txs: viem.Transaction[]) => viem.Transaction,
	): viem.Transaction {
		let multicallCalls = [tx];
		while (true) {
			try {
				const multicallTxn = multicallFunc(multicallCalls);
				const simulationResult = await client.call(multicallTxn);
				return multicallTxn;
			} catch (error) {
				const err = viem.decodeErrorResult(error);
				if (err.errorName === "OracleDataRequired") {
					const signedRequiredData = fetchOffchainData(err.args[0], err.args[1]);
					multicallCalls.unshift(dataVerificationTx);
				} else {
					throw error;
				}
			}
		}
	}

	function fetchOffchainData(client: viem.PublicClient, requester: viem.Address, data: viem.Bytes): viem.Bytes {
		const oracleProvider = viem.hexToString(await client.readContract({
			abi: IERC7412.abi,
			address: requester,
			functionName: "oracleId",
			args: []
		}));

		const url = this.providers.get(oracleProvider);

		if (url === undefined) {
			throw new Error("oracle provider not supported");
		}
		this.fetch(url, data);
	}

	function fetch(url: string, data: viem.Bytes): viem.Bytes {

	}	
}
