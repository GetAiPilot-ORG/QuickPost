/**
 * IntelligencePanel.jsx
 * ─────────────────────────────────────────────────────────────────
 * Renders the intelligence panel: errors, warnings, behaviors,
 * suggestions — all with staggered Framer Motion animations.
 *
 * Props:
 *   panelItems: array from usePostIntelligence().panelItems
 *   collapsed:  boolean (optional, for mobile accordion)
 */

import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
} from "lucide-react";

/* ── Visual config per item kind ── */
const KIND_CONFIG = {
  error: {
    Icon:       AlertCircle,
    color:      "#dc2626",
    bg:         "rgba(239,68,68,0.06)",
    border:     "rgba(239,68,68,0.18)",
    labelColor: "#dc2626",
    label:      "Error",
  },
  warning: {
    Icon:       AlertTriangle,
    color:      "#d97706",
    bg:         "rgba(245,158,11,0.06)",
    border:     "rgba(245,158,11,0.18)",
    labelColor: "#d97706",
    label:      "Warning",
  },
  behavior: {
    Icon:       Info,
    color:      "#0085FF",
    bg:         "rgba(0,133,255,0.06)",
    border:     "rgba(0,133,255,0.15)",
    labelColor: "#0085FF",
    label:      "Info",
  },
  suggestion: {
    Icon:       Lightbulb,
    color:      "#7c3aed",
    bg:         "rgba(124,58,237,0.05)",
    border:     "rgba(124,58,237,0.12)",
    labelColor: "#7c3aed",
    label:      "Tip",
  },
};

// Override for positive behavior items
const POSITIVE_CONFIG = {
  Icon:       CheckCircle2,
  color:      "#059669",
  bg:         "rgba(16,185,129,0.06)",
  border:     "rgba(16,185,129,0.15)",
  labelColor: "#059669",
  label:      "Ready",
};

/* ── Single intelligence card ── */
const IntelligenceCard = memo(React.forwardRef(function IntelligenceCard({ item, index }, ref) {
  const cfg = item.positive ? POSITIVE_CONFIG : (KIND_CONFIG[item.kind] || KIND_CONFIG.behavior);
  const { Icon, color, bg, border, labelColor, label } = cfg;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -10, height: 0 }}
      animate={{ opacity: 1, x: 0,   height: "auto" }}
      exit={{    opacity: 0, x: 10,  height: 0 }}
      transition={{
        duration: 0.22,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
      }}
      style={{ overflow: "hidden" }}
    >
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        padding: "10px 12px", borderRadius: 10,
        background: bg, border: `1px solid ${border}`,
        marginBottom: 6,
      }}>
        {/* Icon */}
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <Icon size={13} style={{ color }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: labelColor, textTransform: "capitalize",
              padding: "1px 6px", borderRadius: 4,
              background: `${labelColor}15`,
            }}>
              {label}
            </span>
            {item.platform && (
              <span style={{
                fontSize: 9, fontWeight: 600,
                color: "var(--slate)", textTransform: "capitalize", opacity: 0.7,
              }}>
                {item.platform}
              </span>
            )}
          </div>
          <p style={{
            fontSize: 11.5, fontWeight: 700, color: "var(--ink)",
            margin: 0, lineHeight: 1.4,
          }}>
            {item.title}
          </p>
          <p style={{
            fontSize: 10.5, color: "var(--slate)",
            margin: "3px 0 0", lineHeight: 1.55, opacity: 0.85,
          }}>
            {item.message}
          </p>
        </div>
      </div>
    </motion.div>
  );
}));

/* ── Main panel ── */
const IntelligencePanel = memo(function IntelligencePanel({
  panelItems,
  collapsed = false,
  onToggleCollapsed,
}) {
  if (!panelItems || panelItems.length === 0) return null;

  const errorCount   = panelItems.filter((i) => i.kind === "error").length;
  const warningCount = panelItems.filter((i) => i.kind === "warning").length;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Panel header — acts as accordion toggle on mobile */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: collapsed ? 0 : 8, cursor: onToggleCollapsed ? "pointer" : "default",
        }}
        onClick={onToggleCollapsed}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--slate)",
          }}>
            What will happen?
          </span>

          {/* Issue count badges */}
          {errorCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 10,
              background: "rgba(239,68,68,0.1)", color: "#dc2626",
            }}>
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 10,
              background: "rgba(245,158,11,0.1)", color: "#d97706",
            }}>
              {warningCount} warning{warningCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {onToggleCollapsed && (
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={12} style={{ color: "var(--slate)" }} />
          </motion.div>
        )}
      </div>

      {/* Cards */}
      <AnimatePresence mode="popLayout">
        {!collapsed && panelItems.map((item, index) => (
          <IntelligenceCard key={item.id} item={item} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
});

export default IntelligencePanel;
