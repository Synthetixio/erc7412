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
    data: viem.Hex
  ): Promise<viem.Hex> {
    const [priceIds, updateType, _stalenessTolerance] = viem.decodeAbiParameters([
      { name: "priceIds", type: "bytes32[]" },
      { name: "updateType", type: "uint8" },
      { name: "stalenessTolerance", type: "uint64" },
    ], data);

    if (updateType as number !== 1) {
      throw new Error(`update type ${updateType} not supported`);
    }

    let updateData = await this.connection.getPriceFeedsUpdateData(priceIds as string[]);

    return viem.encodeAbiParameters([
      { type: "bytes[]" },
    ], [updateData]);
  }
}
