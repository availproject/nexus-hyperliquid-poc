export const formatDecimalAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return num.toFixed(3);
};

export const getNameOrUrl = (): string => {
  const DEFAULT_MAPPING: Record<string, string> = {
    "app.hypurr.fi": "HypurrFi",
    "app.hyperliquid.xyz": "HyperLiquid",
    "app.hyperlend.finance": "HyperLend",
    "usefelix.xyz": `Felix`,
  };

  try {
    const origin = window.location.origin;
    const key = Object.keys(DEFAULT_MAPPING).find((k) => origin.includes(k));

    const value = key ? DEFAULT_MAPPING[key] : "HyperLiquid";
    return value;
  } catch {
    return "Invalid URL";
  }
};

export const getExplorerUrl = (hash: string, url: string, path = "tx") => {
  const expUrl = new URL(url);
  let expUrlPath = "";
  if (expUrl.pathname) {
    expUrlPath = expUrl.pathname.endsWith("/")
      ? expUrl.pathname.substring(0, expUrl.pathname.length - 1)
      : expUrl.pathname;
  }
  const pathString = `${expUrlPath}/${path}/${hash}`;
  return new URL(pathString, url).href;
};

export const getChainName = (inputChain: string): string => {
  const DEFAULT_MAPPING: Record<string, string> = {
    Ethereum: "Ethereum Mainnet",
    Arbitrum: "Arbitrum One",
    Base: "Base",
    "BNB Chain": "BNB Smart Chain",
    HyperEVM: "HyperEVM",
    // Kaia: "Kaia Mainnet",
    // OP: "OP Mainnet",
    // Scroll: "Scroll",
    // Sophon: "Sophon",
    // Polygon: "Polygon PoS",
    // Avalanche: "Avalanche C-Chain",
  };

  const key = Object.keys(DEFAULT_MAPPING).find((k) => inputChain.includes(k));
  const value = key ? DEFAULT_MAPPING[key] : "Invalid";
  return value;
};

export const getExplorerBase = (chainId?: number) => {
  switch (chainId) {
    case 1:
      return { url: "https://etherscan.io", name: "Ethereum" };
    case 56:
      return { url: "https://bscscan.com", name: "BNB Smart Chain" };
    case 137:
      return { url: "https://polygonscan.com", name: "Polygon PoS" };
    case 10:
      return { url: "https://optimistic.etherscan.io", name: "Optimism" };
    case 42161:
      return { url: "https://arbiscan.io", name: "Arbitrum One" };
    case 8453:
      return { url: "https://basescan.org", name: "Base" };
    case 43114:
      return { url: "https://snowscan.xyz", name: "Avalanche C-Chain" };
    case 534352:
      return { url: "https://scrollscan.com", name: "Scroll" };
    case 50104:
      return { url: "https://sophscan.xyz", name: "Sophon" };
    case 8217:
      return { url: "https://kaiascan.io", name: "Kaia" };
    case 999:
      return { url: "https://purrsec.com", name: "HyperEVM" };
    case 1514:
      return { url: "https://www.storyscan.io", name: "Story" };
    default:
      return { url: "https://purrsec.com", name: "HyperEVM" };
  }
};

export function decodePath(path: string): string[] {
  const cleanPath = path.startsWith("0x") ? path.slice(2) : path;
  const addresses: string[] = [];

  let i = 0;
  while (i + 40 <= cleanPath.length) {
    // take 20-byte (40 hex chars) as address
    const addr = "0x" + cleanPath.slice(i, i + 40);
    addresses.push(addr.toLowerCase());
    i += 40;

    // skip 3-byte fee (6 hex chars) if more path exists
    if (i + 6 < cleanPath.length) {
      i += 6;
    }
  }

  return addresses;
}

export function getFirstTokenAddress(path: string): string {
  const hex = path.startsWith("0x") ? path.slice(2) : path;
  return "0x" + hex.slice(0, 40); // first 20 bytes
}
