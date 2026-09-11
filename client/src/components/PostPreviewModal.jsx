import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { usePlatformMetrics } from '../utils/metrics';
import {
  X,
  Clock, Heart, MessageCircle, Share2, Bookmark,
  MoreHorizontal, MoreVertical, Send,
  Repeat, MessageSquare, Plus, Music2,
  ThumbsUp, ThumbsDown, Play, User,
  ChevronLeft, Video, Trash2
} from 'lucide-react';

/* ── Platform display config ─────────────────────────────────────────── */
const PLATFORM_CONFIG = {
  instagram: {
    name: 'Instagram', color: '#E4405F', bg: '#fff',
    icon: '/icons/ig-instagram-icon.svg',
    formats: [
      { id: 'ig_post',  label: 'Square Post', ratio: '1:1',    w: 1080, h: 1080, css: 'aspect-square'     },
      { id: 'ig_port',  label: 'Portrait',    ratio: '4:5',    w: 1080, h: 1350, css: 'aspect-[4/5]'      },
      { id: 'ig_reel',  label: 'Reel',        ratio: '9:16',   w: 1080, h: 1920, css: 'aspect-[9/16]', full: true },
      { id: 'ig_story', label: 'Story',       ratio: '9:16',   w: 1080, h: 1920, css: 'aspect-[9/16]', full: true },
    ],
    headerBg: '#fff',
    textColor: '#000',
  },
  x: {
    name: 'X (Twitter)', color: '#000', bg: '#000',
    icon: '/icons/x-social-media-round-icon.svg',
    formats: [
      { id: 'x_post',   label: 'Feed Image', ratio: '16:9', w: 1200, h: 675,  css: 'aspect-video'      },
      { id: 'x_square', label: 'Square',     ratio: '1:1',  w: 1080, h: 1080, css: 'aspect-square'     },
    ],
    headerBg: '#000',
    textColor: '#fff',
  },
  linkedin: {
    name: 'LinkedIn', color: '#0A66C2', bg: '#f3f2ef',
    icon: '/icons/linkedin-icon.svg',
    formats: [
      { id: 'li_feed',  label: 'Feed Image',  ratio: '1.91:1', w: 1200, h: 628,  css: 'aspect-[191/100]' },
      { id: 'li_sq',    label: 'Square Post', ratio: '1:1',    w: 1080, h: 1080, css: 'aspect-square'     },
      { id: 'li_port',  label: 'Portrait',    ratio: '4:5',    w: 1080, h: 1350, css: 'aspect-[4/5]'      },
    ],
    headerBg: '#fff',
    textColor: '#000',
  },
  youtube: {
    name: 'YouTube', color: '#FF0000', bg: '#0f0f0f',
    icon: '/icons/youtube-color-icon.svg',
    formats: [
      { id: 'yt_thumb', label: 'Thumbnail',   ratio: '16:9', w: 1280, h: 720,  css: 'aspect-video'  },
      { id: 'yt_short', label: 'Shorts',      ratio: '9:16', w: 1080, h: 1920, css: 'aspect-[9/16]', full: true },
    ],
    headerBg: '#0f0f0f',
    textColor: '#fff',
  },
  facebook: {
    name: 'Facebook', color: '#1877F2', bg: '#fff',
    icon: '/icons/facebook-round-color-icon.svg',
    formats: [
      { id: 'fb_feed',  label: 'Feed Post',   ratio: '1.91:1', w: 1200, h: 628,  css: 'aspect-[191/100]' },
      { id: 'fb_sq',    label: 'Square',      ratio: '1:1',    w: 1080, h: 1080, css: 'aspect-square'     },
      { id: 'fb_story', label: 'Story',       ratio: '9:16',   w: 1080, h: 1920, css: 'aspect-[9/16]', full: true },
    ],
    headerBg: '#fff',
    textColor: '#000',
  },

  pinterest: {
    name: 'Pinterest', color: '#BD081C', bg: '#fff',
    icon: '/icons/pinterest-round-color-icon.svg',
    formats: [
      { id: 'pin_std',  label: 'Standard Pin', ratio: '2:3',   w: 1000, h: 1500, css: 'aspect-[2/3]'   },
      { id: 'pin_sq',   label: 'Square Pin',   ratio: '1:1',   w: 1000, h: 1000, css: 'aspect-square'   },
    ],
    headerBg: '#fff',
    textColor: '#000',
  },
  threads: {
    name: 'Threads', color: '#000', bg: '#fff',
    icon: '/icons/threads-icon.svg',
    formats: [
      { id: 'th_feed',  label: 'Feed Post',   ratio: 'auto',  w: 0, h: 0, css: ''  },
    ],
    headerBg: '#fff',
    textColor: '#000',
  },
  bluesky: {
    name: 'Bluesky', color: '#0085FF', bg: '#fff',
    icon: '/icons/bluesky-circle-color-icon.svg',
    formats: [
      { id: 'bsky_post', label: 'Post', ratio: '16:9', w: 1200, h: 675, css: 'aspect-video' },
      { id: 'bsky_sq',   label: 'Square', ratio: '1:1',  w: 1080, h: 1080, css: 'aspect-square' },
    ],
    headerBg: '#fff',
    textColor: '#000',
  },
  mastodon: {
    name: 'Mastodon', color: '#6364FF', bg: '#191b22',
    icon: '/icons/mastodon-round-icon.svg',
    formats: [
      { id: 'masto_post', label: 'Post', ratio: '16:9', w: 1200, h: 675, css: 'aspect-video' },
      { id: 'masto_sq',   label: 'Square', ratio: '1:1',  w: 1080, h: 1080, css: 'aspect-square' },
    ],
    headerBg: '#191b22',
    textColor: '#fff',
  },
  reddit: {
    name: 'Reddit', color: '#FF4500', bg: '#fff',
    icon: '/icons/reddit-icon.svg',
    formats: [
      { id: 'rd_post', label: 'Post', ratio: '1:1', w: 1080, h: 1080, css: 'aspect-square' },
    ],
    headerBg: '#fff',
    textColor: '#000',
  }
};

/* ── UI Components for each Platform ────────────────────────────────── */

const getUserPicture = (user) => user?.profile_picture || user?.profilePicture || user?.picture || user?.avatar_url;
const getAccountPicture = (account) =>
  account?.profilePicture ||
  account?.profile_picture ||
  account?.profilePictureUrl ||
  account?.profile_picture_url ||
  account?.threads_profile_picture_url ||
  account?.picture ||
  account?.picture_url ||
  account?.avatar_url ||
  account?.avatar ||
  account?.image ||
  account?.profile_pic_url;
const getAccountUsername = (account) =>
  account?.username ||
  account?.instagram_username ||
  account?.handle ||
  account?.name ||
  account?.displayName ||
  account?.account_id ||
  account?.accountId;

const accountMatchesId = (account, id) => {
  if (!account || !id) return false;
  const needle = String(id);
  return [
    account.id,
    account.accountId,
    account.account_id,
    account.instagram_business_id,
    account.instagram_business_account_id,
    account.instagram_user_id,
    account.page_id,
    account.pageId,
  ].some((value) => value && String(value) === needle);
};

const resolvePlatformAccount = ({ post, platformId, channel, connectedAccounts }) => {
  if (!platformId) return null;
  const accountList = connectedAccounts?.[`${platformId}Accounts`] || [];
  const platformData = post?.platform_data || {};
  const platformResult = platformData?.results?.[channel] || platformData?.results?.[platformId] || platformData?.[channel] || platformData?.[platformId];
  const channelAccountId = String(channel || '').includes(':') ? String(channel).split(':')[1] : null;
  const accountId = [
    channelAccountId,
    platformResult?.accountId,
    platformResult?.account_id,
    platformResult?.instagramAccountId,
    platformResult?.instagram_account_id,
    platformResult?.threadsAccountId,
    platformResult?.threads_account_id,
    platformData?.[`${platformId}AccountId`],
    platformData?.[`${platformId}_account_id`],
    platformData?.accountId,
    platformData?.account_id,
    post?.[`${platformId}_account_id`],
    post?.[`${platformId}AccountId`],
  ].find(Boolean);

  if (accountId) {
    const matched = accountList.find((account) => accountMatchesId(account, accountId));
    if (matched) return matched;
  }

  const username = [
    platformResult?.username,
    platformResult?.instagram_username,
    platformResult?.handle,
    platformData?.[`${platformId}Username`],
    platformData?.[`${platformId}_username`],
    post?.[`${platformId}_username`],
  ].find(Boolean);
  if (username) {
    const normalized = String(username).replace(/^@/, '').toLowerCase();
    const matched = accountList.find((account) =>
      String(getAccountUsername(account) || '').replace(/^@/, '').toLowerCase() === normalized
    );
    if (matched) return matched;
  }

  if (accountList.length === 1 && (!channel || channel === platformId)) return accountList[0];
  return connectedAccounts?.[platformId] || null;
};

const getPlatformResult = (post, platformId, channel) => {
  const data = post?.platform_data || {};
  return data?.results?.[channel] || data?.results?.[platformId] || data?.[channel] || data?.[platformId] || null;
};

const ProfileBubble = ({ user, username, picture, className = "w-8 h-8", ring = false }) => {
  const displayPicture = picture || getUserPicture(user);
  const letter = (username || user?.name || "?").trim()[0]?.toUpperCase() || "?";

  return (
    <div className={`${className} rounded-full ${ring ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]" : "bg-gray-100"} overflow-hidden flex-shrink-0`}>
      <div className="w-full h-full rounded-full bg-white p-[2px]">
        {displayPicture ? (
          <img src={displayPicture} className="w-full h-full rounded-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full rounded-full bg-[#ebe7e1] flex items-center justify-center text-[11px] font-semibold text-[#111]">
            {letter}
          </div>
        )}
      </div>
    </div>
  );
};

const InstagramOverlay = ({ format, caption, children, isFull, platformUsername, platformPicture, metrics, user }) => {
  if (isFull) {
    const isReel = format.id === 'ig_reel';
    const isStory = format.id === 'ig_story';

    if (isStory) {
      return (
        <div className="absolute inset-0 flex flex-col pointer-events-none text-white">
          <div className="absolute inset-0 z-[-1] bg-black border-2 border-black">{children}</div>

          {/* Story Progress Bar */}
          <div className="px-2 pt-3 flex gap-1.5 z-10">
            <div className="h-0.5 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white w-1/3" />
            </div>
          </div>

          {/* Story Header */}
          <div className="px-3 flex items-center justify-between mt-3 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 p-0.5 overflow-hidden">
                {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full bg-indigo-500 rounded-full flex items-center justify-center text-[10px]">{user?.name?.[0] || '?'}</div>}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold shadow-sm">{platformUsername || 'Your Story'}</span>
                <span className="text-[9px] opacity-70 shadow-sm">{metrics.timestamp || '2h ago'}</span>
              </div>
            </div>
            <MoreHorizontal className="w-4 h-4 shadow-sm" />
          </div>

          {/* Story Bottom Bar */}
          <div className="mt-auto p-4 pb-6 flex items-center gap-4 bg-gradient-to-t from-black/50 to-transparent z-10">
            <div className="flex-1 h-10 rounded-full border border-white/40 px-4 flex items-center text-[12px] bg-black/10 backdrop-blur-md">
              Send message
            </div>
            <Heart className="w-6 h-6" />
            <Send className="w-6 h-6" />
          </div>
        </div>
      );
    }

    if (isReel) {
      return (
        <div className="absolute inset-0 flex flex-col pointer-events-none text-white">
          <div className="absolute inset-0 z-[-1] bg-black border-2 border-black">{children}</div>

          {/* Reels Sidebar */}
          <div className="absolute right-3 bottom-24 flex flex-col gap-6 items-center z-10">
            <div className="flex flex-col items-center gap-1">
              <Heart className="w-7 h-7 drop-shadow-lg" />
              <span className="text-[11px] font-bold drop-shadow-md">{metrics.likes?.toLocaleString() || '1.4k'}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MessageCircle className="w-7 h-7 drop-shadow-lg" />
              <span className="text-[11px] font-bold drop-shadow-md">{metrics.comments?.toLocaleString() || '42'}</span>
            </div>
            <Send className="w-6 h-6 drop-shadow-lg" />
            <MoreVertical className="w-5 h-5 drop-shadow-lg" />
            <div className="w-7 h-7 rounded-lg border-2 border-white/80 overflow-hidden mt-1">
              {user?.profile_picture && <img src={user.profile_picture} className="w-full h-full object-cover" />}
            </div>
          </div>

          {/* Reels Bottom Info */}
          <div className="mt-auto p-4 pb-8 bg-gradient-to-t from-black/60 via-black/20 to-transparent z-10">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 rounded-full border-2 border-white/20 p-0.5 overflow-hidden">
                {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full rounded-full object-cover" /> : <div className="w-full h-full bg-indigo-500 rounded-full flex items-center justify-center text-[10px]">{user?.name?.[0] || '?'}</div>}
              </div>
              <span className="text-[13px] font-bold drop-shadow-md">{platformUsername || 'username'}</span>
              <button className="px-2.5 py-1 rounded-lg border border-white/40 text-[10px] font-bold backdrop-blur-sm">Follow</button>
            </div>
            <p className="text-[12px] line-clamp-2 mb-3 drop-shadow-md">{caption}</p>
            <div className="flex items-center gap-2">
              <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full">
                <Music2 className="w-3 h-3" />
              </div>
              <span className="text-[11px] drop-shadow-md">Original Audio • {platformUsername || 'creator'}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col pointer-events-none text-white">
        <div className="absolute inset-0 z-[-1] bg-black border-2 border-black">{children}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_250px] bg-white pointer-events-none border border-gray-200">
      <div className="min-h-[420px] bg-black flex items-center justify-center">
        {children}
      </div>
      <div className="flex min-h-[420px] flex-col border-l border-gray-200 bg-white">
        <div className="h-[68px] px-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-10 h-10" ring />
            <span className="text-[14px] font-semibold text-black truncate">{platformUsername || 'username'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[14px] font-semibold text-black">Following</span>
            <MoreHorizontal className="w-5 h-5 text-black" />
          </div>
        </div>

        <div className="flex-1 px-4 py-4">
          <div className="flex items-start gap-3">
            <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-8 h-8" ring />
            <p className="min-w-0 text-[14px] leading-snug text-black">
              <span className="font-semibold mr-1">{platformUsername || 'username'}</span>
              {caption}
            </p>
          </div>
          <div className="mt-20 text-center">
            <p className="text-[24px] font-bold text-[#1c1e21]">No comments yet.</p>
            <p className="mt-2 text-[14px] text-[#1c1e21]">Start the conversation.</p>
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-black">
              <Heart className="w-6 h-6" />
              <MessageCircle className="w-6 h-6" />
              <Repeat className="w-6 h-6" />
              <Send className="w-6 h-6" />
            </div>
            <Bookmark className="w-6 h-6 text-black" />
          </div>
          <p className="mt-3 text-[12px] text-gray-500">{metrics.timestamp} ago</p>
          <div className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
            <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-7 h-7" ring />
            <span className="text-[14px] text-gray-500">Add a comment...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const YouTubeOverlay = ({ format, caption, children, isFull, platformUsername, platformPicture, metrics, user }) => {
  if (isFull) {
    return (
      <div className="absolute inset-0 flex flex-col pointer-events-none text-white">
        <div className="absolute inset-0 z-[-1] bg-black border-2 border-black">{children}</div>

        {/* Shorts Sidebar */}
        <div className="absolute right-3 bottom-24 flex flex-col gap-6 items-center z-10">
          <div className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 fill-white" />
            </div>
            <span className="text-[11px] font-bold">{metrics.likes?.toLocaleString() || 'Like'}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
              <ThumbsDown className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold">Dislike</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
              <MessageSquare className="w-5 h-5 fill-white" />
            </div>
            <span className="text-[11px] font-bold">{metrics.comments?.toLocaleString() || '42'}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
              <Share2 className="w-5 h-5 fill-white" />
            </div>
            <span className="text-[11px] font-bold">Share</span>
          </div>
          <div className="w-10 h-10 rounded border-2 border-white/20 mt-1 overflow-hidden">
            {platformPicture && <img src={platformPicture} className="w-full h-full object-cover" alt="" />}
          </div>
        </div>

        {/* Shorts Bottom Info */}
        <div className="mt-auto p-4 pb-8 bg-gradient-to-t from-black/60 to-transparent z-10">
          <div className="flex items-center gap-3 mb-3">
            <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-9 h-9" />
            <span className="text-[13px] font-bold">@{platformUsername || user?.name || 'channel'}</span>
            <button className="bg-red-600 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold">Subscribe</button>
          </div>
          <p className="text-[13px] font-medium line-clamp-2 mb-3">{caption}</p>
          <div className="flex items-center gap-2">
            <Music2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">Original Audio • {platformUsername || 'creator'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#0f0f0f] pointer-events-none">
       <div className={`relative overflow-hidden ${format.css} w-full`}>
         {children}
       </div>
       <div className="p-3 text-white">
          <div className="flex gap-3">
            <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-10 h-10" />
            <div className="flex-1">
              <p className="text-[13px] font-bold leading-tight mb-1">{caption || 'Video Title'}</p>
              <p className="text-[11px] text-gray-400">{platformUsername || user?.name || 'Channel Name'} • {metrics.views.toLocaleString()} views • {metrics.timestamp}</p>
            </div>
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </div>
       </div>
    </div>
  );
};

const LinkedInOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-white pointer-events-none">
      <div className="p-3 flex items-center gap-2 border-b border-gray-100">
        <div className="w-10 h-10 rounded-sm bg-gray-200 overflow-hidden">
           {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#0A66C2] flex items-center justify-center text-white text-xs">{user?.name?.[0] || '?'}</div>}
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-black">{platformUsername || user?.name || 'Your Name'}</p>
          <p className="text-[9px] text-gray-500">GAP Social-pilot User</p>
          <p className="text-[9px] text-gray-400">{metrics.timestamp} • 🌐</p>
        </div>
        <MoreHorizontal className="w-4 h-4 text-gray-400" />
      </div>
      <div className="p-3">
        <p className="text-[11px] text-black leading-relaxed mb-2">{caption}</p>
      </div>
      <div className={`relative overflow-hidden bg-gray-50 ${format.css} w-full`}>
        {children}
      </div>
      <div className="p-2.5 flex items-center justify-between border-t border-gray-100 bg-white">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
             <div className="w-3.5 h-3.5 rounded-full bg-[#0a66c2] flex items-center justify-center border border-white"><ThumbsUp size={7} color="white" fill="white" /></div>
             <div className="w-3.5 h-3.5 rounded-full bg-[#df704d] flex items-center justify-center border border-white"><Heart size={7} color="white" fill="white" /></div>
          </div>
          <span className="text-[10px] text-gray-500">{metrics.likes.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-gray-500">{metrics.comments.toLocaleString()} comments • {metrics.shares.toLocaleString()} shares</div>
      </div>
    </div>
  );
};

const XOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-black pointer-events-none text-white p-3">
      <div className="flex gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
           {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-700 flex items-center justify-center text-sm">{user?.name?.[0] || '?'}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold truncate">{user?.name || 'Your Name'}</span>
              <span className="text-[11px] text-gray-500 truncate">@{platformUsername || user?.name?.toLowerCase().replace(/\s+/g, '') || 'handle'} · {metrics.timestamp}</span>
            </div>
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </div>
          <p className="text-[12px] leading-normal mb-2">{caption}</p>
        </div>
      </div>
      <div className={`relative overflow-hidden rounded-xl border border-gray-800 ${format.css} w-full mb-2`}>
        {children}
      </div>
      <div className="py-2 border-t border-gray-800 flex items-center justify-around">
        <div className="flex items-center gap-1.5 text-gray-500"><MessageSquare className="w-4 h-4" /><span className="text-[10px]">{metrics.comments.toLocaleString()}</span></div>
        <div className="flex items-center gap-1.5 text-gray-500"><Repeat className="w-4 h-4" /><span className="text-[10px]">{metrics.shares.toLocaleString()}</span></div>
        <div className="flex items-center gap-1.5 text-gray-500"><Heart className="w-4 h-4" /><span className="text-[10px]">{metrics.likes.toLocaleString()}</span></div>
        <div className="flex items-center gap-1.5 text-gray-500"><Share2 className="w-4 h-4" /></div>
      </div>
    </div>
  );
};



const FacebookOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  if (isFull) {
    return (
      <div className="absolute inset-0 flex flex-col pointer-events-none text-white">
        <div className="absolute inset-0 z-[-1] bg-black border-2 border-black">{children}</div>

        {/* Story Progress Bar */}
        <div className="px-2 pt-3 flex gap-1 z-10">
          <div className="h-0.5 flex-1 bg-white/40 rounded-full overflow-hidden">
            <div className="h-full bg-white w-1/3" />
          </div>
        </div>

        {/* Story Header */}
        <div className="px-3 flex items-center justify-between mt-3 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-300 border border-white/20 overflow-hidden">
               {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#1877F2] flex items-center justify-center text-white text-[10px] font-bold">{user?.name?.[0] || '?'}</div>}
            </div>
            <span className="text-[10px] font-bold shadow-sm">{platformUsername || user?.name || 'Your Story'}</span>
          </div>
          <div className="flex gap-4">
             <MoreHorizontal className="w-4 h-4 shadow-sm" />
             <X className="w-4 h-4 shadow-sm" />
          </div>
        </div>

        {/* Story Bottom Bar */}
        <div className="mt-auto p-4 pb-8 flex items-center gap-4 bg-gradient-to-t from-black/50 to-transparent z-10">
          <div className="flex-1 h-10 rounded-full bg-white/10 backdrop-blur-md px-4 flex items-center text-[11px] border border-white/20">
            Reply...
          </div>
          <Heart className="w-6 h-6" />
          <ThumbsUp className="w-6 h-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white pointer-events-none">
      <div className="p-3 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
           {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#1877F2] flex items-center justify-center text-white text-xs">{user?.name?.[0] || '?'}</div>}
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-bold text-black leading-tight">{platformUsername || user?.name || 'Your Page Name'}</p>
          <p className="text-[10px] text-gray-500 font-medium">{metrics.timestamp} • 🌎</p>
        </div>
        <MoreHorizontal className="w-4 h-4 text-gray-500" />
      </div>
      <div className="px-3 pb-3">
        <p className="text-[12px] text-gray-900 leading-relaxed">{caption}</p>
      </div>
      <div className={`relative overflow-hidden bg-gray-100 ${format.css} w-full`}>
        {children}
      </div>
      <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center text-[11px] text-gray-500">
         <div className="flex items-center gap-1">
            <div className="w-3.5 h-3.5 rounded-full bg-[#1877F2] flex items-center justify-center"><ThumbsUp size={7} color="white" fill="white" /></div>
            <span>{metrics.likes.toLocaleString()}</span>
         </div>
         <div>{metrics.comments.toLocaleString()} comments • {metrics.shares.toLocaleString()} shares</div>
      </div>
      <div className="flex items-center justify-between px-6 py-1 bg-white">
        <div className="flex flex-col items-center gap-0.5 text-gray-600">
          <ThumbsUp className="w-4 h-4" />
          <span className="text-[9px] font-bold">Like</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-gray-600">
          <MessageCircle className="w-4 h-4" />
          <span className="text-[9px] font-bold">Comment</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-gray-600">
          <Share2 className="w-4 h-4" />
          <span className="text-[9px] font-bold">Share</span>
        </div>
      </div>
    </div>
  );
};

const ThreadsOverlay = ({ format, caption, children, isFull, platformUsername, platformPicture, metrics, user }) => {
  return (
    <div className="bg-white pointer-events-none">
      <div className="flex h-12 items-center gap-5 px-4 text-black">
        <ChevronLeft className="w-5 h-5" />
        <span className="text-[18px] font-semibold">Thread</span>
        <MoreHorizontal className="w-5 h-5 ml-auto" />
      </div>
      <div className="rounded-[24px] border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-9 h-9" />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[14px] font-semibold text-black">{platformUsername || 'username'}</span>
              <span className="text-[14px] text-gray-500">{metrics.timestamp}</span>
              <MoreHorizontal className="ml-auto w-5 h-5 text-gray-400" />
            </div>
            <p className="mb-3 text-[14px] leading-snug text-black whitespace-pre-wrap">{caption}</p>
            <div className={`relative mb-3 w-full overflow-hidden rounded-md border border-gray-100 bg-white ${format.css}`}>
              {children}
            </div>
            <div className="flex items-center gap-5 text-black">
              <Heart className="w-5 h-5" />
              <MessageCircle className="w-5 h-5" />
              <Repeat className="w-5 h-5" />
              <Send className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-x border-gray-200 px-5 py-4">
        <p className="text-[15px] font-semibold text-gray-400">No replies yet</p>
        <div className="mt-4 flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-2 py-2">
          <ProfileBubble user={user} username={platformUsername} picture={platformPicture} className="w-8 h-8" />
          <span className="text-[14px] text-gray-400">Reply to {platformUsername || 'username'}...</span>
          <div className="ml-auto flex items-center gap-2 text-gray-400">
            <MessageCircle className="w-4 h-4" />
            <span className="rounded border border-gray-300 px-1 text-[10px] font-semibold">GIF</span>
          </div>
        </div>
      </div>
    </div>
  );

};

const BlueskyOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-[#161e27] p-4 pointer-events-none text-white">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden">
           {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#0085ff] flex items-center justify-center text-white text-sm">{user?.name?.[0] || '?'}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[14px] font-bold text-white truncate">{user?.name || 'Your Name'}</span>
              <span className="text-[13px] text-gray-400 truncate">@{platformUsername || user?.name?.toLowerCase().replace(/\s+/g, '') || 'handle'}.bsky.social</span>
              <span className="text-gray-500 mx-1">·</span>
              <span className="text-[13px] text-gray-500">{metrics.timestamp}</span>
            </div>
          </div>
          <p className="text-[14px] text-white leading-normal mb-3 whitespace-pre-wrap">{caption}</p>
          <div className={`relative overflow-hidden rounded-xl border border-white/10 ${format.css} w-full mb-3`}>
            {children}
          </div>
          <div className="flex items-center justify-between text-gray-400 max-w-[300px]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-[11px]">{metrics.comments.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              <span className="text-[11px]">{metrics.shares.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-pink-500/80">
              <Heart className="w-4 h-4" />
              <span className="text-[11px]">{metrics.likes.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
            </div>
            <Share2 className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const MastodonOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-[#282c37] p-4 pointer-events-none text-white">
      <div className="flex gap-3">
        <div className="w-11 h-11 rounded bg-gray-600 flex-shrink-0 overflow-hidden">
           {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#6364ff] flex items-center justify-center text-white font-bold">{user?.name?.[0] || '?'}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[14px] font-bold text-white truncate">{user?.name || 'Your Name'}</span>
            <span className="text-[14px] text-gray-400 truncate">@{platformUsername || user?.name?.toLowerCase().replace(/\s+/g, '') || 'handle'}</span>
          </div>
          <p className="text-[14px] text-white leading-normal mb-3">{caption}</p>
          <div className={`relative overflow-hidden rounded-md border border-white/10 ${format.css} w-full mb-3`}>
            {children}
          </div>
          <div className="flex items-center gap-6 text-gray-400">
             <MessageSquare className="w-4 h-4" />
             <Repeat className="w-4 h-4" />
             <Heart className="w-4 h-4" />
             <MoreHorizontal className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

const RedditOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-white pointer-events-none">
      <div className="p-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[#ff4500] flex items-center justify-center text-white text-[10px] font-bold">r/</div>
        <div className="flex items-center gap-1">
          <span className="text-[12px] font-bold text-black">r/gapsocialpilot</span>
          <span className="text-[10px] text-gray-500">• Posted by u/{platformUsername || user?.name?.toLowerCase().replace(/\s+/g, '') || 'user'}</span>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[14px] font-bold text-black mb-1">{caption || 'Post Title'}</p>
      </div>
      <div className={`relative overflow-hidden bg-gray-50 ${format.css} w-full`}>
        {children}
      </div>
      <div className="p-2 flex items-center gap-4 text-gray-500 border-t border-gray-100">
         <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
            <ThumbsUp className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">{metrics.likes.toLocaleString()}</span>
            <ThumbsDown className="w-3.5 h-3.5" />
         </div>
         <div className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /><span className="text-[11px]">{metrics.comments.toLocaleString()}</span></div>
         <div className="flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /><span className="text-[11px]">Share</span></div>
      </div>
    </div>
  );
};

const GoogleBusinessOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-white pointer-events-none border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 flex gap-3">
         <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
         </div>
         <div className="flex-1">
            <p className="text-[14px] font-bold text-gray-900">{platformUsername || user?.name || 'Business Name'}</p>
            <p className="text-[12px] text-gray-500">Posted on Google</p>
         </div>
      </div>
      <div className={`relative overflow-hidden ${format.css} w-full`}>
        {children}
      </div>
      <div className="p-4">
        <p className="text-[13px] text-gray-700 leading-relaxed mb-4">{caption}</p>
        <button className="w-full py-2 bg-blue-600 text-white rounded-md text-[13px] font-bold">Learn More</button>
      </div>
    </div>
  );
};

const PinterestOverlay = ({ format, caption, children, isFull, platformUsername, metrics, user }) => {
  return (
    <div className="flex flex-col bg-white pointer-events-none">
       <div className="p-3 flex items-center justify-between">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
             <ChevronLeft className="w-5 h-5 text-gray-900" />
          </div>
          <div className="bg-[#E60023] text-white px-4 py-2 rounded-full text-xs font-bold">Save</div>
       </div>
       <div className={`relative overflow-hidden ${format.css} w-full`}>
         {children}
       </div>
       <div className="p-4 bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <h3 className="text-sm font-bold text-gray-900 mb-2">{caption || 'Pin Title'}</h3>
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                   {user?.profile_picture ? <img src={user.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-red-600 flex items-center justify-center text-white text-[10px]">{user?.name?.[0] || '?'}</div>}
                </div>
                <span className="text-[11px] font-bold">{platformUsername || user?.name || 'Username'}</span>
             </div>
             <button className="bg-gray-100 text-black px-3 py-1.5 rounded-full text-[11px] font-bold">Follow</button>
          </div>
       </div>
    </div>
  );
};

/* ── Preview Container (Refactored) ────────────────────────────────── */
function PreviewContainer({ children, config, format, caption, platformUsername, metrics, user }) {
  const isVertical = format.ratio.includes('9:16') || format.ratio === '2:3' || format.ratio === '1:2.1' || format.ratio === '4:5';
  const isFull = format.full === true;
  const platformName = config.name.toLowerCase();
  const widthClass = !isFull && platformName === 'instagram'
    ? 'w-[640px]'
    : !isFull && platformName === 'threads'
      ? 'w-[420px]'
      : isVertical ? 'w-[280px]' : 'w-[360px]';

  const getOverlay = () => {
    const props = { format, caption, children, isFull, platformUsername, metrics, user };
    if (platformName === 'instagram') return <InstagramOverlay {...props} />;
    if (platformName === 'youtube') return <YouTubeOverlay {...props} />;
    if (platformName === 'linkedin') return <LinkedInOverlay {...props} />;
    if (platformName === 'x (twitter)') return <XOverlay {...props} />;

    if (platformName === 'facebook') return <FacebookOverlay {...props} />;
    if (platformName === 'threads') return <ThreadsOverlay {...props} />;
    if (platformName === 'pinterest') return <PinterestOverlay {...props} />;
    if (platformName === 'bluesky') return <BlueskyOverlay {...props} />;
    if (platformName === 'mastodon') return <MastodonOverlay {...props} />;
    if (platformName === 'reddit') return <RedditOverlay {...props} />;
    if (platformName === 'google business') return <GoogleBusinessOverlay {...props} />;
    return children;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Container */}
      <div
        className={`relative rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-gray-100 bg-white transition-all duration-500 ${
          widthClass
        } ${isFull ? format.css : 'h-auto'}`}
      >
        {/* If it's a full screen post (Story/Reel), we use absolute positioning */}
        {isFull ? (
          <div className="absolute inset-0 z-10">
            {getOverlay()}
          </div>
        ) : (
          /* For feed posts, we let the overlay handle the layout naturally */
          <div className="relative z-10">
            {getOverlay()}
          </div>
        )}
      </div>

    </div>
  );
}
/* ── Main Modal ──────────────────────────────────────────────────────── */
export default function PostPreviewModal({ post, onClose, onDelete }) {
  const { connectedAccounts, user } = useAuth();
  const metrics = usePlatformMetrics(post.caption || "");
  const [activePlatformIdx, setActivePlatformIdx] = useState(0);
  const [activeFormatIdx, setActiveFormatIdx] = useState(0);

  useEffect(() => {
    if (!post) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, post]);

  if (!post) return null;

  const selectedChannels = Array.from(new Set([
    ...(post.selected_channels || []),
    ...(post.platform_data?.selectedChannels || []),
  ].map((channel) => String(channel))));
  const selectedBasePlatforms = new Set(selectedChannels.map((channel) => String(channel).split(':')[0]));
  const postType = post.platform_data?.postType || post.platform_data?.instagram?.type;

  const postedPlatforms = Object.entries(PLATFORM_CONFIG)
    .flatMap(([id, cfg]) => {
      let platformChannels = selectedChannels.filter((channel) => String(channel).split(':')[0] === id);
      if (platformChannels.some((channel) => String(channel).includes(':'))) {
        platformChannels = platformChannels.filter((channel) => String(channel).includes(':'));
      }
      const entries = platformChannels.length ? platformChannels : [id];
      let finalFormats = cfg.formats;
      const presetId = post?.platform_data?.parsedPresets?.[id]
        || (id === 'instagram' && postType === 'story' ? 'ig-story' : '');
      if (presetId) {
        let matchedIndex = -1;
        if (id === 'instagram') {
           if (presetId.includes('square')) matchedIndex = cfg.formats.findIndex(f => f.id === 'ig_post');
           else if (presetId.includes('portrait')) matchedIndex = cfg.formats.findIndex(f => f.id === 'ig_port');
           else if (presetId.includes('reel')) matchedIndex = cfg.formats.findIndex(f => f.id === 'ig_reel');
           else if (presetId.includes('story')) matchedIndex = cfg.formats.findIndex(f => f.id === 'ig_story');
           else if (presetId.includes('landscape')) matchedIndex = cfg.formats.findIndex(f => f.id === 'ig_post');
        } else if (id === 'linkedin') {
           if (presetId.includes('square')) matchedIndex = cfg.formats.findIndex(f => f.id === 'li_sq');
           else if (presetId.includes('portrait')) matchedIndex = cfg.formats.findIndex(f => f.id === 'li_port');
           else if (presetId.includes('feed') || presetId.includes('image')) matchedIndex = cfg.formats.findIndex(f => f.id === 'li_feed');
        } else if (id === 'facebook') {
           if (presetId.includes('image') || presetId.includes('feed')) matchedIndex = cfg.formats.findIndex(f => f.id === 'fb_feed');
           else if (presetId.includes('reel')) matchedIndex = cfg.formats.findIndex(f => f.id === 'fb_reel');
           else if (presetId.includes('story')) matchedIndex = cfg.formats.findIndex(f => f.id === 'fb_story');
           else if (presetId.includes('square')) matchedIndex = cfg.formats.findIndex(f => f.id === 'fb_sq');
        } else if (id === 'x') {
           if (presetId.includes('square')) matchedIndex = cfg.formats.findIndex(f => f.id === 'x_square');
           else if (presetId.includes('image')) matchedIndex = cfg.formats.findIndex(f => f.id === 'x_post');
        } else if (id === 'youtube') {
           if (presetId.includes('shorts')) matchedIndex = cfg.formats.findIndex(f => f.id === 'yt_short');
           else if (presetId.includes('community') || presetId.includes('video')) matchedIndex = cfg.formats.findIndex(f => f.id === 'yt_thumb');
        }
        if (matchedIndex !== -1) {
           finalFormats = [cfg.formats[matchedIndex]];
        }
      }
      return entries.map((channel) => {
        const result = getPlatformResult(post, id, channel);
        const success = result?.success ?? post[`${id}_success`] ?? (selectedBasePlatforms.has(id) && post.status === 'sent');
        return {
        key: channel,
        channel,
        id,
        ...cfg,
        formats: finalFormats,
        success,
        error: result?.error || post[`${id}_error`],
        url: result?.videoUrl || result?.shortsUrl || result?.url || post[`${id}_url`] || post[`${id}_shorts_url`],
        selected: selectedBasePlatforms.has(id),
      };
      });
    })
    .filter(p => p.selected || p.success || (p.error && p.error !== 'Not selected'));

  const activePlatform = postedPlatforms[activePlatformIdx];
  const activeFormat   = activePlatform?.formats?.[activeFormatIdx] || activePlatform?.formats?.[0];
  const activeChannel = activePlatform?.channel || null;
  const activeAccount = resolvePlatformAccount({
    post,
    platformId: activePlatform?.id,
    channel: activeChannel,
    connectedAccounts,
  });
  const activeUsername =
    getPlatformResult(post, activePlatform?.id, activeChannel)?.username ||
    getAccountUsername(activeAccount) ||
    connectedAccounts?.[activePlatform?.id]?.username ||
    user?.name?.toLowerCase().replace(/\s+/g, '_') ||
    'username';
  const activePicture =
    getPlatformResult(post, activePlatform?.id, activeChannel)?.profilePicture ||
    getAccountPicture(activeAccount) ||
    getAccountPicture(connectedAccounts?.[activePlatform?.id]) ||
    getUserPicture(user);

  const handlePlatformChange = (idx) => { setActivePlatformIdx(idx); setActiveFormatIdx(0); };
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const isImage = post.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(post.video_filename || '');
  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="post-preview-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={handleBackdrop}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
        className="post-preview-modal bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >

        {/* ── Modal Header ── */}
        <div className="post-preview-header flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <div>
              <h2 className="post-preview-title text-lg font-bold text-gray-900 leading-tight">{post.caption?.split('\n')[0] || 'Post Preview'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 font-medium">{formatDate(post.scheduled_for || post.posted_at || post.created_at)}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">{post.media_type}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this post from your history?")) {
                    onDelete(post.id);
                  }
                }} 
                className="post-preview-icon-button p-2.5 hover:bg-red-50 rounded-full transition-all group"
                title="Delete Post"
              >
                <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-all duration-300" />
              </button>
            )}
            <button onClick={onClose} className="post-preview-close p-2.5 hover:bg-gray-100 rounded-full transition-all group">
              <X className="w-5 h-5 text-gray-400 group-hover:text-gray-900 group-hover:rotate-90 transition-all duration-300" />
            </button>
          </div>
        </div>

        <div className="post-preview-shell flex flex-1 overflow-hidden">

          {/* ── Left: Platform list ── */}
          <div className="post-preview-sidebar w-64 border-r border-gray-100 overflow-y-auto flex-shrink-0 bg-gray-50/30">
            <div className="p-5">
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.1em] mb-4">Platforms</p>
              <div className="space-y-2">
                {postedPlatforms.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No platforms data available</p>
                ) : (
                  postedPlatforms.map((p, i) => {
                    const rowAccount = resolvePlatformAccount({ post, platformId: p.id, channel: p.channel, connectedAccounts });
                    const rowResult = getPlatformResult(post, p.id, p.channel);
                    const rowName = rowResult?.username || getAccountUsername(rowAccount);
                    const rowPicture = rowResult?.profilePicture || getAccountPicture(rowAccount);
                    return (
                    <button
                      key={p.key || p.id}
                      onClick={() => handlePlatformChange(i)}
                      className={`post-preview-platform-option w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                        i === activePlatformIdx
                        ? 'bg-white shadow-lg shadow-gray-200/50 border border-gray-100 scale-[1.02]'
                        : 'hover:bg-gray-100/50'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {rowPicture ? (
                          <img src={rowPicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <img src={p.icon} alt={p.name} className="w-8 h-8 object-contain" />
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-white shadow-sm ${p.success ? 'bg-green-500' : post.status === 'scheduled' ? 'bg-blue-500' : 'bg-red-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-[13px] font-bold ${i === activePlatformIdx ? 'text-gray-900' : 'text-gray-600'}`}>{p.name}</p>
                        {rowName && <p className="truncate text-[11px] font-semibold text-gray-500">{rowName}</p>}
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${p.success ? 'text-green-600' : post.status === 'scheduled' ? 'text-blue-600' : 'text-red-500'}`}>
                          {p.success ? 'Success' : post.status === 'scheduled' ? 'Scheduled' : 'Failed'}
                        </p>
                      </div>
                    </button>
                  );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Preview + formats ── */}
          <div className="post-preview-main flex-1 overflow-y-auto bg-white">
            {!activePlatform ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 p-10 text-center">
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                  <Play className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">Select a platform to preview your post</p>
              </div>
            ) : (
              <div className="post-preview-main-inner p-8">
                {/* Phone preview area */}
                <div className="post-preview-stage flex flex-col lg:flex-row gap-10 items-start justify-center">

                  <div className="flex-shrink-0">
                    <PreviewContainer
                      config={activePlatform}
                      format={activeFormat}
                      caption={post.caption}
                      platformUsername={activeUsername}
                      platformPicture={activePicture}
                      metrics={metrics}
                      user={user}
                    >
                      {(() => {
                        const isImage = post.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(post.video_filename || '');
                        const displayUrl = post.thumbnail_url || post.media_url;
                        const isThreadsPreview = activePlatform?.id === 'threads';

                        const activePlatId = activePlatform?.id;
                        const activeResult = getPlatformResult(post, activePlatId, activePlatform?.channel);
                        const liveUrl = activeResult?.url || post[`${activePlatId}_url`] || post[`${activePlatId}_shorts_url`];
                        const ytVideoId = activeResult?.videoId || post.youtube_video_id;

                        // ── Live Embeds for Published Posts ──
                        if (post.status !== 'scheduled' && activePlatId === 'youtube' && (ytVideoId || liveUrl)) {
                          const embedId = ytVideoId || (liveUrl ? liveUrl.match(/(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] : null);
                          // If post has direct video file URL or image, prefer direct media player to prevent YouTube third-party embed restriction errors
                          if (embedId && !post.media_url && !post.thumbnail_url) {
                            return (
                              <iframe
                                src={`https://www.youtube-nocookie.com/embed/${embedId}?autoplay=0&rel=0&enablejsapi=1`}
                                className="w-full h-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                referrerPolicy="strict-origin-when-cross-origin"
                                title="YouTube Live Embed"
                              />
                            );
                          }
                        }

                        if (post.status !== 'scheduled' && activePlatId === 'instagram' && (liveUrl || post.instagram_url)) {
                          const igUrl = liveUrl || post.instagram_url;
                          const cleanIgUrl = igUrl.replace(/\/$/, '') + '/embed';
                          return (
                            <iframe
                              src={cleanIgUrl}
                              className="w-full h-full border-0 bg-white"
                              allowTransparency="true"
                              title="Instagram Live Embed"
                            />
                          );
                        }

                        if (post.status !== 'scheduled' && activePlatId === 'facebook' && (liveUrl || post.facebook_url)) {
                          const fbUrl = encodeURIComponent(liveUrl || post.facebook_url);
                          return (
                            <iframe
                              src={`https://www.facebook.com/plugins/post.php?href=${fbUrl}&show_text=true&width=500`}
                              className="w-full h-full border-0 bg-white"
                              scrolling="no"
                              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                              title="Facebook Live Embed"
                            />
                          );
                        }

                        if (post.status !== 'scheduled' && (activePlatId === 'x' || activePlatId === 'twitter') && (liveUrl || post.x_url)) {
                          const xUrl = encodeURIComponent(liveUrl || post.x_url);
                          return (
                            <iframe
                              src={`https://platform.twitter.com/embed/Tweet.html?url=${xUrl}`}
                              className="w-full h-full border-0 bg-white"
                              title="X Live Embed"
                            />
                          );
                        }

                        if (post.status !== 'scheduled' && activePlatId === 'pinterest' && (liveUrl || post.pinterest_url)) {
                          const pinUrl = encodeURIComponent(liveUrl || post.pinterest_url);
                          return (
                            <iframe
                              src={`https://assets.pinterest.com/ext/embed.html?id=${pinUrl}`}
                              className="w-full h-full border-0 bg-white"
                              title="Pinterest Live Embed"
                            />
                          );
                        }

                        if (post.status !== 'scheduled' && activePlatId === 'bluesky' && (liveUrl || post.bluesky_url)) {
                          const bskyUrl = encodeURIComponent(liveUrl || post.bluesky_url);
                          return (
                            <iframe
                              src={`https://embed.bsky.app/embed/${bskyUrl}`}
                              className="w-full h-full border-0 bg-white"
                              title="Bluesky Live Embed"
                            />
                          );
                        }

                        if (post.status !== 'scheduled' && activePlatId === 'reddit' && liveUrl) {
                          const cleanRedditUrl = liveUrl.replace(/\/$/, '') + '/embed';
                          return (
                            <iframe
                              src={cleanRedditUrl}
                              className="w-full h-full border-0 bg-white"
                              title="Reddit Live Embed"
                            />
                          );
                        }

                        if (displayUrl) {
                          if (!isImage) {
                            return (
                              <video
                                src={post.media_url || displayUrl}
                                poster={post.thumbnail_url || undefined}
                                className={isThreadsPreview ? "w-full h-auto object-contain bg-white" : "w-full h-full object-contain bg-black"}
                                autoPlay
                                loop
                                muted
                                playsInline
                                controls
                                onError={e => {
                                  console.error("Video failed to load", e);
                                }}
                              />
                            );
                          }
                          
                          return (
                            <img
                              src={displayUrl}
                              alt="Post Preview"
                              className={isThreadsPreview ? "w-full h-auto object-contain bg-white" : "w-full h-full object-contain bg-black"}
                              onError={e => {
                                e.target.src = 'https://placehold.co/600x600?text=Preview+Unavailable';
                              }}
                            />
                          );
                        }

                        return (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-600">
                            {post.media_type === 'video' ? (
                              <Video className="w-10 h-10 mb-2 opacity-20" />
                            ) : (
                              <Play className="w-10 h-10 mb-2 opacity-20" />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              {post.media_type === 'video' ? 'Video Preview' : 'Media Preview'}
                            </span>
                          </div>
                        );
                      })()}
                    </PreviewContainer>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
