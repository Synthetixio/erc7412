import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { Adapter } from "../adapter";
import * as viem from "viem";

export class PythAdapter implements Adapter {
	private connection: EvmPriceServiceConnection;
	constructor(endpoint: string) {
		this.connection = new EvmPriceServiceConnection(endpoint);
	}

	getOracleId(): string {
		return "PYTH";
	}

	async fetchOffchainData(
		_client: viem.Client,
		_requester: viem.Address,
		data: viem.Hex,
	): Promise<viem.Hex> {
		const [updateType, stalenessTolerance, priceIds] = viem.decodeAbiParameters(
			[
				{ name: "updateType", type: "uint8" },
				{ name: "stalenessTolerance", type: "uint64" },
				{ name: "priceIds", type: "bytes32[]" },
			],
			data,
		);

		if ((updateType as number) !== 1) {
			throw new Error(`update type ${updateType} not supported`);
		}

		let updateData = await this.connection.getPriceFeedsUpdateData(priceIds as string[]);

		return viem.encodeAbiParameters(
			[
				{ type: "uint8", name: "updateType" },
				{ type: "uint64", name: "stalenessTolerance" },
				{ type: "bytes32[]", name: "priceIds" },
				{ type: "bytes[]", name: "updateData" },
			],
			[updateType, stalenessTolerance, priceIds, updateData],
		);
	}
}
