import { type Address } from 'viem'
import { base, baseGoerli } from 'viem/chains'

const WETH_ADDRESS: Record<number, string> = {
  [base.id]: '0x4200000000000000000000000000000000000006',
  [baseGoerli.id]: '0x4200000000000000000000000000000000000006'
}

export function getWETHAddress (chainId: number | undefined): Address {
  return WETH_ADDRESS[chainId ?? 0] as Address
}
