import { type Batcher, type TransactionRequest } from "../types";
import * as viem from "viem";
import IERC2771Context from "../../out/IERC2771Context.sol/IERC2771Context.json";
import ITrustedMulticallForwarder from "../../out/ITrustedMulticallForwarder.sol/ITrustedMulticallForwarder.json";

const TRUSTED_MULTICALL_FORWARDER_ADDRESS: viem.Address =
  "0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e";

export class TrustedMulticallForwarderBatcher implements Batcher {
  isSupported: Map<viem.Address, boolean | undefined>;

  constructor() {
    this.isSupported = new Map();
  }

  async batchable(
    client: viem.PublicClient,
    transactions: TransactionRequest[],
  ): Promise<boolean> {
    for (const transaction of transactions) {
      const toAddress = transaction.to ?? viem.zeroAddress; // Should this default be set further up, or make sure it's set by now with stricter types?

      // Check if the address is already known
      if (this.isSupported.has(toAddress)) {
        // If it's known and not supported, return false
        if (!this.isSupported.get(toAddress)) {
          return false;
        }
      } else {
        // If the address is not known, check its support status
        const supported = await this.checkSupport(client, toAddress);
        this.isSupported.set(toAddress, supported);

        // If not supported, return false
        if (!supported) {
          return false;
        }
      }
    }

    // If all addresses are supported, return true
    return true;
  }

  batch(transactions: TransactionRequest[]): TransactionRequest {
    const totalValue = transactions.reduce((val, txn) => {
      return val + (txn.value ?? BigInt(0));
    }, BigInt(0));

    return {
      from: transactions[transactions.length - 1].from,
      to: TRUSTED_MULTICALL_FORWARDER_ADDRESS,
      value: totalValue,
      data: viem.encodeFunctionData({
        abi: ITrustedMulticallForwarder.abi,
        functionName: "aggregate3Value",
        args: [
          transactions.map((txn) => ({
            target: txn.to ?? viem.zeroAddress,
            callData: txn.data ?? "0x",
            value: txn.value ?? "0",
            requireSuccess: true,
          })),
        ],
      }),
    };
  }

  async checkSupport(
    client: viem.PublicClient,
    address: viem.Address,
  ): Promise<boolean> {
    const resp = await client.readContract({
      abi: IERC2771Context.abi,
      address,
      functionName: "isTrustedForwarder",
      args: [TRUSTED_MULTICALL_FORWARDER_ADDRESS],
    });

    return resp as boolean;
  }
}
