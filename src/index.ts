import * as viem from "viem";

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
				//console.log("GOT ERROR DETAILS", JSON.stringify(error, null, 2));
				const err = viem.decodeErrorResult({
					abi: IERC7412.abi,
					data: ((error as viem.CallExecutionError).cause as any).cause.error.data as viem.Hex,
				});
				if (err.errorName === "OracleDataRequired") {
					const oracleRequestData = err.args![1] as viem.Hex;
					const signedRequiredData = await this.fetchOffchainData(
						client,
						err.args![0] as viem.Address,
						oracleRequestData,
					);
					multicallCalls.unshift({
						to: err.args![0] as viem.Address,
						data: viem.encodeFunctionData({
							abi: IERC7412.abi,
							functionName: "fulfillOracleData",
							args: [oracleRequestData, signedRequiredData],
						}),
					});
				} else if (err.errorName === "OracleFeeRequired") {
					const requiredFee = err.args![0] as bigint;
					multicallCalls[0].value = requiredFee;
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
			viem.trim(
				(await client.readContract({
					abi: IERC7412.abi,
					address: requester,
					functionName: "oracleId",
					args: [],
				})) as unknown as viem.Hex,
				{ dir: "right" },
			),
		);

		const url = this.providers.get(oracleProvider);

		if (url === undefined) {
			throw new Error(
				`oracle provider ${oracleProvider} not supported (supported providers: ${Array.from(
					this.providers.keys(),
				).join(",")})`,
			);
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
		return (await response.text()) as viem.Hex;
	}
}
