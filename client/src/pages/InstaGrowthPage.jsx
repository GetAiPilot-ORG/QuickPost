import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Instagram,
  Video,
  Twitter,
  Music,
  Heart,
  Eye,
  Users,
  Zap,
  Wallet,
  ShieldCheck,
  ExternalLink,
  Send,
  Loader2,
  RefreshCw,
  History,
  Check,
  Plus,
  Trash2,
  Sliders,
  CreditCard,
  ArrowUpRight,
  Sparkles,
  Lock,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import apiClient from '../utils/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function SocialGrowthPage() {
  const { connectedAccounts, user } = useAuth();

  // Navigation Tab: 'boost' | 'history' | 'autopilot'
  const [activeTab, setActiveTab] = useState('boost');

  // Platform: 'instagram' | 'youtube' | 'x' | 'tiktok'
  const [platform, setPlatform] = useState('instagram');

  // Goal: 'likes' | 'views' | 'followers' | 'comments'
  const [selectedGoal, setSelectedGoal] = useState('likes');

  // Form State
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState(1000);
  const [customQty, setCustomQty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  // Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [servicesData, setServicesData] = useState({
    instagram: [
      { service: '4348', name: 'Instagram Video Views', category: 'views', rate: 1.70, min: 100, max: 10000000, platform: 'instagram' },
      { service: '4349', name: 'IG Likes Global', category: 'likes', rate: 51.00, min: 10, max: 100000, platform: 'instagram' },
      { service: '4378', name: 'IG Likes [Indian 🇮🇳]', category: 'likes', rate: 80.75, min: 50, max: 50000, platform: 'instagram' },
      { service: '4350', name: 'Instagram Followers [High Quality + Real]', category: 'followers', rate: 233.75, min: 10, max: 100000, platform: 'instagram' },
      { service: '4380', name: 'Instagram Auto Likes', category: 'subscriptions', rate: 11.48, min: 50, max: 500000, platform: 'instagram' },
      { service: '4381', name: 'Instagram Auto Views', category: 'subscriptions', rate: 2.89, min: 100, max: 100000000, platform: 'instagram' },
    ],
    youtube: [
      { service: '4386', name: 'Youtube Views | Non Drop', category: 'views', rate: 212.50, min: 500, max: 1000000, platform: 'youtube' },
      { service: '4387', name: 'YouTube Likes | Non Drop', category: 'likes', rate: 297.50, min: 20, max: 3000, platform: 'youtube' },
      { service: '4388', name: 'Youtube Subscribers [30 Days Guaranteed]', category: 'subscribers', rate: 2407.20, min: 50, max: 50000, platform: 'youtube' },
    ],
    x: [
      { service: '4373', name: 'Twitter Tweet Views [Instant]', category: 'views', rate: 0.26, min: 100, max: 100000000, platform: 'x' },
      { service: '4375', name: 'X | Twitter Retweets [Instant]', category: 'retweets', rate: 255.00, min: 100, max: 500000, platform: 'x' },
      { service: '4376', name: 'Twitter Followers [Super High Speed]', category: 'followers', rate: 408.00, min: 100, max: 1000000, platform: 'x' },
      { service: '4374', name: 'X / Twitter Likes [HQ Real]', category: 'likes', rate: 424.15, min: 10, max: 10000, platform: 'x' },
    ],
    tiktok: [
      { service: '4389', name: 'TikTok Video Views | Instant Start', category: 'views', rate: 3.40, min: 100, max: 999998, platform: 'tiktok' },
      { service: '4390', name: 'TikTok Followers [HQ + 365D Refill]', category: 'followers', rate: 382.50, min: 50, max: 1000000, platform: 'tiktok' },
    ],
  });

  // User Wallet State
  const [walletBalance, setWalletBalance] = useState(0);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(500);
  const [topupLoading, setTopupLoading] = useState(false);

  // Orders & Subscriptions Store
  const [orders, setOrders] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [liveActivities, setLiveActivities] = useState([]);
  const [liveStats, setLiveStats] = useState({ successRate: '99.8%', avgStartTime: '45 seconds' });

  // Auto-Pilot Subscription Modal State
  const [showAutoSubModal, setShowAutoSubModal] = useState(false);
  const [autoSubType, setAutoSubType] = useState('likes'); // 'likes' | 'views'
  const [autoSubUsername, setAutoSubUsername] = useState('');
  const [autoSubMin, setAutoSubMin] = useState(250);
  const [autoSubMax, setAutoSubMax] = useState(500);
  const [autoSubPosts, setAutoSubPosts] = useState(10);
  const [autoSubDelay, setAutoSubDelay] = useState(5);
  const [autoSubLoading, setAutoSubLoading] = useState(false);

  // Platform Definitions
  const platforms = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <Instagram size={18} className="text-pink-600" />,
      color: 'from-pink-500/10 to-rose-500/10',
      activeBorder: 'border-pink-500 ring-pink-500/20',
      linkPlaceholder: 'https://instagram.com/p/... or /reel/...',
      linkHint: 'Paste your Instagram Reel or Post link (Account must be Public)',
      goals: [
        { id: 'likes', label: 'Post / Reel Likes', icon: <Heart size={16} className="text-rose-500 fill-rose-500" />, desc: 'Instant HQ likes from active profiles' },
        { id: 'views', label: 'Reel Views', icon: <Eye size={16} className="text-blue-500" />, desc: 'High retention video/reel views' },
        { id: 'followers', label: 'Followers', icon: <Users size={16} className="text-purple-500" />, desc: 'Boost profile follower authority' },
      ],
      presets: [250, 500, 1000, 2500, 5000],
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: <Video size={18} className="text-red-600" />,
      color: 'from-red-500/10 to-orange-500/10',
      activeBorder: 'border-red-500 ring-red-500/20',
      linkPlaceholder: 'https://youtube.com/watch?v=... (Video URL)',
      linkHint: 'Paste your YouTube Video, Short, or Channel Link',
      goals: [
        { id: 'views', label: 'Video Views', icon: <Eye size={16} className="text-red-500" />, desc: 'High retention views to trigger algorithm' },
        { id: 'likes', label: 'Video Likes', icon: <Heart size={16} className="text-rose-500 fill-rose-500" />, desc: 'Real likes for high engagement ratio' },
        { id: 'followers', label: 'Subscribers', icon: <Users size={16} className="text-purple-500" />, desc: 'Permanent channel subscribers' },
      ],
      presets: [500, 1000, 2500, 5000, 10000],
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      icon: <Twitter size={18} className="text-sky-500" />,
      color: 'from-sky-500/10 to-blue-500/10',
      activeBorder: 'border-sky-500 ring-sky-500/20',
      linkPlaceholder: 'https://x.com/username/status/... (Tweet URL)',
      linkHint: 'Paste the direct URL to your Tweet/Post',
      goals: [
        { id: 'likes', label: 'Tweet Likes', icon: <Heart size={16} className="text-rose-500 fill-rose-500" />, desc: 'High quality real likes for instant velocity' },
        { id: 'views', label: 'Tweet Impressions', icon: <Eye size={16} className="text-blue-500" />, desc: 'Boost tweet impression counters' },
        { id: 'followers', label: 'Followers', icon: <Users size={16} className="text-purple-500" />, desc: 'Grow account authority & followers' },
      ],
      presets: [250, 500, 1000, 2500, 5000],
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: <Music size={18} className="text-cyan-600" />,
      color: 'from-cyan-500/10 to-teal-500/10',
      activeBorder: 'border-cyan-500 ring-cyan-500/20',
      linkPlaceholder: 'https://tiktok.com/@user/video/... (Video URL)',
      linkHint: 'Paste your TikTok Video or Profile URL',
      goals: [
        { id: 'views', label: 'Video Views', icon: <Eye size={16} className="text-blue-500" />, desc: 'Initial velocity for TikTok FYP testing' },
        { id: 'followers', label: 'Followers', icon: <Users size={16} className="text-purple-500" />, desc: 'Boost account follower authority' },
      ],
      presets: [500, 1000, 2500, 5000, 10000],
    },
  ];

  const currentPlatform = platforms.find((p) => p.id === platform) || platforms[0];

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Just now';
    const now = new Date();
    const past = new Date(dateStr);
    const diffSec = Math.max(0, Math.floor((now - past) / 1000));
    if (diffSec < 60) return `${diffSec || 1}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  };

  const getPlatformActivityIcon = (platformStr) => {
    switch ((platformStr || '').toLowerCase()) {
      case 'youtube':
        return <Video size={13} className="text-red-600 shrink-0" />;
      case 'x':
      case 'twitter':
        return <Twitter size={13} className="text-sky-500 shrink-0" />;
      case 'tiktok':
        return <Music size={13} className="text-cyan-600 shrink-0" />;
      case 'instagram':
      default:
        return <Instagram size={13} className="text-pink-600 shrink-0" />;
    }
  };

  const orderStats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((o) => (o.status || '').toLowerCase() === 'completed').length;
    const inQueue = orders.filter((o) =>
      ['queued', 'processing', 'in_progress'].includes((o.status || '').toLowerCase())
    ).length;
    const failed = orders.filter((o) =>
      ['failed', 'canceled', 'cancelled'].includes((o.status || '').toLowerCase())
    ).length;
    const finalized = completed + failed;
    const successRate =
      finalized > 0 ? `${((completed / finalized) * 100).toFixed(1)}%` : total > 0 ? '100.0%' : '100.0%';
    return { total, completed, inQueue, failed, successRate };
  }, [orders]);

  // Fetch Services, Wallet Balance, and Orders
  const fetchData = async (force = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);

      const [sRes, wRes, oRes, subRes, actRes] = await Promise.allSettled([
        apiClient.get(`/api/smm/services${force ? '?force=true' : ''}`),
        apiClient.get('/api/smm/wallet'),
        apiClient.get('/api/smm/orders'),
        apiClient.get('/api/smm/subscriptions'),
        apiClient.get('/api/smm/live-activity'),
      ]);

      if (sRes.status === 'fulfilled' && sRes.value.data.success) {
        setServicesData(sRes.value.data.platforms || {});
      }

      if (wRes.status === 'fulfilled' && wRes.value.data.success) {
        setWalletBalance(parseFloat(wRes.value.data.wallet?.balance || 0));
      }

      if (oRes.status === 'fulfilled' && oRes.value.data.success) {
        setOrders(oRes.value.data.orders || []);
      }

      if (subRes.status === 'fulfilled' && subRes.value.data.success) {
        setSubscriptions(subRes.value.data.subscriptions || []);
      }

      if (actRes.status === 'fulfilled' && actRes.value.data.success) {
        setLiveActivities(actRes.value.data.activities || []);
        if (actRes.value.data.successRate) {
          setLiveStats({
            successRate: actRes.value.data.successRate,
            avgStartTime: actRes.value.data.avgStartTime || '45 seconds',
          });
        }
      }
    } catch (err) {
      console.error('[SocialGrowth] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to load Razorpay Script dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle Wallet Top-Up via Razorpay
  const handleTopup = async (amountToPay) => {
    const payAmount = Number(amountToPay || topupAmount);
    if (!payAmount || payAmount < 10) {
      toast.error('Minimum deposit is ₹10');
      return;
    }

    try {
      setTopupLoading(true);
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error('Razorpay SDK failed to load. Are you online?');
        return;
      }

      // 1. Create order on server
      const { data: res } = await apiClient.post('/api/smm/wallet/topup/create-order', {
        amount: payAmount,
      });

      if (!res.success || !res.order) {
        toast.error(res.error || 'Failed to initialize payment');
        return;
      }

      const { orderId, keyId } = res.order;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: keyId,
        amount: Math.round(payAmount * 100),
        currency: 'INR',
        name: 'QuickPost Wallet Top-Up',
        description: `Add ₹${payAmount.toFixed(2)} to your Social Growth balance`,
        order_id: orderId,
        handler: async function (response) {
          try {
            const verifyToast = toast.loading('Verifying payment with bank...');
            const { data: verifyRes } = await apiClient.post('/api/smm/wallet/topup/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: payAmount,
            });

            toast.dismiss(verifyToast);

            if (verifyRes.success) {
              toast.success(`🎉 ₹${payAmount} added to your wallet!`, { duration: 5000 });
              setWalletBalance(parseFloat(verifyRes.new_balance || (walletBalance + payAmount)));
              setShowTopupModal(false);
              fetchData(true);
            } else {
              toast.error(verifyRes.error || 'Payment verification failed');
            }
          } catch (vErr) {
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          email: user?.email || '',
        },
        theme: {
          color: '#000000',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        toast.error(`Payment failed: ${resp.error?.description || 'Declined by bank'}`);
      });
      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Payment initiation failed';
      toast.error(msg);
    } finally {
      setTopupLoading(false);
    }
  };

  // Match available one-time services based on Platform + Goal from Supabase
  const currentServices = servicesData[platform] || [];

  // Filter ONLY one-time services for the Boost tab (exclude auto-subscriptions)
  const availableServicesForGoal = useMemo(() => {
    return currentServices.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const cat = (s.category || '').toLowerCase();
      if (cat === 'subscriptions' || name.includes('auto ') || name.includes('auto-') || name.startsWith('auto')) {
        return false;
      }
      if (cat === selectedGoal || name.includes(selectedGoal)) return true;
      if (selectedGoal === 'followers' && (cat === 'subscribers' || name.includes('subscriber') || cat === 'followers' || name.includes('follower'))) {
        return true;
      }
      if (selectedGoal === 'views' && (cat === 'views' || name.includes('view') || cat === 'impressions' || name.includes('impression'))) {
        return true;
      }
      if (selectedGoal === 'likes' && (cat === 'likes' || name.includes('like') || cat === 'retweets' || name.includes('retweet'))) {
        return true;
      }
      return false;
    });
  }, [currentServices, selectedGoal]);

  const matchedService = useMemo(() => {
    if (selectedServiceId) {
      const found = availableServicesForGoal.find((s) => s.service === selectedServiceId);
      if (found) return found;
    }
    return availableServicesForGoal[0] || currentServices.find((s) => s.category !== 'subscriptions') || null;
  }, [availableServicesForGoal, selectedServiceId, currentServices]);

  // Dynamic Pricing Calculation (in INR)
  const totalCostINR = matchedService ? Number(((quantity / 1000) * matchedService.rate).toFixed(2)) : 0;
  const isBalanceInsufficient = walletBalance < totalCostINR;
  const balanceShortage = Number((totalCostINR - walletBalance).toFixed(2));

  const getGoalPrice = (goalId, targetPlatform = platform) => {
    const pServices = servicesData[targetPlatform] || [];
    const matchingSvcs = pServices.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const cat = (s.category || '').toLowerCase();
      if (cat === 'subscriptions' || name.includes('auto ') || name.includes('auto-') || name.startsWith('auto')) {
        return false;
      }
      if (cat === goalId || name.includes(goalId)) return true;
      if (goalId === 'followers' && (cat === 'subscribers' || name.includes('subscriber') || cat === 'followers' || name.includes('follower'))) return true;
      if (goalId === 'views' && (cat === 'views' || name.includes('view') || cat === 'impressions' || name.includes('impression'))) return true;
      if (goalId === 'likes' && (cat === 'likes' || name.includes('like') || cat === 'retweets' || name.includes('retweet'))) return true;
      return false;
    });

    if (matchingSvcs.length > 0) {
      const minRate = Math.min(...matchingSvcs.map((s) => parseFloat(s.rate) || 0));
      return `₹${minRate.toFixed(2)} / 1k`;
    }
    return null;
  };

  const getPlatformStartingPrice = (platformId) => {
    const pServices = (servicesData[platformId] || []).filter((s) => {
      const name = (s.name || '').toLowerCase();
      const cat = (s.category || '').toLowerCase();
      return cat !== 'subscriptions' && !name.includes('auto ') && !name.includes('auto-') && !name.startsWith('auto');
    });
    if (pServices.length > 0) {
      const minRate = Math.min(...pServices.map((s) => parseFloat(s.rate) || 0));
      return `From ₹${minRate.toFixed(2)}/1k`;
    }
    return null;
  };

  // Switch Platform
  const handlePlatformChange = (pId) => {
    setPlatform(pId);
    setTargetLink('');
    setSelectedServiceId('');
    const newPlatform = platforms.find((p) => p.id === pId);
    if (newPlatform && !newPlatform.goals.some((g) => g.id === selectedGoal)) {
      setSelectedGoal(newPlatform.goals[0].id);
    }
  };

  // Launch Order
  const handleLaunchOrder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!matchedService) {
      toast.error('Service is currently unavailable. Please try again.');
      return;
    }
    if (!targetLink.trim()) {
      toast.error('Please paste your post or profile link.');
      return;
    }

    if (isBalanceInsufficient) {
      toast.error(`Insufficient balance. Please add ₹${balanceShortage} to proceed.`);
      setTopupAmount(Math.max(100, Math.ceil(balanceShortage)));
      setShowTopupModal(true);
      return;
    }

    try {
      setSubmitting(true);
      const res = await apiClient.post('/api/smm/orders', {
        service_id: matchedService.service,
        link: targetLink.trim(),
        quantity: Number(quantity),
      });

      if (res.data.success) {
        toast.success(`🎉 Boost launched! Queued for instant delivery.`, { duration: 5000 });
        setTargetLink('');
        if (typeof res.data.new_balance === 'number') {
          setWalletBalance(res.data.new_balance);
        }
        fetchData(false);
        setActiveTab('history');
      } else {
        toast.error(res.data.error || 'Failed to place order.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Order failed';
      toast.error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Instagram Auto-Boost Subscription
  const handleCreateAutoSubscription = async (e) => {
    e.preventDefault();
    if (!autoSubUsername.trim()) {
      toast.error('Please enter your Instagram username');
      return;
    }

    const igServices = servicesData.instagram || [];
    const autoService =
      igServices.find((s) =>
        autoSubType === 'views'
          ? (s.category === 'subscriptions' || s.name.toLowerCase().includes('auto')) && s.name.toLowerCase().includes('view')
          : (s.category === 'subscriptions' || s.name.toLowerCase().includes('auto')) && s.name.toLowerCase().includes('like')
      ) ||
      igServices.find((s) => s.category === 'subscriptions' || s.name.toLowerCase().includes('auto')) ||
      igServices[0];

    if (!autoService) {
      toast.error(`Auto-${autoSubType} service currently unavailable`);
      return;
    }

    const minLimit = autoService.min || (autoSubType === 'views' ? 100 : 50);
    const maxLimit = autoService.max || 1000000;

    if (Number(autoSubMin) < minLimit) {
      toast.error(`Minimum ${autoSubType} per post is ${minLimit}. Please adjust Min.`);
      return;
    }

    if (Number(autoSubMax) > maxLimit) {
      toast.error(`Maximum ${autoSubType} per post is ${maxLimit}.`);
      return;
    }

    if (Number(autoSubMin) > Number(autoSubMax)) {
      toast.error('Min quantity cannot be greater than Max quantity.');
      return;
    }

    const subTotalCost = Number(((autoSubPosts * autoSubMax / 1000) * autoService.rate).toFixed(2));
    if (walletBalance < subTotalCost) {
      toast.error(`Insufficient balance (Requires ₹${subTotalCost}). Please top up first.`);
      setTopupAmount(Math.max(100, Math.ceil(subTotalCost - walletBalance)));
      setShowTopupModal(true);
      return;
    }

    try {
      setAutoSubLoading(true);
      const res = await apiClient.post('/api/smm/subscription', {
        service: autoService.service,
        serviceName: autoService.name,
        username: autoSubUsername.trim(),
        min: Number(autoSubMin),
        max: Number(autoSubMax),
        posts: Number(autoSubPosts),
        delay: Number(autoSubDelay),
        pricePerK: autoService.rate,
      });

      if (res.data.success) {
        toast.success(`✨ Auto-${autoSubType === 'views' ? 'Views' : 'Likes'} active on @${autoSubUsername} for next ${autoSubPosts} posts!`);
        setShowAutoSubModal(false);
        if (typeof res.data.new_balance === 'number') {
          setWalletBalance(res.data.new_balance);
        }
        fetchData(false);
      } else {
        toast.error(res.data.error || 'Failed to activate subscription');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Subscription failed';
      toast.error(msg);
    } finally {
      setAutoSubLoading(false);
    }
  };

  // Cancel an active Auto-Pilot subscription with pro-rata refund
  const handleCancelSubscription = async (subId) => {
    if (!window.confirm('Cancel this Auto-Pilot rule? Any unused posts will be immediately refunded back to your wallet.')) {
      return;
    }
    try {
      const res = await apiClient.delete(`/api/smm/subscription/${subId}`);
      if (res.data.success) {
        toast.success(res.data.message);
        if (typeof res.data.new_balance === 'number') {
          setWalletBalance(res.data.new_balance);
        }
        fetchData(false);
      } else {
        toast.error(res.data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to cancel subscription');
    }
  };

  const instagramAccounts = connectedAccounts?.instagramAccounts || [];

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#111111] pb-24 antialiased">
      {/* ── TOP HERO BAR ── */}
      <div className="border-b border-black/10 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--arc)] text-white flex items-center justify-center font-bold shadow-xs">
              <TrendingUp size={18} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-[var(--ink)] leading-none flex items-center gap-2">
                <span>GAP SocialGrowth</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                  Live
                </span>
              </h1>
              <p className="text-xs text-[var(--slate)] mt-0.5">High-Speed Social Reach & Auto-Boost Engine</p>
            </div>
          </div>

          {/* Wallet Balance & Add Funds CTA */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#f8f7f4] border border-black/10 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
              <Wallet size={15} className="text-emerald-600" />
              <span>Balance:</span>
              <span className="font-black text-emerald-700 text-sm">₹{walletBalance.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setTopupAmount(500);
                setShowTopupModal(true);
              }}
              className="px-3.5 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus size={14} /> Add Funds
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN DASHBOARD CONTAINER ── */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-start gap-2 bg-white border border-black/10 p-1.5 rounded-2xl shadow-xs mb-6 max-w-xl">
          <button
            type="button"
            onClick={() => setActiveTab('boost')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'boost'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-50'
            }`}
          >
            <Zap size={15} className={activeTab === 'boost' ? 'text-amber-400 fill-amber-400' : ''} />
            <span>1. Boost a Post</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-50'
            }`}
          >
            <History size={15} />
            <span>2. Orders & Queue</span>
            {orders.length > 0 && (
              <span className="px-1.5 py-0.2 bg-gray-200 text-gray-800 text-[11px] font-black rounded-full">
                {orders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('autopilot')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'autopilot'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-600 hover:text-black hover:bg-gray-50'
            }`}
          >
            <Sliders size={15} />
            <span>3. Auto-Pilot</span>
            {subscriptions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[11px] font-black rounded-full">
                {subscriptions.length}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            FLOW 1: BOOST A POST (2-COLUMN HIGH-CONVERTING LAYOUT)
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'boost' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* ── LEFT COLUMN (65% width): CONFIGURATION FORM ── */}
            <div className="lg:col-span-8 space-y-6">
              {/* STEP 1: Select Platform */}
              <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--arc)]">
                    Step 1 • Choose Platform
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Select destination network</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {platforms.map((p) => {
                    const active = platform === p.id;
                    const startPrice = getPlatformStartingPrice(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePlatformChange(p.id)}
                        className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-2 ${
                          active
                            ? 'border-black bg-black text-white shadow-sm ring-2 ring-black/10'
                            : 'border-black/10 bg-[#fbfaf8] hover:border-black/30 hover:bg-white text-gray-800'
                        }`}
                      >
                        <div className={`p-2.5 rounded-xl ${active ? 'bg-white/20 text-white' : 'bg-white text-gray-800 border border-black/5 shadow-2xs'}`}>
                          {p.icon}
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-bold block">{p.name}</span>
                          {startPrice && (
                            <span className={`text-[10px] font-semibold mt-0.5 block ${active ? 'text-gray-300' : 'text-emerald-700'}`}>
                              {startPrice}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: Select Goal */}
              <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--arc)]">
                    Step 2 • What do you want to boost?
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Target metric & live pricing</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {currentPlatform.goals.map((goal) => {
                    const active = selectedGoal === goal.id;
                    const goalPrice = getGoalPrice(goal.id);
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => setSelectedGoal(goal.id)}
                        className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 ${
                          active
                            ? 'border-[var(--arc)] bg-orange-50/40 ring-1 ring-orange-500/30 shadow-xs'
                            : 'border-black/10 bg-[#fbfaf8] hover:border-black/30 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="p-2 rounded-xl bg-white border border-black/5 shadow-2xs">
                            {goal.icon}
                          </div>
                          {goalPrice && (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs rounded-lg shadow-2xs">
                              {goalPrice}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">{goal.label}</span>
                            {active && (
                              <span className="text-[11px] font-black text-[var(--arc)]">✓ Selected</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 leading-snug">{goal.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 3: Link, Variant & Quantity */}
              <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--arc)]">
                    Step 3 • Link & Quantity
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Public link configuration</span>
                </div>

                {/* Service Variant Selector (if multiple available) */}
                {availableServicesForGoal.length > 1 && (
                  <div className="space-y-1.5 p-3.5 bg-[#fbfaf8] border border-black/10 rounded-2xl">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Server Quality Tier</span>
                      <span className="text-xs font-semibold text-emerald-700">Instant Server Connection</span>
                    </label>
                    <select
                      value={matchedService?.service || ''}
                      onChange={(e) => setSelectedServiceId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-black/10 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      {availableServicesForGoal.map((s) => (
                        <option key={s.service} value={s.service}>
                          {s.name} — ₹{s.rate.toFixed(2)} / 1,000
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Public Requirement Alert Notice */}
                <div className="flex items-start gap-2.5 p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-xs text-amber-950 leading-relaxed">
                  <span className="text-base shrink-0">🔒</span>
                  <div>
                    <strong className="font-bold text-amber-950">Target Account Must Be Public:</strong> Your {currentPlatform.name} account and post/reel must be set to <strong>Public</strong>. Private accounts cannot receive delivery from high-speed bots and will be rejected.
                  </div>
                </div>

                {/* URL Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-gray-800">
                    <label htmlFor="post-url-input">Target URL / Link</label>
                    {platform === 'instagram' && instagramAccounts.length > 0 && selectedGoal === 'followers' && (
                      <button
                        type="button"
                        onClick={() => setTargetLink(`https://instagram.com/${instagramAccounts[0].username}`)}
                        className="text-xs text-indigo-600 hover:underline font-extrabold flex items-center gap-1"
                      >
                        Use @{instagramAccounts[0].username}
                      </button>
                    )}
                  </div>
                  <input
                    id="post-url-input"
                    type="text"
                    placeholder={
                      selectedGoal === 'followers'
                        ? 'https://instagram.com/username (Profile Link)'
                        : selectedGoal === 'views'
                        ? 'https://instagram.com/reel/... (Reel / Video URL)'
                        : currentPlatform.linkPlaceholder
                    }
                    value={targetLink}
                    onChange={(e) => setTargetLink(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-[#fbfaf8] border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black font-medium"
                    required
                  />

                  {/* Inline Warning for Profile URL entered when Likes/Views selected */}
                  {platform === 'instagram' &&
                    ['likes', 'views'].includes(selectedGoal) &&
                    targetLink.trim().length > 0 &&
                    !targetLink.includes('/p/') &&
                    !targetLink.includes('/reel/') &&
                    !targetLink.includes('/reels/') &&
                    !targetLink.includes('/stories/') &&
                    targetLink.includes('instagram.com/') && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>
                          You selected <strong>{selectedGoal === 'likes' ? 'Likes' : 'Views'}</strong>. Please paste a direct <strong>Reel or Post link</strong> (e.g. <code>/reel/ABC...</code> or <code>/p/ABC...</code>), not a profile link.
                        </span>
                      </div>
                    )}

                  <p className="text-xs text-gray-500">
                    {selectedGoal === 'followers'
                      ? 'Paste your public Profile URL (e.g. https://instagram.com/username)'
                      : selectedGoal === 'views'
                      ? 'Paste your public Reel or Video link (e.g. https://instagram.com/reel/...)'
                      : currentPlatform.linkHint}
                  </p>
                </div>

                {/* Quantity Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-gray-800">
                    <label>Select Quantity</label>
                    <span className="text-xs text-gray-600 font-bold">
                      Rate: {matchedService ? `₹${matchedService.rate.toFixed(2)}` : '₹0'} / 1,000
                    </span>
                  </div>

                  {/* Preset Chips */}
                  <div className="grid grid-cols-5 gap-2">
                    {currentPlatform.presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setQuantity(preset);
                          setCustomQty(false);
                        }}
                        className={`py-2.5 rounded-xl text-xs sm:text-sm font-bold border transition ${
                          quantity === preset && !customQty
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-[#fbfaf8] text-gray-700 border-black/10 hover:bg-white'
                        }`}
                      >
                        {preset >= 1000 ? `${preset / 1000}k` : preset}
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div className="pt-1">
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(Number(e.target.value));
                        setCustomQty(true);
                      }}
                      min={matchedService?.min || 10}
                      max={matchedService?.max || 1000000}
                      className="w-full px-4 py-2.5 text-sm bg-[#fbfaf8] border border-black/10 rounded-xl font-bold"
                      placeholder="Enter custom quantity..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (35% width): STICKY LIVE RECEIPT & CHECKOUT CARD ── */}
            <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
              <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[var(--arc)]" />
                    <h3 className="font-bold text-gray-900 text-sm">Order Summary</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-black rounded-full border border-emerald-200">
                    ⚡ Instant Queue
                  </span>
                </div>

                {/* Visual Order Card Preview */}
                <div className="p-3.5 bg-[#fbfaf8] border border-black/5 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Platform</span>
                    <span className="font-bold text-gray-900 capitalize flex items-center gap-1.5">
                      {currentPlatform.icon} {currentPlatform.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Service</span>
                    <span className="font-bold text-gray-900 truncate max-w-[160px]">
                      {matchedService?.name || 'Standard Boost'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Target</span>
                    <span className="font-bold text-gray-900 truncate max-w-[160px]">
                      {targetLink.trim() ? targetLink.slice(0, 24) + '...' : '(Enter link on left)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500">
                    <span>Quantity</span>
                    <span className="font-bold text-black text-sm">{quantity.toLocaleString()} units</span>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Unit Rate</span>
                    <span>₹{matchedService ? matchedService.rate.toFixed(2) : '0.00'} / 1k</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Estimated Delivery</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Clock size={12} /> ~15 - 45 mins
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-base font-black text-black pt-2 border-t border-black/5">
                    <span>Total Amount</span>
                    <span className="text-xl font-black text-black">₹{totalCostINR.toFixed(2)}</span>
                  </div>
                </div>

                {/* Wallet Balance Status */}
                <div className="p-3 bg-[#fbfaf8] border border-black/5 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Your Wallet:</span>
                    <span className={`font-black ${isBalanceInsufficient ? 'text-red-600' : 'text-emerald-700'}`}>
                      ₹{walletBalance.toFixed(2)}
                    </span>
                  </div>
                  {isBalanceInsufficient && (
                    <p className="text-[11px] text-red-600 font-bold">
                      ⚠️ Short by ₹{balanceShortage}. Top-up required.
                    </p>
                  )}
                </div>

                {/* Main Action Button */}
                <button
                  type="button"
                  onClick={handleLaunchOrder}
                  disabled={submitting || !matchedService}
                  className={`w-full py-3.5 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 ${
                    isBalanceInsufficient ? 'bg-black hover:bg-gray-800' : 'bg-[var(--arc)] hover:opacity-90'
                  }`}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Placing Order...
                    </>
                  ) : isBalanceInsufficient ? (
                    <>
                      <Plus size={16} /> Add ₹{Math.max(100, Math.ceil(balanceShortage))} & Boost
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Launch Boost • ₹{totalCostINR.toFixed(2)}
                    </>
                  )}
                </button>

                {/* Security & Reliability Badges */}
                <div className="space-y-2 pt-2 border-t border-black/5 text-[11px] text-gray-500">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold">Automatic 100% wallet refund if delivery fails</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock size={14} className="text-emerald-600 shrink-0" />
                    <span>Public links only • Zero passwords ever required</span>
                  </div>
                </div>
              </div>

              {/* ── LIVE ACTIVITY & SOCIAL PROOF WIDGET (Eliminates Empty Space) ── */}
              <div className="bg-white border border-black/10 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Platform Activity
                  </span>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {liveStats.successRate} Success Rate
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {liveActivities && liveActivities.length > 0 ? (
                    liveActivities.slice(0, 4).map((act) => (
                      <div
                        key={act.id}
                        className="p-2.5 bg-[#fbfaf8] border border-black/5 rounded-xl flex items-center justify-between transition-all hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getPlatformActivityIcon(act.platform)}
                          <span className="text-gray-700 truncate font-medium">
                            {act.quantity ? Number(act.quantity).toLocaleString() : ''} {act.serviceLabel || 'Boost'} • <span className="text-gray-500">{act.targetTag || 'Media'}</span>
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold shrink-0 ml-2">
                          {formatTimeAgo(act.createdAt)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 bg-[#fbfaf8] border border-black/5 rounded-xl text-center text-xs text-gray-500 space-y-1">
                      <div className="flex items-center justify-center gap-1.5 font-semibold text-emerald-600">
                        <CheckCircle2 size={13} />
                        <span>High-Speed Queue Active</span>
                      </div>
                      <p className="text-[10px] text-gray-400">Ready to fulfill incoming broadcasts</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Average start time: <strong className="text-gray-700 font-bold">{liveStats.avgStartTime}</strong></span>
                  <span className="text-[var(--arc)] font-bold">Instant API</span>
                </div>
              </div>

              {/* ── PRO CREATOR ALGORITHM TIP ── */}
              <div className="p-4 bg-gradient-to-br from-orange-50/80 to-amber-50/40 border border-orange-200/60 rounded-2xl space-y-1.5 text-xs text-orange-950">
                <div className="flex items-center gap-1.5 font-bold text-orange-900">
                  <Zap size={14} className="text-[var(--arc)] fill-[var(--arc)]" />
                  <span>Pro Tip for Algorithmic Reach</span>
                </div>
                <p className="text-[11px] text-orange-900/80 leading-relaxed">
                  Boosting within the first <strong>30 minutes</strong> of publishing signals high velocity to the recommendation engine, increasing Explore page impressions by up to <strong>3.4x</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            FLOW 2: ORDER TRACKING (LIVE DATABASE & QUEUE SYNC)
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Your Growth Orders</h3>
                <p className="text-xs text-gray-500">Live background queue and delivery progress</p>
              </div>

              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin text-emerald-600' : ''} /> Refresh
              </button>
            </div>

            {/* Live Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-[#fbfaf8] border border-black/10 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-emerald-600" />
                  Success Rate
                </div>
                <div className="text-lg sm:text-xl font-black text-emerald-600 mt-1">
                  {orderStats.successRate}
                </div>
                <div className="text-[10px] text-gray-400 font-medium">Delivery completion</div>
              </div>

              <div className="p-3.5 bg-[#fbfaf8] border border-black/10 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  Completed
                </div>
                <div className="text-lg sm:text-xl font-black text-gray-900 mt-1">
                  {orderStats.completed}
                </div>
                <div className="text-[10px] text-gray-400 font-medium">Fulfilled boosts</div>
              </div>

              <div className="p-3.5 bg-[#fbfaf8] border border-black/10 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} className="text-blue-600" />
                  In Queue
                </div>
                <div className="text-lg sm:text-xl font-black text-blue-600 mt-1">
                  {orderStats.inQueue}
                </div>
                <div className="text-[10px] text-gray-400 font-medium">Live processing</div>
              </div>

              <div className="p-3.5 bg-[#fbfaf8] border border-black/10 rounded-xl">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History size={12} className="text-gray-600" />
                  Total Orders
                </div>
                <div className="text-lg sm:text-xl font-black text-gray-900 mt-1">
                  {orderStats.total}
                </div>
                <div className="text-[10px] text-gray-400 font-medium">All-time count</div>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="py-14 text-center text-xs text-gray-400 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 border">
                  <History size={20} />
                </div>
                <div className="font-bold text-gray-800 text-sm">No Orders Placed Yet</div>
                <p className="text-xs text-gray-500">
                  Boost your first post in the &quot;1. Boost a Post&quot; tab to see live delivery here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 bg-[#fbfaf8] border border-black/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-900 text-sm">#{ord.provider_order_id || ord.id.slice(0, 8)}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase ${
                            ord.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ord.status === 'failed' || ord.status === 'canceled'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-gray-700 font-medium truncate max-w-md">
                        {ord.sg_services?.name || `Service ID #${ord.service_id}`}
                      </div>
                      <div className="text-gray-500 truncate">
                        <a href={ord.target_link} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                          {ord.target_link} <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>

                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-sm font-black text-gray-900">{ord.quantity.toLocaleString()} qty</div>
                      <div className="font-bold text-emerald-700">₹{parseFloat(ord.total_cost || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            FLOW 3: AUTO-PILOT (TELE SMM NATIVE SUBSCRIPTIONS)
           ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'autopilot' && (
          <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Instagram Auto-Boost</h3>
                <p className="text-xs text-gray-500">Automatically deliver likes/views when you post from your phone</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAutoSubModal(true)}
                className="px-3.5 py-1.5 bg-[var(--arc)] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                <Plus size={14} /> New Auto-Boost
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="py-14 text-center text-xs text-gray-400 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 border">
                  <Sliders size={20} />
                </div>
                <div className="font-bold text-gray-800 text-sm">No Active Subscriptions</div>
                <p className="text-xs text-gray-500">
                  Click &quot;+ New Auto-Boost&quot; to monitor your Instagram page and auto-boost future Reels.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="p-4 bg-[#fbfaf8] border border-black/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                        <Instagram size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span>@{sub.username}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase ${
                              sub.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.status === 'Completed'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        <div className="text-gray-500">
                          {sub.type === 'auto_views' ? '👁️ Auto Views' : '💖 Auto Likes'} • {sub.max_quantity || sub.min_quantity} per post
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <div className="font-black text-gray-900 text-sm">
                          {sub.posts_remaining} / {sub.posts_total} posts left
                        </div>
                        <div className="text-xs text-emerald-700 font-bold">
                          ₹{parseFloat(sub.total_charged || 0).toFixed(2)} total
                        </div>
                      </div>

                      {sub.status === 'Active' && (
                        <button
                          type="button"
                          onClick={() => handleCancelSubscription(sub.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                        >
                          <Trash2 size={13} /> Stop Rule
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 1: RAZORPAY WALLET TOP-UP
         ═══════════════════════════════════════════════════════════════ */}
      {showTopupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-black/10 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-emerald-600" />
                <h3 className="font-bold text-gray-900 text-base">Top-Up Wallet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTopupModal(false)}
                className="text-gray-400 hover:text-black font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Add funds via UPI (GPay, PhonePe, Paytm), NetBanking, or Credit/Debit Card.
              </p>

              {/* Amount Presets */}
              <div className="grid grid-cols-3 gap-2">
                {[100, 250, 500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition ${
                      topupAmount === amt
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-[#fbfaf8] hover:bg-gray-100 text-gray-800 border-black/10'
                    }`}
                  >
                    + ₹{amt}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Custom Amount (₹)</label>
                <input
                  type="number"
                  min="10"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-[#fbfaf8] border border-black/10 rounded-xl font-black text-base"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleTopup(topupAmount)}
                disabled={topupLoading || topupAmount < 10}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {topupLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Initializing Gateway...
                  </>
                ) : (
                  <>
                    Pay ₹{topupAmount} via UPI / Cards <ArrowUpRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          MODAL 2: NEW INSTAGRAM AUTO-BOOST SUBSCRIPTION
         ═══════════════════════════════════════════════════════════════ */}
      {showAutoSubModal && (() => {
        const igServices = servicesData.instagram || [];
        const currentAutoService =
          igServices.find((s) =>
            autoSubType === 'views'
              ? (s.category === 'subscriptions' || s.name.toLowerCase().includes('auto')) && s.name.toLowerCase().includes('view')
              : (s.category === 'subscriptions' || s.name.toLowerCase().includes('auto')) && s.name.toLowerCase().includes('like')
          ) || { rate: autoSubType === 'views' ? 0.04 : 0.18, name: autoSubType === 'views' ? 'Instagram Auto Views' : 'Instagram Auto Likes' };
        
        const minLimit = currentAutoService.min || (autoSubType === 'views' ? 100 : 50);
        const estTotalCost = Number(((autoSubPosts * autoSubMax / 1000) * (currentAutoService.rate || 0.18)).toFixed(2));

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleCreateAutoSubscription}
              className="bg-white rounded-2xl p-6 max-w-md w-full border border-black/10 shadow-2xl space-y-4 text-xs sm:text-sm"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <Instagram size={18} className="text-pink-600" />
                  <h3 className="font-bold text-gray-900 text-base">New Instagram Auto-Pilot</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAutoSubModal(false)}
                  className="text-gray-400 hover:text-black font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              {/* Goal Type Switcher (Likes vs Views) */}
              <div className="grid grid-cols-2 gap-2 bg-[#f8f7f4] p-1 rounded-xl border border-black/10">
                <button
                  type="button"
                  onClick={() => {
                    setAutoSubType('likes');
                    setAutoSubMin(250);
                    setAutoSubMax(500);
                  }}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
                    autoSubType === 'likes'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <Heart size={14} className={autoSubType === 'likes' ? 'text-rose-400 fill-rose-400' : 'text-rose-500'} />
                  <span>Auto Likes (₹0.18/1k)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAutoSubType('views');
                    setAutoSubMin(1000);
                    setAutoSubMax(2500);
                  }}
                  className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition ${
                    autoSubType === 'views'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-gray-600 hover:text-black'
                  }`}
                >
                  <Eye size={14} className={autoSubType === 'views' ? 'text-blue-400' : 'text-blue-500'} />
                  <span>Auto Views (₹0.04/1k)</span>
                </button>
              </div>

              <div className="space-y-3">
                {/* Instagram Handle */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700">Instagram Username (@handle)</label>
                    {instagramAccounts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAutoSubUsername(instagramAccounts[0].username)}
                        className="text-[11px] text-indigo-600 hover:underline font-bold"
                      >
                        Use @{instagramAccounts[0].username}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
                    <input
                      type="text"
                      placeholder="e.g. virat.kohli"
                      value={autoSubUsername}
                      onChange={(e) => setAutoSubUsername(e.target.value.replace(/^@/, ''))}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-[#fbfaf8] border border-black/10 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-black"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-gray-500">Account must be Public. Works automatically when you post from phone.</p>
                </div>

                {/* Min & Max Range with Presets and Inline Validation */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 flex items-center justify-between">
                        <span>Min {autoSubType === 'views' ? 'Views' : 'Likes'}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">Min: {minLimit}</span>
                      </label>
                      <input
                        type="number"
                        min={minLimit}
                        value={autoSubMin}
                        onChange={(e) => setAutoSubMin(Number(e.target.value))}
                        className={`w-full px-3 py-2 border rounded-xl font-bold transition ${
                          autoSubMin < minLimit
                            ? 'bg-red-50/50 border-red-400 text-red-900 focus:ring-red-400'
                            : 'bg-[#fbfaf8] border-black/10'
                        }`}
                        required
                      />
                      {autoSubMin < minLimit && (
                        <p className="text-[10px] text-red-600 font-bold">⚠️ Must be at least {minLimit}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-gray-700 flex items-center justify-between">
                        <span>Max {autoSubType === 'views' ? 'Views' : 'Likes'}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">Max: {(currentAutoService.max || 1000000).toLocaleString()}</span>
                      </label>
                      <input
                        type="number"
                        min={autoSubMin}
                        value={autoSubMax}
                        onChange={(e) => setAutoSubMax(Number(e.target.value))}
                        className={`w-full px-3 py-2 border rounded-xl font-bold transition ${
                          autoSubMax < autoSubMin
                            ? 'bg-red-50/50 border-red-400 text-red-900 focus:ring-red-400'
                            : 'bg-[#fbfaf8] border-black/10'
                        }`}
                        required
                      />
                      {autoSubMax < autoSubMin && (
                        <p className="text-[10px] text-red-600 font-bold">⚠️ Max cannot be less than Min</p>
                      )}
                    </div>
                  </div>

                  {/* Quick Preset Range Chips */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-gray-500 font-bold shrink-0">Presets:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(autoSubType === 'views'
                        ? [
                            { min: 500, max: 1000, label: '500 - 1k' },
                            { min: 1000, max: 2500, label: '1k - 2.5k' },
                            { min: 2500, max: 5000, label: '2.5k - 5k' },
                          ]
                        : [
                            { min: 100, max: 250, label: '100 - 250' },
                            { min: 250, max: 500, label: '250 - 500' },
                            { min: 500, max: 1000, label: '500 - 1k' },
                          ]
                      ).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setAutoSubMin(preset.min);
                            setAutoSubMax(preset.max);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                            autoSubMin === preset.min && autoSubMax === preset.max
                              ? 'bg-black text-white border-black shadow-2xs'
                              : 'bg-white text-gray-600 border-black/10 hover:border-black/30'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Number of Posts & Delay */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">Upcoming Posts</label>
                    <select
                      value={autoSubPosts}
                      onChange={(e) => setAutoSubPosts(Number(e.target.value))}
                      className="w-full p-2.5 bg-[#fbfaf8] border border-black/10 rounded-xl font-bold"
                    >
                      <option value={5}>Next 5 Posts</option>
                      <option value={10}>Next 10 Posts</option>
                      <option value={20}>Next 20 Posts</option>
                      <option value={30}>Next 30 Posts</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700">Delivery Delay</label>
                    {autoSubType === 'views' ? (
                      <input
                        type="text"
                        value="Instant (Starts on Upload)"
                        disabled
                        className="w-full p-2.5 bg-gray-100 text-gray-600 border border-black/10 rounded-xl font-bold cursor-not-allowed text-xs"
                      />
                    ) : (
                      <select
                        value={autoSubDelay}
                        onChange={(e) => setAutoSubDelay(Number(e.target.value))}
                        className="w-full p-2.5 bg-[#fbfaf8] border border-black/10 rounded-xl font-bold text-xs"
                      >
                        <option value={0}>Instant (0 mins)</option>
                        <option value={5}>5 Minutes (Recommended)</option>
                        <option value={10}>10 Minutes (Organic)</option>
                        <option value={15}>15 Minutes</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Price Preview Card */}
                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-emerald-900 font-bold block">
                      Max Total Cost ({autoSubPosts} posts × {autoSubMax}):
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Rate: ₹{currentAutoService.rate.toFixed(2)} / 1k
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-800">
                    ₹{estTotalCost.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutoSubModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={autoSubLoading || autoSubMin < minLimit || autoSubMax < autoSubMin}
                  className="px-5 py-2 bg-[var(--arc)] hover:opacity-90 text-white font-bold rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {autoSubLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : autoSubMin < minLimit ? (
                    `Min ${minLimit} required`
                  ) : (
                    `Activate Auto-Boost • ₹${estTotalCost.toFixed(2)}`
                  )}
                </button>
              </div>
            </form>
          </div>
        );
      })()}
    </div>
  );
}
