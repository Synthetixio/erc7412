import erc7412 from "../dist/src/index.js";
import * as viem from "viem";

import { build, runRpc, getProvider, getFoundryArtifact, ChainDefinition } from "@usecannon/cli";

import http from "http";

async function do7412CompatibleCall(client, multicallFunc, greeterAddress, greeterFunc) {
	const providers = new Map();
	providers.set("TEST", "http://localhost:8000");
	const converter = new erc7412.EIP7412(providers, multicallFunc);

	const newTx = await converter.wrap(client, {
		to: greeterAddress,
		data: greeterFunc,
	});

	console.log("ready to execute txn", newTx);
	process.exit(0);
}

function startWebServer() {
	return new Promise((resolve) => {
		http
			.createServer((req, res) => {
				res.writeHead(200, { "Content-Type": "text/plain" });
				res.end(viem.encodeAbiParameters([{ type: "string" }], [`Hello World ${req.data}`]));
			})
			.listen(8000, resolve);
	});
}

async function makeTestEnv() {
	await startWebServer();

	const node = await runRpc({ port: 8545 });

	const info = await build({
		provider: getProvider(node),
		packageDefinition: { name: "erc7412test", version: "0.0.1" },
		getArtifact: getFoundryArtifact,
		def: new ChainDefinition({
			name: "erc7412test",
			version: "0.0.1",
			import: {
				// regular multicall3 contract does not work because it does not bubble up errors
				//multicall: { source: "multicall:latest" },
			},
			contract: {
				Multicall: {
					artifact: "Multicall3",
				},
				OffchainGreeter: {
					artifact: "OffchainGreeter",
				},
			},
		}),
	});

	return info;
}

makeTestEnv().then((netInfo) => {
	const senderAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
	console.log("created test environment");

	const greeterAddress = netInfo.outputs.contracts.OffchainGreeter.address;
	const greeterFunc = viem.encodeFunctionData({
		abi: netInfo.outputs.contracts.OffchainGreeter.abi,
		functionName: "greet",
		args: [3],
	});

	function makeMulticall(calls) {
		const ret = viem.encodeFunctionData({
			abi: netInfo.outputs.contracts.Multicall.abi,
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
			account: senderAddr,
			to: netInfo.outputs.contracts.Multicall.address,
			data: ret,
			value: totalValue.toString(),
		};
	}

	const client = viem.createPublicClient({
		chain: {
			nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
			chainId: 13370,
			chainName: "Cannon Localhost",
			rpcUrls: { default: { http: ["http://localhost:8545"] } },
			blockExplorerUrls: ["http://localhost:8000"],
		},
		transport: viem.custom({
			request: async (req) => {
				//console.log("received request", req);
				const res = await netInfo.provider.send(req.method, req.params);
				//console.log("res", res);
				return res;
			},
		}),
	});

	do7412CompatibleCall(client, makeMulticall, greeterAddress, greeterFunc);
});
