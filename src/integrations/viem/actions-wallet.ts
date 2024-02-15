import * as viem from 'viem'

import { prepareTransactionRequest as actionPrepareTransactionRequest } from 'viem/actions'

import { resolvePrependTransaction, makeTrustedForwarderMulticall, callWithOffchainData } from '../..'

import ITrustedMulticallForwarder from '../../../out/ITrustedMulticallForwarder.sol/ITrustedMulticallForwarder.json'

import type { TransactionRequest } from '../..'
import type { OracleAdapter } from '../../types'
import { getAccount } from './actions-public'

/**
 * Extend your viem client with the object returned by this function to automatically apply erc7412
 * required offchain data to your read calls
 */
export function createErc7412WalletActions (adapters: OracleAdapter[]) {
  return (client: viem.PublicClient) => {
    const actions = {
      prepareTransactionRequest: async (
        args: viem.PrepareTransactionRequestParameters
      ): Promise<viem.PrepareTransactionRequestReturnType> => {
        return await actions.prepareMulticallTransactionRequest({ txns: [args] })
      },

      prepareMulticallTransactionRequest: async (args: {
        txns: viem.PrepareTransactionRequestParameters[]
      }): Promise<viem.PrepareTransactionRequestReturnType> => {
        const prependedTxns: TransactionRequest[] = []

        if (args.txns.length < 1) {
          throw new Error('must have at least 1 transaction in multicall')
        }

        const payloadTxns: TransactionRequest[] = args.txns.map((t) => {
          const req: TransactionRequest = {
            ...t,
            from: getAccount(t.account)
          }

          return req
        })

        while (true) {
          const multicallTxn: viem.PrepareTransactionRequestParameters =
            payloadTxns.length > 1 || prependedTxns.length > 0
              ? {
                  ...makeTrustedForwarderMulticall([...prependedTxns, ...payloadTxns]),
                  account: args.txns[0].account,
                  chain: args.txns[0].chain
                }
              : args.txns[0]
          try {
            return await actionPrepareTransactionRequest(client, multicallTxn)
          } catch (err) {
            prependedTxns.push(await resolvePrependTransaction(err, client, adapters))
          }
        }
      },
      simulateContract: async (args: viem.SimulateContractParameters): Promise<viem.SimulateContractReturnType> => {
        const baseTxn = {
          from: (args.account as any)?.address ?? viem.zeroAddress,
          to: args.address,
          chain: args.chain,
          data: viem.encodeFunctionData(args),
          value: args.value
        }
        const preparedTxn = await actions.prepareTransactionRequest(baseTxn)
        return {
          request:
            preparedTxn.to === args.address
              ? args
              : {
                  ...preparedTxn,
                  abi: ITrustedMulticallForwarder.abi,
                  address: preparedTxn.to,
                  functionName: 'aggregate3Value',
                  args: viem.decodeFunctionData({ abi: ITrustedMulticallForwarder.abi, data: preparedTxn.data ?? '0x' })
                },
          result: viem.decodeFunctionResult({
            ...args,
            data: (await callWithOffchainData([baseTxn], client, adapters))[0]
          })
        } as any // TODO
      }

      // NOTE: cant override `sendRawTransaction` because the transaction is
      // already serialized and so its impossible to impart a new multicall
      // in front without breaking permissions
      // `sendTransaction` is not included because its behavior is not supposed to affect the transaction,
      // its just supposed to sign and send
    }

    return actions
  }
}
