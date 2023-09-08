import eip7412 from "../dist/src/index.js";
import { PythAdapter } from "../dist/src/adapters/pyth.js";

import { ethers } from "ethers";

import * as viem from "viem";
import { baseGoerli } from "viem/chains";

const Multicall3ABI = [
	{
		inputs: [
			{
				components: [
					{
						internalType: "address",
						name: "target",
						type: "address",
					},
					{
						internalType: "bool",
						name: "allowFailure",
						type: "bool",
					},
					{
						internalType: "uint256",
						name: "value",
						type: "uint256",
					},
					{
						internalType: "bytes",
						name: "callData",
						type: "bytes",
					},
				],
				internalType: "struct Multicall3.Call3Value[]",
				name: "calls",
				type: "tuple[]",
			},
		],
		name: "aggregate3Value",
		outputs: [
			{
				components: [
					{
						internalType: "bool",
						name: "success",
						type: "bool",
					},
					{
						internalType: "bytes",
						name: "returnData",
						type: "bytes",
					},
				],
				internalType: "struct Multicall3.Result[]",
				name: "returnData",
				type: "tuple[]",
			},
		],
		stateMutability: "payable",
		type: "function",
	},
];

const MulticallThroughAbi = [
	{
		inputs: [
			{
				internalType: "address[]",
				name: "to",
				type: "address[]",
			},
			{
				internalType: "bytes[]",
				name: "data",
				type: "bytes[]",
			},
			{
				internalType: "uint256[]",
				name: "values",
				type: "uint256[]",
			},
		],
		name: "multicallThrough",
		outputs: [
			{
				internalType: "bytes[]",
				name: "results",
				type: "bytes[]",
			},
		],
		stateMutability: "payable",
		type: "function",
	},
];

// make an ethers provider like we would have in the browser
const provider = new ethers.providers.JsonRpcProvider("https://goerli.base.org");

async function generate7412CompatibleCall(client, multicallFunc, txn) {
	const adapters = [];

	// NOTE: add other providers here as needed
	adapters.push(new PythAdapter("https://xc-testnet.pyth.network/"));

	const converter = new eip7412.EIP7412(adapters, multicallFunc);

	return await converter.enableERC7412(client, txn);
}

export async function hookForReadCall(txn) {
	const viemClient = viem.createPublicClient({
		chain: baseGoerli,
		// NOTE: this can also be `custom(window.ethereum)` if preferred
		transport: viem.custom({
			request: ({ method, params }) => {
				return provider.send(method, params);
			},
		}),
	});
	const multicall3Addr = "0xa0266eE94Bff06D8b07e7b672489F21d2E05636e";
	const multicallFunc = function makeMulticall3Call(calls) {
		const ret = viem.encodeFunctionData({
			abi: Multicall3ABI,
			functionName: "aggregate3Value",
			args: [
				calls.map((call) => ({
					target: call.to,
					callData: call.data,
					value: call.value || 0n,
					allowFailure: false,
				})),
			],
		});

		let totalValue = 0n;
		for (const call of calls) {
			totalValue += call.value || 0n;
		}

		return {
			account: txn.from || txn.account,
			to: multicall3Addr,
			data: ret,
			value: totalValue.toString(),
		};
	};

	// NOTE: pyth TransactionRequest is basically compatible with ethers TransactionRequest so we can just cast it
	return generate7412CompatibleCall(viemClient, multicallFunc, txn);
}

export async function hookForWriteCall(txn) {
	const viemClient = viem.createPublicClient({
		chain: baseGoerli,
		transport: viem.custom({
			request: ({ method, params }) => {
				return provider.send(method, params);
			},
		}),
	});
	const multicallFunc = function makeMulticallThroughCall(calls) {
		const ret = viem.encodeFunctionData({
			abi: MulticallThroughAbi,
			functionName: "multicallThrough",
			args: [calls.map((c) => c.to), calls.map((c) => c.data), calls.map((c) => c.value)],
		});

		let totalValue = 0n;
		for (const call of calls) {
			totalValue += call.value || 0n;
		}

		return {
			account: txn.from || txn.account,
			to: txn.to,
			data: ret,
			value: totalValue.toString(),
		};
	};

	return generate7412CompatibleCall(viemClient, multicallFunc, txn);
}

(async () => {
	// example call
	const call = await hookForReadCall({
		to: "0x9863Dae3f4b5F4Ffe3A841a21565d57F2BA10E87", // perps competition market address
		data: "0x41c2e8bd0000000000000000000000000000000000000000000000000000000000000064", // call to `computeFee` on the above contract. triggers a OracleDataRequired.
	});

	console.log(await provider.call(call));
})();
