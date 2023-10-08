import { Adapter } from "../adapter";
import * as viem from "viem";
import axios from "axios";

import {
	EthCallQueryRequest,
	PerChainQueryRequest,
	QueryRequest,
	QueryResponse,
	sign,
} from "./wormhole-lib";

import * as chains from "viem/chains";

const QUERY_URL = "https://testnet.ccq.vaa.dev/v1/query";
const ETH_DEV_PRIVATE_KEY = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";

const ContractCrossChainRequestType = {
	components: [
		{
			internalType: "uint64",
			name: "chainSelector",
			type: "uint64",
		},
		{
			internalType: "uint256",
			name: "timestamp",
			type: "uint256",
		},
		{
			internalType: "address",
			name: "target",
			type: "address",
		},
		{
			internalType: "bytes",
			name: "data",
			type: "bytes",
		},
	],
	internalType: "struct IWormholeERC7412Receiver.CrossChainRequest[]",
	name: "reqs",
	type: "tuple[]",
};

const WormholeSignatureType = {
	components: [
		{
			internalType: "bytes32",
			name: "r",
			type: "bytes32",
		},
		{
			internalType: "bytes32",
			name: "s",
			type: "bytes32",
		},
		{
			internalType: "uint8",
			name: "v",
			type: "uint8",
		},
		{
			internalType: "uint8",
			name: "guardianIndex",
			type: "uint8",
		},
	],
	internalType: "struct IWormhole.Signature[]",
	name: "signatures",
	type: "tuple[]",
};

const selectorToId: { [key: string]: number } = {
	"5": 80001,
	"23": 421613,
};

const selectorToRpc: { [key: string]: string } = {
	"5": "https://polygon-mumbai-bor.publicnode.com",
	"23": "https://arbitrum-goerli.publicnode.com",
};

export class WormholeAdapter implements Adapter {
	readonly apiKey: string;
	readonly queryUrl: string;
	readonly signKey: string;

	constructor(apiKey: string, queryUrl = QUERY_URL, signKey = ETH_DEV_PRIVATE_KEY) {
		this.apiKey = apiKey;
		this.queryUrl = queryUrl;
		this.signKey = signKey;
	}

	getOracleId(): string {
		return "WORMHOLE";
	}

	async fetchOffchainData(
		_client: viem.PublicClient,
		_requester: viem.Address,
		data: viem.Hex,
	): Promise<viem.Hex> {
		const [ccqs] = viem.decodeAbiParameters([ContractCrossChainRequestType], data) as any[][];

		const perChainRequests: PerChainQueryRequest[] = [];

		for (const ccq of ccqs) {
			console.log("ccq", ccq);
			console.log("getting block");
			const block =
				"0x" +
				(
					(await viem
						.createPublicClient({
							chain: Object.values(chains).find(
								(c) => c.id === selectorToId[ccq.chainSelector.toString()],
							),
							transport: viem.http(selectorToRpc[ccq.chainSelector.toString()]),
						})
						.getBlockNumber()) - BigInt(10)
				).toString(16);

			console.log("got block", block);
			perChainRequests.push(
				new PerChainQueryRequest(
					Number(ccq.chainSelector),
					new EthCallQueryRequest(block, [{ to: ccq.target, data: ccq.data }]),
				),
			);
		}

		const request = new QueryRequest(1, perChainRequests);
		const serialized = request.serialize();
		//const digest = QueryRequest.digest("TESTNET", serialized);
		//const signature = sign(ETH_DEV_PRIVATE_KEY, digest);
		//console.log(Buffer.from(serialized).toString("hex"));
		console.log("begin request");
		const response = await axios.put<QueryResponse>(
			QUERY_URL,
			{
				//signature,
				bytes: Buffer.from(serialized).toString("hex"),
			},
			{ headers: { "X-API-Key": this.apiKey } },
		);
		console.log("end request");

		return viem.encodeAbiParameters(
			[{ type: "bytes", name: "signedOffchainData" }, WormholeSignatureType],
			[
				`0x${response.data.bytes}`,
				response.data.signatures.map((s) => ({
					r: `0x${s.substring(0, 64)}`,
					s: `0x${s.substring(64, 128)}`,
					v: `0x${(parseInt(s.substring(128, 130), 16) + 27).toString(16)}`,
					guardianIndex: `0x${s.substring(130, 132)}`,
				})),
			],
		);
	}
}
