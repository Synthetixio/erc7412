import eip7412, { DefaultAdapter } from "../dist/src/index.js";
import http from "http";
import * as viem from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  build,
  runRpc,
  getProvider,
  getFoundryArtifact,
  ChainDefinition,
} from "@usecannon/cli";

async function generate7412CompatibleCall(
  client,
  multicallFunc,
  addressToCall,
  functionName
) {
  const adapters = [];
  adapters.push(new DefaultAdapter("TEST", "http://localhost:8000"));

  const converter = new eip7412.EIP7412(adapters, multicallFunc);

  return await converter.enableERC7412(client, {
    to: addressToCall,
    data: functionName,
  });
}

function startWebServer() {
  return new Promise((resolve) => {
    http
      .createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });

        req.on("end", () => {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end(
            viem.encodeAbiParameters(
              [{ type: "string" }],
              [`Hello World ${viem.hexToNumber(body)}`]
            )
          );
        });
      })
      .listen(8000, resolve);
  });
}

async function makeTestEnv() {
  await startWebServer();

  const node = await runRpc({ port: 8545 });

  const info = await build({
    provider: getProvider(node),
    packageDefinition: { name: "erc7412test", version: "0.0.1" },
    getArtifact: getFoundryArtifact,
    def: new ChainDefinition({
      name: "erc7412test",
      version: "0.0.1",
      contract: {
        Multicall: {
          artifact: "Multicall3_1", // using "multicall3.1" because it bubbles up errors
        },
        OffchainGreeter: {
          artifact: "OffchainGreeter",
        },
      },
    }),
  });

  return info;
}

makeTestEnv().then((netInfo) => {
  const senderAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const greeterAddress = netInfo.outputs.contracts.OffchainGreeter.address;
  const greeterFunc = viem.encodeFunctionData({
    abi: netInfo.outputs.contracts.OffchainGreeter.abi,
    functionName: "greet",
    args: [3],
  });

  function makeMulticall(calls) {
    const ret = viem.encodeFunctionData({
      abi: netInfo.outputs.contracts.Multicall.abi,
      functionName: "aggregate3Value",
      args: [
        calls.map((call) => ({
          target: call.to,
          callData: call.data,
          value: call.value || 0n,
          allowFailure: false,
        })),
      ],
    });

    let totalValue = 0n;
    for (const call of calls) {
      totalValue += call.value || 0n;
    }

    return {
      account: senderAddr,
      to: netInfo.outputs.contracts.Multicall.address,
      data: ret,
      value: totalValue.toString(),
    };
  }

  const walletConfig = {
    chain: {
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      id: 13370,
      chainName: "Cannon Localhost",
      rpcUrls: { default: { http: ["http://localhost:8545"] } },
      blockExplorerUrls: ["http://localhost:8000"],
    },
    transport: viem.custom({
      request: async (req) => {
        const res = await netInfo.provider.send(req.method, req.params);
        return res;
      },
    }),
  };

  const client = viem.createPublicClient(walletConfig);
  const walletClient = viem.createWalletClient({
    account: privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    ),
    transport: walletConfig.transport,
    chain: walletConfig.chain,
  });

  generate7412CompatibleCall(
    client,
    makeMulticall,
    greeterAddress,
    greeterFunc
  ).then((tx) => {
    console.log("Sending multicall transaction with oracle data");
    walletClient
      .sendTransaction({
        account: senderAddr,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })
      .then((hash) => {
        console.log("Multicall transaction hash: " + hash);
        client.waitForTransactionReceipt({ hash }).then(() => {
          console.log("Multicall transaction mined");
          client
            .readContract({
              address: greeterAddress,
              abi: netInfo.outputs.contracts.OffchainGreeter.abi,
              functionName: "greet",
              args: [3],
            })
            .then((res) => {
              console.log(`Oracle data "${res}" is available on chain`);
              process.exit(0);
            });
        });
      });
  });
});
