import * as viem from 'viem';
import IERC7412 from '../out/IERC7412.sol/IERC7412.json';
import { Adapter } from './adapter';
import { parseError } from './parseError';

export { Adapter } from './adapter';
export { DefaultAdapter } from './adapters/default';

type TransactionRequest = Pick<
  viem.TransactionRequest,
  'to' | 'data' | 'value'
>;

export class EIP7412 {
  adapters: Map<string, Adapter>;
  multicallFunc:
    | ((txs: TransactionRequest[]) => TransactionRequest)
    | undefined;

  constructor(
    adapters?: Adapter[],
    multicallFunc?: (txs: TransactionRequest[]) => TransactionRequest
  ) {
    this.adapters = new Map();
    adapters?.forEach((adapter) => {
      this.adapters.set(adapter.getOracleId(), adapter);
    });
    this.multicallFunc = multicallFunc;
  }

  async enableERC7412(
    client: viem.PublicClient,
    tx: TransactionRequest | TransactionRequest[]
  ): Promise<TransactionRequest> {
    const multicallCalls: TransactionRequest[] = Array.isArray(tx) ? tx : [tx];

    while (true) {
      try {
        if (multicallCalls.length == 1) {
          await client.call(multicallCalls[0]);
          return multicallCalls[0];
        } else if (!this.multicallFunc) {
          throw 'multicallFunc is not defined';
        } else {
          const multicallTxn = this.multicallFunc(multicallCalls);
          await client.call(multicallTxn);
          return multicallTxn;
        }
      } catch (error) {
        const err = viem.decodeErrorResult({
          abi: IERC7412.abi,
          data: parseError(error as viem.CallExecutionError),
        });

        if (err.errorName === 'OracleDataRequired') {
          const oracleQuery = err.args![1] as viem.Hex;
          const oracleAddress = err.args![0] as viem.Address;

          const oracleId = viem.hexToString(
            viem.trim(
              (await client.readContract({
                abi: IERC7412.abi,
                address: oracleAddress,
                functionName: 'oracleId',
                args: [],
              })) as unknown as viem.Hex,
              { dir: 'right' }
            )
          );

          const adapter = this.adapters.get(oracleId);
          if (adapter === undefined) {
            throw new Error(
              `oracle ${oracleId} not supported (supported oracles: ${Array.from(
                this.adapters.keys()
              ).join(',')})`
            );
          }

          const signedRequiredData = await adapter.fetchOffchainData(
            client,
            oracleAddress,
            oracleQuery
          );

          const priceUpdateTx = {
            to: err.args![0] as viem.Address,
            data: viem.encodeFunctionData({
              abi: IERC7412.abi,
              functionName: 'fulfillOracleQuery',
              args: [signedRequiredData],
            }),
          };
          multicallCalls.unshift(priceUpdateTx);
        } else if (err.errorName === 'FeeRequired') {
          const requiredFee = err.args![0] as bigint;
          multicallCalls[0].value = requiredFee;
        } else {
          throw error;
        }
      }
    }
  }
}
