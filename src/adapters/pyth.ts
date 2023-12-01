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
    const [updateType] = viem.decodeAbiParameters(
      [{ name: 'updateType', type: 'uint8' }],
      data
    );

    if ((updateType as number) === 1) {
      const [updateType, stalenessOrTime, priceIds] = viem.decodeAbiParameters(
        [
          { name: 'updateType', type: 'uint8' },
          { name: 'stalenessTolerance', type: 'uint64' },
          { name: 'priceIds', type: 'bytes32[]' },
        ],
        data
      );

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
      const [updateType, requestedTime, priceId] = viem.decodeAbiParameters(
        [
          { name: 'updateType', type: 'uint8' },
          { name: 'requestedTime', type: 'uint64' },
          { name: 'priceIds', type: 'bytes32' },
        ],
        data
      );

      // const unixTimestamp =
      //   Date.parse(((requestedTime as unknown as bigint) * 1000n)?.toString()) /
      //   1000;

      const [priceFeedUpdateVaa] = await this.connection.getVaa(
        priceId as string,
        Number((requestedTime as unknown as bigint).toString())
      );

      const priceFeedUpdate =
        '0x' + Buffer.from(priceFeedUpdateVaa, 'base64').toString('hex');

      return viem.encodeAbiParameters(
        [
          { type: 'uint8', name: 'updateType' },
          { type: 'uint64', name: 'timestamp' },
          { type: 'bytes32[]', name: 'priceIds' },
          { type: 'bytes[]', name: 'updateData' },
        ],
        [
          updateType,
          requestedTime,
          [priceId],
          [priceFeedUpdate as `0x${string}`],
        ]
      );
    } else {
      throw new Error(`update type ${updateType} not supported`);
    }
  }
}
