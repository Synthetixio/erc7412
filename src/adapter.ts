import * as viem from "viem";

export interface Adapter {
  getOracleId(): string;
  fetchOffchainData(
    client: viem.Client,
    oracleContract: viem.Address,
    oracleQuery: viem.Hex
  ): Promise<viem.Hex>;
}
