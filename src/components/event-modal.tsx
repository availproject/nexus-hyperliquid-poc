import React, { ReactNode, useMemo } from "react";
import { getExplorerBase, getExplorerUrl } from "../utils/lib";

type Step = {
  typeID: string;
  type: string;
  done: boolean;
  data?: any;
};

interface NexusStepsProps {
  steps: Step[];
  title: string;
  currentSource: number;
  totalSources: number;
  currentAllowance: number;
  totalAllowances: number;
  setIntentStepsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  txURL?: string;
  chainId?: React.RefObject<number>;
  setIntent?: any;
  setTxURL?: any;
}

interface HeaderProps {
  title: string;
}

interface StepData {
  leftText: string;
  rightText?: ReactNode;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(2px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2147483646,
  fontFamily:
    "Inter, system-ui, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
};

const modalStyle: React.CSSProperties = {
  width: "480px",
  minHeight: "505px",
  maxWidth: "65vw",
  color: "#e5e7eb",
  padding: "24px",
  position: "relative",
  background: "rgb(30 38 43)",
  boxShadow: "rgba(0, 0, 0, 0.7) 0px 0px 22px 0px",
  border: "1px solid rgb(39, 48, 53)",
  borderRadius: 16,
  overflow: "auto",
  margin: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  fontFamily:
    "Inter, system-ui, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
};

const btnBase: React.CSSProperties = {
  flex: 1,
  cursor: "pointer",
  fontWeight: 600,
  width: "100%",
  outline: "none",
  border: "1px solid transparent",
  boxSizing: "border-box",
  textAlign: "center",
  fontFamily:
    "Inter, system-ui, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
  height: "40px",
  lineHeight: "38px",
  padding: "0px 16px",
  borderRadius: "8px",
  fontSize: "16px",
  whiteSpace: "nowrap",
  transition:
    "background 0.2s ease-in-out, color 0.2s ease-in-out, border-color 0.2s ease-in-out, text-decoration-color 0.2s ease-in-out",
};

const btnStyleMuted: React.CSSProperties = {
  ...btnBase,
  background: "#939393",
  boxShadow: "0 0 8px 0 hsla(0, 0%, 100%, .8)",
  color: "#323232",
};

const getTextFromStep = (
  status: string,
  done: boolean,
  totalAllowances: number,
  totalSources: number,
  explorerURL?: string,
  txURL?: string,
  chainId?: React.RefObject<number>
): StepData | undefined => {
  let varOcg: StepData = { leftText: "Invalid Step", rightText: "" };
  console.log(chainId?.current, "chainIdsssss");

  switch (status) {
    case "ALLOWANCE_ALL_DONE":
      varOcg = {
        leftText: done ? `Allowances Setup Done` : `Setting Up Allowances`,
        rightText: done
          ? `${totalAllowances}/${totalAllowances}`
          : `0/${totalAllowances}`,
      };
      break;

    case "INTENT_SUBMITTED":
      varOcg = {
        leftText: done ? `Intent Verified` : `Verifying Intent`,
        rightText: done ? (
          <a
            href={explorerURL?.replace(
              "https://explorer.arcana.network",
              "https://explorer.nexus.availproject.org"
            )}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline", color: "currentColor" }}
          >
            View Intent
          </a>
        ) : (
          `Not Verified`
        ),
      };
      break;

    case "INTENT_COLLECTION_COMPLETE":
      varOcg = {
        leftText: done ? `Collected from Sources` : `Collecting from Sources`,
        rightText: done
          ? `${totalSources}/${totalSources}`
          : `0/${totalSources}`,
      };
      break;

    case "INTENT_FULFILLED":
      const chainName = getExplorerBase(chainId?.current).name;
      varOcg = {
        leftText: done
          ? `Received on ${chainName}`
          : `Receiving on ${chainName}`,
        rightText: done ? `Done` : `Not Supplied`,
      };
      break;

    case "SUBMIT_TRANSACTION":
      const explorerBase = getExplorerBase(chainId?.current).url;
      varOcg = {
        leftText: txURL ? `Submitted Transaction` : `Submitting Transaction`,
        rightText: txURL ? (
          <a
            href={getExplorerUrl(txURL, explorerBase)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline", color: "currentColor" }}
          >
            View Transaction
          </a>
        ) : (
          `Pending`
        ),
      };
      break;

    default:
      return undefined;
  }

  return varOcg;
};

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        gap: 11,
      }}
    >
      <p
        style={{
          fontWeight: 600,
          fontSize: 24,
          textAlign: "center",
          margin: "0",
        }}
      >
        {title}
      </p>
    </div>
  );
};

const IntentTransaction: React.FC<NexusStepsProps> = ({
  steps,
  totalSources,
  totalAllowances,
  txURL,
  chainId,
}) => {
  console.log(steps, "steps");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        width: "100%",
      }}
    >
      {steps.map((step) => {
        const stepText = getTextFromStep(
          step.type,
          step.done,
          totalAllowances,
          totalSources,
          step?.data?.explorerURL || "",
          txURL,
          chainId
        );

        if (!stepText?.leftText || !stepText?.rightText) return null;

        return (
          <div
            key={step.typeID}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
              fontSize: "0.875rem",
              borderRadius: "0.5rem",
              transition: "all 0.3s ease",
              padding: "10px",
              border: "1px solid rgb(39, 48, 53)",
              background: "rgb(39, 48, 53)",
            }}
          >
            <div
              style={{
                color: "rgb(255, 255, 255)",
                display: "flex",
                alignItems: "center",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              {stepText.leftText}
            </div>
            {stepText.rightText && (
              <div
                style={{
                  color:
                    step.done || txURL
                      ? "rgb(115 228 194 / 80%)"
                      : "rgb(148, 158, 156)",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 600,
                  fontSize: "1rem",
                }}
              >
                {stepText.rightText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const NexusSteps: React.FC<NexusStepsProps> = ({
  title,
  steps,
  currentAllowance,
  currentSource,
  totalSources,
  totalAllowances,
  setIntentStepsOpen,
  txURL,
  chainId,
  setIntent,
  setTxURL,
}) => {
  const onClose = () => {
    setIntent(null);
    setTxURL("");
    setIntentStepsOpen(false);
  };

  const content = useMemo(() => {
    return (
      <div style={modalStyle} role="dialog" aria-modal="true">
        <Header title={title} />
        <IntentTransaction
          title={title}
          steps={steps}
          currentSource={currentSource}
          totalSources={totalSources}
          currentAllowance={currentAllowance}
          totalAllowances={totalAllowances}
          setIntentStepsOpen={setIntentStepsOpen}
          txURL={txURL}
          chainId={chainId}
        />

        {txURL && (
          <div
            style={{
              display: "flex",
              alignItems: "end",
              flex: "1",
              width: "100%",
            }}
          >
            <button
              onClick={onClose}
              style={{
                ...btnStyleMuted,
                width: "100%",
                flex: "1",
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  }, [
    title,
    steps,
    currentAllowance,
    currentSource,
    totalSources,
    totalAllowances,
    setIntentStepsOpen,
    txURL,
    chainId,
  ]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
};
