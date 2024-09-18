import * as viem from 'viem'
import type { PublicClient } from 'viem'
import type { OracleAdapter } from '../../types'

import { createErc7412PublicActions } from './actions-public'

import { callWithOffchainData } from '../..'

jest.mock('../..')

const fakeAddress = viem.getContractAddress({ from: viem.zeroAddress, nonce: 0n })

export const fakeAdapters: OracleAdapter[] = [
  {
    getOracleId: () => 'FAKE',
    fetchOffchainData: async () => [{ arg: '0x87651234' as viem.Hex, fee: BigInt(100) }]
  }
]

describe('createErc7412PublicActions', () => {
  const mockPublicClient = {
    getBlockNumber: jest.fn().mockResolvedValue(12345),
    simulateContract: jest.fn().mockResolvedValue({
      /* Mock result */
    })
    // ...other methods as needed
  } as unknown as PublicClient

  const actions = createErc7412PublicActions(fakeAdapters)(mockPublicClient)

  const fakeTxn = {
    to: fakeAddress,
    data: '0x5678',
    value: 203n
  } as const

  const fakeContractRequest = {
    abi: [
      {
        type: 'function',
        name: 'greet',
        inputs: [
          {
            type: 'string',
            name: 'first'
          },
          {
            type: 'string',
            name: 'second'
          }
        ],
        outputs: [
          {
            type: 'uint32',
            name: 'result'
          }
        ],
        stateMutability: 'view'
      }
    ] as viem.Abi,
    address: fakeAddress,
    functionName: 'greet',
    args: ['uno', 'dos']
  }

  describe('call()', () => {
    it('should pass through a single transaction', async () => {
      jest.mocked(callWithOffchainData).mockResolvedValue(['0x83838'])
      const result = await actions.call(fakeTxn)
      expect(result).toEqual({ data: '0x83838' })
      expect(jest.mocked(callWithOffchainData).mock.calls[0][0]).toEqual([{ from: viem.zeroAddress, ...fakeTxn }])
    })
  })

  describe('readContract()', () => {
    it('should pass through a single transaction', async () => {
      jest
        .mocked(callWithOffchainData)
        .mockResolvedValue(['0x0000000000000000000000000000000000000000000000000000000000000009'])
      const result = await actions.readContract(fakeContractRequest)
      expect(result).toEqual({ data: 9 })
      expect(jest.mocked(callWithOffchainData).mock.calls[0][0][0]).toMatchObject({
        data: viem.encodeFunctionData(fakeContractRequest)
      })
    })
  })
})
