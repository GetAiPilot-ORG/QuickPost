import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { autodmSupabase, startAutoDMInstagramOAuth } from '../../services/autodm/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { Loader2, CheckCircle2, Lock, ArrowRight, Instagram } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

import FacebookSetupModal from '../../components/FacebookSetupModal';
import LinkedInConnectModal from '../../components/LinkedInConnectModal';
import MastodonConnectModal from '../../components/MastodonConnectModal';
import BlueskyConnectModal from '../../components/BlueskyConnectModal';
import PinterestConnectModal from '../../components/PinterestConnectModal';
import { countConnectedTargets } from '../../utils/connectedAccounts';

export default function ConnectInstagramPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, connectedAccounts } = useAuth();
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [activeInstagramAccount, setActiveInstagramAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [checkingAccounts, setCheckingAccounts] = useState(true);

  // Modal States
  const [showFacebookModal, setShowFacebookModal] = useState(false);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showMastodonModal, setShowMastodonModal] = useState(false);
  const [showBlueskyModal, setShowBlueskyModal] = useState(false);
  const [showPinterestModal, setShowPinterestModal] = useState(false);

  const loadAccounts = async () => {
    if (!user?.userId) return;
    try {
      const { data: accounts, error } = await autodmSupabase
        .from('instagram_accounts')
        .select('*')
        .eq('user_id', user.userId);

      if (error) throw error;

      const connected = (accounts || []).filter(acc => acc.is_connected !== false);
      setInstagramAccounts(connected);
      if (connected.length > 0) {
        setActiveInstagramAccount(connected[0]);
      } else {
        setActiveInstagramAccount(null);
      }
    } catch (e) {
      console.error('[ConnectPage] Failed to load accounts:', e);
    } finally {
      setCheckingAccounts(false);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      loadAccounts();
    }
  }, [user?.userId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error) {
      setIsLoading(false);
      toast.error(decodeURIComponent(error));
    }
  }, [location.search]);

  const handleConnectInstagram = async () => {
    if (instagramAccounts.length > 0) {
      toast.error('Instagram already connected. Disconnect first.');
      return;
    }

    if (!user?.userId) {
      toast.error('Please sign in again');
      return;
    }

    setIsLoading(true);

    try {
      const url = await startAutoDMInstagramOAuth(window.location.origin);
      window.location.assign(url);
    } catch (err) {
      console.error('Instagram connect error:', err);
      toast.error(err?.message || 'Failed to start Instagram login');
      setIsLoading(false);
    }
  };

  const handleConnectFacebook = () => {
    const token = localStorage.getItem('quickpost_token');
    if (!token) {
      toast.error('Please sign in again');
      return;
    }
    setShowFacebookModal(false);
    const apiUrl = import.meta.env.VITE_API_URL || '';
    window.location.href = `${apiUrl}/api/auth/facebook?token=${token}`;
  };

  const handleDisconnect = async () => {
    const accountId = activeInstagramAccount?.id || instagramAccounts[0]?.id;
    if (!accountId) return;

    setIsDisconnecting(true);
    try {
      const { error } = await autodmSupabase
        .from('instagram_accounts')
        .update({ is_connected: false })
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Instagram disconnected');
      loadAccounts();
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast.error('Failed to disconnect Instagram');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRedirectConnect = (endpoint) => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      return;
    }
    const limit = user?.entitlements?.limits?.social_accounts ?? Infinity;
    const platformAccounts = connectedAccounts?.[`${endpoint}Accounts`] || [];
    const alreadyConnected = Boolean(connectedAccounts?.[endpoint]?.connected || platformAccounts.length);
    if (!alreadyConnected && countConnectedTargets(connectedAccounts) >= limit) {
      toast.error(`Your plan allows ${limit} connected social account${limit === 1 ? "" : "s"}. Disconnect one account or upgrade to connect more.`);
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || "";
    window.location.href = `${apiUrl}/api/auth/${endpoint}?token=${token}`;
  };

  const socialPlatforms = [
    { id: 'facebook', name: 'Facebook', description: 'Pages & Groups', icon: '/icons/facebook-round-color-icon.svg', onConnect: () => setShowFacebookModal(true) },
    { id: 'linkedin', name: 'LinkedIn', description: 'Profiles & Pages', icon: '/icons/linkedin-icon.svg', onConnect: () => setShowLinkedInModal(true) },
    { id: 'youtube', name: 'YouTube', description: 'Shorts & Videos', icon: '/icons/youtube-color-icon.svg', onConnect: () => handleRedirectConnect('youtube') },
    { id: 'threads', name: 'Threads', description: 'Text & Media', icon: '/icons/threads-icon.svg', onConnect: () => handleRedirectConnect('threads') },
    { id: 'bluesky', name: 'Bluesky', description: 'AT Protocol', icon: '/icons/bluesky-circle-color-icon.svg', onConnect: () => setShowBlueskyModal(true) },
  ];

  const comingSoonPlatforms = [
    { id: 'x', name: 'X (Twitter)', description: 'Posts & Threads', icon: '/icons/x-social-media-round-icon.svg' },
    { id: 'pinterest', name: 'Pinterest', description: 'Boards & Pins', icon: '/icons/pinterest-round-color-icon.svg' },
    { id: 'reddit', name: 'Reddit', description: 'Subreddit Posting', icon: '/icons/reddit-icon.svg' },
    { id: 'whatsapp', name: 'WhatsApp', description: 'Business API', icon: '/icons/wa-whatsapp-icon.svg' },
    { id: 'telegram', name: 'Telegram', description: 'Bot API', icon: '/icons/telegram-icon.svg' },
  ];

  const isInstagramConnected = instagramAccounts.length > 0;

  return (
    <main style={{ 
      minHeight: '100vh', 
      background: 'var(--canvas, #FAF9F6)', 
      color: 'var(--ink, #141413)', 
      fontFamily: 'var(--font-body, Inter, sans-serif)',
      display: 'flex',
      flexDirection: 'column',
      padding: '48px 32px 80px',
      overflowX: 'hidden'
    }}>
      
      <div style={{ width: '100%', maxWidth: '760px', margin: '0 auto' }}>
        
        {/* Page Header */}
        <header style={{ marginBottom: '56px', maxWidth: '640px' }}>
          <h1 style={{ fontSize: '44px', fontWeight: '700', letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: '1.1' }}>
            Channels & Integrations
          </h1>
          <p style={{ color: 'var(--slate, #64645F)', fontSize: '17px', margin: 0, lineHeight: '1.5' }}>
            Manage your connected social accounts and messaging platforms. Authorize GAP to post on your behalf and automate direct messages.
          </p>
        </header>

        {checkingAccounts ? (
          <div style={{ display: 'flex', padding: '60px 0', color: 'var(--slate)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <Loader2 size={24} />
            </motion.div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '56px' }}>
            
            {/* Featured Section: AutoDM (Instagram) */}
            <section>
              <h2 style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--slate)', margin: '0 0 16px' }}>
                Primary AutoDM Channel
              </h2>
              
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1px solid rgba(20,20,19,0.08)',
                display: 'grid',
                gridTemplateColumns: 'minmax(300px, 1.2fr) 1fr',
                overflow: 'hidden',
                boxShadow: '0 4px 24px -12px rgba(20,20,19,0.04)'
              }}>
                {/* Left Side: Connection Details */}
                <div style={{ padding: '40px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '12px', 
                      background: 'var(--canvas, #FAF9F6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid rgba(20,20,19,0.06)'
                    }}>
                      <img src="/icons/ig-instagram-icon.svg" alt="Instagram" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 2px', fontSize: '18px', fontWeight: '600' }}>Instagram</h3>
                      <p style={{ margin: 0, color: 'var(--slate)', fontSize: '14px' }}>Official Meta Graph API</p>
                    </div>
                  </div>

                  <p style={{ color: 'var(--slate)', fontSize: '14px', lineHeight: '1.5', marginBottom: '32px', maxWidth: '380px' }}>
                    Connect your professional Instagram account to enable automated DM replies, lead capture flows, and story mentions tracking.
                  </p>

                  {isInstagramConnected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={() => navigate('/dashboard/auto-dm')}
                        style={{ 
                          background: 'var(--ink, #141413)', color: '#fff', border: 'none', borderRadius: '8px', 
                          padding: '10px 20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', 
                          display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.15s' 
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#333'}
                        onMouseOut={e => e.currentTarget.style.background = 'var(--ink)'}
                      >
                        Configure AutoDM <ArrowRight size={16} />
                      </button>
                      <button 
                        onClick={handleDisconnect} disabled={isDisconnecting}
                        style={{ 
                          background: 'transparent', color: 'var(--slate)', border: '1px solid rgba(20,20,19,0.1)', 
                          borderRadius: '8px', padding: '9px 16px', fontSize: '14px', fontWeight: '500', 
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' 
                        }}
                        onMouseOver={e => { e.currentTarget.style.color = '#b62216'; e.currentTarget.style.borderColor = '#b62216'; }}
                        onMouseOut={e => { e.currentTarget.style.color = 'var(--slate)'; e.currentTarget.style.borderColor = 'rgba(20,20,19,0.1)'; }}
                      >
                        {isDisconnecting ? <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleConnectInstagram} disabled={isLoading}
                      style={{ 
                        background: 'var(--ink, #141413)', color: '#fff', border: 'none', borderRadius: '8px', 
                        padding: '10px 24px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.15s' 
                      }}
                      onMouseOver={e => e.currentTarget.style.background = '#333'}
                      onMouseOut={e => e.currentTarget.style.background = 'var(--ink)'}
                    >
                      {isLoading ? <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : 'Connect Instagram'}
                    </button>
                  )}
                </div>

                {/* Right Side: Status/Graphic Panel */}
                <div style={{ 
                  background: 'var(--canvas, #FAF9F6)', 
                  borderLeft: '1px solid rgba(20,20,19,0.06)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                  padding: '40px', position: 'relative', overflow: 'hidden'
                }}>
                  {/* Subtle background decoration */}
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(20,20,19,0.04) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                  
                  {isInstagramConnected ? (
                    <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                      <div style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: '#fff', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                        boxShadow: '0 8px 32px -8px rgba(18,130,59,0.25)', border: '4px solid #fff'
                      }}>
                        <CheckCircle2 size={32} color="#12823b" />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#12823b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Active Connection</div>
                      <div style={{ fontSize: '15px', color: 'var(--ink)', fontWeight: '500' }}>@{activeInstagramAccount?.username || instagramAccounts[0]?.username}</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, opacity: 0.6 }}>
                      <div style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', background: '#fff', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                        border: '1px solid rgba(20,20,19,0.1)'
                      }}>
                        <Instagram size={28} color="var(--slate)" />
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--slate)', fontWeight: '500' }}>Awaiting Connection</div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* List Section: Social Networks */}
            <section>
              <h2 style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--slate)', margin: '0 0 16px' }}>
                Social Media Channels
              </h2>
              
              <div style={{ 
                background: '#fff', borderRadius: '12px', border: '1px solid rgba(20,20,19,0.08)',
                overflow: 'hidden'
              }}>
                {socialPlatforms.map((platform, index) => (
                  <div key={platform.id} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '16px 24px',
                    borderBottom: index !== socialPlatforms.length - 1 ? '1px solid rgba(20,20,19,0.06)' : 'none',
                    transition: 'background 0.15s',
                    cursor: 'default'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(20,20,19,0.02)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={platform.icon} alt={platform.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ink)' }}>{platform.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--slate)' }}>{platform.description}</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={platform.onConnect}
                      style={{ 
                        background: '#fff', color: 'var(--ink)', border: '1px solid rgba(20,20,19,0.12)', 
                        borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: '500', 
                        cursor: 'pointer', transition: 'all 0.15s' 
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--canvas)'; e.currentTarget.style.borderColor = 'rgba(20,20,19,0.2)'; }}
                      onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'rgba(20,20,19,0.12)'; }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* List Section: Coming Soon */}
            <section>
              <h2 style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--slate)', margin: '0 0 16px' }}>
                Upcoming Integrations
              </h2>
              
              <div style={{ 
                background: '#fff', borderRadius: '12px', border: '1px solid rgba(20,20,19,0.08)',
                overflow: 'hidden'
              }}>
                {comingSoonPlatforms.map((platform, index) => (
                  <div key={platform.id} style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                    padding: '16px 24px',
                    borderBottom: index !== comingSoonPlatforms.length - 1 ? '1px solid rgba(20,20,19,0.06)' : 'none',
                    opacity: 0.6
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'grayscale(1)' }}>
                        <img src={platform.icon} alt={platform.name} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--ink)' }}>{platform.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--slate)' }}>{platform.description}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--slate)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', padding: '6px 12px', background: 'var(--canvas)', borderRadius: '6px' }}>
                      <Lock size={14} /> Soon
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}
      </div>

      {/* Render Modals */}
      <FacebookSetupModal
        isOpen={showFacebookModal}
        onClose={() => setShowFacebookModal(false)}
        onProceed={handleConnectFacebook}
      />
      <LinkedInConnectModal isOpen={showLinkedInModal} onClose={() => setShowLinkedInModal(false)} />
      <MastodonConnectModal isOpen={showMastodonModal} onClose={() => setShowMastodonModal(false)} />
      <BlueskyConnectModal isOpen={showBlueskyModal} onClose={() => setShowBlueskyModal(false)} />
      <PinterestConnectModal isOpen={showPinterestModal} onClose={() => setShowPinterestModal(false)} />
    </main>
  );
}
