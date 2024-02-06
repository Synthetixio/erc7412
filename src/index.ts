import * as viem from 'viem'
import IERC7412 from '../out/IERC7412.sol/IERC7412.json'
import { type OracleAdapter } from './types'
import { parseError } from './parseError'

import {
  prepareTransactionRequest as actionPrepareTransactionRequest,
  estimateContractGas as actionEstimateContractGas,
  simulateContract as actionSimulateContract
} from 'viem/actions'

import ITrustedMulticallForwarder from '../out/ITrustedMulticallForwarder.sol/ITrustedMulticallForwarder.json'

const TRUSTED_MULTICALL_FORWARDER_ADDRESS: viem.Address = '0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e'

export type TransactionRequest = Pick<viem.TransactionRequest, 'to' | 'data' | 'value' | 'from'>

/**
 * Extend your viem client with the object returned by this function to automatically apply erc7412
 * required offchain data to your read calls
 */
export function createErc7412Actions(adapters: OracleAdapter[]) {
  return (client: viem.PublicClient) => {
    const actions = {
      call: async (args: viem.CallParameters): Promise<viem.CallReturnType> => {
        return {
          data: (
            await callWithOffchainData(
              [
                {
                  from: (args.account as any)?.address ?? viem.zeroAddress,
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
                    from: (args.account as any)?.address ?? viem.zeroAddress,
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
        try {
          return await actionPrepareTransactionRequest(client, args)
        } catch (err) {
          console.log('WARN: erc7412 not implemented for prepareTransactionRequest')
          throw err
        }
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
      simulateContract: async (args: viem.SimulateContractParameters): Promise<any> => {
        try {
          return await actionSimulateContract(client, args)
        } catch (err) {
          const baseTxn = {
            from: (args.account as any)?.address ?? viem.zeroAddress,
            to: args.address,
            chain: args.chain,
            data: viem.encodeFunctionData(args),
            value: args.value
          }
          return {
            result: viem.decodeFunctionResult({
              ...args,
              data: (await callWithOffchainData([baseTxn], client, adapters))[0]
            }) as any
          }
        }
      },
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

export function makeTrustedForwarderMulticall(transactions: TransactionRequest[]): TransactionRequest {
  const totalValue = transactions.reduce((val, txn) => {
    return val + (txn.value ?? BigInt(0))
  }, BigInt(0))

  return {
    from: transactions[transactions.length - 1].from,
    to: TRUSTED_MULTICALL_FORWARDER_ADDRESS,
    value: totalValue,
    data: viem.encodeFunctionData({
      abi: ITrustedMulticallForwarder.abi,
      functionName: 'aggregate3Value',
      args: [
        transactions.map((txn) => ({
          target: txn.to ?? viem.zeroAddress,
          callData: txn.data ?? '0x',
          value: txn.value ?? '0',
          requireSuccess: true
        }))
      ]
    })
  }
}

export async function callWithOffchainData(
  transactions: [TransactionRequest, ...TransactionRequest[]],
  client: viem.PublicClient,
  adapters: OracleAdapter[]
): Promise<[viem.Hex, ...viem.Hex[]]> {
  const prependedTxns: TransactionRequest[] = []
  while (true) {
    try {
      const result = await client.call(
        makeTrustedForwarderMulticall([...prependedTxns, ...transactions] as TransactionRequest[])
      )
      if (result.data === undefined) {
        throw new Error('missing return data')
      }

      const datas: any[] = viem.decodeFunctionResult({
        abi: ITrustedMulticallForwarder.abi,
        functionName: 'multicall3',
        data: result.data
      }) as any[]
      return datas.slice(-transactions.length)[0]
    } catch (caughtErr) {
      prependedTxns.push(await resolvePrependTransaction(caughtErr, client, adapters))
    }
  }
}

export async function resolvePrependTransaction(
  origError: any,
  client: viem.PublicClient,
  adapters: OracleAdapter[]
): Promise<TransactionRequest> {
  try {
    const err = viem.decodeErrorResult({
      abi: IERC7412.abi,
      data: parseError(origError as viem.CallExecutionError)
    })
    if (err.errorName === 'OracleDataRequired') {
      const oracleQuery = err.args?.[1] as viem.Hex
      const oracleAddress = err.args?.[0] as viem.Address

      const oracleId = viem.hexToString(
        viem.trim(
          (await client.readContract({
            abi: IERC7412.abi,
            address: oracleAddress,
            functionName: 'oracleId',
            args: []
          })) as viem.Hex,
          { dir: 'right' }
        )
      )

      const adapter = adapters.find((a) => a.getOracleId() === oracleId)
      if (adapter === undefined) {
        throw new Error(
          `oracle ${oracleId} not supported (supported oracles: ${Array.from(adapters.map((a) => a.getOracleId())).join(
            ','
          )})`
        )
      }

      const offchainData = adapter.fetchOffchainData(client, oracleAddress, oracleQuery)

      const priceUpdateTx: TransactionRequest = {
        from: viem.zeroAddress,
        to: err.args?.[0] as viem.Address,
        data: viem.encodeFunctionData({
          abi: IERC7412.abi,
          functionName: 'fulfillOracleQuery',
          args: [offchainData]
        })
      }

      // find out if we have to pay a fee to submit this data
      try {
        await client.call(priceUpdateTx)
      } catch (priceUpdateErr: any) {
        const priceUpdateErrInfo = viem.decodeErrorResult({
          abi: IERC7412.abi,
          data: parseError(priceUpdateErr as viem.CallExecutionError)
        })
        if (priceUpdateErrInfo.errorName === 'FeeRequired' && priceUpdateErrInfo.args !== undefined) {
          priceUpdateTx.value = priceUpdateErrInfo.args[0] as bigint
        }
      }

      return priceUpdateTx
    }
  } catch (err) {
    console.log('had unexpected failure', err)
  }

  // if we get to this point then we cant parse the error so we should make sure to send the original
  throw origError
}
