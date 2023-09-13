import * as viem from "viem";

// TODO: Generalize this. See https://github.com/usecannon/cannon/blob/main/packages/builder/src/error/index.ts
export function parseError(error: viem.CallExecutionError): viem.Hex {
  try {
    if (((error as viem.CallExecutionError).cause as any).cause.error.data) {
      return ((error as viem.CallExecutionError).cause as any).cause.error
        .data as viem.Hex;
    }

    return (error as any).data as viem.Hex;
  } catch (err) {
    // rethrow the error (and log it so we can see the original)
    console.error("got unknown error in erc7412 parse", error);
    throw error;
  }
}
