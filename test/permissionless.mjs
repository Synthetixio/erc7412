// Integration Test with Permissionless.js and Pyth on Base Sepolia.

import * as viem from "viem";
import eip7412 from "../dist/src/index.js";
import { PythAdapter } from "../dist/src/oracles/pyth.js"; 
import { TrustedMulticallForwarderBatcher } from "../dist/src/batchers/trustedmulticallforwarder.js"; 
import { BiconomyBatcher } from "../dist/src/batchers/biconomy.js"; 
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
const adapters = [new PythAdapter("https://hermes.pyth.network/")];
const batchers = [new BiconomyBatcher, new TrustedMulticallForwarderBatcher];
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

  // permissionless.js has logic for constructing the batchTransaction call, would be nice to avoid maintaining them seperately here
  // https://github.com/pimlicolabs/permissionless.js/blob/main/packages/permissionless/accounts/biconomy/signerToBiconomySmartAccount.ts#L344
  // smartAccountClient.encodeCallData([transactions])

  // pythOracleContract.interface should be able to tell us that getBenchmarkPrice is a view function

  // Mutable function, with ERC-4337
  // const transactions = await erc7412.withOracleData(publicClient, txn);
  // await smartAccountClient.sendTransactions({ transactions });

  // Mutable function, with TMF
  // const transaction = await erc7412.buildTransaction(publicClient, txn);
  // await privateClient.sendTransaction(transaction);

  // View function, with ERC-4337
  // Looks like eth_estimateUserOperationGas doesn't return values, so we have to rely on the batchers to know how to generate the batchTransaction call based on the smart account implementation
  // TODO, presumably this comes straight out of a function from erc7412 object? buildTransaction/buildTransaction could return info about the simulation result?
  // These batch implementations don't return values, so we probably need to use Multicall3 for views: https://github.com/bcnmy/scw-contracts/blob/main/contracts/smart-account/SmartAccount.sol#L128

  // View function, with TMF
  // const transaction = await erc7412.buildTransaction(publicClient, txn);
  // await publicClient.call(transaction); // I think this also needs to come from the erc7412 object, because the adapter knows out to parse out the response from the batch transaction function

  // TODO: For views, consider whether we have a "from" address from smartAccountClient and whether "from" is present on the transaction data. We sometimes prefer using the zero address for view calls, since it should have some gas tokens on it that will circumvent the FeeRequired error. This is probably an option, but opt-in or opt-out? Consider starting with from address and fallback to zero address if FeeRequired.

  // So based on the above, I'm thinking there should just be a function for views which just puts the call together with Multicall3 from the zero address.
  // Simulating the return value of a mutable function isn't use case that needs to supported.
})();
