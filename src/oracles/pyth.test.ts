import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js'
import * as viem from 'viem'

import * as mod from './pyth'

jest.mock('@pythnetwork/pyth-evm-js')

// prevent dumb bugs
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

describe.only('oracles/pyth.ts', () => {
  describe('PythAdapter', () => {
    let adapter: mod.PythAdapter
    beforeEach(() => {
      adapter = new mod.PythAdapter('https://some-endpoint.com')
      const mockedConnector = jest.mocked(EvmPriceServiceConnection)
      jest
        .mocked(mockedConnector.mock.instances[0].getPriceFeedsUpdateData)
        .mockImplementation(async (c) => c.map(() => '0x1234'))

      jest.mocked(mockedConnector.mock.instances[0].getVaa).mockResolvedValue(['0x4321', 22])
    })

    describe('getOracleId()', () => {
      it('returns PYTH', () => {
        const adapter = new mod.PythAdapter('https://some-endpoint.com')
        expect(adapter.getOracleId()).toEqual('PYTH')
      })
    })

    describe('fetchOffchainData()', () => {
      it('processes stale prices', async () => {
        const oracleQuery = [
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32[]' }
              ],
              [1, BigInt(100), [viem.toHex('woot', { size: 32 }), viem.toHex('sup', { size: 32 })]]
            ),
            fee: BigInt(10)
          },
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32[]' }
              ],
              [1, BigInt(100), [viem.toHex('shuv', { size: 32 })]]
            ),
            fee: BigInt(100)
          },
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32[]' }
              ],
              [1, BigInt(100), [viem.toHex('waa', { size: 32 })]]
            )
          }
        ]

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            oracleQuery
          )
        ).resolves.toMatchObject([{ fee: BigInt(111) }])
      })

      it('processes vaa prices', async () => {
        const oracleQuery = [
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32' }
              ],
              [2, BigInt(100), viem.toHex('sup', { size: 32 })]
            ),
            fee: BigInt(25)
          },
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32' }
              ],
              [2, BigInt(100), viem.toHex('shuv', { size: 32 })]
            ),
            fee: BigInt(150)
          },
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32' }
              ],
              [2, BigInt(100), viem.toHex('waa', { size: 32 })]
            )
          }
        ]

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            oracleQuery
          )
        ).resolves.toMatchObject([{ fee: BigInt(25) }, { fee: BigInt(150) }, { fee: BigInt(1) }])
      })

      it('does not work on unsupported update type', async () => {
        const oracleQuery = [
          {
            query: viem.encodeAbiParameters(
              [
                { name: 'updateType', type: 'uint8' },
                { name: 'requestedTime', type: 'uint64' },
                { name: 'priceIds', type: 'bytes32' }
              ],
              [2, BigInt(100), viem.toHex('sup', { size: 32 })]
            ),
            fee: BigInt(25)
          },
          {
            query: viem.encodeAbiParameters([{ name: 'updateType', type: 'uint8' }], [3]),
            fee: BigInt(150)
          }
        ]

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            oracleQuery
          )
        ).rejects.toThrow(new Error('update type 3 not supported'))
      })
    })
  })
})
