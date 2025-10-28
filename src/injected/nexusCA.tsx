import { debugInfo } from "../utils/debug";
// Rely on chrome.runtime global for MV3 to resolve stylesheet URL
import Decimal from "decimal.js";
import {
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionResult,
  erc20Abi,
  parseAbi,
} from "viem";
import {
  erc20TransferAbi,
  MulticallAbi,
  MulticallAddress,
} from "../utils/multicall";
import { createRoot, Root } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { TOKEN_MAPPING } from "../utils/constants";
import { clearCache, fetchUnifiedBalances } from "./cache";
import { LifiAbi } from "../utils/lifi.abi";
import IntentModal from "../components/intent-modal";
import AllowanceModal from "../components/allowance-modal";
import { setCAEvents } from "./caEvents";
import { formatDecimalAmount, getExplorerBase } from "../utils/lib";
import {
  EthereumProvider,
  NexusSDK,
  OnAllowanceHook,
  OnAllowanceHookData,
  OnIntentHookData,
  ProgressStep,
  SUPPORTED_CHAINS_IDS,
  SUPPORTED_TOKENS,
  UserAsset,
} from "@avail-project/nexus";
import { publicClient } from "../utils/publicClient";
import type {} from "@avail-project/nexus";
import { NexusSteps } from "../components/event-modal";
import { createPortal } from "react-dom";

interface ExtendedStep extends ProgressStep {
  done: boolean;
  data?: any; // if you want to store explorerURL, hash, etc.
}

type EVMProvider = EthereumProvider & {
  isConnected?: () => Promise<boolean>;
  selectedAddress?: string;
};

const providers = [] as {
  info: {
    name: string;
    icon: string;
    rdns: string;
    uuid: string;
  };
  provider: EVMProvider;
}[];

window.addEventListener("eip6963:announceProvider", (event: any) => {
  debugInfo("eip6963:announceProvider event received:", event);
  if (!providers.find((p) => p.info.name === event.detail.info.name)) {
    providers.push(event.detail);
  }
});

// The DApp dispatches a request event which will be heard by
// Wallets' code that had run earlier
window.dispatchEvent(new Event("eip6963:requestProvider"));

let reactRoot: Root;
let reactRootElement: Element | null = null;

function render(App: React.FC) {
  // Create a Shadow DOM host to avoid leaking styles into the dApp and vice-versa
  let host = document.getElementById("nexus-root-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "nexus-root-host";
    host.style.position = "fixed";
    host.style.zIndex = "9999999999";
    const shadow = host.attachShadow({ mode: "open" });
    const root = document.createElement("div");
    root.id = "nexus-root";
    shadow.appendChild(root);
    document.body.appendChild(host);
    reactRootElement = root;
  }

  if (!reactRoot) {
    if (!reactRootElement) {
      const shadow = (host as any).shadowRoot as ShadowRoot | null;
      reactRootElement = shadow?.getElementById("nexus-root") || null;
    }
    reactRoot = createRoot(reactRootElement!);
  }

  fixAppModal();

  try {
    debugInfo("RENDERING APP");
    reactRoot.render(<App />);
  } catch (e) {
    debugInfo("ERROR RENDERING APP", e);
  }
}

function fixAppModal() {
  document
    .querySelector(".sc-bBABsx.fAsTrb:has(.sc-fLcnxK.iOdKba.modal)")
    ?.setAttribute("style", "z-index: 40");
  document
    .querySelector(".sc-bBABsx.jWjRYk:has(.modal)")
    ?.setAttribute("style", "z-index: 40");
}

function ShadowPortal({ children }: { children: any }) {
  const host = document.getElementById("nexus-root-host");
  const shadow = host?.shadowRoot as ShadowRoot | null;
  const container = shadow?.getElementById("nexus-root") || null;

  if (!container || !container.isConnected) {
    console.warn("⚠️ ShadowPortal target missing — skipping render");
    return null;
  }
  return createPortal(children!, container!);
}

type Step = {
  typeID: string;
  type: string;
  done: boolean;
  data?: any;
};

function NexusApp() {
  const ca = new NexusSDK();
  const [intent, setIntent] = useState<OnIntentHookData | null>(null);

  const [allowance, setAllowance] = useState<OnAllowanceHookData | null>(null);

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentSource, setCurrentSource] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [currentAllowance, setCurrentAllowance] = useState(0);
  const [totalAllowances, setTotalAllowances] = useState(0);
  const [title, setTitle] = useState("Signing Intent");
  const [intentStepsOpen, setIntentStepsOpen] = useState<boolean>(false);
  const [txURL, setTxURL] = useState<string>("");
  const [error, setError] = useState<boolean>(false);
  const chainIdRef = useRef(1);

  const unifiedBalancesRef = useRef<UserAsset[] | null>(null);

  const requiredAmountRef = useRef<string | null>(null);

  ca.setOnIntentHook(({ intent, allow, deny, refresh }) => {
    debugInfo("ON INTENT HOOK", { intent, allow, deny, refresh });
    setIntent({ intent, allow, deny, refresh });
  });

  ca.setOnAllowanceHook(
    ({ allow, deny, sources }: Parameters<OnAllowanceHook>[0]) => {
      debugInfo("ON ALLOWANCE HOOK", { allow, deny, sources });
      setAllowance({ allow, deny, sources });
    }
  );

  const handleExpectedSteps = (data: Step[]) => {
    try {
      const newSteps = [
        ...data.map((s) => ({
          ...s,
          done: false,
        })),
        {
          type: "SUBMIT_TRANSACTION",
          typeID: "ST",
          done: false,
        },
      ];
      setIntentStepsOpen(true);
      setSteps(newSteps);
      setCurrentSource(0);
      setTotalSources(0);
      setCurrentAllowance(0);
      setTotalAllowances(0);

      let allowanceCount = 0;
      let sourcesCount = 0;
      newSteps.forEach((s) => {
        if (s.type === "ALLOWANCE_USER_APPROVAL") {
          allowanceCount++;
        }
        if (s.type === "INTENT_COLLECTION" && s.data?.total) {
          sourcesCount = s.data.total;
        }
      });

      setTotalAllowances(allowanceCount);
      setTotalSources(sourcesCount);
      setTitle("Signing Intent");
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleStepComplete = (data: any, chainId: number) => {
    try {
      const chainN = getExplorerBase(chainId).name;

      switch (data.type) {
        case "ALLOWANCE_ALL_DONE":
          setTitle("Allowances setup done");
          break;

        case "ALLOWANCE_USER_APPROVAL":
          setTitle(`Setting up allowances on ${data.data.chainName}`);
          break;

        case "ALLOWANCE_APPROVAL_MINED":
          setCurrentAllowance((prev) => prev + 1);
          break;

        case "INTENT_ACCEPTED":
          setTitle("Submitting Intent");
          break;

        case "INTENT_SUBMITTED":
          setTitle("Collecting from Sources");
          break;

        case "INTENT_COLLECTION":
          setCurrentSource((prev) => prev + 1);
          break;

        case "INTENT_COLLECTION_COMPLETE":
          setTitle(`Receiving on ${chainN ?? "HyperEVM"}`);
          break;

        case "INTENT_FULFILLED":
          setTitle("Submitting Transaction");
          break;

        case "SUBMIT_TRANSACTION":
          setTitle("Submitting Transaction");
          break;

        default:
          break;
      }

      setSteps((prev) =>
        prev.map((s) =>
          s.typeID === data.typeID ? { ...s, done: true, data: data.data } : s
        )
      );
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    debugInfo(
      "Detected Providers:",
      providers.length,
      providers.map((p) => ({
        name: p.info.name,
        hasSelectedAddress: !!p.provider.selectedAddress,
      }))
    );

    let activeProvider: {
      info: { name: string; icon?: string };
      provider: EVMProvider;
      address: string;
    } | null = null;

    const initializeCA = async () => {
      // Find the first provider with an active connection
      for (const provider of providers) {
        debugInfo(`=== Checking provider: ${provider.info.name} ===`);

        try {
          let address = provider.provider.selectedAddress;
          debugInfo(
            `Initial selectedAddress for ${provider.info.name}:`,
            address
          );

          // If selectedAddress is not available, try requesting accounts
          if (!address) {
            debugInfo(
              `No selectedAddress, trying eth_accounts for ${provider.info.name}`
            );
            try {
              const accounts = (await provider.provider.request?.({
                method: "eth_accounts",
              })) as string[] | undefined;
              debugInfo(
                `eth_accounts result for ${provider.info.name}:`,
                accounts
              );
              address = accounts?.[0] || undefined;
            } catch (ethAccountsError) {
              debugInfo(
                `eth_accounts failed for ${provider.info.name}:`,
                ethAccountsError
              );
            }
          }

          if (address) {
            debugInfo(
              `Found active provider: ${provider.info.name} with address:`,
              address
            );
            activeProvider = {
              info: provider.info,
              provider: provider.provider,
              address,
            };

            // Set up CA with the active provider
            await provider.provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x1" }],
            });
            await ca.initialize(provider.provider);
            window.nexus = ca;
            if (
              window.origin === "https://app.hyperlend.finance" ||
              window.origin === "https://www.usefelix.xyz" ||
              window.origin === "https://liminal.money"
            ) {
              await provider.provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x3e7" }],
              });
            }
            setCAEvents(ca);
            fetchUnifiedBalances().then((balances) => {
              unifiedBalancesRef.current = balances;
            });

            // Send update for the active provider
            const message = {
              type: "NEXUS_PROVIDER_UPDATE",
              providerName: provider.info.name,
              walletAddress: address,
              providerIcon: provider.info.icon ?? null,
            };
            debugInfo("Posting message for active provider:", message);
            // Add delay to ensure content script is ready
            setTimeout(() => window.postMessage(message, "*"), 100);

            break; // Stop looking once we find an active provider
          }
        } catch (error) {
          debugInfo(`Error checking provider ${provider.info.name}:`, error);
        }
      }

      if (!activeProvider) {
        console.log("No active provider found");
        // Send a message indicating no provider is active
        setTimeout(
          () =>
            window.postMessage(
              {
                type: "NEXUS_PROVIDER_UPDATE",
                providerName: null,
                walletAddress: null,
                providerIcon: null,
              },
              "*"
            ),
          100
        );
      }
    };

    initializeCA();

    // Set up event listeners for all providers, but only update if it's the active one
    for (const provider of providers) {
      provider.provider.on("accountsChanged", async (event) => {
        // debugInfo("ON ACCOUNT CHANGED", event, provider.info.name);
        if (event.length) {
          const address = event[0] || provider.provider.selectedAddress;
          // Re-initialize CA with the new active provider
          // ca.setEVMProvider(provider.provider);

          await provider.provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x1" }],
          });
          await ca.initialize(provider.provider).then(async () => {
            window.nexus = ca;
            if (
              window.origin === "https://app.hyperlend.finance" ||
              window.origin === "https://www.usefelix.xyz" ||
              window.origin === "https://liminal.money"
            ) {
              await provider.provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x3e7" }],
              });
            }
            setCAEvents(ca);
            fetchUnifiedBalances().then((balances) => {
              unifiedBalancesRef.current = balances;
            });
            try {
              window.postMessage(
                {
                  type: "NEXUS_PROVIDER_UPDATE",
                  providerName: provider.info.name,
                  walletAddress: address,
                  providerIcon: provider.info.icon ?? null,
                },
                "*"
              );
              console.log(
                "Account changed - updated active provider:",
                provider.info.name,
                address
              );
            } catch {}
          });
        } else {
          // Check if this was the active provider that got disconnected
          if (
            activeProvider &&
            activeProvider.info.name === provider.info.name
          ) {
            ca.deinit();

            clearCache();
            activeProvider = null;
            try {
              window.postMessage(
                {
                  type: "NEXUS_PROVIDER_UPDATE",
                  providerName: null,
                  walletAddress: null,
                  providerIcon: null,
                },
                "*"
              );
            } catch {}
          }
        }
      });

      // provider.provider.on("connect", async (event) => {
      //   debugInfo("ON CONNECT", event, provider.info.name);

      //   let address = provider.provider.selectedAddress;
      //   if (!address) {
      //     try {
      //       const accounts = (await provider.provider.request?.({
      //         method: "eth_accounts",
      //       })) as string[] | undefined;
      //       address = accounts?.[0] || undefined;
      //     } catch {}
      //   }

      //   if (address) {
      //     // Update active provider
      //     activeProvider = {
      //       info: provider.info,
      //       provider: provider.provider,
      //       address,
      //     };
      //     ca.setEVMProvider(provider.provider);
      //     ca.init().then(() => {
      //       window.nexus = ca;
      //       setCAEvents(ca);
      //       fetchUnifiedBalances();
      //       try {
      //         window.postMessage(
      //           {
      //             type: "NEXUS_PROVIDER_UPDATE",
      //             providerName: provider.info.name,
      //             walletAddress: address,
      //             providerIcon: provider.info.icon ?? null,
      //           },
      //           "*"
      //         );
      //         console.log(
      //           "Connect event - new active provider:",
      //           provider.info.name,
      //           address
      //         );
      //       } catch {}
      //     });
      //   }
      // });

      // Set up request interceptor for this provider
      const originalRequest = provider.provider.request;
      debugInfo("Adding Request Interceptor", provider);
      provider.provider.request = async function (...args) {
        debugInfo("Intercepted in useEffect", ...args);

        const { method, params } = args[0] as {
          method: string;
          params?: any[];
        };

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          params[0].data.toLowerCase().startsWith("0x0efe6a8b")
        ) {
          const unifiedBalances = await fetchUnifiedBalances();
          unifiedBalancesRef.current = unifiedBalances;

          const decodedData = decodeFunctionData({
            abi: MulticallAbi,
            data: params[0].data,
          });

          const newArgs = decodedData?.args as any;
          const paramAmount = newArgs[1].toString();
          const tokenAddress = newArgs[0].toLowerCase();

          const tokenIndex = unifiedBalances.findIndex((bal) =>
            bal.breakdown.find(
              (token) => token.contractAddress.toLowerCase() === tokenAddress
            )
          );
          if (tokenIndex === -1) {
            return originalRequest.apply(this, args);
          }
          const actualToken = unifiedBalances[tokenIndex].breakdown.find(
            (token) => token.contractAddress.toLowerCase() === tokenAddress
          );

          if (
            new Decimal(actualToken?.balance || "0")
              .mul(Decimal.pow(10, actualToken?.decimals || 0))
              .lessThan(paramAmount)
          ) {
            document.body.style.pointerEvents = "auto";
            const requiredAmount = new Decimal(paramAmount)
              .minus(
                Decimal.mul(
                  actualToken?.balance || "0",
                  Decimal.pow(10, actualToken?.decimals || 0)
                )
              )
              .div(Decimal.pow(10, actualToken?.decimals || 0))
              .toFixed();

            requiredAmountRef.current = formatDecimalAmount(requiredAmount);
            const chainIdHex = await window.nexus.request({
              method: "eth_chainId",
            });
            const chainId = parseInt(String(chainIdHex), 16);
            chainIdRef.current = chainId;
            const handler = await ca.bridge({
              amount: requiredAmount,
              token: TOKEN_MAPPING[chainId][tokenAddress]
                .symbol as SUPPORTED_TOKENS,
              chainId: chainId as SUPPORTED_CHAINS_IDS,
            });
            console.log("BRIDGE Response", handler);
            if (!handler.success) {
              const errorMessage = {
                code: 4001,
                message: "User rejected the request.",
                details: "User denied intent.",
                version: "viem@2.33.3",
              };
              setError(true);
              throw errorMessage;
            }
            const hashResponse = await originalRequest.apply(this, args);
            setTxURL(hashResponse as string);
            return hashResponse;
          }
        }

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          (params[0].data.toLowerCase().startsWith("0x4d8160ba") ||
            params[0].data.toLowerCase().startsWith("0xb9303701"))
        ) {
          const unifiedBalances = await fetchUnifiedBalances();

          unifiedBalancesRef.current = unifiedBalances;
          const abiItem = parseAbi([
            "function createSaltedOrder((address,uint256,bytes,uint256,uint256,bytes,address,bytes,bytes,bytes,bytes),uint64,bytes,uint32,bytes,bytes)",
          ]);

          const decodedData = decodeFunctionData({
            abi: [...MulticallAbi, ...abiItem],
            data: params[0].data,
          });

          const newArgs = decodedData?.args as any;

          const paramAmount = Array.isArray(newArgs[0])
            ? (newArgs[0][1] as bigint).toString()
            : (newArgs[1] as bigint).toString();
          const tokenAddress = Array.isArray(newArgs[0])
            ? (newArgs[0][0] as string).toLowerCase()
            : (newArgs[0] as string).toLowerCase();

          const tokenIndex = unifiedBalances.findIndex((bal) =>
            bal.breakdown.find(
              (token) => token.contractAddress.toLowerCase() === tokenAddress
            )
          );
          if (tokenIndex === -1) {
            return originalRequest.apply(this, args);
          }
          const actualToken = unifiedBalances[tokenIndex].breakdown.find(
            (token) => token.contractAddress.toLowerCase() === tokenAddress
          );

          if (
            new Decimal(actualToken?.balance || "0")
              .mul(Decimal.pow(10, actualToken?.decimals || 0))
              .lessThan(paramAmount)
          ) {
            const requiredAmount = new Decimal(paramAmount)
              .minus(
                Decimal.mul(
                  actualToken?.balance || "0",
                  Decimal.pow(10, actualToken?.decimals || 0)
                )
              )
              .div(Decimal.pow(10, actualToken?.decimals || 0))
              .toFixed();

            requiredAmountRef.current = formatDecimalAmount(requiredAmount);
            const chainIdHex = await window.nexus.request({
              method: "eth_chainId",
            });
            const chainId = parseInt(String(chainIdHex), 16);
            chainIdRef.current = chainId;
            const handler = await ca.bridge({
              amount: requiredAmount,
              token: TOKEN_MAPPING[chainId][tokenAddress]
                .symbol as SUPPORTED_TOKENS,
              chainId: chainId as SUPPORTED_CHAINS_IDS,
            });
            console.log("BRIDGE Response", handler);
            if (!handler.success) {
              const errorMessage = {
                code: 4001,
                message: "User rejected the request.",
                details: "User denied intent.",
                version: "viem@2.33.3",
              };
              setError(true);
              throw errorMessage;
            }
            const hashResponse = await originalRequest.apply(this, args);
            setTxURL(hashResponse as string);
            return hashResponse;
          }
        }

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          params[0].data.toLowerCase().startsWith("0x6e553f65")
        ) {
          const unifiedBalances = await fetchUnifiedBalances();

          unifiedBalancesRef.current = unifiedBalances;

          const decodedData = decodeFunctionData({
            abi: MulticallAbi,
            data: params[0].data,
          });

          const paramAmount = (decodedData.args?.[0] as bigint).toString();
          const tokenAddress = await publicClient.readContract({
            address: params[0]?.to,
            abi: MulticallAbi,
            functionName: "asset",
          });
          const tokenIndex = unifiedBalances.findIndex((bal) =>
            bal.breakdown.find(
              (token) =>
                token.contractAddress.toLowerCase() ===
                (tokenAddress as string).toLowerCase()
            )
          );
          if (tokenIndex === -1) {
            return originalRequest.apply(this, args);
          }
          const actualToken = unifiedBalances[tokenIndex].breakdown.find(
            (token) =>
              token.contractAddress.toLowerCase() ===
              (tokenAddress as string).toLowerCase()
          );

          if (
            new Decimal(actualToken?.balance || "0")
              .mul(Decimal.pow(10, actualToken?.decimals || 0))
              .lessThan(paramAmount)
          ) {
            document.body.style.pointerEvents = "auto";
            const requiredAmount = new Decimal(paramAmount)
              .minus(
                Decimal.mul(
                  actualToken?.balance || "0",
                  Decimal.pow(10, actualToken?.decimals || 0)
                )
              )
              .div(Decimal.pow(10, actualToken?.decimals || 0))
              .toFixed();

            requiredAmountRef.current = formatDecimalAmount(requiredAmount);
            const chainIdHex = await window.nexus.request({
              method: "eth_chainId",
            });
            const chainId = parseInt(String(chainIdHex), 16);
            chainIdRef.current = chainId;
            const handler = await ca.bridge({
              amount: requiredAmount,
              token: TOKEN_MAPPING[chainId][
                (tokenAddress as string).toLowerCase()
              ].symbol as SUPPORTED_TOKENS,
              chainId: chainId as SUPPORTED_CHAINS_IDS,
            });
            console.log("BRIDGE Response", handler);
            if (!handler.success) {
              const errorMessage = {
                code: 4001,
                message: "User rejected the request.",
                details: "User denied intent.",
                version: "viem@2.33.3",
              };
              setError(true);
              throw errorMessage;
            }
            const hashResponse = await originalRequest.apply(this, args);
            setTxURL(hashResponse as string);
            return hashResponse;
          }
        }

        if (
          method === "eth_call" &&
          params?.[0] &&
          params[0].data.toLowerCase().startsWith("0x70a08231")
        ) {
          debugInfo("BALANCE OF CALLED INSIDE REQUEST", params);
        }

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          (params[0].data.toLowerCase().startsWith("0xe28c8be3") ||
            params[0].data.toLowerCase().startsWith("0xf24f0847"))
        ) {
          const unifiedBalances = await fetchUnifiedBalances();
          unifiedBalancesRef.current = unifiedBalances;
          const abiItem = parseAbi([
            "function zapIn(address tokenIn, uint256 amountIn, uint256 amountOutMin, uint256 minimumMint, uint256 deadline, address[] tokens, (address tokenIn, address tokenOut, uint8 routerIndex, uint24 fee, uint256 amountIn, bool stable)[][], uint256 expectedAmountOut, uint256 feeBps)",
            "function zapInGluex(address tokenIn,uint256 amountIn,bytes gluexData,uint256 amountOutMin,uint256 minimumMint,uint256 deadline)",
          ]);
          const decodedData = decodeFunctionData({
            abi: abiItem,
            data: params[0].data,
          });

          const paramAmount = decodedData.args[1].toString();
          const tokenAddress = decodedData.args[0].toLowerCase();
          const tokenIndex = unifiedBalances.findIndex((bal) =>
            bal.breakdown.find(
              (token) => token.contractAddress.toLowerCase() === tokenAddress
            )
          );
          if (tokenIndex === -1) {
            return originalRequest.apply(this, args);
          }
          const actualToken = unifiedBalances[tokenIndex].breakdown.find(
            (token) => token.contractAddress.toLowerCase() === tokenAddress
          );

          if (
            new Decimal(actualToken?.balance || "0")
              .mul(Decimal.pow(10, actualToken?.decimals || 0))
              .lessThan(paramAmount)
          ) {
            document.body.style.pointerEvents = "auto";
            const requiredAmount = new Decimal(paramAmount)
              .minus(
                Decimal.mul(
                  actualToken?.balance || "0",
                  Decimal.pow(10, actualToken?.decimals || 0)
                )
              )
              .div(Decimal.pow(10, actualToken?.decimals || 0))
              .toFixed();
            requiredAmountRef.current = formatDecimalAmount(requiredAmount);
            const chainIdHex = await window.nexus.request({
              method: "eth_chainId",
            });
            const chainId = parseInt(String(chainIdHex), 16);
            chainIdRef.current = chainId;
            const handler = await ca.bridge({
              amount: requiredAmount,
              token: TOKEN_MAPPING[chainId][tokenAddress.toLowerCase()]
                .symbol as SUPPORTED_TOKENS,
              chainId: chainId as SUPPORTED_CHAINS_IDS,
            });
            console.log("BRIDGE Response", handler);
            if (!handler.success) {
              const errorMessage = {
                code: 4001,
                message: "User rejected the request.",
                details: "User denied intent.",
                version: "viem@2.33.3",
              };
              throw errorMessage;
            }

            return originalRequest.apply(this, args);
          }
        }

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          (params[0].data.toLowerCase().startsWith("0x095ea7b3") ||
            params[0].data.toLowerCase().startsWith("0xa9059cbb"))
        ) {
          if (window.origin === "https://app.hypurr.fi") {
            const unifiedBalances = await fetchUnifiedBalances();
            unifiedBalancesRef.current = unifiedBalances;
            const decodedData = decodeFunctionData({
              abi: erc20Abi,
              data: params[0].data,
            });

            if (decodedData && decodedData?.args && params[0]?.to) {
              const tokenAddress = String(params[0]?.to).toLowerCase();
              const tokenIndex = unifiedBalances.findIndex((bal) =>
                bal.breakdown.find(
                  (token) =>
                    token.contractAddress.toLowerCase() === tokenAddress
                )
              );
              if (tokenIndex === -1) {
                return originalRequest.apply(this, args);
              }
              const actualToken = unifiedBalances[tokenIndex].breakdown.find(
                (token) => token.contractAddress.toLowerCase() === tokenAddress
              );
              const paramAmount = decodedData?.args?.[1] as bigint;

              if (
                new Decimal(actualToken?.balance || "0")
                  .mul(Decimal.pow(10, actualToken?.decimals || 0))
                  .lessThan(paramAmount)
              ) {
                const requiredAmount = new Decimal(paramAmount)
                  .minus(
                    Decimal.mul(
                      actualToken?.balance || "0",
                      Decimal.pow(10, actualToken?.decimals || 0)
                    )
                  )
                  .div(Decimal.pow(10, actualToken?.decimals || 0))
                  .toFixed();
                requiredAmountRef.current = formatDecimalAmount(requiredAmount);
                const chainIdHex = await window.nexus.request({
                  method: "eth_chainId",
                });
                const chainId = parseInt(String(chainIdHex), 16);
                chainIdRef.current = chainId;
                const handler = await ca.bridge({
                  amount: requiredAmount,
                  token: TOKEN_MAPPING[chainId][tokenAddress.toLowerCase()]
                    .symbol as SUPPORTED_TOKENS,
                  chainId: chainId as SUPPORTED_CHAINS_IDS,
                });

                if (!handler.success) {
                  const errorMessage = {
                    code: 4001,
                    message: "User rejected the request.",
                    details: "User denied intent.",
                    version: "viem@2.33.3",
                  };
                  throw errorMessage;
                }
                return originalRequest.apply(this, args);
              }
            }
          }
        }

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          (params[0].data.toLowerCase().startsWith("0xa9059cbb") || // ERC20 transfer
            params[0].data.toLowerCase().startsWith("0x23b872dd")) // ERC20 transferFrom
        ) {
          const unifiedBalances = await fetchUnifiedBalances();
          unifiedBalancesRef.current = unifiedBalances;
          const tokenAddress = params[0].to.toLowerCase() as string;
          const tokenIndex = unifiedBalances.findIndex((bal) =>
            bal.breakdown.find(
              (token) => token.contractAddress.toLowerCase() === tokenAddress
            )
          );
          if (tokenIndex === -1) {
            return originalRequest.apply(this, args);
          }
          const actualToken = unifiedBalances[tokenIndex].breakdown.find(
            (token) => token.contractAddress.toLowerCase() === tokenAddress
          );
          const decodedData = decodeFunctionData({
            abi: erc20TransferAbi,
            data: params[0].data,
          });

          const paramAmount = params[0].data
            .toLowerCase()
            .startsWith("0xa9059cbb")
            ? (decodedData.args![1] as bigint).toString()
            : (decodedData.args![2] as bigint).toString();

          const amount = new Decimal(paramAmount)
            .div(Decimal.pow(10, actualToken?.decimals || 0))
            .toFixed();

          debugInfo("amount decoded:", amount);
          debugInfo("actual contract:", decodedData.args![0]);
          debugInfo("actual transaction:", args[0]);

          if (
            new Decimal(actualToken?.balance || "0")
              .mul(Decimal.pow(10, actualToken?.decimals || 0))
              .lessThan(paramAmount)
          ) {
            const modal = document.querySelector(".modal")!;
            const mainDiv =
              modal.children[1].children[0].children[0].children[1].children[0];
            mainDiv.children[0].innerHTML = "Building Intent";
            mainDiv.children[1].innerHTML = "";
            const mainDiv2 =
              modal.children[1].children[0].children[0].children[1].children[1];
            mainDiv2.setAttribute(
              "style",
              mainDiv2.getAttribute("style") + "visibility: hidden;"
            );
            const requiredAmount = new Decimal(paramAmount)
              .minus(
                Decimal.mul(
                  actualToken?.balance || "0",
                  Decimal.pow(10, actualToken?.decimals || 0)
                )
              )
              .div(Decimal.pow(10, actualToken?.decimals || 0))
              .toFixed();
            requiredAmountRef.current = formatDecimalAmount(requiredAmount);
            const handler = await ca.bridge({
              amount: requiredAmount,
              token: TOKEN_MAPPING[42161][
                tokenAddress.toLowerCase()
              ].symbol.toLowerCase() as SUPPORTED_TOKENS,
              chainId: 42161,
            });
            const res = handler;
            debugInfo("BRIDGE Response", res);
            return originalRequest.apply(this, args);
          }
        }

        if (
          method === "eth_sendTransaction" &&
          params?.[0] &&
          params[0].data.toLowerCase().startsWith("0x4666fc80")
        ) {
          const unifiedBalances = await fetchUnifiedBalances();
          unifiedBalancesRef.current = unifiedBalances;
          const decodedData = decodeFunctionData({
            abi: LifiAbi,
            data: params[0].data,
          });
          debugInfo(
            "LIFI DECODED",
            decodedData.args[5].fromAmount,
            decodedData.args[5].sendingAssetId
          );
          const paramAmount = decodedData.args[5].fromAmount.toString();
          const tokenAddress = decodedData.args[5].sendingAssetId.toLowerCase();

          const tokenIndex = unifiedBalances.findIndex((bal) =>
            bal.breakdown.find(
              (token) => token.contractAddress.toLowerCase() === tokenAddress
            )
          );
          if (tokenIndex === -1) {
            return originalRequest.apply(this, args);
          }
          const actualToken = unifiedBalances[tokenIndex].breakdown.find(
            (token) => token.contractAddress.toLowerCase() === tokenAddress
          );

          if (
            new Decimal(actualToken?.balance || "0")
              .mul(Decimal.pow(10, actualToken?.decimals || 0))
              .lessThan(paramAmount)
          ) {
            const requiredAmount = new Decimal(paramAmount)
              .minus(
                Decimal.mul(
                  actualToken?.balance || "0",
                  Decimal.pow(10, actualToken?.decimals || 0)
                )
              )
              .div(Decimal.pow(10, actualToken?.decimals || 0))
              .toFixed();
            requiredAmountRef.current = formatDecimalAmount(requiredAmount);
            const handler = await ca.bridge({
              amount: requiredAmount,
              token: TOKEN_MAPPING[42161][
                tokenAddress.toLowerCase()
              ].symbol.toLowerCase() as SUPPORTED_TOKENS,
              chainId: 42161,
            });
            const res = handler;
            debugInfo("BRIDGE Response", res);
            return originalRequest.apply(this, args);
          }
        }

        if (
          method === "eth_call" &&
          params?.[0] &&
          params[0].to?.toLowerCase() === MulticallAddress
        ) {
          const decoded = decodeFunctionData({
            abi: MulticallAbi,
            data: params[0].data,
          });
          const responseData = await originalRequest.apply(this, args);

          if (decoded.functionName === "aggregate3") {
            if (!responseData) {
              debugInfo(
                "No result in aggregate3 response, returning original response"
              );
              return responseData;
            }
            const res = responseData as `0x${string}`;
            const decodedResult = decodeFunctionResult({
              abi: MulticallAbi,
              functionName: "aggregate3",
              data: res,
            }) as { success: boolean; returnData: string }[];
            const params = decoded.args![0] as {
              target: string;
              callData: `0x${string}`;
              allowFailure: boolean;
            }[];
            const unifiedBalances = await fetchUnifiedBalances();
            unifiedBalancesRef.current = unifiedBalances;
            params.forEach((param, pIndex) => {
              try {
                const decodedParam = decodeFunctionData({
                  abi: MulticallAbi,
                  data: param.callData,
                });
                if (decodedParam.functionName !== "balanceOf") {
                  return;
                }
                const index = unifiedBalances.findIndex((bal) =>
                  bal.breakdown.find(
                    (asset) =>
                      asset.contractAddress.toLowerCase() ===
                      param.target.toLowerCase()
                  )
                );
                if (index === -1) {
                  return;
                }
                const asset = unifiedBalances[index];
                const actualAsset = asset.breakdown.find(
                  (token) =>
                    token.contractAddress.toLowerCase() ===
                    param.target.toLowerCase()
                );
                decodedResult[pIndex].returnData = encodeFunctionResult({
                  abi: MulticallAbi,
                  functionName: "balanceOf",
                  result: BigInt(
                    new Decimal(asset.balance)
                      .mul(
                        Decimal.pow(10, actualAsset!.decimals || asset.decimals)
                      )
                      .floor()
                      .toFixed()
                  ),
                });
              } catch (error) {
                console.error(
                  "Failed to decode callData for target:",
                  param.target,
                  "Error:",
                  error
                );
              }
            });
            const modifiedResult = encodeFunctionResult({
              abi: MulticallAbi,
              functionName: "aggregate3",
              result: decodedResult,
            });
            return modifiedResult;
          }
          return responseData;
        }
        return originalRequest.apply(this, args);
      };
    }

    console.log(chainIdRef.current, "chainN");
    const onStepComplete = (data: any) => {
      handleStepComplete(data, chainIdRef.current);
    };

    ca.nexusEvents.on("expected_steps", handleExpectedSteps);
    ca.nexusEvents.on("step_complete", onStepComplete);

    return () => {
      ca.nexusEvents.off("expected_steps", handleExpectedSteps);
      ca.nexusEvents.off("step_complete", handleStepComplete);
    };
  }, []);

  useEffect(() => {
    if (error) {
      setIntentStepsOpen(false);
      setError(false);
      setTxURL("");
    }
  }, [error]);

  return (
    <>
      <ShadowPortal>
        {intent && (
          <IntentModal
            intentModal={intent}
            setIntentModal={setIntent}
            requiredAmount={requiredAmountRef.current}
            unifiedBalances={unifiedBalancesRef.current}
            setIntentStepsOpen={setIntentStepsOpen}
          />
        )}

        {allowance && (
          <AllowanceModal
            allowance={allowance}
            setAllowance={setAllowance}
            setIntentStepsOpen={setIntentStepsOpen}
          />
        )}

        {intentStepsOpen && !intent && !allowance && (
          <NexusSteps
            steps={steps}
            title={title}
            currentSource={currentSource}
            totalSources={totalSources}
            currentAllowance={currentAllowance}
            totalAllowances={totalAllowances}
            setIntentStepsOpen={setIntentStepsOpen}
            txURL={txURL}
            chainId={chainIdRef}
            setIntent={setIntent}
            setTxURL={setTxURL}
          />
        )}
      </ShadowPortal>
    </>
  );
}

function NexusProviderApp() {
  return <NexusApp />;
}
render(NexusProviderApp);

const observer = new MutationObserver(() => {
  const host = document.getElementById("nexus-root-host");
  if (!host) {
    if (reactRoot) {
      reactRoot.unmount();
      render(NexusProviderApp);
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });
