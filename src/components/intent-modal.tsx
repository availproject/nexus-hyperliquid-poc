import React, { useCallback, useEffect, useMemo, useState } from "react";
import Avail from "./avail";
import ExpandableRow, { Row } from "./expandable-row";
import { debugInfo } from "../utils/debug";
import { formatDecimalAmount } from "../utils/lib";
import {
  OnIntentHookData,
  ProgressStep,
  UserAsset,
} from "@avail-project/nexus";
import HostImage from "./host-image";
import HostText from "./host-text";
import Decimal from "decimal.js";
import { removeMainnet } from "../utils/multicall";

interface TotalSpendProps {
  totalChain:
    | {
        amount: string;
        chainID: number;
        chainLogo: string | undefined;
        chainName: string;
        contractAddress: `0x${string}`;
      }[];
  totalAmount: number;
}

export type IntentModalProps = {
  intentModal: OnIntentHookData | null;
  setIntentModal: (modal: IntentModalProps["intentModal"]) => void;
  requiredAmount: string | null;
  unifiedBalances: UserAsset[] | null;
  setIntentStepsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(2px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
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
  background: "rgb(15, 26, 31)",
  border: "1px solid rgb(39, 48, 53)",
  borderRadius: 16,
  overflow: "auto",
  margin: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  fontFamily:
    "Inter, system-ui, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
};

const sectionStyle: React.CSSProperties = {
  background: "rgb(15, 26, 31)",
  width: "100%",
  padding: 0,
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

const btnStylePrimary: React.CSSProperties = {
  ...btnBase,
  color: "rgb(4, 6, 12)",
  backgroundColor: "rgb(80, 210, 193)",
};

const btnStyleMuted: React.CSSProperties = {
  ...btnBase,
  background: "#2a2f3a",
  color: "#e5e7eb",
  borderColor: "#3b424f",
};

const FeesSection = ({
  intent,
  showSources,
  setShowSources,
  showFeesBreakdown,
  setShowFeesBreakdown,
  totalSpend,
}: {
  intent: OnIntentHookData["intent"];
  showSources: boolean;
  setShowSources: (show: boolean) => void;
  showFeesBreakdown: boolean;
  setShowFeesBreakdown: (show: boolean) => void;
  totalSpend?: TotalSpendProps | null;
}) => {
  console.log(intent, totalSpend, "intent");

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        padding: "16px 0",
        alignItems: "center",
      }}
    >
      <div style={sectionStyle}>
        <ExpandableRow
          strong
          label="Total Spend"
          value={`${totalSpend?.totalAmount} ${intent?.token?.symbol}`}
          subValue={`${totalSpend?.totalAmount} USD`}
          expandLabel="View Sources"
          isExpanded={showSources}
          onToggle={() => setShowSources(!showSources)}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              backgroundColor: "#2A3134",
              borderRadius: 8,
              padding: "12px 16px",
            }}
          >
            {totalSpend?.totalChain?.map((source, index) => {
              if (Number(source?.amount) === 0) return;
              return (
                <Row
                  key={`${source.chainID}-${index}`}
                  label={`${intent?.token?.symbol} (${removeMainnet(
                    source.chainName
                  )})`}
                  tokenLogo={intent?.token?.logo}
                  chainLogo={source.chainLogo}
                  value={`${source.amount} ${intent?.token?.symbol}`}
                />
              );
            })}
          </div>
        </ExpandableRow>
      </div>

      {intent?.fees ? (
        <div style={sectionStyle}>
          <ExpandableRow
            strong
            label="Total Fees"
            value={`${intent?.fees?.total || "0"} ${intent?.token?.symbol}`}
            expandLabel="View Breakup"
            subValue={`${intent?.fees?.total || "0"} USD`}
            isExpanded={showFeesBreakdown}
            onToggle={() => setShowFeesBreakdown(!showFeesBreakdown)}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                backgroundColor: "#2A3134",
                borderRadius: 8,
                padding: "12px 16px",
              }}
            >
              <Row
                label="Network Gas"
                value={`${intent?.fees?.caGas || "0"} ${intent?.token?.symbol}`}
              />
              {Number(intent?.fees?.solver) > 0 && (
                <Row
                  label="Solver Fee"
                  value={`${intent?.fees?.solver} ${intent?.token?.symbol}`}
                />
              )}
              {Number(intent?.fees?.protocol) > 0 && (
                <Row
                  label="Protocol Fee"
                  value={`${intent?.fees?.protocol} ${intent?.token?.symbol}`}
                />
              )}
              {Number(intent?.fees?.gasSupplied) > 0 && (
                <Row
                  label="Additional Gas"
                  value={`${intent?.fees?.gasSupplied} ${intent?.token?.symbol}`}
                />
              )}
            </div>
          </ExpandableRow>
        </div>
      ) : null}
    </div>
  );
};

const RouteArrow = ({ label }: { label: string }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: "column",
        gap: 4,
        justifyContent: "center",
        backgroundColor: "#2A3134",
      }}
    >
      <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
        {label}
      </span>
      <div
        style={{
          display: "flex",
          width: "28px",
          height: "28px",
          padding: "4px",
          justifyContent: "center",
          alignItems: "center",
          flexShrink: 0,
          aspectRatio: "1/1",
          borderRadius: "47px",
          background: "rgba(244, 246, 248, 0.13)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-arrow-right-icon lucide-arrow-right"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

const Header = () => {
  return (
    <div
      id="dialog-title"
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
        Confirm Intent
      </p>

      <HostText
        style={{
          fontSize: 16,
          color: "#9ca3af",
          textAlign: "center",
          margin: "0",
        }}
      />
    </div>
  );
};

const SourceSection = ({ intent }: { intent: OnIntentHookData["intent"] }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          flexDirection: "column",
        }}
      >
        <img
          src={intent.token.logo}
          width={46}
          height={46}
          style={{ borderRadius: 9999 }}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 46,
            height: 46,
          }}
        >
          {intent?.sources?.slice(0, 3).map((s, i) => {
            const radius = i + 25;
            const startAngle = 60;
            const angleStep = 25;
            const angle = startAngle - i * angleStep;

            const x = radius * Math.cos((angle * Math.PI) / 180);
            const y = radius * Math.sin((angle * Math.PI) / 180);

            return (
              <img
                src={s.chainLogo}
                width={16}
                height={16}
                key={`${s.chainID}-${i}`}
                style={{
                  position: "absolute",
                  borderRadius: 9999,
                  left: `calc(50% + ${x}px - 8px)`,
                  top: `calc(50% + ${y}px - 8px)`,
                  zIndex: intent.sources.length - i,
                  border: "2px solid rgb(15, 26, 31)",
                }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            );
          })}
          {intent?.sources && intent.sources.length > 3 && (
            <div
              style={{
                position: "absolute",
                backgroundColor: "#1f2937",
                border: "2px solid rgb(15, 26, 31)",
                borderRadius: 9999,
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                fontWeight: 600,
                color: "#e5e7eb",
                left: "calc(50% - 6px)",
                bottom: "-14px",
                zIndex: intent.sources.length + 1,
              }}
            >
              +{intent.sources.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DestinationSection = ({
  intent,
}: {
  intent: OnIntentHookData["intent"];
}) => {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        flexDirection: "column",
      }}
    >
      <img
        src={intent?.token?.logo}
        width={46}
        height={46}
        style={{ borderRadius: 9999 }}
        onError={(e) => (e.currentTarget.style.display = "none")}
      />

      <div
        style={{
          position: "absolute",
          backgroundColor: "#1f2937",
          border: "2px solid rgb(15, 26, 31)",
          borderRadius: 9999,
          width: 16,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 600,
          color: "#e5e7eb",
          left: "calc(50% + 6px)",
          bottom: "-8px",
          zIndex: intent.sources.length + 1,
        }}
      >
        <img
          src={intent?.destination?.chainLogo}
          width={16}
          height={16}
          onError={(e) => (e.currentTarget.style.display = "none")}
          style={{
            borderRadius: 9999,
          }}
        />
      </div>
    </div>
  );
};

const Routes = ({
  intent,
  requiredAmount,
  destinationChainBalance,
}: {
  intent: OnIntentHookData["intent"];
  requiredAmount: string | null;
  destinationChainBalance?: string | null;
}) => {
  return (
    <div style={sectionStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          flexDirection: "column",
          width: "100%",
          backgroundColor: "#2A3134",
          borderRadius: 8,
          paddingBottom: "6px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-around",
            height: 76,
            width: "100%",
          }}
        >
          {intent?.token?.logo ? <SourceSection intent={intent} /> : null}
          <RouteArrow label={formatDecimalAmount(intent?.sourcesTotal) ?? ""} />
          {intent?.destination ? <DestinationSection intent={intent} /> : null}
          <RouteArrow
            label={
              formatDecimalAmount(
                Decimal.add(
                  intent?.sourcesTotal || 0,
                  destinationChainBalance || 0
                ).toFixed(3)
              ) ?? ""
            }
          />
          <HostImage />
        </div>
        <span style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>
          {destinationChainBalance ?? ""}
        </span>
      </div>
    </div>
  );
};

const Actions = ({
  onClose,
  handleAllow,
  isRefreshing,
}: {
  onClose: () => void;
  handleAllow: () => void;
  isRefreshing: boolean;
}) => {
  return (
    <div style={{ display: "flex", gap: 8, width: "100%" }}>
      <button
        onClick={onClose}
        disabled={isRefreshing}
        style={{
          ...btnStyleMuted,
          width: "100%",
          opacity: isRefreshing ? 0.6 : 1,
          cursor: isRefreshing ? "not-allowed" : "pointer",
        }}
      >
        Cancel
      </button>
      <button
        onClick={handleAllow}
        disabled={isRefreshing}
        style={{
          ...btnStylePrimary,
          width: "100%",
          opacity: isRefreshing ? 0.6 : 1,
          cursor: isRefreshing ? "not-allowed" : "pointer",
        }}
      >
        {isRefreshing ? "Refreshing..." : "Confirm"}
      </button>
    </div>
  );
};

export default function IntentModal({
  intentModal,
  setIntentModal,
  requiredAmount,
  unifiedBalances,
  setIntentStepsOpen,
}: IntentModalProps) {
  const [showSources, setShowSources] = useState(false);
  const [showFeesBreakdown, setShowFeesBreakdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const destinationChainBalance = useMemo(() => {
    if (!unifiedBalances || !intentModal) return null;

    const destinationChainId = intentModal?.intent?.destination?.chainID;
    const destinationToken = intentModal?.intent?.token.symbol;
    if (!destinationChainId || !destinationToken) return null;
    const tokenBalance = unifiedBalances.find(
      (balance) => balance?.symbol === destinationToken
    );

    if (!tokenBalance) return null;
    const chainBreakdown = tokenBalance.breakdown?.find(
      (breakdown) => breakdown?.chain?.id === destinationChainId
    );

    return formatDecimalAmount(chainBreakdown?.balance || "0");
  }, [unifiedBalances, intentModal]);

  const onClose = useCallback(() => {
    if (!intentModal || isRefreshing) return;
    intentModal.deny();
    setIntentModal(null);
    setIntentStepsOpen(false);
  }, [intentModal, setIntentModal, isRefreshing]);

  const handleAllow = useCallback(() => {
    if (!intentModal || isRefreshing) return;
    intentModal.allow();
    setIntentModal(null);
  }, [intentModal, setIntentModal, isRefreshing]);

  // Auto-refresh intent every 5 seconds
  useEffect(() => {
    if (!intentModal?.refresh) return;

    const intervalId = setInterval(async () => {
      try {
        setIsRefreshing(true);
        const refreshedIntent = await intentModal.refresh();
        // Update the intent in the modal state
        setIntentModal({
          ...intentModal,
          intent: refreshedIntent,
        });
      } catch (error) {
        console.error("Failed to refresh intent:", error);
      } finally {
        setIsRefreshing(false);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [intentModal, setIntentModal]);

  const totalSpend = useMemo(() => {
    if (!unifiedBalances || !intentModal) return null;

    const destinationChainId = intentModal?.intent?.destination?.chainID;
    const destinationToken = intentModal?.intent?.token.symbol;
    if (!destinationChainId || !destinationToken) return null;
    const tokenBalance = unifiedBalances.find(
      (balance) => balance?.symbol === destinationToken
    );

    if (!tokenBalance) return null;
    const chainBreakdown = tokenBalance.breakdown?.find(
      (breakdown) => breakdown?.chain?.id === destinationChainId
    );

    if (!chainBreakdown) return null;
    const currentChainSource = {
      amount: chainBreakdown?.balance,
      chainID: chainBreakdown?.chain?.id,
      chainLogo: chainBreakdown?.chain?.logo,
      chainName: chainBreakdown?.chain?.name,
      contractAddress: chainBreakdown?.contractAddress,
    };

    const totalChain = [...intentModal.intent.sources, currentChainSource];
    const totalAmount =
      Number(chainBreakdown?.balance) +
      Number(intentModal?.intent?.sourcesTotal);
    return { totalChain, totalAmount };
  }, [unifiedBalances, intentModal]);

  const content = useMemo(() => {
    if (!intentModal) return null;
    const { intent } = intentModal;
    return (
      <div
        style={modalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <Header />

        <Routes
          intent={intent}
          requiredAmount={requiredAmount}
          destinationChainBalance={destinationChainBalance}
        />

        <FeesSection
          intent={intent}
          showSources={showSources}
          setShowSources={setShowSources}
          showFeesBreakdown={showFeesBreakdown}
          setShowFeesBreakdown={setShowFeesBreakdown}
          totalSpend={totalSpend}
        />

        <Actions
          onClose={onClose}
          handleAllow={handleAllow}
          isRefreshing={isRefreshing}
        />
      </div>
    );
  }, [
    intentModal,
    handleAllow,
    onClose,
    showSources,
    showFeesBreakdown,
    isRefreshing,
    requiredAmount,
  ]);

  if (!intentModal) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>
  );
}
