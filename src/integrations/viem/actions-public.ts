import * as viem from 'viem'

import { estimateContractGas as actionEstimateContractGas } from 'viem/actions'

import { createErc7412WalletActions } from './actions-wallet'

import { callWithOffchainData } from '../..'
import type { OracleAdapter } from '../../types'

export function getAccount (account: `0x${string}` | viem.Account | undefined): `0x${string}` {
  if (account === undefined) {
    return viem.zeroAddress
  }
  if (typeof account === 'string') {
    return account
  }
  return account.address
}

/**
 * Extend your viem client with the object returned by this function to automatically apply erc7412
 * required offchain data to your read calls
 */
export function createErc7412PublicActions (adapters: OracleAdapter[]) {
  const actionsWallet = createErc7412WalletActions(adapters)
  return (client: viem.PublicClient) => {
    const actions = {
      call: async (args: viem.CallParameters): Promise<viem.CallReturnType> => {
        return {
          data: (
            await callWithOffchainData(
              [
                {
                  from: getAccount(args.account),
                  ...args
                }
              ],
              client,
              adapters
            )
          )[0]
        }
      },
      readContract: async (args: viem.ReadContractParameters): Promise<viem.ReadContractReturnType> => {
        return {
          data: viem.decodeFunctionResult({
            ...args,
            data: (
              await callWithOffchainData(
                [
                  {
                    from: getAccount(args.account),
                    data: viem.encodeFunctionData(args),
                    ...args
                  }
                ],
                client,
                adapters
              )
            )[0]
          })
        }
      },
      prepareTransactionRequest: async (args: viem.PrepareTransactionRequestParameters) => {
        return await actionsWallet(client).prepareTransactionRequest(args)
      },
      estimateContractGas: async (args: viem.EstimateContractGasParameters) => {
        try {
          return await actionEstimateContractGas(client, args)
        } catch (err) {
          console.log('WARN: erc7412 not implemented for estimateContractGas')
          throw err
        }
      },
      // TODO: types
      simulateContract: async (args: viem.SimulateContractParameters): Promise<any> => {},
      multicall: async (args: viem.MulticallParameters): Promise<viem.MulticallReturnType> => {
        if (args.contracts.length < 1) {
          throw new Error('must have at least one call for multicall')
        }

        const retvals = await callWithOffchainData(
          // todo: types have a problem with the fact it cannot verify that the array is at least 1 long
          args.contracts.map((c) => {
            return {
              from: c.address ?? viem.zeroAddress,
              data: viem.encodeFunctionData(c),
              ...c
            }
          }) as any,
          client,
          adapters
        )

        return retvals.map((r, i) => {
          return { result: viem.decodeFunctionResult({ ...args.contracts[i], data: r }), status: 'success' }
        })
      }
      // below functions are not included because they are not applicable
      // writeContract: async (args: viem.WriteContractParameters) => {},
    }

    return actions
  }
}
