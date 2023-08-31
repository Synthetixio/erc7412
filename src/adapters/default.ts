import { Adapter } from "../adapter";
import * as viem from "viem";
import fetch from "node-fetch";

export class DefaultAdapter implements Adapter {
  constructor(private oracleId: string, private url: string) {}

  getOracleId(): string {
    return this.oracleId;
  }

  async fetchOffchainData(
    _client: viem.Client,
    _oracleContract: viem.Address,
    oracleQuery: viem.Hex
  ): Promise<viem.Hex> {
    return this.fetch(oracleQuery);
  }

  private async fetch(data: viem.Hex): Promise<viem.Hex> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: data,
    });
    if (response.status !== 200) {
      throw new Error(
        `error fetching data (${response.status}): ${await response.text()}`
      );
    }
    return (await response.text()) as viem.Hex;
  }
}
