import * as viem from "viem";

// TODO: Generalize this. See https://github.com/usecannon/cannon/blob/main/packages/builder/src/error/index.ts
export function parseError(error: viem.CallExecutionError): viem.Hex {
  return ((error as viem.CallExecutionError).cause as any).cause.error
    .data as viem.Hex;
}
