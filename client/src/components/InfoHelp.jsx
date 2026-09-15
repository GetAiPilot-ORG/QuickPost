import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

export default function InfoHelp({
  text,
  side = "top",
  align = "center",
  className = "",
  maxWidth = 260,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = typeof maxWidth === "number" ? maxWidth : 260;
    const gap = 8;
    const padding = 12;

    let placement = side;

    // Flip vertical if too close to top edge of viewport
    if (placement === "top" && rect.top < 85) {
      placement = "bottom";
    }

    // Flip to top if too close to bottom edge of viewport
    if (placement === "bottom" && rect.bottom > window.innerHeight - 85) {
      placement = "top";
    }

    const top = placement === "top" ? rect.top - gap : rect.bottom + gap;

    // Horizontal centering & strict viewport clamping
    let left = rect.left + rect.width / 2;
    if (align === "end" || rect.right > window.innerWidth - 130) {
      left = Math.min(rect.right, window.innerWidth - padding - tooltipWidth / 2);
    } else if (align === "start" || rect.left < 130) {
      left = Math.max(rect.left, padding + tooltipWidth / 2);
    }

    const halfWidth = tooltipWidth / 2;
    left = Math.max(halfWidth + padding, Math.min(window.innerWidth - halfWidth - padding, left));

    setCoords({
      top,
      left,
      placement,
    });
  }, [side, align, maxWidth]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  if (!text) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        lineHeight: 1,
        flexShrink: 0,
        marginLeft: "4px",
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        style={{
          all: "unset",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#8e8e93",
          borderRadius: "50%",
          padding: "2px",
          margin: 0,
          border: "none",
          background: "transparent",
          boxShadow: "none",
          minWidth: 0,
          minHeight: 0,
          width: "auto",
          height: "auto",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#111111";
          setIsOpen(true);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#8e8e93";
          setIsOpen(false);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen((prev) => !prev);
        }}
        aria-label="More information"
        className={className}
      >
        <Info
          size={14}
          style={{
            width: "14px",
            height: "14px",
            minWidth: "14px",
            minHeight: "14px",
            maxWidth: "14px",
            maxHeight: "14px",
            padding: 0,
            margin: 0,
            border: "none",
            background: "transparent",
            borderRadius: 0,
            display: "block",
            flexShrink: 0,
            color: "inherit",
          }}
        />
      </button>

      {isOpen &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform:
                coords.placement === "top"
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)",
              zIndex: 999999,
              pointerEvents: "none",
              backgroundColor: "#111111",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "7px 11px",
              boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
              fontSize: "11px",
              lineHeight: "1.4",
              fontWeight: 400,
              fontFamily: 'var(--font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
              textAlign: "left",
              maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
              width: "max-content",
            }}
          >
            <p style={{ margin: 0, padding: 0, fontSize: "11px", lineHeight: "1.35", color: "#ffffff" }}>
              {text}
            </p>
          </div>,
          document.body
        )}
    </span>
  );
}
