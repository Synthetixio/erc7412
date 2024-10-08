import type * as viem from 'viem'

export type TransactionRequest = Pick<viem.TransactionRequest, 'to' | 'data' | 'value' | 'from'>

export interface OracleAdapter {
  getOracleId: () => string
  fetchOffchainData: (
    client: viem.Client,
    oracleContract: viem.Address,
    oracleQuery: Array<{ query: viem.Hex; fee: bigint }>
  ) => Promise<Array<{ arg: viem.Hex; fee?: bigint }>>
}

export interface Batcher {
  batchable: (client: viem.PublicClient, transactions: TransactionRequest[]) => Promise<boolean>
  batch: (transactions: TransactionRequest[]) => TransactionRequest
}
