import * as viem from "viem";

// TODO: Generalize this. See https://github.com/usecannon/cannon/blob/main/packages/builder/src/error/index.ts
export function parseError(error: any): viem.Hex {
	console.debug("decoding error output", error, error.data);
	try {
		if (error.cause?.cause?.error?.data) {
			return error.cause?.cause?.error?.data;
		}

		if (error.error.data) {
			return error.error.data;
		}
	} catch (err) {}
	// rethrow the error (and log it so we can see the original)
	console.error("got unknown error in erc7412 parse", error);
	throw error;
}
