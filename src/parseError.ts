import * as viem from "viem";

// TODO: Generalize this. See https://github.com/usecannon/cannon/blob/main/packages/builder/src/error/index.ts
export function parseError(error: any): viem.Hex {
	console.debug("decoding error output", error);
	console.debug("cause 1", error.cause);
	console.debug("OK", JSON.stringify(error.cause));
	console.debug("cause 2", error.cause.cause);
	console.debug("cause 2 error", error.cause.cause.error);
	try {
		if (error.cause?.cause?.error?.data) {
			return error.cause?.cause?.error?.data;
		}

		if (error.cause?.error?.data) {
			return error.cause?.error?.data;
		}
	} catch (err) {
		console.error("exception in erc7412 error parser:", err);
	}
	// rethrow the error (and log it so we can see the original)
	console.error("got unknown error in erc7412 parse", error);
	throw error;
}
