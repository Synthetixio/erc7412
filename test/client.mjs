import erc7412 from "../dist/src/index.js";
import * as viem from "viem";

import { build, runRpc } from "@usecannon/cli";
import { getProvider } from "@usecannon/cli/dist/src/rpc.js";

async function do7412CompatibleCall(client, greeterAddress, greeterFunc) {
	const converter = new erc7412.ERC7412(
		{
			TEST: "http://localhost:8000",
		},
		makeMulticall,
	);

	const newTx = await converter.wrap(client, {
		address: greeterAddress,
		data: greeterFunc,
	});

	console.log(newTx);
}

const client = viem.createPublicClient({
	chain: {
		chainId: 13370,
		chainName: "Cannon Localhost",
		rpcUrls: { default: { http: ["http://localhost:8545"] } },
		blockExplorerUrls: ["http://localhost:8000"],
	},
	transport: viem.http(),
});

async function makeTestEnv() {
	const node = await runRpc({ port: 8545 });

	const info = await build({
		provider: getProvider(node),
		packageDefinition: {
			name: "erc7412test",
			version: "0.0.1",
			import: {
				multicall: { source: "multicall:latest" },
			},
			contract: {
				OffchainGreeter: {
					artifact: "OffchainGreeter",
				},
			},
		},
	});

	console.log("the info", info);

	return info.outputs;
}

makeTestEnv().then((netInfo) => {
	console.log("created test environment");

	const greeterAddress = netInfo.contracts.OffchainGreeter.address;
	const greeterFunc = viem.encodeFunctionData({
		abi: netInfo.contracts.OffchainGreeter.abi,
		functionName: "greet",
		inputs: [3],
	});

	do7412CompatibleCall(client, greeterAddress, greeterFunc);
});
