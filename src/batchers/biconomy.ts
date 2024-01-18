import { type Batcher, type TransactionRequest } from "../types";
import * as viem from "viem";
import ISmartAccount from "../../out/ISmartAccount.sol/ISmartAccount.json";

export class BiconomyBatcher implements Batcher {
  isSupported: Map<viem.Address, boolean | undefined>;

  constructor() {
    this.isSupported = new Map();
  }

  async batchable(
    client: viem.PublicClient,
    transactions: TransactionRequest[],
  ): Promise<boolean> {
    for (const transaction of transactions) {
      // Check if the address is already known
      if (this.isSupported.has(transaction.from)) {
        // If it's known and not supported, return false
        if (!this.isSupported.get(transaction.from)) {
          return false;
        }
      } else {
        // If the address is not known, check its support status
        const supported = await this.checkSupport(client, transaction.from);
        this.isSupported.set(transaction.from, supported);

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

    // https://github.com/bcnmy/scw-contracts/blob/main/contracts/smart-account/SmartAccount.sol#L128C5-L134C6
    // https://docs.walletconnect.com/api/sign/smart-contract-wallet-usage#transactions
    return {
      from: viem.zeroAddress, // unused in this context?
      to: transactions[transactions.length - 1].from, // `to` will be the RelayerManager contract address, per walletconnect docs?
      value: totalValue,
      data: viem.encodeFunctionData({
        abi: ISmartAccount.abi,
        functionName: "executeBatch",
        args: [
          transactions.map((txn) => txn.to ?? viem.zeroAddress),
          transactions.map((txn) => txn.value ?? "0"),
          transactions.map((txn) => txn.data ?? "0x"),
        ],
      }),
    };
  }

  async checkSupport(
    client: viem.PublicClient,
    address: viem.Address,
  ): Promise<boolean> {
    // The ERC-165 implementation only shows support for 165 itself? https://github.com/bcnmy/scw-contracts/blob/main/contracts/smart-account/SmartAccount.sol#L211
    // Maybe we call the address and it works if we don't get a 0x error?
    try {
      await client.call({
        to: address,
        data: viem.encodeFunctionData({
          abi: ISmartAccount.abi,
          functionName: "executeBatch",
          args: [[viem.zeroAddress], ["0"], ["0x"]],
        }),
      });
    } catch (e) {
      // TODO: Only return false if '0x error'?
      return false;
    }
    return true;
  }
}
