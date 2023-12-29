import type * as viem from 'viem'

export type TransactionRequest = Pick<
viem.TransactionRequest,
'to' | 'data' | 'value' | 'from'
>

export interface OracleAdapter {
  getOracleId: () => string
  fetchOffchainData: (
    client: viem.Client,
    oracleContract: viem.Address,
    oracleQuery: viem.Hex
  ) => Promise<viem.Hex>
}

export interface Batcher {
  batchable: (client: viem.PublicClient, transactions: TransactionRequest[]) => Promise<boolean>
  batch: (
    transactions: TransactionRequest[]
  ) => TransactionRequest
}
