import viem from "viem";

import fetch from "node-fetch";

import IERC7412 from "../out/IERC7412.sol/IERC7412.json";

type TransactionRequest = Pick<viem.TransactionRequest, "to" | "data" | "value">;

export class EIP7412 {
	providers: Map<string, string>;
	multicallFunc: (txs: TransactionRequest[]) => TransactionRequest;

	constructor(
		providers: Map<string, string>,
		multicallFunc: (txs: TransactionRequest[]) => TransactionRequest,
	) {
		this.providers = providers;
		this.multicallFunc = multicallFunc;
	}

	async wrap(client: viem.PublicClient, tx: TransactionRequest): Promise<TransactionRequest> {
		let multicallCalls: TransactionRequest[] = [tx];
		while (true) {
			try {
				const multicallTxn = this.multicallFunc(multicallCalls);
				await client.call(multicallTxn);
				return multicallTxn;
			} catch (error) {
				console.log("GOT ERROR DETAILS", error);
				const err = viem.decodeErrorResult({
					abi: IERC7412.abi,
					data: (error as viem.RpcError).details as viem.Hex,
				});
				if (err.errorName === "OracleDataRequired") {
					const signedRequiredData = await this.fetchOffchainData(
						client,
						err.args![0] as viem.Address,
						err.args![1] as viem.Hex,
					);
					multicallCalls.unshift({
						to: err.args![0] as viem.Address,
						data: signedRequiredData,
					});
				} else {
					throw error;
				}
			}
		}
	}

	async fetchOffchainData(
		client: viem.PublicClient,
		requester: viem.Address,
		data: viem.Hex,
	): Promise<viem.Hex> {
		const oracleProvider = viem.hexToString(
			(await client.readContract({
				abi: IERC7412.abi,
				address: requester,
				functionName: "oracleId",
				args: [],
			})) as unknown as viem.Hex,
		);

		const url = this.providers.get(oracleProvider);

		if (url === undefined) {
			throw new Error("oracle provider not supported");
		}
		return this.fetch(url, data);
	}

	async fetch(url: string, data: viem.Hex): Promise<viem.Hex> {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": data.length.toString(),
			},
			body: data,
		});
		if (response.status !== 200) {
			throw new Error("error fetching data");
		}
		return (await response.json()).result;
	}
}
