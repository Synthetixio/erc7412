import eip7412 from "../dist/src/index.js";
import { WormholeAdapter } from "../dist/src/adapters/wormhole.js";

import { ethers } from "ethers";

import * as viem from "viem";
import { polygonMumbai } from "viem/chains";

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
const provider = new ethers.providers.JsonRpcProvider("https://polygon-mumbai-bor.publicnode.com");
//const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

async function generate7412CompatibleCall(client, multicallFunc, txn) {
	const adapters = [];

	// NOTE: add other providers here as needed
	adapters.push(new WormholeAdapter("ca61424a-c2a7-4901-ac62-70c44296cb15"));

	const converter = new eip7412.EIP7412(adapters, multicallFunc);

	return await converter.enableERC7412(client, txn);
}

export async function hookForReadCall(txn) {
	const viemClient = viem.createPublicClient({
		chain: polygonMumbai,
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
		chain: polygonMumbai,
		transport: viem.custom({
			request: ({ method, params }) => {
				return provider.send(method, params);
			},
		}),
	});
	const multicall3Addr = "0xcA11bde05977b3631167028862bE2a173976CA11";
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

		console.log("total value", totalValue);

		return {
			account: txn.from || txn.account,
			to: multicall3Addr,
			data: ret,
			value: totalValue.toString(),
		};
	};

	return generate7412CompatibleCall(viemClient, multicallFunc, txn);
}

(async () => {
	// example call
	console.log("THE MONEY", viem.parseEther("0.1").toString());
	const call = await hookForWriteCall({
		from: signer.address,
		to: "0x7506f41D9BD647e7B285B71c3B97c416f32F0f26", // v3 system contract for testing of xchain pools
		data: "0x4585e33b000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014", // call to `performUpkeep` on above contract triggers wormhole OracleDataRequired.
		// need to provide eth for the bridge fee
		value: viem.parseEther("0.1"),
	});

	delete call.account;

	console.log("sending txn:", call);
	console.log(await signer.sendTransaction(call));
})();
