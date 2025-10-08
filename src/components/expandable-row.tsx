import React from "react";

export function Row({
  label,
  value,
  strong,
  tokenLogo,
  chainLogo,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tokenLogo?: string;
  chainLogo?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {tokenLogo && chainLogo && (
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
              src={tokenLogo}
              width={20}
              height={20}
              style={{ borderRadius: 9999 }}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <div
              style={{
                position: "absolute",
                border: "0.5px solid rgba(255, 255, 255, 1)",
                borderRadius: 9999,
                width: 10,
                height: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                right: "-4px",
                bottom: "-4px",
              }}
            >
              <img
                src={chainLogo}
                width={10}
                height={10}
                onError={(e) => (e.currentTarget.style.display = "none")}
                style={{
                  borderRadius: 9999,
                }}
              />
            </div>
          </div>
        )}

        <span
          style={{
            fontSize: 12,
            color: "#FFF",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
      </div>

      <span style={{ fontSize: 12, fontWeight: strong ? 600 : 500 }}>
        {value}
      </span>
    </div>
  );
}

function ExpandableRow({
  label,
  value,
  expandLabel,
  isExpanded,
  onToggle,
  children,
  strong,
  subValue,
}: {
  label: string;
  value: string;
  subValue: string;
  expandLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: 16,
            color: strong ? "#e5e7eb" : "#9ca3af",
            fontWeight: strong ? 600 : 500,
          }}
        >
          {label}
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: strong ? 700 : 600,
              color: "#FFF",
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#858585" }}>
            {subValue}
          </span>
          <button
            onClick={onToggle}
            style={{
              background: "none",
              border: "none",
              color: "rgba(3, 55, 255, .8)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
              gap: 4,
              fontFamily:
                "Inter, system-ui, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', sans-serif",
            }}
          >
            {expandLabel}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease-in-out",
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        style={{
          overflow: "hidden",
          maxHeight: isExpanded ? "200px" : "0px",
          opacity: isExpanded ? 1 : 0,
          transition: "max-height 0.3s ease-in-out, opacity 0.25s ease-in-out",
        }}
      >
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export default ExpandableRow;
