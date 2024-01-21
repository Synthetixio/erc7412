// Integration Test with Permissionless.js and Pyth on Base Sepolia.

import * as viem from "viem";
import eip7412 from "../dist/src/index.js";
import { PythAdapter } from "../dist/src/oracles/pyth.js"; 
import { TrustedMulticallForwarderBatcher } from "../dist/src/batchers/trustedmulticallforwarder.js"; 
import { baseSepolia } from "viem/chains";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { createPublicClient, http } from "viem";

// Initialize ERC-4337 Account Abstraction
// (from https://docs.pimlico.io/permissionless/how-to/accounts/use-simple-account)
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: viem.custom({
    request: ({ method, params }) => {
      return provider.send(method, params);
    },
  }),
});

export const paymasterClient = createPimlicoPaymasterClient({
  transport: http(
    "https://api.pimlico.io/v2/CHAIN/rpc?apikey=API_KEY",
  ),
});

const simpleAccount = await privateKeyToSimpleSmartAccount(publicClient, {
	privateKey: "0xPRIVATE_KEY",
	factoryAddress: "0x9406Cc6185a346906296840746125a0E44976454",
	entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789", // global entrypoint
	address: "0x..." // optional, only if you are using an already created account
});

const smartAccountClient = createSmartAccountClient({
	account: simpleAccount,
	chain: sepolia,
	transport: http(
		"https://api.pimlico.io/v1/CHAIN/rpc?apikey=API_KEY",
	),
	sponsorUserOperation: paymasterClient.sponsorUserOperation, // optional
});

// Initialize ERC-7412 Client Library
const adapters = [new PythAdapter("https://xc-mainnet.pyth.network/")];
const batchers = [new TrustedMulticallForwarderBatcher]; // TODO: Is biconomy batcher (or otherwise) needed if the bundler can take care of everything?
const erc7412 = new eip7412.EIP7412(adapters, batchers);

// Query the price of $PEPE five seconds ago
(async () => {
  // https://usecannon.com/packages/pyth-erc7412-wrapper/latest/84532-andromeda
  const pythOracleContract = new viem.Contract("0xBf01fE835b3315968bbc094f50AE3164e6d3D969", [
    {
      name: "getBenchmarkPrice",
      type: "function",
      stateMutability: "view",
      inputs: [
        {
          internalType: "bytes32",
          name: "priceId",
          type: "bytes32",
        },
        {
          internalType: "uint64",
          name: "requestedTime",
          type: "uint64",
        },
      ],
      outputs: [
        {
          internalType: "int256",
          name: "",
          type: "int256",
        },
      ],
    },
  ]);

  // Calculate the timestamp for 5 seconds ago
  const now = new Date().getTime();
  const timestampFiveSecondsAgo = Math.floor((now - (5 * 1000)) / 1000);

  // We expect this to trigger OracleDataRequired
  const data = pythOracleContract.interface.encodeFunctionData("getBenchmarkPrice", [
    "0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4", // https://pyth.network/price-feeds/crypto-pepe-usd
    timestampFiveSecondsAgo.toString()
  ]);

  const txn = {
    to: pythOracleContract.address,
    data,
  };

  // pythOracleContract.interface should be able to tell us that getBenchmarkPrice is a view function

  // Mutable function, with ERC-4337
  // const transactions = await erc7412.withOracleData(smartAccountClient, txn);
  // await smartAccountClient.sendTransactions({ transactions });

  // Mutable function, with TMF
  // const transaction = await erc7412.buildTransaction(publicClient, txn);
  // await privateClient.sendTransaction(transaction);

  // View function, with ERC-4337
  // TODO, presumably this comes straight out of a function from erc7412 object?

  // View function, with TMF
  // const transaction = await erc7412.buildTransaction(publicClient, txn);
  // await publicClient.call(transaction); // I think this also needs to come from the erc7412 object, because we need to know how to parse out the response to the last call in the list, or at least provide the list?

  // TODO: For views, consider whether we have a "from" address from smartAccountClient and whether "from" is present on the transaction data. We sometimes prefer using the zero address for view calls, since it should have some gas tokens on it that will circumvent the FeeRequired error. This is probably an option, but opt-in or opt-out? Consider starting with from address and fallback to zero address if FeeRequired.
})();