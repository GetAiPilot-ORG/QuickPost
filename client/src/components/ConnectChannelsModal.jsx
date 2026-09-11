import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Zap, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BlueskyConnectModal from "./BlueskyConnectModal";
import PinterestConnectModal from "./PinterestConnectModal";
import LinkedInConnectModal from "./LinkedInConnectModal";
import MastodonConnectModal from "./MastodonConnectModal";
import InstagramBusinessSetupModal from "./InstagramBusinessSetupModal";
import FacebookSetupModal from "./FacebookSetupModal";
import { startAutoDMInstagramOAuth } from "../services/autodm/supabaseClient";

const SESSION_KEY = "qp_channels_skipped";

const platforms = [
  { id: "instagram",  name: "Instagram",       icon: "/icons/ig-instagram-icon.svg",              type: "oauth-instagram" },
  { id: "facebook",   name: "Facebook",         icon: "/icons/facebook-round-color-icon.svg",      type: "oauth-facebook", allowMultiple: true },
  { id: "linkedin",   name: "LinkedIn",         icon: "/icons/linkedin-icon.svg",                  type: "modal-linkedin" },


  { id: "youtube",    name: "YouTube",          icon: "/icons/youtube-color-icon.svg",             type: "oauth" },
  { id: "threads",    name: "Threads",          icon: "/icons/threads-icon.svg",                   type: "oauth", allowMultiple: true },
  { id: "mastodon",   name: "Mastodon",         icon: "/icons/mastodon-round-icon.svg",            type: "modal-mastodon" },
  { id: "bluesky",    name: "Bluesky",          icon: "/icons/bluesky-circle-color-icon.svg",      type: "modal-bluesky", allowMultiple: true },
];

export default function ConnectChannelsModal() {
  const { connectedAccounts, refreshAccounts } = useAuth();
  const [visible, setVisible] = useState(false);
  const [showBlueskyModal, setShowBlueskyModal] = useState(false);
  const [showPinterestModal, setShowPinterestModal] = useState(false);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showMastodonModal, setShowMastodonModal] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [showFacebookModal, setShowFacebookModal] = useState(false);

  useEffect(() => {
    localStorage.removeItem("qp_channels_skipped");
    const skipped = sessionStorage.getItem(SESSION_KEY);
    if (skipped) return;

    const hasAnyConnected = Object.values(connectedAccounts).some((a) => a?.connected);
    if (!hasAnyConnected) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [connectedAccounts]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "true");
  };

  const getToken = () => localStorage.getItem("quickpost_token");

  const handleConnect = (platform) => {
    const { type, id } = platform;
    const token = getToken();

    if (type === "oauth-instagram") {
      setShowInstagramModal(true);
      return;
    }
    if (type === "oauth-facebook") {
      setShowFacebookModal(true);
      return;
    }
    if (type === "oauth") {
      if (!token) return;
      const apiUrl = import.meta.env.VITE_API_URL || "";
      window.location.href = `${apiUrl}/api/auth/${id}?token=${token}`;
      return;
    }
    if (type === "modal-linkedin")  { setShowLinkedInModal(true);  return; }
    if (type === "modal-pinterest") { setShowPinterestModal(true); return; }
    if (type === "modal-mastodon")  { setShowMastodonModal(true);  return; }
    if (type === "modal-bluesky")   { setShowBlueskyModal(true);   return; }
    if (type === "coming-soon") {
      alert(`${platform.name} integration is coming soon!`);
    }
  };

  const unconnectedPlatforms = platforms.filter(
    (p) => !connectedAccounts[p.id]?.connected || p.allowMultiple
  );

  if (!visible) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 320, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl bg-white shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div 
                className="relative p-8 overflow-hidden bg-cover bg-center"
                style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url('/connect-bg.jpg')" }}
              >
                
                <button
                  onClick={dismiss}
                  className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white/90 hover:text-white rounded-full transition-colors backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 backdrop-blur-md border border-white/15 text-white text-xs font-semibold tracking-wide uppercase mb-4 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-white/80" />
                    <span>Onboarding</span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                    Connect your channels
                  </h2>
                  <p className="text-white/80 font-medium max-w-sm text-sm leading-relaxed">
                    Post to all your networks from one place. Connect at least one channel to unlock your dashboard.
                  </p>
                </div>
              </div>

              {/* Platform Grid */}
              <div className="p-8 pb-4 bg-gray-50/50 flex-1 overflow-y-auto">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                  Available Platforms
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
                  {unconnectedPlatforms.map((platform) => (
                    <PlatformTile
                      key={platform.id}
                      platform={platform}
                      onClick={() => handleConnect(platform)}
                    />
                  ))}
                  {unconnectedPlatforms.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-gray-100/50 rounded-2xl border border-gray-200 border-dashed">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <p className="text-gray-900 font-semibold">All channels connected! 🎉</p>
                      <p className="text-sm text-gray-500 mt-1">You're ready to start posting.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between shrink-0">
                <button
                  onClick={dismiss}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors rounded-xl hover:bg-gray-100"
                >
                  Skip for now
                </button>
                <button
                  onClick={dismiss}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg shadow-gray-900/20 transition-all hover:-translate-y-0.5"
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-modals */}
      {showInstagramModal && (
        <InstagramBusinessSetupModal
          isOpen={showInstagramModal}
          onClose={() => setShowInstagramModal(false)}
          onProceed={async () => {
            setShowInstagramModal(false);
            try {
              const redirectTo = await startAutoDMInstagramOAuth(window.location.origin);
              window.location.assign(redirectTo);
            } catch (error) {
              alert(error?.message || "Failed to start Instagram login.");
            }
          }}
        />
      )}
      {showFacebookModal && (
        <FacebookSetupModal
          isOpen={showFacebookModal}
          onClose={() => setShowFacebookModal(false)}
          onProceed={() => {
            setShowFacebookModal(false);
            const token = getToken();
            const apiUrl = import.meta.env.VITE_API_URL || "";
            if (token) window.location.href = `${apiUrl}/api/auth/facebook?token=${token}`;
          }}
        />
      )}
      {showLinkedInModal && (
        <LinkedInConnectModal
          isOpen={showLinkedInModal}
          onClose={() => { setShowLinkedInModal(false); refreshAccounts(); }}
        />
      )}
      {showPinterestModal && (
        <PinterestConnectModal
          isOpen={showPinterestModal}
          onClose={() => { setShowPinterestModal(false); refreshAccounts(); }}
        />
      )}
      {showMastodonModal && (
        <MastodonConnectModal
          isOpen={showMastodonModal}
          onClose={() => { setShowMastodonModal(false); refreshAccounts(); }}
        />
      )}
      {showBlueskyModal && (
        <BlueskyConnectModal
          isOpen={showBlueskyModal}
          onClose={() => { setShowBlueskyModal(false); refreshAccounts(); }}
        />
      )}
    </>,
    document.body
  );
}

function PlatformTile({ platform, onClick }) {
  return (
    <button
      onClick={onClick}
      title={`Connect ${platform.name}`}
      className="group flex flex-col items-center justify-center gap-3 p-4 bg-white border border-gray-200/60 rounded-2xl cursor-pointer transition-all duration-300 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-50 group-hover:bg-indigo-50/50 transition-colors duration-300">
        <img 
          src={platform.icon} 
          alt={platform.name} 
          className="w-7 h-7 object-contain transform transition-transform duration-300 group-hover:scale-110" 
        />
      </div>
      <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-600 transition-colors duration-300 text-center leading-tight">
        {platform.name}
      </span>
    </button>
  );
}
