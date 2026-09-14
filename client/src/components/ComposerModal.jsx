import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  memo,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  AtSign,
  Calendar,
  Clock,
  AlertCircle,
  Zap,
  CheckCircle2,
  Monitor,
  Smartphone,
  Square,
  RectangleVertical,
  Lock,
  Upload,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Reorder } from "framer-motion";

import apiClient from "../utils/apiClient";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useUploadJobs } from "../context/UploadJobContext";
import { useDialog } from "../context/DialogContext";
import ChannelSelector from "./ChannelSelector";
import PlatformCustomization from "./PlatformCustomization";

// Modular imports
import {
  PLATFORM_META,
  PLATFORM_POST_TYPES,
  PLATFORM_LAYOUT_PRESETS,
  PLATFORM_SUPPORTED_RATIOS,
  getPresetsForPlatform,
} from "./composer/data/platforms.js";
import { usePostIntelligence } from "./composer/hooks/usePostIntelligence.js";
import { useSmartSizes } from "./composer/hooks/useSmartSizes.js";
import IntelligencePanel from "./composer/components/IntelligencePanel.jsx";
import MediaUploader from "./composer/components/MediaUploader.jsx";
import PreviewPanel from "./composer/components/PreviewPanel.jsx";
import {
  AutoDMComposerPanel,
  defaultComposerAutoDMConfig,
} from "../features/autodm/AutoDMComposerPanel";

const QUICK_SUGGESTIONS = [
  "Building something special...",
  "Insights from the week 📈",
  "Consistency is the key 🗝️",
  "Quick thoughts on this 💡",
  "Milestone reached! 🎯",
  "Behind the strategy 🧠",
  "Leveling up... ⚡",
  "Fresh perspective 🌿",
  "Daily workflow 💻",
  "The progress is real...",
  "Deep dive into the workflow 🛠️",
  "Strategy of the day 📊",
  "Beyond the surface 🌊",
  "Crafting the future ✨",
  "Perspective matters 👁️",
  "Systematic growth 📈",
  "Efficiency unlocked 🔓",
];

const SUGGESTED_HASHTAGS = [
  "#productivity",
  "#marketing",
  "#socialmedia",
  "#growth",
  "#creator",
  "#digitalmarketing",
  "#branding",
];

const INSTAGRAM_POST_TYPE_PRESETS = {
  post: "ig-post-square",
  story: "ig-story",
  reel: "ig-reel",
};

const ClockView = memo(function ClockView({ value, onChange, minTime, onClose }) {
  const [mode, setMode] = useState("hours"); // 'hours' or 'minutes'
  const initialH = parseInt(value.split(":")[0]) || 0;
  const initialM = parseInt(value.split(":")[1]) || 0;

  const [hour, setHour] = useState(initialH % 12 || 12);
  const [minute, setMinute] = useState(initialM);
  const [meridiem, setMeridiem] = useState(initialH >= 12 ? "PM" : "AM");
  const [isDragging, setIsDragging] = useState(false);
  const faceRef = useRef(null);

  useEffect(() => {
    const h = parseInt(value.split(":")[0]) || 0;
    const m = parseInt(value.split(":")[1]) || 0;
    setHour(h % 12 || 12);
    setMinute(m);
    setMeridiem(h >= 12 ? "PM" : "AM");
  }, [value]);

  const [minH, minM] = useMemo(
    () => (minTime ? minTime.split(":").map(Number) : [null, null]),
    [minTime],
  );

  const isPastH = useCallback(
    (h12, mer) => {
      if (minH === null) return false;
      const h24 = mer === "PM" ? (h12 % 12) + 12 : h12 % 12;
      return h24 < minH;
    },
    [minH],
  );

  const isPastM = useCallback(
    (h12, m, mer) => {
      if (minH === null) return false;
      const h24 = mer === "PM" ? (h12 % 12) + 12 : h12 % 12;
      if (h24 < minH) return true;
      if (h24 === minH && m < minM) return true;
      return false;
    },
    [minH, minM],
  );

  const hours = [
    { v: 12, x: 0, y: -84 },
    { v: 1, x: 42, y: -73 },
    { v: 2, x: 73, y: -42 },
    { v: 3, x: 84, y: 0 },
    { v: 4, x: 73, y: 42 },
    { v: 5, x: 42, y: 73 },
    { v: 6, x: 0, y: 84 },
    { v: 7, x: -42, y: 73 },
    { v: 8, x: -73, y: 42 },
    { v: 9, x: -84, y: 0 },
    { v: 10, x: -73, y: -42 },
    { v: 11, x: -42, y: -73 },
  ];

  const minutes = [
    { v: 0, x: 0, y: -84 },
    { v: 5, x: 42, y: -73 },
    { v: 10, x: 73, y: -42 },
    { v: 15, x: 84, y: 0 },
    { v: 20, x: 73, y: 42 },
    { v: 25, x: 42, y: 73 },
    { v: 30, x: 0, y: 84 },
    { v: 35, x: -42, y: 73 },
    { v: 40, x: -73, y: 42 },
    { v: 45, x: -84, y: 0 },
    { v: 50, x: -73, y: -42 },
    { v: 55, x: -42, y: -73 },
  ];

  const to24h = (h, m, ampm) => {
    let hh = h % 12;
    if (ampm === "PM") hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleSelectHour = (h) => {
    setHour(h);
    onChange(to24h(h, minute, meridiem));
    setMode("minutes");
  };

  const handleSelectMinute = (m) => {
    setMinute(m);
    onChange(to24h(hour, m, meridiem));
  };

  const isCurrentSelectionPast = isPastM(hour, minute, meridiem);

  const calculateValueFromCoords = (clientX, clientY) => {
    if (!faceRef.current) return;
    const rect = faceRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (mode === "hours") {
      let h = Math.round(angle / 30) % 12 || 12;
      if (h !== hour) {
        setHour(h);
        onChange(to24h(h, minute, meridiem));
      }
    } else {
      let m = Math.round(angle / 6) % 60;
      if (m !== minute) {
        setMinute(m);
        onChange(to24h(hour, m, meridiem));
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) calculateValueFromCoords(e.clientX, e.clientY);
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches[0]) {
      calculateValueFromCoords(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const handleStop = () => {
      if (isDragging) {
        setIsDragging(false);
        if (mode === "hours") setMode("minutes");
      }
    };
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleStop);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleStop);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleStop);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleStop);
    };
  }, [isDragging, mode, hour, minute, meridiem]);

  const handleMeridiemChange = (m) => {
    setMeridiem(m);
    onChange(to24h(hour, minute, m));
  };

  const currentList = mode === "hours" ? hours : minutes;
  const currentVal = mode === "hours" ? hour : minute;

  const getAngle = () => {
    if (mode === "hours") {
      const h = hour % 12;
      return h * 30;
    } else {
      return minute * 6;
    }
  };

  return (
    <div
      style={{
        width: 270,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        userSelect: "none",
        background: "var(--white)",
      }}
    >
      {/* Header with Time Display & AM/PM */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 20,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px",
            background: "rgba(20,20,19,0.04)",
            borderRadius: "12px",
          }}
        >
          <button
            onClick={() => setMode("hours")}
            style={{
              width: 54,
              height: 44,
              borderRadius: "8px",
              fontSize: 20,
              fontWeight: 800,
              border: "none",
              background: mode === "hours" ? "var(--white)" : "transparent",
              color: isCurrentSelectionPast
                ? "#ef4444"
                : mode === "hours"
                  ? "var(--arc)"
                  : "var(--slate)",
              boxShadow:
                mode === "hours" ? "0 4px 10px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              fontFamily: "var(--font)",
            }}
          >
            {String(hour).padStart(2, "0")}
          </button>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "var(--slate)",
              opacity: 0.3,
            }}
          >
            :
          </span>
          <button
            onClick={() => setMode("minutes")}
            style={{
              width: 54,
              height: 44,
              borderRadius: "8px",
              fontSize: 20,
              fontWeight: 800,
              border: "none",
              background: mode === "minutes" ? "var(--white)" : "transparent",
              color: isCurrentSelectionPast
                ? "#ef4444"
                : mode === "minutes"
                  ? "var(--arc)"
                  : "var(--slate)",
              boxShadow:
                mode === "minutes" ? "0 4px 10px rgba(0,0,0,0.06)" : "none",
              cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              fontFamily: "var(--font)",
            }}
          >
            {String(minute).padStart(2, "0")}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "rgba(20,20,19,0.04)",
            padding: "4px",
            borderRadius: "10px",
          }}
        >
          {["AM", "PM"].map((m) => (
            <button
              key={m}
              onClick={(e) => {
                e.stopPropagation();
                handleMeridiemChange(m);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: 10,
                fontWeight: 800,
                border: "none",
                background: meridiem === m ? "var(--white)" : "transparent",
                color: meridiem === m ? "var(--arc)" : "var(--slate)",
                boxShadow:
                  meridiem === m ? "0 2px 5px rgba(0,0,0,0.05)" : "none",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "var(--font)",
                textTransform: "uppercase",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {isCurrentSelectionPast && (
        <p
          style={{
            fontSize: 10,
            color: "#ef4444",
            fontWeight: 700,
            marginTop: -10,
            marginBottom: 10,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Past time selected
        </p>
      )}

      {/* Clock Face */}
      <div
        ref={faceRef}
        onMouseDown={(e) => {
          setIsDragging(true);
          calculateValueFromCoords(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (e.touches[0])
            calculateValueFromCoords(
              e.touches[0].clientX,
              e.touches[0].clientY,
            );
        }}
        style={{
          position: "relative",
          width: 190,
          height: 190,
          background: "var(--canvas)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          cursor: "crosshair",
          boxShadow: "inset 0 2px 10px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 6,
            height: 6,
            margin: -3,
            background: isCurrentSelectionPast ? "#ef4444" : "var(--arc)",
            borderRadius: "50%",
            zIndex: 10,
          }}
        />

        <motion.div
          animate={{ rotate: getAngle() }}
          transition={
            isDragging
              ? { type: "just" }
              : { type: "spring", stiffness: 300, damping: 30 }
          }
          style={{
            position: "absolute",
            left: "50%",
            bottom: "50%",
            width: 2,
            height: 72,
            background: isCurrentSelectionPast ? "#ef4444" : "var(--arc)",
            transformOrigin: "bottom center",
            zIndex: 5,
            pointerEvents: "none",
            borderRadius: "4px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 28,
              height: 28,
              margin: "-14px",
              background: isCurrentSelectionPast ? "#ef4444" : "var(--arc)",
              borderRadius: "50%",
              opacity: 0.15,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              width: 8,
              height: 8,
              margin: "-4px",
              background: isCurrentSelectionPast ? "#ef4444" : "var(--arc)",
              borderRadius: "50%",
              border: "2px solid var(--white)",
            }}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {currentList.map((item) => {
              const isSelected = item.v === currentVal;
              const disabled =
                mode === "hours"
                  ? isPastH(item.v, meridiem)
                  : isPastM(hour, item.v, meridiem);

              // Scale coordinates for smaller face
              const scale = 190 / 210;
              const sx = item.x * scale;
              const sy = item.y * scale;

              return (
                <div
                  key={item.v}
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${sx}px)`,
                    top: `calc(50% + ${sy}px)`,
                    width: 30,
                    height: 30,
                    margin: -15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    background: isSelected
                      ? isCurrentSelectionPast
                        ? "#ef4444"
                        : "var(--arc)"
                      : "transparent",
                    color: isSelected ? "var(--white)" : "var(--ink)",
                    fontSize: 12,
                    fontWeight: isSelected ? 800 : 600,
                    zIndex: 10,
                    transition: "all 0.2s",
                    fontFamily: "var(--font)",
                    opacity: disabled ? 0.2 : 1,
                  }}
                >
                  {item.v}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <p
        style={{
          fontSize: 9,
          color: isCurrentSelectionPast ? "#ef4444" : "var(--slate)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.6,
          marginBottom: 12,
        }}
      >
        {isDragging
          ? "Adjusting..."
          : isCurrentSelectionPast
            ? "Invalid Time"
            : `Pick ${mode}`}
      </p>

      <button
        disabled={isCurrentSelectionPast}
        onClick={(e) => {
          if (isCurrentSelectionPast) return;
          e.stopPropagation();
          onChange(to24h(hour, minute, meridiem));
          if (typeof onClose === "function") {
            onClose();
          } else {
            window.dispatchEvent(new MouseEvent("mousedown"));
          }
        }}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "12px",
          background: isCurrentSelectionPast
            ? "rgba(20,20,19,0.04)"
            : "var(--ink)",
          color: isCurrentSelectionPast ? "rgba(20,20,19,0.2)" : "white",
          fontSize: 12,
          fontWeight: 700,
          border: "none",
          cursor: isCurrentSelectionPast ? "not-allowed" : "pointer",
        }}
      >
        {isCurrentSelectionPast ? "Invalid Time" : "Set Time"}
      </button>
    </div>
  );
});

const CalendarView = memo(function CalendarView({ value, onChange }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(
    value ? new Date(value + "T00:00:00") : today,
  );
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div
      style={{
        width: 260,
        padding: "16px",
        background: "var(--white)",
        fontFamily: "var(--font)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          padding: "0 4px",
        }}
      >
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          style={{
            border: "1px solid rgba(20,20,19,0.06)",
            background: "var(--canvas-lifted)",
            borderRadius: "8px",
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--ink)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.target.style.borderColor = "rgba(20,20,19,0.15)")
          }
          onMouseLeave={(e) =>
            (e.target.style.borderColor = "rgba(20,20,19,0.06)")
          }
        >
          <ChevronDown size={14} style={{ transform: "rotate(90deg)" }} />
        </button>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {monthNames[month]} {year}
        </span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          style={{
            border: "1px solid rgba(20,20,19,0.06)",
            background: "var(--canvas-lifted)",
            borderRadius: "8px",
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--ink)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.target.style.borderColor = "rgba(20,20,19,0.15)")
          }
          onMouseLeave={(e) =>
            (e.target.style.borderColor = "rgba(20,20,19,0.06)")
          }
        >
          <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginBottom: 12,
        }}
      >
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: 900,
              color: "var(--slate)",
              paddingBottom: 4,
              opacity: 0.4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${(month + 1).toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
          const isSelected = value === dateStr;
          const isToday = today.toISOString().split("T")[0] === dateStr;
          const isPast =
            new Date(year, month, d) <
            new Date(today.getFullYear(), today.getMonth(), today.getDate());

          return (
            <button
              key={i}
              onClick={() => !isPast && onChange(dateStr)}
              style={{
                padding: "8px 0",
                border: "none",
                borderRadius: "8px",
                fontSize: 11,
                fontWeight: isSelected || isToday ? 800 : 500,
                color: isSelected
                  ? "var(--white)"
                  : isPast
                    ? "rgba(20,20,19,0.15)"
                    : isToday
                      ? "var(--arc)"
                      : "var(--ink)",
                height: 32,
                cursor: isPast ? "default" : "pointer",
                transition: "all 0.2s",
                fontFamily: "var(--font)",
              }}
              onMouseEnter={(e) => {
                if (!isPast && !isSelected) {
                  e.target.style.background = "rgba(20,20,19,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.background = isToday
                    ? "rgba(243,115,56,0.08)"
                    : "transparent";
                }
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
});

const CustomSelect = memo(function CustomSelect({
  value,
  options,
  onChange,
  icon: Icon,
  isCalendar = false,
  isTime = false,
  minTime,
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setOpen(false);
    };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, []);

  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    right: 0,
    upward: false,
    isMobileCentered: false,
  });

  useEffect(() => {
    if (open && containerRef.current) {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // On mobile, pop up in the center of the screen to avoid clipping
        setPosition({
          top: "50%",
          left: "50%",
          right: "auto",
          upward: false,
          isMobileCentered: true,
        });
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const dropdownHeight = isCalendar ? 360 : isTime ? 400 : 240;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Open upwards if there's not enough space below AND there's more space above than below
        const shouldOpenUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        setPosition({
          top: shouldOpenUp ? rect.top - 8 : rect.bottom + 8,
          left: align === "left" ? rect.left : "auto",
          right: align === "right" ? window.innerWidth - rect.right : "auto",
          upward: shouldOpenUp,
          isMobileCentered: false,
        });
      }
    }
  }, [open, isCalendar, isTime, align]);

  const label = isCalendar
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : value;

  return (
    <div ref={containerRef} style={{ position: "relative", flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: open ? "rgba(20,20,19,0.02)" : "var(--white)",
          border: `1.5px solid ${open ? "var(--arc)" : "rgba(20,20,19,0.08)"}`,
          borderRadius: "14px",
          cursor: "pointer",
          width: "100%",
          minWidth: isTime ? 130 : 160,
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: open
            ? "0 4px 12px rgba(243,115,56,0.08)"
            : "0 2px 4px rgba(0,0,0,0.02)",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.target.style.borderColor = "rgba(20,20,19,0.15)";
            e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.04)";
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.target.style.borderColor = "rgba(20,20,19,0.08)";
            e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)";
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Icon && (
            <Icon
              size={14}
              style={{
                color: open ? "var(--arc)" : "var(--slate)",
                transition: "color 0.2s",
              }}
            />
          )}
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {label}
          </span>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: "var(--slate)",
            opacity: 0.5,
            transform: open ? "rotate(180deg)" : "none",
            transition: "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </button>

      {open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: position.isMobileCentered ? 0 : position.top,
              left: position.isMobileCentered ? 0 : position.left,
              right: position.isMobileCentered ? 0 : position.right,
              bottom: position.isMobileCentered ? 0 : "auto",
              display: position.isMobileCentered ? "flex" : "block",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              pointerEvents: position.isMobileCentered ? "auto" : "none",
              background: position.isMobileCentered ? "rgba(0,0,0,0.4)" : "transparent",
            }}
            onMouseDown={(e) => {
              if (position.isMobileCentered && e.target === e.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <div
              style={{
                transform: position.isMobileCentered ? "none" : position.upward ? "translateY(-100%)" : "none",
                pointerEvents: "none",
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: position.isMobileCentered ? 0 : position.upward ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: position.isMobileCentered ? 0 : position.upward ? 4 : -4 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  background: "var(--white)",
                  borderRadius: "20px",
                  border: "1px solid rgba(20,20,19,0.1)",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(20,20,19,0.02)",
                  overflow: "hidden",
                  transformOrigin: position.isMobileCentered ? "center" : position.upward ? "bottom" : "top",
                  pointerEvents: "auto",
                }}
              >
            {isCalendar ? (
              <CalendarView
                value={value}
                onChange={(v) => {
                  onChange(v);
                  setOpen(false);
                }}
              />
            ) : isTime ? (
              <ClockView
                value={value}
                minTime={minTime}
                onChange={(v) => {
                  onChange(v);
                }}
                onClose={() => setOpen(false)}
              />
            ) : (
              <div
                style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  width: 140,
                  padding: "8px",
                  fontFamily: "var(--font)",
                }}
                className="custom-scrollbar"
              >
                {options.map((opt) => {
                  const val = typeof opt === "string" ? opt : opt.value;
                  const lbl = typeof opt === "string" ? opt : opt.label;
                  const disabled = minTime && val < minTime;
                  return (
                    <button
                      key={val}
                      onClick={() => {
                        if (!disabled) {
                          onChange(val);
                          setOpen(false);
                        }
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        textAlign: "left",
                        background:
                          value === val
                            ? "rgba(243,115,56,0.08)"
                            : "transparent",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: 12,
                        fontWeight: value === val ? 800 : 500,
                        color: disabled
                          ? "rgba(20,20,19,0.2)"
                          : value === val
                            ? "var(--arc)"
                            : "var(--ink)",
                        cursor: disabled ? "default" : "pointer",
                        transition: "all 0.15s",
                        marginBottom: "2px",
                      }}
                      onMouseEnter={(e) => {
                        if (!disabled && value !== val)
                          e.target.style.background = "rgba(20,20,19,0.04)";
                      }}
                      onMouseLeave={(e) => {
                        if (value !== val)
                          e.target.style.background = "transparent";
                      }}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

const SmartWarnings = memo(function SmartWarnings({
  selectedChannels,
  platformData,
  mediaFiles,
}) {
  const warnings = [];

  const hasInstagram = selectedChannels.some(c => c === 'instagram' || c.startsWith('instagram:'));

  const mainMedia = mediaFiles[0];
  if (!mainMedia || !mainMedia.dimensions) return null;

  const { ratio } = mainMedia.dimensions;
  const isHorizontal = ratio > 1.2;
  const isVertical = ratio < 0.8;

  const hasYoutube = selectedChannels.some((c) => c === "youtube" || String(c).startsWith("youtube:"));

  if (
    hasYoutube &&
    platformData.youtube?.type === "short" &&
    isHorizontal
  ) {
    warnings.push({
      id: "yt-short-ratio",
      text: "YouTube Shorts must be vertical. Your video is landscape and will be uploaded as a normal video.",
    });
  }

  if (
    hasInstagram &&
    platformData.instagram?.type === "reel" &&
    isHorizontal
  ) {
    warnings.push({
      id: "ig-reel-ratio",
      text: "Instagram Reels are vertical. This landscape video will have black bars.",
    });
  }

  if (warnings.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {warnings.map((w) => (
        <motion.div
          key={w.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(243,115,56,0.06)",
            border: "1px solid rgba(243,115,56,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Zap size={14} style={{ color: "var(--arc)", flexShrink: 0 }} />
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ink)",
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {w.text}
          </p>
        </motion.div>
      ))}
    </div>
  );
});

const SizeButton = memo(function SizeButton({ size, isSelected, onClick }) {
  const isSquare = size.id === "1:1";
  const isVertical =
    size.id === "9:16" || size.id === "4:5" || size.id === "2:3";
  const isLandscape = size.id === "16:9" || size.id === "1.91:1";

  // Visual aspect ratio preview
  const getRatioStyles = () => {
    if (isSquare) return { width: 14, height: 14 };
    if (size.id === "4:5") return { width: 12, height: 15 };
    if (size.id === "9:16") return { width: 9, height: 16 };
    if (size.id === "16:9") return { width: 18, height: 10 };
    if (size.id === "1.91:1") return { width: 19, height: 10 };
    if (size.id === "2:3") return { width: 10, height: 15 };
    return { width: 14, height: 14 };
  };

  const ratioStyle = getRatioStyles();

  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        padding: "12px",
        borderRadius: "14px",
        border: "1.5px solid",
        borderColor: isSelected ? "var(--ink)" : "rgba(20,20,19,0.06)",
        background: isSelected ? "var(--ink)" : "var(--white)",
        color: isSelected ? "var(--white)" : "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minWidth: 84,
        flex: 1,
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isSelected
          ? "0 8px 20px rgba(20,20,19,0.15)"
          : "0 2px 4px rgba(0,0,0,0.02)",
      }}
    >
      <div
        style={{
          ...ratioStyle,
          border: `2px solid ${isSelected ? "var(--white)" : "var(--slate)"}`,
          borderRadius: "3px",
          opacity: isSelected ? 1 : 0.4,
          transition: "all 0.2s",
        }}
      />

      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {size.label}
        </p>
        <p
          style={{
            fontSize: 8,
            margin: 0,
            opacity: isSelected ? 0.7 : 0.4,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {size.id}
        </p>
      </div>

      {size.badge && size.badge !== "none" && !isSelected && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            fontSize: 7,
            fontWeight: 900,
            background: size.badge === "best" ? "var(--arc)" : "var(--white)",
            color: size.badge === "best" ? "var(--white)" : "var(--arc)",
            padding: "2px 6px",
            borderRadius: "6px",
            textTransform: "uppercase",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            border: size.badge === "best" ? "none" : "1px solid var(--arc)",
          }}
        >
          {size.badge}
        </div>
      )}
    </motion.button>
  );
});

function ComposerModal({
  isOpen,
  onClose,
  onPostCreated,
  initialData = null,
  initialCaption = "",
  initialHashtags = [],
  initialMediaUrls = [],
  initialScheduledAt = "",
}) {
  const { user, connectedAccounts } = useAuth();
  const { addJob } = useUploadJobs();
  const { alert, confirm } = useDialog();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /* ── State ── */
  const [selectedChannels, setSelectedChannels] = useState([]);
  const hasInstagram = selectedChannels.some(c => c === "instagram" || c.startsWith("instagram:"));
  const getBasePlatform = (c) => c?.split(':')[0] || c;
  const normalizeSelectedChannels = (channels) => {
    const specificProviders = new Set(
      channels
        .map((channel) => String(channel))
        .filter((channel) => channel.includes(":"))
        .map((channel) => channel.split(":")[0]),
    );
    return [...new Set(channels)].filter((channel) => !specificProviders.has(String(channel)));
  };
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [postType, setPostType] = useState("post");
  const postTypeRef = useRef("post");
  const [quickSuggestions, setQuickSuggestions] = useState(QUICK_SUGGESTIONS);
  const [suggestedHashtags, setSuggestedHashtags] = useState(SUGGESTED_HASHTAGS);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFetchingMoreIdeas, setIsFetchingMoreIdeas] = useState(false);
  const [isFetchingMoreHashtags, setIsFetchingMoreHashtags] = useState(false);
  const ideasScrollRef = useRef(null);
  const hashtagsScrollRef = useRef(null);

  const scrollContainer = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const [platformData, setPlatformData] = useState({
    instagram: { type: "post" },
    youtube: { type: "short" },
    facebook: { type: "post" },
    pinterest: { boardId: "", title: "", link: "" },
    reddit: { subreddit: "", title: "", flairId: "" },
    mastodon: { type: "post" },
  });
  const effectivePostType = hasInstagram
    ? platformData.instagram?.type || postType
    : postType;
  const isInstagramStoryOnly =
    hasInstagram &&
    effectivePostType === "story" &&
    selectedChannels.length > 0 &&
    selectedChannels.every((channel) => getBasePlatform(channel) === "instagram");
  const updateInstagramData = useCallback((field, value) => {
    if (field === "type") {
      postTypeRef.current = value;
      setPostType(value);
      setActivePreviewPlatform("instagram");
      setPlatformPresets((current) => ({
        ...current,
        instagram: INSTAGRAM_POST_TYPE_PRESETS[value] || current.instagram,
      }));
    }
    setPlatformData((current) => ({
      ...current,
      instagram: {
        ...current.instagram,
        [field]: value,
      },
    }));
  }, []);
  const [autoDMConfig, setAutoDMConfig] = useState(() => ({
    ...defaultComposerAutoDMConfig,
    responseFlow: {
      ...defaultComposerAutoDMConfig.responseFlow,
      nodes: [...defaultComposerAutoDMConfig.responseFlow.nodes],
    },
  }));
  const [youtubeThumbnail, setYoutubeThumbnail] = useState(null);

  useEffect(() => {
    const ytType = platformData.youtube?.type || "video";
    setPlatformPresets((prev) => ({
      ...prev,
      youtube: ytType === "short" ? "yt-shorts" : "yt-video",
    }));
  }, [platformData.youtube?.type]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);

  /* ── Refs ── */
  const formatScrollRef = useRef(null);

  const scrollFormats = (direction) => {
    if (formatScrollRef.current) {
      const scrollAmount = 260; // Roughly 2 cards
      formatScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Drag & Drop helper
  const getDimensions = (file) => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const d = { width: img.width, height: img.height, ratio: img.width / img.height };
          URL.revokeObjectURL(img.src);
          resolve(d);
        };
        img.src = URL.createObjectURL(file);
      } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.onloadedmetadata = () => {
          const d = { width: video.videoWidth, height: video.videoHeight, ratio: video.videoWidth / video.videoHeight };
          URL.revokeObjectURL(video.src);
          resolve(d);
        };
        video.src = URL.createObjectURL(file);
      } else {
        resolve(null);
      }
    });
  };

  const cropYouTubeThumbnail = (file, position = "center") => {
    if (!file?.type?.startsWith("image/")) return Promise.resolve(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetRatio = 16 / 9;
        const sourceRatio = img.width / img.height;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (sourceRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else if (sourceRatio < targetRatio) {
          sh = img.width / targetRatio;
          sy = position === "top" ? 0 : position === "bottom" ? img.height - sh : (img.height - sh) / 2;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 720;
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, 1280, 720);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(img.src);
          resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.92);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleGlobalDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );

    if (!files.length) return;

    const newItems = await Promise.all(
      files.map(async (file) => ({
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        file,
        dimensions: await getDimensions(file),
      }))
    );

    setMediaFiles((prev) => [...prev, ...newItems].slice(0, 10));
  };

  // Free tier restrictions
  const isFree = user?.plan === "Free" || !user?.plan;


  const [activePreviewPlatform, setActivePreviewPlatform] =
    useState("instagram");
  const [platformPresets, setPlatformPresets] = useState({
    instagram: "ig-post-square",
    facebook: "fb-image",
    x: "x-image",
    linkedin: "li-square",
    youtube: "yt-video",
    threads: "threads-post",
    pinterest: "pin-standard",
    bluesky: "bsky-image",
    mastodon: "masto-image",
    reddit: "reddit-image",
  });
  const [customizationExpanded, setCustomizationExpanded] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [mobileActiveTab, setMobileActiveTab] = useState("compose");
  const [autoFixMsg, setAutoFixMsg] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const fn = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  /* ── Intelligence engine ── */
  const { panelItems, hasBlockingError, totalIssues } = usePostIntelligence({
    selectedChannels,
    mediaFiles,
    platformData,
    youtubeThumbnail,
    postType: effectivePostType,
    caption,
    scheduledAt,
    isScheduled,
    connectedAccounts,
  });

  /* ── Smart size engine ── */
  const activePreviewBasePlatform = getBasePlatform(activePreviewPlatform);
  const { smartSizes, availablePresets, selectedRatio } = useSmartSizes({
    selectedChannels,
    activePlatform: activePreviewBasePlatform,
    selectedSizePreset: platformPresets[activePreviewBasePlatform],
    setSelectedSizePreset: (val) =>
      setPlatformPresets((prev) => ({
        ...prev,
        [activePreviewBasePlatform]: val,
      })),
    onAutoFixed: (msg) => {
      setAutoFixMsg(msg);
      setTimeout(() => setAutoFixMsg(null), 3500);
    },
  });

  /* ── Available post types (intersection) ── */
  const availablePostTypes = useMemo(() => {
    if (selectedChannels.length === 0) return ["post", "story", "reel"];
    let common = PLATFORM_POST_TYPES[getBasePlatform(selectedChannels[0])] || ["post"];
    for (let i = 1; i < selectedChannels.length; i++) {
      const types = PLATFORM_POST_TYPES[getBasePlatform(selectedChannels[i])] || ["post"];
      common = common.filter((t) => types.includes(t));
    }
    return common.length > 0 ? common : ["post"];
  }, [JSON.stringify(selectedChannels)]);

  useEffect(() => {
    if (!availablePostTypes.includes(postType)) {
      const nextType = availablePostTypes[0] || "post";
      postTypeRef.current = nextType;
      setPostType(nextType);
    }
  }, [availablePostTypes, postType]);

  /* ── Platform preview sync ── */
  useEffect(() => {
    if (selectedChannels.length === 0) {
      setActivePreviewPlatform("instagram");
      return;
    }
    if (!selectedChannels.includes(activePreviewPlatform))
      setActivePreviewPlatform(selectedChannels[0]);
  }, [JSON.stringify(selectedChannels), activePreviewPlatform]);

  useEffect(() => {
    if ((!hasInstagram || effectivePostType === "story") && autoDMConfig.enabled) {
      setAutoDMConfig((current) => ({ ...current, enabled: false }));
    }
  }, [JSON.stringify(selectedChannels), autoDMConfig.enabled, hasInstagram, effectivePostType]);

  /* ── Auto-select connected channels on open ── */
  useEffect(() => {
    if (isOpen && selectedChannels.length === 0) {
      const instagramChannels = (connectedAccounts.instagramAccounts || [])
        .map((account) => `instagram:${account.id}`);
      const accountChannels = Object.keys(connectedAccounts)
        .filter((key) => key.endsWith("Accounts") && key !== "instagramAccounts")
        .flatMap((key) => {
          const provider = key.replace(/Accounts$/, "");
          return (connectedAccounts[key] || []).map((account) => `${provider}:${account.id}`);
        });
      const connected = [
        ...instagramChannels,
        ...accountChannels,
        ...Object.keys(connectedAccounts).filter(
          (key) => key !== "instagram" && connectedAccounts[key]?.connected && PLATFORM_META[key] && !(connectedAccounts[`${key}Accounts`]?.length > 0),
        ),
      ];
      setSelectedChannels(normalizeSelectedChannels(connected));
    }
  }, [isOpen]);

  /* ── Pre-fill scheduled time from calendar selection ── */
  useEffect(() => {
    if (isOpen) {
      if (initialScheduledAt) {
        setIsScheduled(true);
        setScheduledAt(initialScheduledAt);
      } else {
        setIsScheduled(false);
        setScheduledAt("");
      }
    }
  }, [isOpen, initialScheduledAt]);

  /* ── Pre-fill caption from trend injection or duplication ── */
  useEffect(() => {
    if (isOpen && initialCaption) {
      setCaption(initialCaption);
    }
  }, [isOpen, initialCaption]);

  /* ── Pre-fill media from trend injection ── */
  useEffect(() => {
    if (isOpen && initialMediaUrls?.length > 0) {
      const loadInitialMedia = async () => {
        try {
          const results = await Promise.all(
            initialMediaUrls.slice(0, 5).map(async (url) => {
              try {
                const res = await fetch(url);
                if (!res.ok) throw new Error("Internal proxy error");

                const blob = await res.blob();
                const name = url.split("/").pop()?.split("?")[0] || "media";

                // Smart mime type detection
                let mimeType = blob.type;
                if (!mimeType || mimeType === "application/octet-stream") {
                  if (
                    url.toLowerCase().includes(".mp4") ||
                    url.toLowerCase().includes(".m4v")
                  )
                    mimeType = "video/mp4";
                  else if (url.toLowerCase().includes(".mov"))
                    mimeType = "video/quicktime";
                  else if (url.toLowerCase().includes(".webm"))
                    mimeType = "video/webm";
                  else if (url.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)/))
                    mimeType = "image/" + url.split(".").pop().split("?")[0];
                }

                // Detect extension
                let extension = mimeType.split("/")[1] || "jpg";
                if (extension === "jpeg") extension = "jpg";
                if (extension.includes("quicktime")) extension = "mov";

                return new File([blob], `${name}.${extension}`, {
                  type: mimeType,
                });
              } catch (err) {
                console.error(
                  "Failed to load media via internal proxy:",
                  url,
                  err,
                );
                return null;
              }
            }),
          );

          const files = results.filter(Boolean);
          const newItems = files.map((file) => ({
            id: `initial_${Math.random().toString(36).substr(2, 9)}`,
            file,
          }));
          if (newItems.length > 0) {
            setMediaFiles(newItems);
          }
        } catch (err) {
          console.error("Failed to load initial media:", err);
        }
      };
      loadInitialMedia();
    }
  }, [isOpen, initialMediaUrls]);

  /* ── Scheduling helpers ── */
  const toLocalDT = (date) => {
    const l = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return l.toISOString().slice(0, 16);
  };
  const minDT = useMemo(
    () => toLocalDT(new Date(Date.now() + 2 * 60 * 1000)),
    [],
  );
  const minDate = minDT.slice(0, 10);
  const minTime = minDT.slice(11, 16);
  const datePart = scheduledAt ? scheduledAt.slice(0, 10) : "";
  const timePart = scheduledAt ? scheduledAt.slice(11, 16) : "";

  const scheduleDateOptions = useMemo(() => {
    const opts = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      opts.push({
        value: toLocalDT(d).slice(0, 10),
        label: d.toLocaleDateString(undefined, {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
      });
    }
    return opts;
  }, []);

  const buildTimeOpts = (dp) => {
    const min = dp !== minDate ? "00:00" : minTime;
    const opts = [];
    for (let h = 0; h < 24; h++)
      for (let m = 0; m < 60; m += 15) {
        const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (v >= min) opts.push(v);
      }
    return opts;
  };
  const scheduleTimeOpts = useMemo(
    () => buildTimeOpts(datePart || minDate),
    [datePart, minDate, minTime],
  );

  useEffect(() => {
    if (!isScheduled) return;
    const dv = datePart || minDate;
    let nt = timePart;
    
    if (!nt) {
      nt = buildTimeOpts(dv)[0] || "";
    } else if (dv === minDate && nt < minTime) {
      nt = minTime;
    }

    if (!nt) return;
    const nv = `${dv}T${nt}`;
    if (scheduledAt !== nv) setScheduledAt(nv);
  }, [isScheduled, datePart, minDate, minTime]);

  /* ── Handlers ── */
  const handleChannelToggle = useCallback((id) => {
    setSelectedChannels((prev) =>
      normalizeSelectedChannels(prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]),
    );
    setError(null);
  }, []);

  const handleBulkSelect = useCallback((ids) => {
    setSelectedChannels(normalizeSelectedChannels(ids));
    setError(null);
  }, []);

  /* ── Validation ── */
  const validateForm = useCallback(() => {
    if (selectedChannels.length === 0) {
      setError("Please select at least one platform");
      return false;
    }
    if (!isInstagramStoryOnly && !caption.trim()) {
      setError("Please add a caption");
      return false;
    }
    if (mediaFiles.length === 0) {
      setError("Please upload at least one file");
      return false;
    }

    const hasImg = mediaFiles.some((m) => m.file?.type?.startsWith("image/"));
    const hasVid = mediaFiles.some((m) => m.file?.type?.startsWith("video/"));

    const hasPlatform = (p) =>
      selectedChannels.some((c) => c === p || String(c).startsWith(p + ":"));

    if (effectivePostType === "reel" && !hasVid) {
      setError("Reels require a video file.");
      return false;
    }
    if (effectivePostType === "story" && mediaFiles.length > 1) {
      setError("Stories support one image or video at a time.");
      return false;
    }
    if (hasPlatform("youtube") && (!hasVid || hasImg)) {
      setError(
        "YouTube only supports video files (.mp4, .mov, .webm, .mkv). Images and GIFs cannot be uploaded to YouTube.",
      );
      return false;
    }
    if (
      hasPlatform("pinterest") &&
      !platformData.pinterest?.title?.trim()
    ) {
      setError("Pinterest requires a title in Platform Customization.");
      return false;
    }
    if (
      hasPlatform("pinterest") &&
      !platformData.pinterest?.boardId
    ) {
      setError("Pinterest requires a board selection.");
      return false;
    }
    if (
      hasPlatform("reddit") &&
      !platformData.reddit?.subreddit?.trim()
    ) {
      setError("Reddit requires a subreddit.");
      return false;
    }
    if (isScheduled) {
      if (!scheduledAt) {
        setError("Please select a date and time for scheduling.");
        return false;
      }
      if (new Date(scheduledAt).getTime() < Date.now() + 2 * 60 * 1000) {
        setError("Scheduled time must be at least 2 minutes in the future.");
        return false;
      }
    }
    if (hasInstagram && effectivePostType !== "story" && autoDMConfig.enabled) {
      if (!autoDMConfig.keywords?.length) {
        setError("Add at least one Auto DM keyword or turn Auto DM off.");
        return false;
      }
      if (!autoDMConfig.responseFlow?.nodes?.length) {
        setError("Add at least one Auto DM response or turn Auto DM off.");
        return false;
      }
    }
    return true;
  }, [
    selectedChannels,
    caption,
    mediaFiles,
    platformData,
    isScheduled,
    scheduledAt,
    autoDMConfig,
    hasInstagram,
    effectivePostType,
    isInstagramStoryOnly,
  ]);

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Prep data
      const formData = new FormData();
      formData.append("caption", isInstagramStoryOnly ? "" : caption);
      const publishChannels = normalizeSelectedChannels(selectedChannels);
      const publishPostType = hasInstagram ? postTypeRef.current : effectivePostType;
      const publishPlatformData = hasInstagram
        ? {
            ...platformData,
            instagram: {
              ...platformData.instagram,
              type: publishPostType,
            },
          }
        : platformData;
      formData.append("selectedChannels", JSON.stringify(publishChannels));
      formData.append("postType", publishPostType);
      formData.append("platformData", JSON.stringify(publishPlatformData));
      
      formData.append("platformPresets", JSON.stringify(
        hasInstagram && publishPostType !== 'post'
          ? {
              ...platformPresets,
              instagram: INSTAGRAM_POST_TYPE_PRESETS[publishPostType] || platformPresets.instagram,
            }
          : platformPresets
      ));
      formData.append("userTimezone", userTimezone);
      formData.append("isScheduled", isScheduled ? "true" : "false");
      if (hasInstagram && publishPostType !== "story" && autoDMConfig.enabled) {
        formData.append("autoDMConfig", JSON.stringify(autoDMConfig));
      }

      if (isScheduled) {
        formData.append("scheduledAt", new Date(scheduledAt).toISOString());
      }

      mediaFiles.forEach((m) => {
        if (m.file) {
          formData.append("media", m.file);
        }
      });

      if (youtubeThumbnail) {
        formData.append(
          "youtubeThumbnail",
          await cropYouTubeThumbnail(youtubeThumbnail, publishPlatformData.youtube?.thumbnailCrop),
        );
      }

      formData.append("selectedAspectRatio", selectedRatio || "1:1");
      formData.append(
        "selectedPostSizePreset",
        platformPresets[activePreviewBasePlatform] || ""
      );

      // 2. Start broadcast via API
      // We use a separate axios instance or override headers to avoid the default 'application/json' 
      // from apiClient, which causes 400 Bad Request on the server when sending FormData.
      const res = await apiClient.post("/api/broadcast", formData, {
        headers: {
          "Content-Type": undefined,
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`📤 Upload Progress: ${percentCompleted}%`);
        },
      });

      // 3. Add to background manager
      const firstMedia = mediaFiles[0];
      const isGif = firstMedia?.file?.type === "image/gif";
      const detectedMediaType = (firstMedia?.file?.type?.startsWith("video/") || isGif)
        ? "video"
        : "image";

      addJob(
        res.data.jobId,
        {
          caption,
          channels: publishChannels,
          fileCount: mediaFiles.length,
          mediaType: detectedMediaType,
          previewUrl:
            firstMedia?.preview ||
            (firstMedia?.file ? URL.createObjectURL(firstMedia.file) : null),
        },
        (completedJob) => {
          if (completedJob?.status === "completed") {
            onPostCreated && onPostCreated();
          }
        }
      );

      // 4. Reset & Close
      onPostCreated && onPostCreated();
      onClose();
      setCaption("");
      setMediaFiles([]);
      setSelectedChannels([]);
      setAutoDMConfig({
        ...defaultComposerAutoDMConfig,
        responseFlow: {
          ...defaultComposerAutoDMConfig.responseFlow,
          nodes: [...defaultComposerAutoDMConfig.responseFlow.nodes],
        },
      });
      setError(null);
    } catch (err) {
      console.error("Broadcast submission error:", err);
      if (err.response) {
        console.error("Server response data:", err.response.data);
      }
      setError(err.response?.data?.error || "Failed to start broadcast");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (caption || mediaFiles.length > 0) {
      confirm(
        "Discard post?",
        "You have unsaved changes. Are you sure you want to discard this post?",
        {
          confirmLabel: "Discard",
          intent: "danger",
        },
      ).then((ok) => ok && onClose());
    } else {
      onClose();
    }
  };

  const handleAiAssistantClick = async () => {
    if (!caption || caption.trim() === '') {
      setError("Please write some text in the caption field first for the AI to analyze.");
      return;
    }
    
    setIsAiLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/ai/suggest', { text: caption });
      if (response.data) {
        if (response.data.ideas && response.data.ideas.length > 0) {
          setQuickSuggestions(response.data.ideas);
        }
        if (response.data.hashtags && response.data.hashtags.length > 0) {
          setSuggestedHashtags(response.data.hashtags);
        }
        if (response.data.titles && response.data.titles.length > 0) {
          // You could also use titles in another way, or just mix them with ideas
          setQuickSuggestions(prev => [...response.data.titles, ...prev]);
        }
      }
    } catch (err) {
      console.error("AI Assistant error:", err);
      setError(err.response?.data?.error || "Failed to fetch AI suggestions.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const fetchMoreIdeas = async () => {
    if (!caption || caption.trim() === '') {
      setError("Please write some text in the caption field first.");
      return;
    }
    
    setIsFetchingMoreIdeas(true);
    try {
      const response = await apiClient.post('/api/ai/suggest', { text: caption, type: 'ideas' });
      if (response.data && response.data.ideas && response.data.ideas.length > 0) {
        setQuickSuggestions(prev => [...prev, ...response.data.ideas]);
        // scroll to the right to show the newly added ideas after a short delay
        setTimeout(() => scrollContainer(ideasScrollRef, 'right'), 100);
      }
    } catch (err) {
      console.error("AI Assistant error:", err);
      setError(err.response?.data?.error || "Failed to fetch more ideas.");
    } finally {
      setIsFetchingMoreIdeas(false);
    }
  };

  const fetchMoreHashtags = async () => {
    if (!caption || caption.trim() === '') {
      setError("Please write some text in the caption field first.");
      return;
    }
    
    setIsFetchingMoreHashtags(true);
    try {
      const response = await apiClient.post('/api/ai/suggest', { text: caption, type: 'hashtags' });
      if (response.data && response.data.hashtags && response.data.hashtags.length > 0) {
        setSuggestedHashtags(prev => [...prev, ...response.data.hashtags]);
        setTimeout(() => scrollContainer(hashtagsScrollRef, 'right'), 100);
      }
    } catch (err) {
      console.error("AI Assistant error:", err);
      setError(err.response?.data?.error || "Failed to fetch more hashtags.");
    } finally {
      setIsFetchingMoreHashtags(false);
    }
  };

  if (!isOpen) return null;

  const publishDisabled = loading || hasBlockingError;
  const shellFullscreen = isFullscreen || isMobile;
  const previewWidth = isFullscreen ? 360 : 300;

  const MOBILE_TABS = [
    { id: "compose", label: "Compose" },
    { id: "preview", label: "Preview" },
    { id: "insights", label: "Insights" },
  ];

  /* ── JSX ── */
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
        style={{ padding: shellFullscreen ? 0 : 16 }}
      >
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 28,
            layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsGlobalDragging(true);
          }}
          onDragLeave={() => setIsGlobalDragging(false)}
          onDrop={handleGlobalDrop}
          style={{
            position: "relative",
            width: "100%",
            maxWidth: shellFullscreen ? "100%" : 960,
            height: shellFullscreen ? "100vh" : "90vh",
            background: isFullscreen ? "#f7f6f3" : "var(--canvas,#fff)",
            borderRadius: shellFullscreen ? 0 : "var(--r-hero,20px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: shellFullscreen ? "none" : "0 25px 50px -12px rgba(0,0,0,0.25)",
            border: shellFullscreen ? "none" : "1px solid rgba(20,20,19,0.08)",
          }}
        >
          {/* Global Drag Overlay */}
          <AnimatePresence>
            {isGlobalDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2000,
                  background: "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "3px dashed var(--arc)",
                  margin: 12,
                  borderRadius: 16,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    background: "var(--arc)",
                    color: "white",
                    padding: "20px",
                    borderRadius: "50%",
                    marginBottom: 20,
                    boxShadow: "0 10px 25px rgba(243,115,56,0.3)",
                  }}
                >
                  <Upload size={40} strokeWidth={2.5} />
                </div>
                <h3
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "var(--ink)",
                    margin: "0 0 8px 0",
                  }}
                >
                  Drop to Upload
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--slate)",
                    margin: 0,
                  }}
                >
                  Release your files anywhere to add them to your post
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* ── HEADER ── */}
          <div
            style={{
              padding: isFullscreen ? "14px 24px" : "16px 22px",
              borderBottom: "1px solid rgba(20,20,19,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "white",
              flexShrink: 0,
              minHeight: isFullscreen ? 60 : "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--ink,#141413)",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Create Post
              </h2>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 20,
                  background: "rgba(20,20,19,0.05)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--slate,#8a8a82)",
                }}
              >
                <Zap size={9} /> {selectedChannels.length} platform
                {selectedChannels.length !== 1 ? "s" : ""}
              </motion.div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!isMobile && (
                <motion.button
                  type="button"
                  onClick={() => setIsFullscreen((value) => !value)}
                  aria-label={isFullscreen ? "Exit fullscreen composer" : "Open fullscreen composer"}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                  whileHover={{ scale: 1.05, background: "rgba(20,20,19,0.06)" }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: isFullscreen ? "1px solid var(--ink,#141413)" : "1px solid rgba(20,20,19,0.1)",
                    background: isFullscreen ? "white" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isFullscreen ? "var(--ink,#141413)" : "var(--slate,#8a8a82)",
                  }}
                >
                  {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </motion.button>
              )}
              <motion.button
                type="button"
                onClick={handleClose}
                aria-label="Close modal"
                whileHover={{ scale: 1.05, background: "rgba(20,20,19,0.06)" }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "1px solid rgba(20,20,19,0.1)",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--slate,#8a8a82)",
                }}
              >
                <X size={13} />
              </motion.button>
            </div>
          </div>

          {/* ── MOBILE TABS ── */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                background: "var(--canvas-lifted,#fafaf9)",
                borderBottom: "1px solid rgba(20,20,19,0.08)",
                flexShrink: 0,
              }}
            >
              {MOBILE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMobileActiveTab(tab.id)}
                  style={{
                    flex: 1,
                    padding: "11px 4px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    border: "none",
                    background: "transparent",
                    color:
                      mobileActiveTab === tab.id
                        ? "var(--ink,#141413)"
                        : "var(--slate,#8a8a82)",
                    borderBottom: `2.5px solid ${mobileActiveTab === tab.id ? "var(--ink,#141413)" : "transparent"}`,
                    transition: "all 0.2s",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── AUTO-FIX TOAST ── */}
          <AnimatePresence>
            {autoFixMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  position: "absolute",
                  top: 60,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 200,
                  background: "rgba(5,150,105,0.92)",
                  color: "white",
                  padding: "7px 14px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 8px 20px rgba(5,150,105,0.25)",
                }}
              >
                <CheckCircle2 size={12} /> {autoFixMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── BODY ── */}
          <div
            style={{
              display: "flex",
              flex: 1,
              overflow: "hidden",
              background: isFullscreen ? "#f7f6f3" : "transparent",
              height: isMobile
                ? "calc(100vh - 105px)"
                : isFullscreen
                  ? "calc(100vh - 115px)"
                  : "calc(90vh - 115px)",
            }}
          >
            {/* ── PREVIEW PANEL (right column on desktop, tab on mobile) ── */}
            {(!isMobile || mobileActiveTab === "preview") && (
              <div
                style={{
                  width: isMobile ? "100%" : previewWidth,
                  flexShrink: 0,
                  borderLeft: isMobile
                    ? "none"
                    : "1px solid rgba(20,20,19,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: "#fff",
                  order: 1,
                }}
              >
                <div
                  style={{
                    padding: isFullscreen ? "14px 18px" : "11px 14px",
                    borderBottom: "1px solid rgba(20,20,19,0.08)",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "var(--slate,#8a8a82)",
                      textTransform: "uppercase",
                    }}
                  >
                    Live Preview
                  </span>
                </div>
                <PreviewPanel
                  user={user}
                  selectedChannels={selectedChannels}
                  caption={caption}
                  mediaFiles={mediaFiles}
                  selectedRatio={selectedRatio}
                  selectedSizePreset={platformPresets[activePreviewBasePlatform]}
                  youtubeThumbnail={youtubeThumbnail}
                  activePlatform={activePreviewPlatform}
                  onActivePlatformChange={setActivePreviewPlatform}
                  connectedAccounts={connectedAccounts}
                />
              </div>
            )}

            {/* ── COMPOSER (main content) ── */}
            {(!isMobile ||
              mobileActiveTab === "compose" ||
              mobileActiveTab === "insights") && (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  minWidth: 0,
                  maxWidth: isFullscreen ? 960 : "none",
                  margin: isFullscreen ? "0 auto" : 0,
                  padding: isFullscreen ? "24px 28px 36px" : "24px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: isFullscreen ? 18 : 24,
                  boxSizing: "border-box",
                  scrollbarWidth: "none",
                }}
              >
                {/* ── Top row ── */}
                {(!isMobile || mobileActiveTab === "compose") && (
                  <div style={{ flexShrink: 0 }}>
                    <Section label="Post to" mb={12}>
                      <ChannelSelector
                        selectedChannels={selectedChannels}
                        onChannelToggle={handleChannelToggle}
                        onBulkSelect={handleBulkSelect}
                        connectedAccounts={connectedAccounts}
                        rightContent={
                          <motion.button
                            type="button"
                            onClick={handleAiAssistantClick}
                            disabled={isAiLoading}
                            whileHover={{ scale: isAiLoading ? 1 : 1.02 }}
                            whileTap={{ scale: isAiLoading ? 1 : 0.97 }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              fontSize: 10,
                              fontWeight: 700,
                              color: isAiLoading ? "var(--slate,#8a8a82)" : "#4f46e5",
                              background: isAiLoading ? "transparent" : "rgba(79,70,229,0.06)",
                              border: "1px solid rgba(20,20,19,0.1)",
                              borderRadius: "var(--r-btn,10px)",
                              cursor: isAiLoading ? "wait" : "pointer",
                              fontFamily: "inherit",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em"
                            }}
                          >
                            {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {isAiLoading ? "Thinking..." : "AI Assistant"}
                          </motion.button>
                        }
                      />
                    </Section>



                    {!isInstagramStoryOnly && (
                      <>
                        {/* Caption */}
                        <div style={{ position: "relative", marginBottom: 16 }}>
                          <textarea
                            value={caption}
                            onChange={(e) => {
                              setCaption(e.target.value);
                              setError(null);
                            }}
                            placeholder="What's on your mind?"
                            style={{
                              width: "100%",
                              minHeight: 120,
                              padding: 14,
                              background: "white",
                              border: "1px solid rgba(20,20,19,0.1)",
                              borderRadius: "var(--r-hero,16px)",
                              fontSize: 14,
                              fontFamily: "inherit",
                              resize: "none",
                              color: "var(--ink,#141413)",
                              outline: "none",
                              transition: "border-color 0.2s",
                            }}
                            onFocus={(e) =>
                              (e.target.style.borderColor = "var(--ink)")
                            }
                            onBlur={(e) =>
                              (e.target.style.borderColor = "rgba(20,20,19,0.1)")
                            }
                          />
                          {/* Caption helpers */}
                          {!isMobile && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: 12,
                                right: 12,
                                display: "flex",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setCaption((p) =>
                                    p
                                      ? `${p} {{MENTION_SELF}}`
                                      : "{{MENTION_SELF}}",
                                  )
                                }
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#4f46e5",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                }}
                              >
                                <AtSign size={9} /> Mention
                              </button>
                              <button
                                onClick={() => setCaption("")}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "var(--slate,#8a8a82)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {effectivePostType !== "story" && (
                      <>
                        {/* Quick suggestions */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <RowLabel>Quick Ideas</RowLabel>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" onClick={() => scrollContainer(ideasScrollRef, 'left')} style={{ padding: 4, borderRadius: 6, background: 'var(--canvas-lifted,#f5f5f4)', border: '1px solid rgba(20,20,19,0.1)', cursor: 'pointer' }}><ChevronLeft size={14} /></button>
                              <button type="button" onClick={() => scrollContainer(ideasScrollRef, 'right')} style={{ padding: 4, borderRadius: 6, background: 'var(--canvas-lifted,#f5f5f4)', border: '1px solid rgba(20,20,19,0.1)', cursor: 'pointer' }}><ChevronRight size={14} /></button>
                              <button type="button" onClick={fetchMoreIdeas} disabled={isFetchingMoreIdeas} style={{ padding: 4, borderRadius: 6, background: 'var(--canvas-lifted,#f5f5f4)', border: '1px solid rgba(20,20,19,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isFetchingMoreIdeas ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                              </button>
                            </div>
                          </div>
                          <div
                            ref={ideasScrollRef}
                            style={{
                              display: "flex",
                              gap: 6,
                              overflowX: "auto",
                              paddingBottom: 4,
                              scrollbarWidth: "none",
                            }}
                          >
                            {quickSuggestions.map((s, i) => (
                              <motion.button
                                key={i}
                                type="button"
                                whileHover={{
                                  scale: 1.03,
                                  background: "var(--ink,#141413)",
                                  color: "white",
                                }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() =>
                                  setCaption(s)
                                }
                                style={{
                                  flexShrink: 0,
                                  padding: "6px 14px",
                                  background: "var(--canvas-lifted,#f5f5f4)",
                                  border: "1px solid rgba(20,20,19,0.1)",
                                  borderRadius: 20,
                                  fontSize: 13,
                                  color: "var(--slate,#8a8a82)",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  fontFamily: "inherit",
                                  fontWeight: 500,
                                  transition: "all 0.15s",
                                }}
                              >
                                {s}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Hashtags */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <RowLabel>Hashtags</RowLabel>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" onClick={() => scrollContainer(hashtagsScrollRef, 'left')} style={{ padding: 4, borderRadius: 6, background: 'var(--canvas-lifted,#f5f5f4)', border: '1px solid rgba(20,20,19,0.1)', cursor: 'pointer' }}><ChevronLeft size={14} /></button>
                              <button type="button" onClick={() => scrollContainer(hashtagsScrollRef, 'right')} style={{ padding: 4, borderRadius: 6, background: 'var(--canvas-lifted,#f5f5f4)', border: '1px solid rgba(20,20,19,0.1)', cursor: 'pointer' }}><ChevronRight size={14} /></button>
                              <button type="button" onClick={fetchMoreHashtags} disabled={isFetchingMoreHashtags} style={{ padding: 4, borderRadius: 6, background: 'var(--canvas-lifted,#f5f5f4)', border: '1px solid rgba(20,20,19,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isFetchingMoreHashtags ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                              </button>
                            </div>
                          </div>
                          <div
                            ref={hashtagsScrollRef}
                            style={{
                              display: "flex",
                              gap: 6,
                              overflowX: "auto",
                              alignItems: "center",
                              scrollbarWidth: "none",
                            }}
                          >
                            <input
                              type="text"
                              placeholder="+ Add tag (Enter)"
                              style={{
                                fontSize: 13,
                                padding: "6px 14px",
                                border: "1px dashed rgba(20,20,19,0.2)",
                                borderRadius: 20,
                                background: "transparent",
                                outline: "none",
                                width: 140,
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    const tag = val.startsWith("#")
                                      ? val
                                      : `#${val}`;
                                    setCaption((p) => (p ? `${p} ${tag}` : tag));
                                    e.target.value = "";
                                  }
                                }
                              }}
                            />
                            {suggestedHashtags.map((h, i) => (
                              <button
                                key={i}
                                onClick={() =>
                                  setCaption((p) => (p ? `${p} ${h}` : h))
                                }
                                style={{
                                  flexShrink: 0,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#4f46e5",
                                  background: "rgba(79,70,229,0.06)",
                                  border: "none",
                                  padding: "6px 14px",
                                  borderRadius: 20,
                                  cursor: "pointer",
                                }}
                              >
                                {h}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setCaption((p) =>
                                  p ? `${p} #getaipilot` : "#getaipilot",
                                )
                              }
                              className="btn-signal"
                              style={{
                                fontSize: 10,
                                padding: "4px 10px",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                flexShrink: 0,
                              }}
                            >
                              #getaipilot <Sparkles size={9} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Media ── */}
                <Section
                  label={`Media${mediaFiles.length > 0 ? ` (${mediaFiles.length}/10)` : ""}`}
                  mb={20}
                >
                  <MediaUploader
                    mediaFiles={mediaFiles}
                    setMediaFiles={setMediaFiles}
                    onError={setError}
                    isMobile={isMobile}
                  />
                </Section>

                {/* ── Smart Size ── */}
                <Section
                  label="Content Format"
                  hint={`Format for ${PLATFORM_META[activePreviewBasePlatform]?.label || "active platform"}`}
                  mb={20}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "nowrap",
                      overflowX: "auto",
                      paddingTop: 8,
                      paddingBottom: 10,
                      paddingLeft: 4,
                      paddingRight: 4,
                      scrollbarWidth: "none",
                      msOverflowStyle: "none",
                    }}
                  >
                    {(PLATFORM_LAYOUT_PRESETS[activePreviewBasePlatform] || []).map(
                      (preset) => {
                        const sizeInfo = smartSizes.find(
                          (s) => s.id === preset.ratio,
                        );
                        const isSelected =
                          platformPresets[activePreviewBasePlatform] === preset.id;
                        return (
                          <motion.button
                            key={preset.id}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() =>
                              setPlatformPresets((prev) => ({
                                ...prev,
                                [activePreviewBasePlatform]: preset.id,
                              }))
                            }
                            style={{
                              flexShrink: 0,
                              minWidth: 130,
                              padding: "12px 14px",
                              background: isSelected
                                ? "rgba(20,20,19,0.03)"
                                : "var(--white)",
                              border: isSelected
                                ? "2px solid var(--arc)"
                                : "1px solid rgba(20,20,19,0.08)",
                              borderRadius: "14px",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              textAlign: "left",
                              transition:
                                "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              boxShadow: isSelected
                                ? "0 4px 12px rgba(243,115,56,0.12)"
                                : "0 2px 4px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                width: "100%",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: isSelected
                                    ? "var(--arc)"
                                    : "var(--ink)",
                                }}
                              >
                                {preset.title}
                              </span>
                              {sizeInfo?.badge && (
                                <div
                                  style={{
                                    fontSize: 8,
                                    fontWeight: 900,
                                    background:
                                      sizeInfo.badge === "best"
                                        ? "var(--arc)"
                                        : "transparent",
                                    color:
                                      sizeInfo.badge === "best"
                                        ? "white"
                                        : "var(--arc)",
                                    border:
                                      sizeInfo.badge === "best"
                                        ? "none"
                                        : "1px solid var(--arc)",
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {sizeInfo.badge}
                                </div>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 9,
                                color: "var(--slate)",
                                fontWeight: 500,
                                opacity: 0.7,
                              }}
                            >
                              {preset.subtitle} ({preset.ratio})
                            </span>
                          </motion.button>
                        );
                      },
                    )}
                  </div>
                </Section>

                {/* ── Schedule ── */}
                <Section mb={20}>
                  <div
                    onClick={() => setIsScheduled(!isScheduled)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      padding: "16px 20px",
                      borderRadius: isScheduled
                        ? "var(--r-hero) var(--r-hero) 0 0"
                        : "var(--r-hero)",
                      background: "var(--white)",
                      border: "1px solid rgba(20,20,19,0.08)",
                      borderBottom: isScheduled
                        ? "1px solid rgba(20,20,19,0.03)"
                        : "1px solid rgba(20,20,19,0.08)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Calendar
                        size={13}
                        style={{
                          color: isScheduled
                            ? "var(--arc,#f37338)"
                            : "var(--slate,#8a8a82)",
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: isScheduled
                              ? "var(--arc,#f37338)"
                              : "var(--ink,#141413)",
                            margin: 0,
                          }}
                        >
                          {isScheduled ? "Scheduled" : "Schedule for later"}
                        </p>
                        {isScheduled && scheduledAt && (
                          <p
                            style={{
                              fontSize: 10,
                              color: "var(--arc,#f37338)",
                              margin: 0,
                              opacity: 0.8,
                            }}
                          >
                            {new Date(scheduledAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isScheduled ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown
                        size={13}
                        style={{ color: "var(--slate,#8a8a82)" }}
                      />
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {isScheduled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, overflow: "hidden" }}
                        animate={{
                          opacity: 1,
                          height: "auto",
                          transitionEnd: { overflow: "visible" },
                        }}
                        exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                        transition={{ duration: 0.25 }}
                      >
                        <div
                          style={{
                            padding: "12px 13px",
                            background: "var(--canvas-lifted,#f5f5f4)",
                            border: "1px solid rgba(20,20,19,0.08)",
                            borderTop: "none",
                            borderRadius: "0 0 11px 11px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                            }}
                          >
                            <CustomSelect
                              value={datePart || minDate}
                              options={scheduleDateOptions}
                              onChange={(v) =>
                                setScheduledAt(
                                  `${v}T${timePart || buildTimeOpts(v)[0] || ""}`,
                                )
                              }
                              icon={Calendar}
                              isCalendar
                            />
                            <CustomSelect
                              value={
                                timePart ||
                                buildTimeOpts(datePart || minDate)[0] ||
                                ""
                              }
                              options={scheduleTimeOpts}
                              onChange={(v) =>
                                setScheduledAt(`${datePart || minDate}T${v}`)
                              }
                              icon={Clock}
                              isTime
                              minTime={
                                datePart === minDate ? minTime : undefined
                              }
                              align="right"
                            />
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            {[
                              { l: "+15m", m: 15 },
                              { l: "+1h", m: 60 },
                              { l: "Tomorrow 9AM", m: null },
                            ].map((q) => (
                              <button
                                key={q.l}
                                type="button"
                                onClick={() => {
                                  if (q.m !== null) {
                                    const d = new Date(
                                      Date.now() + q.m * 60000,
                                    );
                                    setScheduledAt(toLocalDT(d));
                                  } else {
                                    const t = new Date();
                                    t.setDate(t.getDate() + 1);
                                    t.setHours(9, 0, 0, 0);
                                    setScheduledAt(toLocalDT(t));
                                  }
                                }}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: "100px",
                                  border: "1px solid rgba(20,20,19,0.08)",
                                  background: "var(--white)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "var(--slate)",
                                  cursor: "pointer",
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.borderColor = "var(--arc)";
                                  e.target.style.color = "var(--arc)";
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.borderColor =
                                    "rgba(20,20,19,0.08)";
                                  e.target.style.color = "var(--slate)";
                                }}
                              >
                                {q.l}
                              </button>
                            ))}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "7px 10px",
                              background: "rgba(243,115,56,0.05)",
                              borderRadius: 8,
                              border: "1px solid rgba(243,115,56,0.1)",
                            }}
                          >
                            <Clock
                              size={11}
                              style={{ color: "var(--arc,#f37338)" }}
                            />
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--arc,#f37338)",
                                fontWeight: 600,
                              }}
                            >
                              Timezone: {userTimezone}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Section>

                {/* ── Platform Customization ── */}
                <PlatformCustomization
                  selectedChannels={selectedChannels}
                  platformData={platformData}
                  onPlatformDataChange={setPlatformData}
                  expanded={customizationExpanded}
                  onToggleExpanded={() =>
                    setCustomizationExpanded(!customizationExpanded)
                  }
                  youtubeThumbnail={youtubeThumbnail}
                  onYoutubeThumbnailChange={setYoutubeThumbnail}
                  postType={effectivePostType}
                />

                {/* ✨ Smart Warnings ✨ */}
                {hasInstagram && effectivePostType !== "story" && (
                  <Section label="Instagram Auto DM" mb={20}>
                    <AutoDMComposerPanel
                      config={autoDMConfig}
                      onChange={setAutoDMConfig}
                      postType={effectivePostType}
                    />
                  </Section>
                )}

                <SmartWarnings
                  selectedChannels={selectedChannels}
                  platformData={platformData}
                  mediaFiles={mediaFiles}
                />

                {panelItems.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <IntelligencePanel panelItems={panelItems} />
                  </div>
                )}

                {/* ── Error ── */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      style={{
                        marginTop: 12,
                        padding: "10px 13px",
                        borderRadius: 10,
                        background: "rgba(239,68,68,0.06)",
                        border: "1px solid rgba(239,68,68,0.15)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <AlertCircle
                        size={13}
                        style={{
                          color: "#dc2626",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      />
                      <p
                        style={{
                          fontSize: 12,
                          color: "#dc2626",
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        {error}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── INSIGHTS TAB (mobile only) ── */}
            {isMobile && mobileActiveTab === "insights" && (
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: 16,
                  background: "var(--canvas,#fff)",
                }}
              >
                {panelItems.length === 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      textAlign: "center",
                      opacity: 0.4,
                    }}
                  >
                    <CheckCircle2
                      size={32}
                      style={{ marginBottom: 10, color: "#059669" }}
                    />
                    <p style={{ fontWeight: 700, color: "#111", margin: 0 }}>
                      All clear!
                    </p>
                    <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                      No issues detected with your post.
                    </p>
                  </div>
                ) : (
                  <IntelligencePanel panelItems={panelItems} />
                )}
              </div>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div
            style={{
              borderTop: "1px solid rgba(20,20,19,0.08)",
              padding: isMobile ? "12px 16px" : isFullscreen ? "12px 24px" : "14px 22px",
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              borderBottomLeftRadius: shellFullscreen ? 0 : "var(--r-hero,20px)",
              borderBottomRightRadius: shellFullscreen ? 0 : "var(--r-hero,20px)",
              gap: isMobile ? 8 : 16,
              flexWrap: isMobile ? "wrap" : "nowrap",
              boxShadow: isFullscreen ? "0 -2px 8px rgba(20,20,19,0.04)" : "none",
            }}
          >
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleClose}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--slate,#8a8a82)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "7px 13px",
                borderRadius: 20,
              }}
            >
              Cancel
            </motion.button>

            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, flexWrap: "wrap", justifyContent: "flex-end", flex: 1 }}>
              {/* Scheduled badge */}
              {isScheduled && scheduledAt && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontSize: 10,
                    color: "var(--arc,#f37338)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "rgba(243,115,56,0.06)",
                    padding: isMobile ? "4px 8px" : "5px 12px",
                    borderRadius: 20,
                    border: "1px solid rgba(243,115,56,0.15)",
                    textAlign: "center",
                  }}
                >
                  <Clock size={11} />
                  {isMobile ? (
                    <span>
                      {new Date(scheduledAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).replace(',', '')}
                    </span>
                  ) : (
                    new Date(scheduledAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  )}
                </motion.div>
              )}

              {/* Blocking issue hint */}
              {hasBlockingError && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    fontSize: 12,
                    color: "#dc2626",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    maxWidth: isMobile ? 180 : 280,
                    lineHeight: 1.2,
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />{" "}
                  {panelItems.find((p) => p.kind === "error" || p.blocking)?.title ||
                    (isMobile ? "Fix errors" : "Fix errors above")}
                </motion.span>
              )}


              {/* PUBLISH BUTTON */}
              <motion.button
                whileHover={
                  !publishDisabled
                    ? {
                        scale: 1.02,
                        y: -2,
                        boxShadow: isScheduled
                          ? "0 10px 24px rgba(243,115,56,0.3)"
                          : "0 10px 24px rgba(20,20,19,0.22)",
                      }
                    : {}
                }
                whileTap={!publishDisabled ? { scale: 0.97 } : {}}
                type="button"
                onClick={handleSubmit}
                disabled={publishDisabled || loading}
                className={`btn-fly ${publishDisabled || loading ? "" : "hovering"}`}
                style={{
                  background:
                    publishDisabled
                      ? "rgba(20,20,19,0.18)"
                      : isScheduled
                        ? "linear-gradient(135deg,var(--arc,#f37338) 0%,#ff8c5a 100%)"
                        : "linear-gradient(135deg,var(--ink,#141413) 0%,#3a3a37 100%)",
                  height: isMobile ? 42 : 48,
                  minWidth: isMobile ? 120 : 175,
                  borderRadius: "16px",
                  padding: isMobile ? "0 16px" : "0 28px",
                  display: "flex",
                  flexDirection: "row-reverse",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                  color: "white",
                  border: "none",
                  cursor:
                    publishDisabled
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                  fontFamily: "inherit",
                  overflow: "hidden",
                  position: "relative",
                  width: isMobile && (hasBlockingError || isScheduled) ? "100%" : "auto", // Expand to full width if wrapped to new line on mobile
                  marginTop: isMobile && (hasBlockingError || isScheduled) ? 4 : 0,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      Publishing…
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      {isScheduled ? "Schedule Post" : "Publish Now"}
                    </span>
                    <div
                      className="svg-wrapper-1"
                      style={{
                        position: "relative",
                        zIndex: 2,
                        flexShrink: 0,
                        overflow: "visible",
                      }}
                    >
                      <div
                        className="svg-wrapper"
                        style={{ overflow: "visible" }}
                      >
                        {isScheduled ? (
                          <Calendar size={isMobile ? 16 : 20} strokeWidth={2.5} />
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            width={isMobile ? 18 : 24}
                            height={isMobile ? 18 : 24}
                            fill="currentColor"
                          >
                            <path fill="none" d="M0 0h24v24H0z" />
                            <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Small layout helpers ── */
const Section = memo(function Section({ label, hint, mb = 16, children }) {
  return (
    <div style={{ marginBottom: mb }}>
      {label && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "var(--slate,#8a8a82)",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
          {hint && (
            <span
              style={{
                fontSize: 9,
                color: "var(--slate,#8a8a82)",
                opacity: 0.45,
                fontWeight: 500,
              }}
            >
              {hint}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
});

const RowLabel = memo(function RowLabel({ children }) {
  return (
    <p
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: "0.08em",
        color: "var(--slate,#8a8a82)",
        textTransform: "uppercase",
        margin: "0 0 5px",
      }}
    >
      {children}
    </p>
  );
});

export default ComposerModal;
