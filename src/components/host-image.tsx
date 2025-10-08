import React from "react";
import hypurrFiLogo from "../assets/logo/hypurrFi.svg";
import liminalLogo from "../assets/logo/liminal.svg";
import asterDexLogo from "../assets/logo/asterDex.svg";
import storyHuntLogo from "../assets/logo/storyHunt.svg";

const DEFAULT_MAPPING: Record<string, string> = {
  "app.hypurr.fi": hypurrFiLogo,
  "app.hyperliquid.xyz": "/src/assets/logo/hyperliquid.png",
  "app.hyperlend.finance": "HyperLend",
  "usefelix.xyz": `Felix`,
  "liminal.money": liminalLogo,
  "asterdex.com": asterDexLogo,
  "app.storyhunt.xyz": storyHuntLogo,
};

const STYLE_MAPPING: Record<string, React.CSSProperties> = {
  "app.hypurr.fi": { height: 32, width: 70, marginLeft: -25 },
  "app.hyperliquid.xyz": {},
  "app.hyperlend.finance": {
    color: "rgb(202,234,229)",
    fontSize: "0.938rem",
    marginLeft: "-35px",
    marginTop: "12px",
  },
  "usefelix.xyz": {
    color: "#FFF",
    fontSize: "2rem",
    marginLeft: "-20px",
    marginTop: "12px",
  },
  "liminal.money": {
    height: 48,
    width: 130,
    marginLeft: -50,
    marginRight: -35,
    marginTop: 10,
  },
  "asterdex.com": {
    height: 34,
    width: 130,
    marginLeft: -50,
    marginRight: -35,
    marginTop: 10,
  },
  "app.storyhunt.xyz": {
    height: 46,
    width: 130,
    marginLeft: -50,
    marginRight: -35,
    marginTop: 10,
  },
};

const HostImage: React.FC = () => {
  const origin = window.location.origin;
  const key = Object.keys(DEFAULT_MAPPING).find((k) => origin.includes(k));

  const value = key ? DEFAULT_MAPPING[key] : "/images/default.png";
  const customStyle = key ? STYLE_MAPPING[key] : {};
  const finalStyle: React.CSSProperties = { ...customStyle };

  const isImage =
    value.endsWith(".png") ||
    value.endsWith(".svg") ||
    value.endsWith(".jpg") ||
    value.startsWith("data:image/svg+xml") ||
    value.startsWith("/");

  return isImage ? (
    <img src={value} alt="Load" style={finalStyle} />
  ) : (
    <span style={finalStyle}>{value}</span>
  );
};

export default HostImage;
