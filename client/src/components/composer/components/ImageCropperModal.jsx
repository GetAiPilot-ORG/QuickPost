import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, Crop } from "lucide-react";

export default function ImageCropperModal({ isOpen, onClose, file, onSave, defaultAspectRatio = "1", lockedAspectRatio }) {
  const [aspectRatio, setAspectRatio] = useState(lockedAspectRatio || defaultAspectRatio); // "1" (1:1), "0.8" (4:5), "1.777" (16:9), "free"
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0, ratio: 1 });
  const [loading, setLoading] = useState(true);

  const imageRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Sync aspectRatio with lockedAspectRatio when it changes
  useEffect(() => {
    if (lockedAspectRatio) {
      setAspectRatio(lockedAspectRatio);
    }
  }, [lockedAspectRatio]);

  // Create a temporary object URL for editing
  const imageUrl = useMemo(() => {
    if (!file) return "";
    if (typeof file === "string") return file;
    try {
      return URL.createObjectURL(file);
    } catch (e) {
      console.error("Failed to create object URL:", e);
      return "";
    }
  }, [file]);

  // Clean up object URL on unmount (only if created locally)
  useEffect(() => {
    return () => {
      if (imageUrl && imageUrl.startsWith("blob:") && typeof file !== "string") {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, []);

  // Load image dimensions
  useEffect(() => {
    if (!imageUrl) return;
    setLoading(true);
    const img = new Image();
    if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      setImgDimensions({
        width: img.width,
        height: img.height,
        ratio: img.width / img.height,
      });
      // Reset cropping positions
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      setLoading(false);
    };
    img.onerror = (err) => {
      console.error("Cropper image loading failed:", err);
      setLoading(false);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Reset scale and offsets when aspect ratio changes
  useEffect(() => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [aspectRatio]);

  // Aspect ratio calculations
  const targetRatio = useMemo(() => {
    if (aspectRatio === "free") return imgDimensions.ratio;
    return parseFloat(aspectRatio);
  }, [aspectRatio, imgDimensions.ratio]);

  // Calculate viewport size (bound within 340px)
  const viewport = useMemo(() => {
    const maxDimension = 340;
    if (targetRatio >= 1) {
      return {
        width: maxDimension,
        height: maxDimension / targetRatio,
      };
    } else {
      return {
        width: maxDimension * targetRatio,
        height: maxDimension,
      };
    }
  }, [targetRatio]);

  // Sizing of image in its base state (before zoom scale)
  const baseImageSize = useMemo(() => {
    const viewportRatio = viewport.width / viewport.height;
    const imgRatio = imgDimensions.ratio;

    if (imgRatio > viewportRatio) {
      // Image is wider than viewport -> fit height to viewport
      return {
        width: viewport.height * imgRatio,
        height: viewport.height,
      };
    } else {
      // Image is taller than viewport -> fit width to viewport
      return {
        width: viewport.width,
        height: viewport.width / imgRatio,
      };
    }
  }, [viewport, imgDimensions.ratio]);

  // Handle dragging (panning)
  const handleDragStart = (clientX, clientY) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleDragMove = (clientX, clientY) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;

    // Calculate maximum panning boundaries so the image doesn't slide off the viewport
    const scaledWidth = baseImageSize.width * scale;
    const scaledHeight = baseImageSize.height * scale;

    const maxOffsetX = Math.max(0, (scaledWidth - viewport.width) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - viewport.height) / 2);

    setOffsetX((prev) => Math.max(-maxOffsetX, Math.min(maxOffsetX, prev + dx)));
    setOffsetY((prev) => Math.max(-maxOffsetY, Math.min(maxOffsetY, prev + dy)));

    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  // Mouse drag handlers
  const onMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    handleDragEnd();
  };

  // Touch drag handlers
  const onTouchStart = (e) => {
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Render high quality cropped blob using <canvas>
  const handleSave = () => {
    if (!imageRef.current) return;

    const canvas = document.createElement("canvas");
    // Standard target resolution for social media uploads
    const targetWidth = 1080;
    const targetHeight = Math.round(1080 / targetRatio);
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaledWidth = baseImageSize.width * scale;
    const scaledHeight = baseImageSize.height * scale;

    // Top-left of image relative to viewport top-left
    const imgXInViewport = (viewport.width / 2) - (scaledWidth / 2) + offsetX;
    const imgYInViewport = (viewport.height / 2) - (scaledHeight / 2) + offsetY;

    // Source coordinates on the original high-resolution image
    const scaleFactor = imgDimensions.width / scaledWidth;
    const sourceX = -imgXInViewport * scaleFactor;
    const sourceY = -imgYInViewport * scaleFactor;
    const sourceWidth = viewport.width * scaleFactor;
    const sourceHeight = viewport.height * scaleFactor;

    const imgElement = new Image();
    if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
      imgElement.crossOrigin = "anonymous";
    }
    imgElement.onload = () => {
      ctx.drawImage(
        imgElement,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const fileName = typeof file?.name === "string" ? file.name : "cover.jpg";
            const croppedFile = new File([blob], fileName, {
              type: file?.type || "image/jpeg",
              lastModified: Date.now(),
            });
            onSave(croppedFile);
            onClose();
          }
        },
        file.type || "image/jpeg",
        0.92 // High visual compression quality ratio
      );
    };
    imgElement.src = imageUrl;
  };

  if (!isOpen || !file) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,19,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "1px solid rgba(20,20,19,0.08)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(20,20,19,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Crop size={18} style={{ color: "var(--arc, #ff5600)" }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: "#111111" }}>
              Crop Image
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "#7b7b78",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Workspace */}
        <div
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "#fafafa",
          }}
        >
          {/* Cropper area */}
          <div
            style={{
              width: 340,
              height: 340,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#18181b",
              borderRadius: 12,
              position: "relative",
              overflow: "hidden",
              boxShadow: "inset 0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {loading ? (
              <div style={{ color: "#fff", fontSize: 12 }}>Loading image...</div>
            ) : (
              <div
                style={{
                  width: viewport.width,
                  height: viewport.height,
                  position: "relative",
                  overflow: "hidden",
                  border: "2px solid #ffffff",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                  zIndex: 2,
                }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  crossOrigin={imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) ? "anonymous" : undefined}
                  alt="Cropping region"
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={handleDragEnd}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                    cursor: isDraggingRef.current ? "grabbing" : "grab",
                    maxWidth: "none",
                    maxHeight: "none",
                    width: imgDimensions.ratio > (viewport.width / viewport.height) ? "auto" : viewport.width,
                    height: imgDimensions.ratio > (viewport.width / viewport.height) ? viewport.height : "auto",
                    userSelect: "none",
                    pointerEvents: "auto",
                  }}
                  draggable={false}
                />
              </div>
            )}
          </div>

          {/* Aspect ratio controls */}
          {lockedAspectRatio ? (
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                fontWeight: 600,
                color: "#626260",
                background: "rgba(20, 20, 19, 0.04)",
                padding: "6px 16px",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              Locked Ratio: {lockedAspectRatio === "1.777" ? "16:9 Landscape (Video)" : "9:16 Vertical (Short/Reel)"}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
                width: "100%",
                justifyContent: "center",
              }}
            >
              {[
                { id: "1", label: "1:1 Square" },
                { id: "0.8", label: "4:5 Portrait" },
                { id: "1.777", label: "16:9 Landscape" },
                { id: "free", label: "Original" },
              ].map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => setAspectRatio(ratio.id)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: aspectRatio === ratio.id ? "var(--ink, #111111)" : "rgba(20,20,19,0.1)",
                    background: aspectRatio === ratio.id ? "var(--ink, #111111)" : "#ffffff",
                    color: aspectRatio === ratio.id ? "#ffffff" : "#626260",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          )}

          {/* Zoom controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
              width: "100%",
              padding: "0 10px",
            }}
          >
            <ZoomIn size={14} style={{ color: "#7b7b78" }} />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: "var(--arc, #ff5600)",
                height: 4,
                borderRadius: 2,
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#626260", width: 28, textAlign: "right" }}>
              {Math.round(scale * 100)}%
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(20,20,19,0.08)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            background: "#ffffff",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              color: "#626260",
              border: "1px solid rgba(20,20,19,0.1)",
              borderRadius: 8,
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              background: "var(--ink, #111111)",
              cursor: "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Save Crop
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
