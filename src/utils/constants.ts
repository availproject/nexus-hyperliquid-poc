import { SUPPORTED_TOKENS } from "@avail-project/nexus";

export const TOKEN_MAPPING = {
  1: {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
      symbol: "USDC",
      decimals: 6,
    },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": {
      symbol: "USDT",
      decimals: 6,
    },
  },
  8453: {
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
      symbol: "USDC",
      decimals: 6,
    },
    "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2": {
      symbol: "USDT",
      decimals: 6,
    },
  },
  10: {
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85": {
      symbol: "USDC",
      decimals: 6,
    },
    "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": {
      symbol: "USDT",
      decimals: 6,
    },
  },
  137: {
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": {
      symbol: "USDC",
      decimals: 6,
    },
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": {
      symbol: "USDT",
      decimals: 6,
    },
  },
  43114: {
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": {
      symbol: "USDC",
      decimals: 6,
    },
    "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": {
      symbol: "USDT",
      decimals: 6,
    },
  },
  56: {
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": {
      symbol: "USDC",
      decimals: 18,
    },
    "0x55d398326f99059ff775485246999027b3197955": {
      symbol: "USDT",
      decimals: 18,
    },
  },
  42161: {
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831": {
      symbol: "USDC",
      decimals: 6,
    },
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": {
      symbol: "USDT",
      decimals: 6,
    },
  },
  999: {
    "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb": {
      symbol: "USDT",
      decimals: 6,
    },
    "0xb88339cb7199b77e23db6e890353e22632ba630f": {
      symbol: "USDC",
      decimals: 6,
    },
  },
  1514: {
    "0x54d3d8587907393f069e92d777994cd47a6f931f": {
      symbol: "USDT",
      decimals: 6,
    },
    "0xf1815bd50389c46847f0bda824ec8da914045d14": {
      symbol: "USDC",
      decimals: 6,
    },
  },
} as {
  [chainId: number]: {
    [tokenAddress: string]: {
      symbol: SUPPORTED_TOKENS;
      decimals: number;
    };
  };
};
