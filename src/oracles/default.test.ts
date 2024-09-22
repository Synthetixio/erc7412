import * as viem from 'viem'

import * as mod from './default'

import fetch from 'node-fetch'

jest.mock('node-fetch')

// prevent dumb bugs
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

describe('oracles/default.ts', () => {
  describe('DefaultAdapter', () => {
    const adapter = new mod.DefaultAdapter('DEFAULT', 'https://some-endpoint.com')

    describe('getOracleId()', () => {
      it('returns DEFAULT', () => {
        expect(adapter.getOracleId()).toEqual('DEFAULT')
      })
    })

    describe('fetchOffchainData()', () => {
      it('runs a query', async () => {
        const oracleQuery = [
          {
            query: viem.toHex('query one', { size: 32 }),
            fee: BigInt(10)
          }
        ]

        // eslint-disable-next-line
        jest.mocked(fetch).mockResolvedValue({ status: 200, text: async () => '0x2224' } as any)

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            oracleQuery
          )
        ).resolves.toEqual([{ arg: '0x2224', fee: BigInt(10) }])

        expect(fetch).toHaveBeenCalledWith('https://some-endpoint.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: viem.toHex('query one', { size: 32 })
        })

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            [{ query: '0x' }]
          )
        ).resolves.toEqual([{ arg: '0x2224', fee: BigInt(0) }])
      })

      it('shows appropriate error when non 200 response comes back', async () => {
        const oracleQuery = [
          {
            query: viem.toHex('query one', { size: 32 }),
            fee: BigInt(10)
          }
        ]

        // eslint-disable-next-line
        jest.mocked(fetch).mockResolvedValue({ status: 404, text: async () => '0x2224' } as any)

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            oracleQuery
          )
        ).rejects.toThrowErrorMatchingSnapshot()
      })

      it('supports only one query at a time', async () => {
        const oracleQuery = [
          {
            query: viem.toHex('query one', { size: 32 }),
            fee: BigInt(10)
          },
          {
            query: viem.toHex('query two', { size: 32 }),
            fee: BigInt(100)
          }
        ]

        await expect(
          adapter.fetchOffchainData(
            viem.createClient({ transport: viem.custom({ request: async () => {} }) }),
            viem.zeroAddress,
            oracleQuery
          )
        ).rejects.toThrow(new Error('only one query at a time is supported'))
      })
    })
  })
})
