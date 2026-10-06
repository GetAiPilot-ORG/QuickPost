import React, { useState } from "react";
import { ChevronDown, ChevronUp, Hash, Crop } from "lucide-react";
import { PLATFORM_META } from "./composer/data/platforms.js";
import ImageCropperModal from "./composer/components/ImageCropperModal";

function PlatformCustomization({
  selectedChannels,
  platformData,
  onPlatformDataChange,
  expanded,
  onToggleExpanded,
  youtubeThumbnail,
  onYoutubeThumbnailChange,
  instagramCover,
  onInstagramCoverChange,
  postType,
}) {
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isIgCropOpen, setIsIgCropOpen] = useState(false);

  const thumbnailPreviewUrl = React.useMemo(() => {
    if (!youtubeThumbnail) return "";
    if (typeof youtubeThumbnail === "string") return youtubeThumbnail;
    try {
      return URL.createObjectURL(youtubeThumbnail);
    } catch (e) {
      console.error("Failed to create object URL for thumbnail:", e);
      return "";
    }
  }, [youtubeThumbnail]);

  const igCoverPreviewUrl = React.useMemo(() => {
    if (!instagramCover) return "";
    if (typeof instagramCover === "string") return instagramCover;
    try {
      return URL.createObjectURL(instagramCover);
    } catch (e) {
      console.error("Failed to create object URL for Instagram cover:", e);
      return "";
    }
  }, [instagramCover]);

  // Clean up object URLs when component unmounts
  React.useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl && thumbnailPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
      if (igCoverPreviewUrl && igCoverPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(igCoverPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl, igCoverPreviewUrl]);

  const lockedAspectRatio = React.useMemo(() => {
    const ytType = platformData.youtube?.type || "video";
    return ytType === "short" ? "0.5625" : "1.777";
  }, [platformData.youtube?.type]);

  if (selectedChannels.length === 0) return null;

  const hasPlatform = (platform) => selectedChannels.some(ch => String(ch || "").split(":")[0] === platform);

  const handleChange = (platform, field, value) => {
    onPlatformDataChange({
      ...platformData,
      [platform]: {
        ...platformData[platform],
        [field]: value,
      },
    });
  };

  const handleThumbnailChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert("Thumbnail image must be less than 2MB");
        return;
      }
      onYoutubeThumbnailChange(file);
    }
  };

  const handleIgCoverChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("Cover image must be less than 5MB");
        return;
      }
      onInstagramCoverChange(file);
    }
  };

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold transition-colors mb-3 group"
      >
        <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
        Customize for each platform
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Pinterest Customization */}
          {hasPlatform("pinterest") && (
            <div className="platform-card">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#E60023">
                  <path d="M12 0a12 12 0 0 0-4.37 23.17c-.06-.56-.12-1.43 0-2.05l.87-3.65s-.22-.44-.22-1.09c0-1 .6-1.78 1.34-1.78.63 0 .94.48.94 1.05 0 .64-.41 1.6-.62 2.49-.18.74.37 1.34 1.1 1.34 1.32 0 2.33-1.39 2.33-3.4 0-1.78-1.28-3.02-3.1-3.02-2.11 0-3.35 1.58-3.35 3.22 0 .64.24 1.32.55 1.69.06.07.07.14.05.21l-.2.84c-.03.13-.11.16-.25.1-1-.46-1.62-1.91-1.62-3.07 0-2.34 1.7-4.49 4.9-4.49 2.57 0 4.57 1.83 4.57 4.28 0 2.55-1.61 4.6-3.85 4.6-.75 0-1.46-.39-1.7-.85l-.46 1.76c-.17.64-.62 1.44-.92 1.93.69.21 1.42.33 2.17.33A12 12 0 1 0 12 0z" />
                </svg>
                <h4 className="font-semibold text-gray-900">Pinterest</h4>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pin Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={platformData.pinterest?.title || ""}
                    onChange={(e) =>
                      handleChange("pinterest", "title", e.target.value)
                    }
                    placeholder="Add a descriptive title for your Pin"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm placeholder:text-gray-400 transition-all"
                    maxLength={100}
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                    {platformData.pinterest?.title?.length || 0}/100 characters
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Destination Link
                  </label>
                  <input
                    type="url"
                    value={platformData.pinterest?.link || ""}
                    onChange={(e) =>
                      handleChange("pinterest", "link", e.target.value)
                    }
                    placeholder="https://yourwebsite.com"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm placeholder:text-gray-400 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Where should this Pin link to?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Board <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={platformData.pinterest?.boardId || ""}
                    onChange={(e) =>
                      handleChange("pinterest", "boardId", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-link/20 focus:border-link text-sm"
                  >
                    <option value="">Select a board</option>
                    <option value="default">Default Board</option>
                    {/* Additional boards can be fetched from Pinterest API */}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* YouTube Customization */}
          {hasPlatform("youtube") && (
            <div className="platform-card">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF0000">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <h4 className="font-semibold text-gray-900">YouTube</h4>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="yt-type"
                      checked={(platformData.youtube?.type || "video") === "video"}
                      onChange={() => handleChange("youtube", "type", "video")}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Video</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="yt-type"
                      checked={(platformData.youtube?.type || "video") === "short"}
                      onChange={() => handleChange("youtube", "type", "short")}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Short</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Visibility
                  </label>
                  <div className="flex items-center gap-4">
                    {["public", "unlisted", "private"].map((status) => (
                      <label key={status} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="youtubeVisibility"
                          value={status}
                          checked={(platformData.youtube?.visibility || "public") === status}
                          onChange={(e) => handleChange("youtube", "visibility", e.target.value)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="text-sm text-gray-700 capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={platformData.youtube?.description || ""}
                    onChange={(e) => handleChange("youtube", "description", e.target.value)}
                    placeholder="Add a YouTube description. Leave empty to use the caption."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm resize-none placeholder:text-gray-400 transition-all"
                    rows={4}
                    maxLength={5000}
                  />
                  <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                    {(platformData.youtube?.description || "").length}/5000 characters
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Custom Thumbnail
                    </label>
                  </div>

                  {youtubeThumbnail ? (
                    <div className="relative w-full max-w-[680px] aspect-video rounded-xl overflow-hidden border border-black/10 group bg-white">
                      <img
                        src={thumbnailPreviewUrl}
                        alt="Thumbnail Preview"
                        className="w-full h-full object-cover"
                        style={{ objectPosition: platformData.youtube?.thumbnailCrop || "center" }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsCropOpen(true)}
                          className="px-3 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-lg flex items-center gap-1.5"
                        >
                          <Crop size={12} className="text-indigo-500" />
                          Crop
                        </button>
                        <label className="px-3 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-lg cursor-pointer">
                          Change
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleThumbnailChange}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => onYoutubeThumbnailChange(null)}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                        >
                          Remove
                        </button>
                      </div>

                      {isCropOpen && (
                        <ImageCropperModal
                          isOpen={isCropOpen}
                          onClose={() => setIsCropOpen(false)}
                          file={thumbnailPreviewUrl}
                          lockedAspectRatio={lockedAspectRatio}
                          onSave={(croppedFile) => {
                            onYoutubeThumbnailChange(croppedFile);
                            setIsCropOpen(false);
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <label className="flex aspect-video w-full max-w-[680px] flex-col items-center justify-center rounded-xl border border-dashed border-black/20 bg-white hover:border-black/40 hover:bg-gray-50 transition-all cursor-pointer group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg
                          className="w-8 h-8 text-gray-400 group-hover:text-gray-500 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-600">
                          Select Thumbnail
                        </p>
                        <p className="text-[9px] text-gray-400 mt-1">
                          PNG, JPG, WebP (Max 2MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleThumbnailChange}
                      />
                    </label>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed font-medium">
                    <span className="text-indigo-500">Pro Tip:</span> Thumbnail is uploaded as 16:9. Use crop when the image is not landscape.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reddit Customization */}
          {hasPlatform("reddit") && (
            <div className="platform-card">
              <div className="flex items-center gap-2 mb-3">
                <img src="/icons/reddit-icon.svg" className="w-5 h-5" alt="Reddit" />
                <h4 className="font-semibold text-gray-900">Reddit</h4>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reddit Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={platformData.reddit?.title || ""}
                    onChange={(e) =>
                      handleChange("reddit", "title", e.target.value)
                    }
                    placeholder="Enter an eye-catching title..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm placeholder:text-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subreddit <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Hash size={14} />
                    </div>
                    <input
                      type="text"
                      value={platformData.reddit?.subreddit || ""}
                      onChange={(e) =>
                        handleChange("reddit", "subreddit", e.target.value)
                      }
                      placeholder="e.g. technology"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm placeholder:text-gray-400 transition-all"
                    />
                  </div>
                  
                  {/* Suggested Subreddits */}
                  <div className="mt-2.5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Suggested Subreddits</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PLATFORM_META.reddit.suggestedSubreddits.map(sr => (
                        <button
                          key={sr}
                          type="button"
                          onClick={() => handleChange("reddit", "subreddit", sr)}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            platformData.reddit?.subreddit === sr
                              ? "bg-orange-500 text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          r/{sr}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Facebook Customization */}
          {hasPlatform("facebook") && (
            <div className="platform-card">
              <div className="flex items-center gap-2 mb-3">
                <img src="/icons/facebook-round-color-icon.svg" className="w-5 h-5" alt="Facebook" />
                <h4 className="font-semibold text-gray-900">Facebook</h4>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="fb-type"
                    checked={platformData.facebook?.type === "post"}
                    onChange={() => handleChange("facebook", "type", "post")}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Feed Post</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="fb-type"
                    checked={platformData.facebook?.type === "reel"}
                    onChange={() => handleChange("facebook", "type", "reel")}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Reel</span>
                </label>
            </div>
          </div>
        )}

        {/* Instagram Customization */}
        {hasPlatform("instagram") && (
          <div className="platform-card">
            <div className="flex items-center gap-2 mb-3">
              <img src="/icons/ig-instagram-icon.svg" className="w-5 h-5" alt="Instagram" />
              <h4 className="font-semibold text-gray-900">Instagram</h4>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-4">
              {[
                ["post", "Feed Post"],
                ["story", "Story"],
                ["reel", "Reel"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="ig-type"
                    checked={(platformData.instagram?.type || "post") === value}
                    onChange={() => handleChange("instagram", "type", value)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {(platformData.instagram?.type === "reel" || postType === "reel") && (
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Reel Cover Image
                  </label>
                  <span className="text-[11px] text-gray-400 font-medium">9:16 Vertical</span>
                </div>

                {instagramCover ? (
                  <div className="relative w-full max-w-[220px] aspect-[9/16] rounded-xl overflow-hidden border border-black/10 group bg-black shadow-sm">
                    <img
                      src={igCoverPreviewUrl}
                      alt="Reel Cover Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsIgCropOpen(true)}
                        className="px-2.5 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-lg flex items-center gap-1.5"
                      >
                        <Crop size={12} className="text-pink-600" />
                        Crop
                      </button>
                      <label className="px-2.5 py-1.5 bg-white text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-lg cursor-pointer">
                        Change
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleIgCoverChange}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => onInstagramCoverChange(null)}
                        className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                      >
                        Remove
                      </button>
                    </div>

                    {isIgCropOpen && (
                      <ImageCropperModal
                        isOpen={isIgCropOpen}
                        onClose={() => setIsIgCropOpen(false)}
                        file={igCoverPreviewUrl}
                        lockedAspectRatio="0.5625"
                        onSave={(croppedFile) => {
                          onInstagramCoverChange(croppedFile);
                          setIsIgCropOpen(false);
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <label className="flex aspect-[9/16] w-full max-w-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-black/20 bg-white hover:border-pink-500/50 hover:bg-pink-50/20 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wider group-hover:text-pink-600">
                        Set Reel Cover
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        PNG, JPG (Max 5MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleIgCoverChange}
                    />
                  </label>
                )}
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed font-medium">
                  <span className="text-pink-600 font-semibold">Tip:</span> Set a custom 9:16 cover so your Reel looks crisp and intentional on your profile grid and Reels tab.
                </p>
              </div>
            )}

            {(platformData.instagram?.type || postType || "post") !== "story" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Comment (for hashtags)
                </label>
                <textarea
                  value={platformData.instagram?.firstComment || ""}
                  onChange={(e) => handleChange("instagram", "firstComment", e.target.value)}
                  placeholder="Add hashtags as a first comment to keep your caption clean..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm resize-none placeholder:text-gray-400 transition-all"
                  rows={3}
                  maxLength={2200}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
  );
}

export default PlatformCustomization;
