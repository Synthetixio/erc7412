import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { Adapter } from '../adapter';
import * as viem from 'viem';

export class PythAdapter implements Adapter {
  private connection: EvmPriceServiceConnection;
  constructor(endpoint: string) {
    this.connection = new EvmPriceServiceConnection(endpoint);
  }

  getOracleId(): string {
    return 'PYTH';
  }

  async fetchOffchainData(
    _client: viem.Client,
    _requester: viem.Address,
    data: viem.Hex
  ): Promise<viem.Hex> {
    //TODO: update stalenessTolerance to a better name
    const [updateType, stalenessTolerance, priceIds] = viem.decodeAbiParameters(
      [
        { name: 'updateType', type: 'uint8' },
        { name: 'stalenessTolerance', type: 'uint64' },
        { name: 'priceIds', type: 'bytes32[]' },
      ],
      data
    );

    if ((updateType as number) === 1) {
      let updateData = await this.connection.getPriceFeedsUpdateData(
        priceIds as string[]
      );
      return viem.encodeAbiParameters(
        [
          { type: 'uint8', name: 'updateType' },
          { type: 'uint64', name: 'stalenessTolerance' },
          { type: 'bytes32[]', name: 'priceIds' },
          { type: 'bytes[]', name: 'updateData' },
        ],
        [updateType, stalenessTolerance, priceIds, updateData]
      );
    } else if ((updateType as number) === 2) {
      //use SDK
      let updateData = await fetch(
        `https://benchmarks.pyth.network/v1/updates/price/${stalenessTolerance}?ids=${priceIds}`
      );

      return viem.encodeAbiParameters(
        [
          { type: 'uint8', name: 'updateType' },
          { type: 'uint64', name: 'timestamp' },
          { type: 'bytes32[]', name: 'priceIds' },
          { type: 'bytes[]', name: 'updateData' },
        ],
        [updateType, stalenessTolerance, priceIds, updateData]
      );
    } else {
      throw new Error(`update type ${updateType} not supported`);
    }
  }
}
