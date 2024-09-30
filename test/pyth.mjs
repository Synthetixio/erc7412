import { callWithOffchainData } from '../dist/src/index.js'
import { PythAdapter } from '../dist/src/oracles/pyth.js'
import * as cannon from '@usecannon/builder'

import { Contract, ethers } from 'ethers'

// make an ethers provider like we would have in the browser
const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || 'https://arbitrum-sepolia.publicnode.com'
)

;(async () => {
  const contractData = await cannon.getCannonContract({
    package: 'synthetix-omnibus',
    chainId: 421614,
    contractName: 'perpsFactory.PerpsMarketProxy'
  })

  const contract = new Contract(contractData.address, contractData.abi)

  const data = contract.interface.encodeFunctionData('reportedDebt', [6])

  const call = {
    to: contractData.address,
    data
  }

  const adapters = []
  adapters.push(new PythAdapter('https://hermes.pyth.network/'))

  const result = await callWithOffchainData(
    [call],
    { request: (r) => provider.send(r.method, r.params) },
    adapters
  )
  console.log('completed sucessfully', result)
})()
