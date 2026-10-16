/**
 * MediaUploader.jsx
 * ─────────────────────────────────────────────────────────────────
 * Handles all media upload UX:
 *  • Drag & drop with animated feedback
 *  • File grid with reorder (Framer Motion Reorder)
 *  • Cover badge on first item
 *  • Remove on hover
 *  • Video vs image differentiation
 *
 * Props:
 *   mediaFiles:      [{ id, file }]
 *   setMediaFiles:   fn
 *   onError:         fn(message)
 *   isMobile:        boolean
 */

import React, { useRef, useCallback, useState, memo } from "react";
import { Reorder, motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  X,
  Film,
  GripVertical,
  Image as ImageIcon,
  Crop,
} from "lucide-react";
import ImageCropperModal from "./ImageCropperModal";

const MAX_FILES = 10;

/* ── Single draggable media thumbnail ── */
const MediaThumb = memo(function MediaThumb({ item, index, onRemove, onCrop }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isVideo = item.file?.type?.startsWith("video/");

  // Create a stable object URL — revoked on unmount or file change
  const [objectUrl, setObjectUrl] = useState(null);
  React.useEffect(() => {
    if (!item.file) return;
    const url = URL.createObjectURL(item.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file]);

  return (
    <Reorder.Item
      value={item}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.05 }}
      whileDrag={{
        scale: 1.08,
        zIndex: 50,
        boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 10,
        overflow: "hidden",
        border: "1.5px solid rgba(20,20,19,0.1)",
        cursor: "grab",
        background: "#f5f5f4",
        flexShrink: 0,
      }}
    >
      {/* Cover badge */}
      {index === 0 && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            zIndex: 3,
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--ink, #111111)",
            color: "white",
          }}
        >
          Cover
        </div>
      )}

      {/* Media content */}
      {isVideo ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Film size={20} style={{ color: "rgba(255,255,255,0.35)" }} />
        </div>
      ) : imgError || !objectUrl ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafaf9",
            color: "#ccc",
          }}
        >
          <ImageIcon size={20} strokeWidth={1.5} />
        </div>
      ) : (
        <img
          src={objectUrl}
          alt={`Media ${index + 1}`}
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      {/* Action buttons overlay (permanently visible) */}
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          zIndex: 4,
          display: "flex",
          gap: 4,
        }}
      >
        {!isVideo && (
          <motion.button
            whileHover={{ scale: 1.1, background: "var(--arc, #ff5600)" }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onCrop(index);
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "rgba(20,20,19,0.75)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
            }}
            title="Crop image"
          >
            <Crop size={12} />
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.1, background: "#dc2626" }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "rgba(20,20,19,0.75)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "white",
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          }}
          title="Remove file"
        >
          <X size={12} />
        </motion.button>
      </div>

      {/* Drag handle hint */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 4,
          zIndex: 3,
          opacity: 0.3,
          color: "white",
          mixBlendMode: "difference",
        }}
      >
        <GripVertical size={10} />
      </div>
    </Reorder.Item>
  );
});

/* ── Main uploader ── */
const MediaUploader = memo(function MediaUploader({
  mediaFiles,
  setMediaFiles,
  onError,
  isMobile = false,
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [dropSuccess, setDropSuccess] = useState(false);
  const [croppingIndex, setCroppingIndex] = useState(null);
  const [isCropOpen, setIsCropOpen] = useState(false);

  const handleSaveCrop = useCallback(async (croppedFile) => {
    if (croppingIndex === null) return;

    const getDimensions = (file) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height, ratio: img.width / img.height });
          URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
      });
    };

    const dimensions = await getDimensions(croppedFile);

    setMediaFiles((prev) => {
      const copy = [...prev];
      if (copy[croppingIndex]) {
        copy[croppingIndex] = {
          ...copy[croppingIndex],
          file: croppedFile,
          dimensions,
        };
      }
      return copy;
    });
  }, [croppingIndex, setMediaFiles]);

  /* Add validated files */
  const addFiles = useCallback(
    async (rawFiles) => {
      const valid = Array.from(rawFiles).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );
      if (!valid.length) {
        onError?.("Only image and video files are supported.");
        return;
      }

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

      const newItems = await Promise.all(
        valid.map(async (file) => ({
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          file,
          dimensions: await getDimensions(file),
        }))
      );

      setMediaFiles((prev) => [...prev, ...newItems].slice(0, MAX_FILES));

      // Brief success pulse
      setDropSuccess(true);
      setTimeout(() => setDropSuccess(false), 600);
    },
    [setMediaFiles, onError],
  );

  const removeFile = useCallback(
    (index) => {
      setMediaFiles((prev) => prev.filter((_, i) => i !== index));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [setMediaFiles],
  );

  /* Drag events */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleFileInput = useCallback(
    (e) => {
      if (e.target.files?.length) addFiles(e.target.files);
    },
    [addFiles],
  );

  const remaining = MAX_FILES - mediaFiles.length;

  return (
    <div>
      {/* ── Drop zone ── */}
      <motion.div
        animate={{
          borderColor: dragActive
            ? "var(--ink, #111111)"
            : dropSuccess
              ? "#059669"
              : "rgba(20,20,19,0.18)",
          backgroundColor: dragActive
            ? "rgba(20,20,19,0.04)"
            : dropSuccess
              ? "rgba(16,185,129,0.04)"
              : "transparent",
          scale: dragActive ? 1.01 : 1,
        }}
        transition={{ duration: 0.15 }}
        style={{
          border: "2px dashed",
          borderRadius: 14,
          padding: "20px 16px",
          textAlign: "center",
          cursor: "pointer",
          overflow: "hidden",
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <motion.div
          animate={{ y: dragActive ? -5 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          {dropSuccess ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ color: "#059669" }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="mx-auto mb-2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
          ) : (
            <Upload
              style={{ color: "var(--slate, #8a8a82)", margin: "0 auto 8px" }}
              strokeWidth={1.5}
              size={26}
            />
          )}

          <p
            style={{
              fontSize: 13,
              color: "var(--slate, #8a8a82)",
              fontWeight: 500,
              margin: 0,
            }}
          >
            {dragActive ? (
              <span style={{ color: "var(--ink, #111111)", fontWeight: 700 }}>
                Drop it! 🎯
              </span>
            ) : (
              <>
                Drag & drop or{" "}
                <span style={{ color: "var(--arc, #ff5600)", fontWeight: 700 }}>
                  browse
                </span>
              </>
            )}
          </p>
          <p
            style={{
              fontSize: 10.5,
              color: "var(--slate, #8a8a82)",
              opacity: 0.6,
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            Images · Videos · {remaining} file{remaining !== 1 ? "s" : ""}{" "}
            remaining
          </p>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
      </motion.div>

      {/* ── Media grid ── */}
      <AnimatePresence>
        {mediaFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ marginTop: 12, overflow: "hidden" }}
          >
            <Reorder.Group
              axis="x"
              values={mediaFiles}
              onReorder={setMediaFiles}
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "repeat(3, 1fr)"
                  : "repeat(5, 1fr)",
                gap: 8,
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              <AnimatePresence>
                {mediaFiles.map((item, idx) => (
                  <MediaThumb
                    key={item.id}
                    item={item}
                    index={idx}
                    onRemove={removeFile}
                    onCrop={(i) => {
                      setCroppingIndex(i);
                      setIsCropOpen(true);
                    }}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>

            <p
              style={{
                fontSize: 10,
                color: "var(--slate, #8a8a82)",
                marginTop: 6,
                opacity: 0.55,
              }}
            >
              💡 Drag to reorder · First = Cover
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <ImageCropperModal
        isOpen={isCropOpen}
        onClose={() => {
          setIsCropOpen(false);
          setCroppingIndex(null);
        }}
        file={croppingIndex !== null ? mediaFiles[croppingIndex]?.file : null}
        onSave={handleSaveCrop}
      />
    </div>
  );
});

export default MediaUploader;
