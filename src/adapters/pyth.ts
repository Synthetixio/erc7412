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
    const [updateType, stalenessOrTime, priceIds] = viem.decodeAbiParameters(
      [
        { name: 'updateType', type: 'uint8' },
        { name: 'stalenessTolerance', type: 'uint64' },
        { name: 'priceIds', type: 'bytes32[]' },
      ],
      data
    );

    if ((updateType as number) === 1) {
      const stalenessTolerance = stalenessOrTime;
      let updateData = (await this.connection.getPriceFeedsUpdateData(
        priceIds as string[]
      )) as unknown as `0x${string}`[];

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
      const timestamp = stalenessOrTime;
      // https://benchmarks.pyth.network/v1/updates/price/1693485033?ids=ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
      const result = await fetch(
        `https://benchmarks.pyth.network/v1/updates/price/${timestamp}?ids=${priceIds}`
      );

      const data = await result.json();
      const updateData = data?.binary?.data as unknown as `0x${string}`[];

      return viem.encodeAbiParameters(
        [
          { type: 'uint8', name: 'updateType' },
          { type: 'uint64', name: 'timestamp' },
          { type: 'bytes32[]', name: 'priceIds' },
          { type: 'bytes[]', name: 'updateData' },
        ],
        [updateType, timestamp, priceIds, updateData]
      );
    } else {
      throw new Error(`update type ${updateType} not supported`);
    }
  }
}
