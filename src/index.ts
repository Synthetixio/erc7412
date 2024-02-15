import * as viem from 'viem'
import IERC7412 from '../out/IERC7412.sol/IERC7412.json'
import { type OracleAdapter } from './types'
import { parseError } from './parseError'

import ITrustedMulticallForwarder from '../out/ITrustedMulticallForwarder.sol/ITrustedMulticallForwarder.json'
import { getWETHAddress } from './constants'

const TRUSTED_MULTICALL_FORWARDER_ADDRESS: viem.Address = '0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e'

export type TransactionRequest = Pick<viem.TransactionRequest, 'to' | 'data' | 'value' | 'from'>

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
  provider: Parameters<typeof viem.custom>[0],
  adapters: OracleAdapter[]
): Promise<[viem.Hex, ...viem.Hex[]]> {
  const client = viem.createPublicClient({ transport: viem.custom(provider, { retryCount: 0 }) })

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
        functionName: 'aggregate3Value',
        data: result.data
      }) as any[]
      return datas.slice(-transactions.length) as any
    } catch (caughtErr) {
      console.log('an error occured', caughtErr)
      prependedTxns.push(await resolvePrependTransaction(caughtErr, client, adapters))
    }
  }
}

export async function resolvePrependTransaction(
  origError: any,
  provider: Parameters<typeof viem.custom>[0],
  adapters: OracleAdapter[]
): Promise<TransactionRequest> {
  const client = viem.createPublicClient({ transport: viem.custom(provider, { retryCount: 0 }) })

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

      console.log('READ OID', oracleId)

      const adapter = adapters.find((a) => a.getOracleId() === oracleId)
      if (adapter === undefined) {
        throw new Error(
          `oracle ${oracleId} not supported (supported oracles: ${Array.from(adapters.map((a) => a.getOracleId())).join(
            ','
          )})`
        )
      }

      console.log('found the oracle')

      const offchainData = await adapter.fetchOffchainData(client, oracleAddress, oracleQuery)

      const priceUpdateTx: TransactionRequest = {
        from: getWETHAddress(await client.getChainId()),
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
