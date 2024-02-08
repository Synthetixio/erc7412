import * as mod from './'

import * as viem from 'viem'

import IERC7412 from '../out/IERC7412.sol/IERC7412.json'

export const fakeWeb3 = {
  request: jest.fn()
}

export const fakeAdapters = [
  {
    getOracleId: () => 'FAKE',
    fetchOffchainData: async () => '0x87651234' as viem.Hex
  }
]

describe('index.ts', () => {
  beforeEach(() => {
    fakeWeb3.request.mockImplementation(async ({ method, params }: { method: string; params: any[] }) => {
      //console.log('got call', method, params)
      if (method === 'eth_call') {
        if (params[0].data === viem.encodeFunctionData({ abi: IERC7412.abi, functionName: 'oracleId' })) {
          // getOracleId call
          return viem.encodeFunctionResult({
            abi: IERC7412.abi,
            functionName: 'oracleId',
            result: viem.stringToHex('FAKE', { size: 32 })
          })
        } else if (params[0].data.includes('87651234') === true) {
          return viem.encodeAbiParameters(
            [viem.parseAbiParameter('(bool success, bytes returnData)[]')],
            [
              [
                { success: true, returnData: '0x1234' },
                { success: true, returnData: '0x5678' }
              ]
            ]
          )
        } else {
          /* eslint @typescript-eslint/no-throw-literal: "off" */
          throw {
            data: viem.encodeErrorResult({
              abi: IERC7412.abi,
              errorName: 'OracleDataRequired',
              args: ['0x2345234523452345234523452345234523452345', '0x1234']
            })
          }
        }
      } else {
        return '0x'
      }
    })
  })

  describe('callWithOffchainData()', () => {
    it('passes a call execution error if its not recognized', async () => {
      const origError = new Error('0x08273020')
      fakeWeb3.request.mockRejectedValue(origError)
      await expect(
        async () =>
          await mod.callWithOffchainData(
            [{ from: '0x', to: '0x1234123412341234123412341234123412341234', data: '0x12345678' }],
            fakeWeb3,
            fakeAdapters
          )
      ).rejects.toThrowErrorMatchingSnapshot()
    })

    it('resolves offchain data and returns correct data', async () => {
      expect(
        await mod.callWithOffchainData(
          [
            { from: '0x', to: '0x1234123412341234123412341234123412341234', data: '0x12345678' },
            { from: '0x', to: '0x1234123412341234123412341234123412341234', data: '0x23456789' }
          ],
          fakeWeb3,
          fakeAdapters
        )
      ).toMatchObject([
        { returnData: '0x1234', success: true },
        { returnData: '0x5678', success: true }
      ])
    })
  })

  describe('resolvePrependTransaction()', () => {
    it('passes though error if its not recognized', async () => {
      const origError = new Error('0x08273020')
      await expect(async () => await mod.resolvePrependTransaction(origError, fakeWeb3, fakeAdapters)).rejects.toThrow(
        origError
      )
    })

    it('fetches offchain data without fee', async () => {
      const origError = { data: viem.encodeErrorResult({ abi: IERC7412.abi, errorName: 'OracleDataRequired', args: [] }) }
      fakeWeb3.request.mockResolvedValue('0x')
      expect(await mod.resolvePrependTransaction(origError, fakeWeb3, fakeAdapters)).toEqual(
        viem.encodeFunctionData({ abi: IERC7412.abi, functionName: 'fulfillOracleQuery', args: ['0x12345678'] })
      )
    })

    it('fetches offchain data without fee', async () => {
      const origError = { data: viem.encodeErrorResult({ abi: IERC7412.abi, errorName: 'OracleDataRequired', args: [] }) }
      fakeWeb3.request.mockRejectedValue({
        data: viem.encodeErrorResult({ abi: IERC7412.abi, errorName: 'FeeRequired', args: [100n] })
      })
      expect(await mod.resolvePrependTransaction(origError, fakeWeb3, fakeAdapters)).toMatchObject({
        data: viem.encodeFunctionData({ abi: IERC7412.abi, functionName: 'fulfillOracleQuery', args: ['0x12345678'] }),
        value: 100n
      })
    })
  })
})