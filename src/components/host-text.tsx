import React from "react";

const DEFAULT_MAPPING: Record<string, string> = {
  "app.hypurr.fi": `Lets get you the funds on HyperEVM to initiate the swap.`,
  "app.hyperliquid.xyz": `Lets get you the funds your are missing on Arbitrum to complete the
      deposit.`,
  "app.hyperlend.finance": `Lets get you the funds on HyperEVM to initiate the deposit.`,
  "usefelix.xyz": `Lets get you the funds on HyperEVM to initiate the deposit.`,
  "liminal.money": `Lets get you the funds to initiate the deposit.`,
  "asterdex.com": `Lets get you the funds to initiate the deposit.`,
  "app.storyhunt.xyz": `Lets get you the funds to initiate the swap.`,
  "polymarket.com": `Lets get you the funds to initiate the deposit.`,
};

type HostTextProps = {
  style?: React.CSSProperties;
};

const HostText: React.FC<HostTextProps> = ({ style }) => {
  const origin = window.location.origin;
  const key = Object.keys(DEFAULT_MAPPING).find((k) => origin.includes(k));
  const text = key
    ? DEFAULT_MAPPING[key]
    : `Lets get you the funds to complete the deposit`;

  return <p style={style}>{text}</p>;
};

export default HostText;
