import * as viem from "viem";
import IERC7412 from "../out/IERC7412.sol/IERC7412.json";
import { type OracleAdapter, type Batcher } from "./types";
import { parseError } from "./parseError";

export { DefaultAdapter, PythAdapter } from "./oracleAdapters/index";
export {
  TrustedMulticallForwarderBatcher,
  BiconomyBatcher,
} from "./batchers/index";

export type TransactionRequest = Pick<
  viem.TransactionRequest,
  "to" | "data" | "value" | "from"
>;

export class EIP7412 {
  oracleAdapters: Map<string, OracleAdapter>;
  batchers: Batcher[];

  constructor(oracleAdapters: OracleAdapter[], batchers: Batcher[]) {
    this.oracleAdapters = new Map(
      oracleAdapters?.map((adapter) => [adapter.getOracleId(), adapter])
    );
    this.batchers = batchers;
  }

  // Returns a list of transactions for submission to a paymaster or otherwise.
  async buildTransactions(
    client: viem.PublicClient,
    transactions: TransactionRequest | TransactionRequest[]
  ): Promise<TransactionRequest[]> {
    return await (this.enableERC7412(client, transactions, true) as Promise<
      TransactionRequest[]
    >); // I think I go to typescript jail for this
  }

  // Returns a multicall using the best method available for the provided transactions.
  async buildTransaction(
    client: viem.PublicClient,
    transactions: TransactionRequest | TransactionRequest[]
  ): Promise<TransactionRequest> {
    return await (this.enableERC7412(
      client,
      transactions,
      false
    ) as Promise<TransactionRequest>);
  }

  async batch(
    client: viem.PublicClient,
    transactions: TransactionRequest[]
  ): Promise<TransactionRequest> {
    const batcher = this.batchers.find(
      async (batch) => await batch.batchable(client, transactions)
    );

    if (!batcher) {
      throw new Error("No compatible batcher found for these transactions.");
    }

    return batcher.batch(transactions);
  }

  async enableERC7412(
    client: viem.PublicClient,
    tx: TransactionRequest | TransactionRequest[],
    returnList?: boolean
  ): Promise<TransactionRequest | TransactionRequest[]> {
    const multicallCalls: TransactionRequest[] = Array.isArray(tx) ? tx : [tx];

    while (true) {
      try {
        if (multicallCalls.length === 1) {
          await client.call(multicallCalls[0]);
          return multicallCalls[0];
        } else {
          const multicallTxn = await this.batch(client, multicallCalls);
          await client.call(multicallTxn);
          return returnList ? multicallCalls : multicallTxn;
        }
      } catch (error) {
        const err = viem.decodeErrorResult({
          abi: IERC7412.abi,
          data: parseError(error as viem.CallExecutionError),
        });
        if (err.errorName === "OracleDataRequired") {
          const oracleQuery = err.args![1] as viem.Hex;
          const oracleAddress = err.args![0] as viem.Address;

          const oracleId = viem.hexToString(
            viem.trim(
              (await client.readContract({
                abi: IERC7412.abi,
                address: oracleAddress,
                functionName: "oracleId",
                args: [],
              })) as viem.Hex,
              { dir: "right" }
            )
          );

          const adapter = this.oracleAdapters.get(oracleId);
          if (adapter === undefined) {
            throw new Error(
              `oracle ${oracleId} not supported (supported oracles: ${Array.from(
                this.oracleAdapters.keys()
              ).join(",")})`
            );
          }

          const signedRequiredData = await adapter.fetchOffchainData(
            client,
            oracleAddress,
            oracleQuery
          );

          multicallCalls.splice(multicallCalls.length - 1, 0, {
            from: multicallCalls[multicallCalls.length - 1].from,
            to: err.args![0] as viem.Address,
            data: viem.encodeFunctionData({
              abi: IERC7412.abi,
              functionName: "fulfillOracleQuery",
              args: [signedRequiredData],
            }),
          });
        } else if (err.errorName === "FeeRequired") {
          const requiredFee = err.args![0] as bigint;
          multicallCalls[multicallCalls.length - 2].value = requiredFee;
        } else {
          throw error;
        }
      }
    }
  }
}
