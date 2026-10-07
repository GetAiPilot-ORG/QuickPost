import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PLATFORMS = [
  {
    id: 'facebook', name: 'Facebook', borderColor: 'border-blue-600',
    icon: <img src="/icons/facebook-round-color-icon.svg" className="w-8 h-8 object-contain" alt="Facebook" />
  },
  {
    id: 'youtube', name: 'YouTube', borderColor: 'border-red-600',
    icon:<img src="/icons/youtube-color-icon.svg" className="w-8 h-8 object-contain" alt="Youtube" />
  },
  {
    id: 'instagram', name: 'Instagram', borderColor: 'border-pink-600',
    icon: <img src="/icons/ig-instagram-icon.svg" className="w-8 h-8 object-contain" alt="Instagram" />
  },
  {
    id: 'linkedin', name: 'LinkedIn', borderColor: 'border-blue-700',
    icon: <img src="/icons/linkedin-icon.svg" className="w-8 h-8 object-contain" alt="LinkedIn" />
  },
  {
    id: 'threads', name: 'Threads', borderColor: 'border-black',
    icon: <img src="/icons/threads-icon.svg" className="w-8 h-8 object-contain" alt="Threads" />
  },
  {
    id: 'x', name: 'X', borderColor: 'border-black',
    icon: <img src="/icons/x-social-media-round-icon.svg" className="w-8 h-8 object-contain" alt="X" />,
    comingSoon: true,
  },
  {
    id: 'pinterest', name: 'Pinterest', borderColor: 'border-red-600',
    icon: <img src="/icons/pinterest-round-color-icon.svg" className="w-8 h-8 object-contain" alt="Pinterest" />,
    comingSoon: true,
  },
  {
    id: 'bluesky', name: 'Bluesky', borderColor: 'border-blue-500',
    icon: <img src="/icons/bluesky-circle-color-icon.svg" className="w-8 h-8 object-contain" alt="Bluesky" />
  },
  {
    id: 'mastodon', name: 'Mastodon', borderColor: 'border-purple-600',
    icon: <img src="/icons/mastodon-round-icon.svg" className="w-8 h-8 object-contain" alt="Mastodon" />,
  },

  {
    id: 'reddit',
    name: 'Reddit',
    icon: <img src="/icons/reddit-icon.svg" className="w-8 h-8 object-contain" alt="Reddit" />,
    borderColor: 'border-orange-600',
    comingSoon: true,
  },
  {
    id: 'googleBusiness',
    name: 'Google Business',
    icon: <img src="/icons/google-icon.svg" className="w-8 h-8 object-contain" alt="Google Business" />,
    borderColor: 'border-blue-500',
    comingSoon: true,
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: <img src="/icons/snapchat-square-color-icon.svg" className="w-8 h-8 object-contain" alt="Snapchat" />,
    borderColor: 'border-yellow-400',
    comingSoon: true,
  },
];

function ChannelSelector({ selectedChannels, onChannelToggle, onBulkSelect, rightContent }) {
  const { connectedAccounts, user } = useAuth();
  const [connectedOpen, setConnectedOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const connectedRef = useRef(null);
  const moreRef = useRef(null);

  const accountArrayKey = (platformId) => `${platformId}Accounts`;
  const getPlatformAccounts = (platformId) => connectedAccounts?.[accountArrayKey(platformId)] || [];

  // Split platforms
  const connectedPlatforms = [];
  PLATFORMS.forEach(p => {
    if (p.id === 'instagram') {
      const igAccounts = connectedAccounts?.instagramAccounts || [];
      if (igAccounts.length > 0) {
        igAccounts.forEach(acc => {
          connectedPlatforms.push({
            id: `instagram:${acc.id}`,
            name: acc.username ? `Instagram (@${acc.username})` : 'Instagram',
            borderColor: p.borderColor,
            icon: acc.profilePicture ? (
              <img src={acc.profilePicture} className="w-full h-full object-cover" alt={acc.username || 'Instagram'} />
            ) : p.icon,
            platformIcon: p.icon,
            isInstagram: true
          });
        });
      } else if (connectedAccounts?.instagram?.connected) {
         connectedPlatforms.push(p);
      }
    } else {
      const accounts = getPlatformAccounts(p.id);
      if (accounts.length > 0) {
        accounts.forEach(acc => {
          connectedPlatforms.push({
            id: `${p.id}:${acc.id}`,
            name: acc.username ? `${p.name} (${acc.username})` : p.name,
            borderColor: p.borderColor,
            icon: acc.profilePicture ? (
              <img src={acc.profilePicture} className="w-full h-full object-cover" alt={acc.username || p.name} />
            ) : p.icon,
            platformIcon: p.icon
          });
        });
      } else if (connectedAccounts?.[p.id]?.connected) {
        connectedPlatforms.push(p);
      }
    }
  });

  const unconnectedPlatforms = PLATFORMS.filter(p => {
    if (p.id === 'instagram') return !connectedAccounts?.instagram?.connected && !(connectedAccounts?.instagramAccounts?.length > 0);
    return !connectedAccounts?.[p.id]?.connected && getPlatformAccounts(p.id).length === 0;
  });
  const visibleUnconnected = unconnectedPlatforms.slice(0, 3);
  const hiddenUnconnected = unconnectedPlatforms.slice(3);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (connectedRef.current && !connectedRef.current.contains(e.target)) setConnectedOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const connectedIds = connectedPlatforms.map(p => p.id);
  const selectedConnectedCount = selectedChannels.filter(id => connectedIds.includes(id)).length;
  const isAllSelected = selectedConnectedCount === connectedPlatforms.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--slate,#8a8a82)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--arc,#ea580c)] shrink-0" />
          Publish channels
        </div>
        {connectedPlatforms.length > 0 && (
          <button
            type="button"
            onClick={() => onBulkSelect(isAllSelected ? [] : connectedIds)}
            className={`text-[11px] font-medium py-1 px-3 rounded-full transition-all duration-300 ${
              isAllSelected
                ? "bg-ink text-white shadow-md scale-105"
                : "bg-white text-ink border border-gray-200 hover:border-ink"
            }`}
          >
            {isAllSelected ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3.5 flex-wrap">
        {connectedPlatforms.map((p, index) => {
          const isSelected = selectedChannels.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChannelToggle(p.id)}
              title={p.name}
              className={`group relative rounded-full flex items-center justify-center transition-all duration-300 ${
                isSelected
                  ? "ring-[2px] ring-offset-[3px] ring-ink scale-105 shadow-md z-10"
                  : "ring-1 ring-offset-[2px] ring-gray-100 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:scale-105 hover:shadow-sm"
              }`}
            >
              <div className="w-[42px] h-[42px] rounded-full overflow-hidden bg-white flex items-center justify-center [&>img]:w-full [&>img]:h-full [&>img]:object-cover">
                {p.icon}
              </div>
              
              {p.platformIcon && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 [&>img]:w-2.5 [&>img]:h-2.5 [&>img]:object-contain pointer-events-none">
                  {p.platformIcon}
                </div>
              )}

              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ink rounded-full flex items-center justify-center border-[1.5px] border-white shadow-sm pointer-events-none transition-transform duration-300 scale-in-center">
                  <Check size={10} color="white" strokeWidth={4} />
                </div>
              )}

              <div
                className={`absolute -top-10 px-2.5 py-1.5 bg-ink text-white text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap shadow-sm ${
                  index === 0 ? "left-0" : "left-1/2 -translate-x-1/2"
                }`}
              >
                {p.name}
              </div>
            </button>
          );
        })}

        {connectedPlatforms.length === 0 && (
          <div className="w-full p-6 rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-2 bg-gray-50/30">
             <p className="text-sm font-medium text-gray-400">No accounts connected yet</p>
             <button className="text-[11px] font-semibold text-arc hover:underline">Connect accounts in sidebar →</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 px-1">
        <p className="text-[11px] font-medium text-[var(--slate,#8a8a82)] m-0">
          Posting to {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''}
        </p>
        {rightContent}
      </div>
    </div>
  );
}

export default ChannelSelector;
