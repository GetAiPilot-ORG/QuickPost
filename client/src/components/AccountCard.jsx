import React from 'react';
import { useAuth } from '../context/AuthContext';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

function AccountCard({ platform, connected, onConnect, onDisconnect, loading }) {
  const platformInfo = {
    instagram: {
      name: 'Instagram',
      description: 'Share Reels with your followers',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="url(#instagram-gradient)">
          <defs>
            <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#833AB4" />
              <stop offset="50%" stopColor="#E1306C" />
              <stop offset="100%" stopColor="#FCAF45" />
            </linearGradient>
          </defs>
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50',
      iconBg: 'bg-gradient-to-br from-purple-100 to-pink-100',
    },
    youtube: {
      name: 'YouTube',
      description: 'Upload Shorts to your channel',
      icon: (
        <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      bgColor: 'bg-red-50',
      iconBg: 'bg-red-100',
    }
  };

  const info = platformInfo[platform];

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${info.iconBg}`}>
          {info.icon}
        </div>
        <div>
          {connected ? (
            <span className="badge badge-success flex items-center gap-1">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.8} />
              Connected
            </span>
          ) : (
            <span className="badge badge-error flex items-center gap-1">
              <HugeiconsIcon icon={CancelCircleIcon} size={14} strokeWidth={1.8} />
              Not Connected
            </span>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-1">{info.name}</h3>
      <p className="text-sm text-gray-500 mb-6">
        {info.description}
      </p>

      {connected ? (
        <button
          onClick={onDisconnect}
          disabled={loading}
          className="btn-secondary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <HugeiconsIcon icon={Loading03Icon} size={16} strokeWidth={1.8} className="animate-spin" />
              Disconnecting...
            </span>
          ) : (
            'Disconnect'
          )}
        </button>
      ) : (
        <button
          onClick={onConnect}
          disabled={loading}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <HugeiconsIcon icon={Loading03Icon} size={16} strokeWidth={1.8} className="animate-spin" />
              Connecting...
            </span>
          ) : (
            `Connect ${info.name}`
          )}
        </button>
      )}
    </div>
  );
}

export default AccountCard;
