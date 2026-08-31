import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Search,
  Zap,
  Sparkles,
  MessageSquare,
  Users,
  Calendar,
  Send,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Flame,
  Layers,
  HelpCircle,
  CreditCard,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  FileText,
  Sliders,
  CheckSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DocsGuidePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedFaqs, setExpandedFaqs] = useState({ 0: true });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleFaq = (index) => {
    setExpandedFaqs((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const sections = [
    { id: 'overview', title: 'Platform Overview', icon: Layers },
    { id: 'modules', title: 'Core Modules & Pages', icon: FileText },
    { id: 'autodm', title: 'AutoDM Master Tour', icon: Zap },
    { id: 'contacts', title: 'Contacts CRM & Leads', icon: Users },
    { id: 'composer', title: 'Multi-Channel Composer', icon: Send },
    { id: 'trends', title: 'Trend Feed & AI Ideation', icon: Flame },
    { id: 'inbox', title: 'Social Inbox', icon: MessageSquare },
    { id: 'plans', title: 'Plans & Watermark Policy', icon: CreditCard },
    { id: 'limits', title: 'Meta Limits & Zero-Ban', icon: ShieldCheck },
    { id: 'faqs', title: 'Troubleshooting & FAQs', icon: HelpCircle },
  ];

  const playbooks = [
    {
      id: 'lead-magnet',
      title: '🎁 PDF Lead Magnet / Free Guide Funnel',
      keyword: 'guide, pdf, send',
      openingBtn: 'Download PDF Guide',
      payloadTitle: 'Here is your Free Growth Guide ✨',
      payloadText: 'Click below to download the complete 30-day playbook.\n\nEverything you need to scale from 0 to 10k followers.',
      url: 'https://drive.google.com/...',
      badge: 'POPULAR',
    },
    {
      id: 'ai-prompt',
      title: '🤖 AI Prompts & Workflow Code',
      keyword: 'prompt, code, workflow',
      openingBtn: 'Send me the prompt',
      payloadTitle: 'Your AI Automation Prompt 🚀',
      payloadText: 'Copy this prompt directly into ChatGPT / Claude:\n\n"You are an expert copywriter. Analyze my target audience and draft 5 high-converting hooks..."',
      url: 'https://getaipilot.in',
      badge: 'HIGH CONVERSION',
    },
    {
      id: 'discount-deal',
      title: '🏷️ E-Commerce Discount Code',
      keyword: 'discount, deal, coupon',
      openingBtn: 'Claim 20% Off',
      payloadTitle: 'Special VIP Offer: 20% Off 🛍️',
      payloadText: 'Use coupon code VIP20 at checkout for instant savings.\nValid for the next 24 hours only!',
      url: 'https://yourstore.com/discount?code=VIP20',
      badge: 'E-COMMERCE',
    },
  ];

  const faqs = [
    {
      q: 'Why didn’t my automation reply when I commented on my post?',
      a: 'Meta Webhooks deliberately ignore comments made by the page owner on their own post to prevent infinite feedback loops. Always test from a separate/personal Instagram account, or ask a friend to test.',
    },
    {
      q: 'I commented from a secondary account, but still received no DM. What should I check?',
      a: 'Verify these 3 checkpoints: (1) In AutoDM Automations, make sure the Active switch is ON. (2) In the Instagram mobile app, check Settings ➔ Privacy/Messages ➔ Message Controls ➔ "Allow access to messages" is toggled ON. (3) If Case Sensitive Matching is ON, make sure the exact capitalization matches.',
    },
    {
      q: 'Why is the watermark still showing up in my DMs on a paid plan?',
      a: 'Your local session needs a subscription sync. Navigate to /dashboard/billing and click the "Sync Subscription" button. The system will verify your active Hub subscription and permanently remove the watermark.',
    },
    {
      q: 'Why did my Instagram Reel or Video upload fail during publishing?',
      a: 'Check that your video is vertical 9:16 (1080x1920px), under 100MB in file size, and formatted as MP4 (H.264 / AAC). Landscape 16:9 videos cannot be published as Reels by Meta API.',
    },
    {
      q: 'Can I attach multiple keyword automations to the same Instagram post?',
      a: 'Yes! You can create multiple automations on the same post. If a user comments keywords from multiple automations, the engine processes the primary match and queues secondary sequences seamlessly.',
    },
    {
      q: 'What happens if a user spams 10 comments in a row?',
      a: 'SocialPilot includes built-in webhook deduplication and throttling. Only 1 automated sequence is dispatched per distinct conversation thread, preventing duplicate spam.',
    },
    {
      q: 'Can I send clickable links to Telegram, WhatsApp, or websites in the DM?',
      a: 'Yes! Standard HTTPS URLs (e.g. https://t.me/... or https://wa.me/...) are automatically rendered as clickable links inside Instagram DMs, or you can add Web URL Buttons on Generic Template Cards.',
    },
    {
      q: 'How do I reconnect an expired Instagram or Facebook token?',
      a: 'Go to /dashboard/connect, find the account showing "Needs Reconnect", and click "Refresh Token" (or "Connect Instagram" to re-authorize via Meta OAuth).',
    },
    {
      q: 'How do I export my captured leads to Google Sheets, Notion, or Mailchimp?',
      a: 'Navigate to /dashboard/auto-dm/contacts and click the "Export CSV" button in the top right. You can import the downloaded CSV file into any CRM or spreadsheet.',
    },
    {
      q: 'Is my data secure and compliant with Meta Platform Terms?',
      a: 'Yes. All credentials and tokens are encrypted with AES-256 in Supabase Postgres. SocialPilot uses 100% official Meta Graph APIs with zero scraping or unofficial bots.',
    },
  ];

  const filteredFaqs = useMemo(() => {
    if (!searchQuery) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero Banner */}
        <div className="rounded-3xl border border-black/10 bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-[var(--arc)]">
              <Sparkles size={13} /> Official Meta Graph API Certified
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--ink)]">
              GAP SocialPilot Documentation & User Guide
            </h1>
            <p className="text-sm sm:text-base text-[var(--slate)] leading-relaxed">
              Master high-converting Instagram AutoDM funnels, multi-channel social broadcasting, AI trend discovery, and lead generation in one unified workstation.
            </p>

            {/* Live Search Bar */}
            <div className="pt-2 max-w-xl">
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 h-4 w-4 text-[var(--slate)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search features, workflows, limits, or FAQs..."
                  className="w-full rounded-2xl border border-black/15 bg-gray-50/50 pl-10 pr-4 py-2.5 text-sm outline-none transition-all focus:border-[var(--arc)] focus:bg-white focus:ring-2 focus:ring-[var(--arc)]/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-xs font-medium text-[var(--slate)] hover:text-[var(--ink)]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Decorative Corner Icon */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 sm:opacity-20 pointer-events-none hidden sm:block">
            <BookOpen size={180} className="text-[var(--ink)]" />
          </div>
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Sticky Navigation Menu */}
          <div className="lg:col-span-3 lg:sticky lg:top-8 space-y-2 rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--slate)] px-3 py-1">Documentation Index</p>
            {sections.map(({ id, title, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveSection(id);
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left ${
                  activeSection === id
                    ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                    : 'text-[var(--slate)] hover:bg-black/5 hover:text-[var(--ink)]'
                }`}
              >
                <Icon size={16} className={activeSection === id ? 'text-[var(--arc)]' : ''} />
                <span className="truncate">{title}</span>
              </button>
            ))}

            <div className="pt-3 mt-3 border-t border-black/5">
              <button
                onClick={() => navigate('/dashboard/auto-dm/automations/new')}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--arc)] px-3 py-2 text-xs font-bold text-white transition-all hover:opacity-90 shadow-sm"
              >
                <Zap size={14} /> Create Automation
              </button>
            </div>
          </div>

          {/* Right Main Guide Area */}
          <div className="lg:col-span-9 space-y-12">

            {/* Section 1: Overview */}
            <section id="overview" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[var(--arc)]">
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--ink)]">1. Platform Overview & Architecture</h2>
                  <p className="text-xs text-[var(--slate)]">The all-in-one AI social media workstation</p>
                </div>
              </div>

              <p className="text-sm text-[var(--ink)]/80 leading-relaxed">
                <strong>GAP SocialPilot</strong> converts Instagram commenters and DM conversations into verified leads, active followers, and paying customers with official Meta Graph API automations, while streamlining social publishing across Instagram, Facebook, YouTube, and LinkedIn.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold">
                    <ShieldCheck size={16} /> 100% Zero-Ban Compliance
                  </div>
                  <p className="text-xs text-[var(--slate)] leading-relaxed">
                    Uses official OAuth 2.0 and approved Meta developer endpoints. No unauthorized scraping, browser extensions, or private APIs.
                  </p>
                </div>

                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-[var(--arc)] text-xs font-bold">
                    <Zap size={16} /> 2-Step Conversions
                  </div>
                  <p className="text-xs text-[var(--slate)] leading-relaxed">
                    Opening DM button confirmation + rich response cards with auto-chunked copy and quick-reply branching.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Core Modules */}
            <section id="modules" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--ink)]">2. Core Modules & Quick Navigation</h2>
                  <p className="text-xs text-[var(--slate)]">Every page and tool at your fingertips</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: 'AutoDM Home & Metrics',
                    path: '/dashboard/auto-dm',
                    desc: 'Real-time Sent, Seen, Clicks, and Follower conversion analytics.',
                    btn: 'Open AutoDM',
                  },
                  {
                    name: 'Automations Builder',
                    path: '/dashboard/auto-dm/automations',
                    desc: 'Visual editor for Comment-to-DM flows, follow gates, and response cards.',
                    btn: 'View Automations',
                  },
                  {
                    name: 'Contacts CRM',
                    path: '/dashboard/auto-dm/contacts',
                    desc: 'Lead directory, audience message history, and 1-click CSV export.',
                    btn: 'Open Contacts',
                  },
                  {
                    name: 'Multi-Channel Composer',
                    path: '/dashboard/compose',
                    desc: 'Post, Reel, Carousel, and YouTube Shorts creator with Smart Sizing.',
                    btn: 'Open Composer',
                  },
                  {
                    name: 'Trend Feed',
                    path: '/dashboard/trends',
                    desc: 'Infinite viral discovery from YouTube, Reddit, and Bluesky with 1-click AI Remix.',
                    btn: 'Open Trends',
                  },
                  {
                    name: 'Billing & Plan Hub',
                    path: '/dashboard/billing',
                    desc: 'Check entitlements, monthly reply counters, and Central Hub sync.',
                    btn: 'Manage Plan',
                  },
                ].map((item) => (
                  <div key={item.name} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col justify-between hover:border-black/20 transition-all">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--ink)]">{item.name}</h4>
                      <p className="text-xs text-[var(--slate)] mt-1">{item.desc}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-[var(--slate)]">{item.path}</span>
                      <button
                        onClick={() => navigate(item.path)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--arc)] hover:underline"
                      >
                        {item.btn} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section 3: AutoDM Master Tour */}
            <section id="autodm" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)]">3. AutoDM Comment-to-DM Master Tour</h2>
                    <p className="text-xs text-[var(--slate)]">Step-by-step creation and conversion playbooks</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/auto-dm/automations/new')}
                  className="rounded-xl bg-[var(--ink)] text-white px-4 py-2 text-xs font-bold hover:bg-black transition-all flex items-center gap-1.5"
                >
                  <Zap size={14} className="text-[var(--arc)]" /> New Automation
                </button>
              </div>

              {/* Step by step cards */}
              <div className="space-y-4">
                {[
                  {
                    step: '1',
                    title: 'Trigger Scope',
                    text: 'Select "All Posts/Reels" for evergreen funnels or pick a "Specific Post" for campaign-specific Reels.',
                  },
                  {
                    step: '2',
                    title: 'Keywords & Matching',
                    text: 'Enter trigger words (e.g., link, prompt, info). Suggestion pills appear when empty and auto-hide once keywords are added.',
                  },
                  {
                    step: '3',
                    title: 'Public Comment Reply',
                    text: 'Boost Instagram algorithm reach with an automated public comment reply ("Sent you the details in DM! ✨").',
                  },
                  {
                    step: '4',
                    title: 'Instagram Follow Gate',
                    text: 'Require users to follow your account before receiving value. Non-followers get an automated reminder; followers receive the DM instantly.',
                  },
                  {
                    step: '5',
                    title: 'Opening DM (Two-Step Flow)',
                    text: 'Sends an initial button message ("Click below for details" ➔ [Send me the link]) to verify user intent and open the Meta 24-hr session.',
                  },
                  {
                    step: '6',
                    title: 'Response Payload & Auto-Chunking',
                    text: 'Deliver rich text, links, or Generic Template Cards. Large prompts > 950 chars are automatically split into sequential bubbles seamlessly.',
                  },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4 p-4 rounded-2xl border border-black/5 bg-gray-50/50">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ink)] text-xs font-bold text-white flex-shrink-0">
                      {s.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--ink)]">{s.title}</h4>
                      <p className="text-xs text-[var(--slate)] mt-0.5 leading-relaxed">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ready-to-use Playbooks */}
              <div className="pt-4 border-t border-black/5 space-y-4">
                <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <Sparkles size={16} className="text-[var(--arc)]" /> Copyable High-Converting Templates
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {playbooks.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-black/10 bg-white p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-[var(--arc)] px-2 py-0.5 rounded-md">
                            {p.badge}
                          </span>
                          <button
                            onClick={() => handleCopy(`Keyword: ${p.keyword}\nOpening Button: ${p.openingBtn}\nPayload: ${p.payloadText}`, p.id)}
                            className="p-1 rounded-lg hover:bg-black/5 text-[var(--slate)]"
                            title="Copy Template"
                          >
                            {copiedId === p.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <h4 className="text-xs font-bold text-[var(--ink)]">{p.title}</h4>
                        <p className="text-[11px] text-[var(--slate)] mt-1 line-clamp-3 leading-relaxed">
                          {p.payloadText}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-[var(--slate)]">Trigger: {p.keyword.split(',')[0]}</span>
                        <span className="font-semibold text-purple-600">[{p.openingBtn}]</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Section 4: Contacts CRM */}
            <section id="contacts" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <Users size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)]">4. Contacts CRM & Lead Capturing</h2>
                    <p className="text-xs text-[var(--slate)]">Automated audience enrichment and export</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/auto-dm/contacts')}
                  className="rounded-xl border border-black/15 bg-white text-[var(--ink)] px-4 py-2 text-xs font-bold hover:bg-black/5 transition-all flex items-center gap-1.5"
                >
                  <Users size={14} /> Open Contacts Directory
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4">
                  <span className="text-xs text-[var(--slate)]">1. Auto Zero-Setup</span>
                  <p className="text-xs text-[var(--ink)] font-medium mt-1">Every commenter and DM recipient is automatically saved with profile avatar and username.</p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4">
                  <span className="text-xs text-[var(--slate)]">2. Detail Drawer</span>
                  <p className="text-xs text-[var(--ink)] font-medium mt-1">Click any contact to view full chronological message history and campaign attribution.</p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4">
                  <span className="text-xs text-[var(--slate)]">3. 1-Click CSV Export</span>
                  <p className="text-xs text-[var(--ink)] font-medium mt-1">Download contact leads with email and follower metadata for Meta Ads or email marketing.</p>
                </div>
              </div>
            </section>

            {/* Section 5: Multi-Channel Composer */}
            <section id="composer" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[var(--arc)]">
                  <Send size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--ink)]">5. Multi-Channel Composer & Publishing</h2>
                  <p className="text-xs text-[var(--slate)]">Instagram, Facebook, YouTube, and LinkedIn</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 bg-gray-50/50 text-[var(--slate)]">
                      <th className="p-3 font-bold">Platform / Type</th>
                      <th className="p-3 font-bold">Aspect Ratio</th>
                      <th className="p-3 font-bold">Max File Size</th>
                      <th className="p-3 font-bold">Max Video Length</th>
                      <th className="p-3 font-bold">Caption Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    <tr>
                      <td className="p-3 font-bold text-[var(--ink)]">Instagram Feed</td>
                      <td className="p-3">1:1 / 4:5</td>
                      <td className="p-3">8 MB (Image)</td>
                      <td className="p-3">N/A</td>
                      <td className="p-3">2,200 chars</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[var(--ink)]">Instagram Reels</td>
                      <td className="p-3">9:16 (1080x1920)</td>
                      <td className="p-3">100 MB (Video)</td>
                      <td className="p-3">15 mins</td>
                      <td className="p-3">2,200 chars</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[var(--ink)]">Instagram Carousel</td>
                      <td className="p-3">2–10 items</td>
                      <td className="p-3">8 MB img / 100 MB vid</td>
                      <td className="p-3">60s / slide</td>
                      <td className="p-3">2,200 chars</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[var(--ink)]">YouTube Shorts</td>
                      <td className="p-3">9:16</td>
                      <td className="p-3">256 GB</td>
                      <td className="p-3">≤ 60 seconds</td>
                      <td className="p-3">Title: 100 / Desc: 5k</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 6: Trend Feed */}
            <section id="trends" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                    <Flame size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)]">6. Trend Feed & 1-Click AI Ideation</h2>
                    <p className="text-xs text-[var(--slate)]">Discover viral hooks from YouTube, Reddit, and Bluesky</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/trends')}
                  className="rounded-xl bg-[var(--ink)] text-white px-4 py-2 text-xs font-bold hover:bg-black transition-all flex items-center gap-1.5"
                >
                  <Flame size={14} className="text-[var(--arc)]" /> Explore Trend Feed
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4 space-y-2">
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--arc)]" /> 1-Click AI Remix
                  </div>
                  <p className="text-xs text-[var(--slate)] leading-relaxed">
                    Click the Sparkle button on any trending post to auto-generate a fresh, original script and open the Composer with prefilled copy!
                  </p>
                </div>
                <div className="rounded-2xl border border-black/5 bg-gray-50/70 p-4 space-y-2">
                  <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-2">
                    <Layers size={14} className="text-blue-600" /> Never-Repeat Algorithm
                  </div>
                  <p className="text-xs text-[var(--slate)] leading-relaxed">
                    Tracks seen posts per user session so you always discover fresh viral content every time you scroll.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 7: Plans & Watermarks */}
            <section id="plans" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)]">7. Subscription Plans, Quotas & Watermarks</h2>
                    <p className="text-xs text-[var(--slate)]">Entitlements and Central Hub sync</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/billing')}
                  className="rounded-xl border border-black/15 bg-white text-[var(--ink)] px-4 py-2 text-xs font-bold hover:bg-black/5 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw size={14} /> Sync Subscription
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-3">
                  <span className="text-xs font-bold text-[var(--slate)] uppercase">Free Tier</span>
                  <div className="text-2xl font-bold text-[var(--ink)]">₹0</div>
                  <ul className="text-xs text-[var(--slate)] space-y-2 pt-2 border-t border-black/5">
                    <li>• 3 Connected Accounts</li>
                    <li>• 50 AutoDMs / month</li>
                    <li>• 1 Active Automation</li>
                    <li className="text-amber-700 font-medium">• Watermark on DMs</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-5 space-y-3">
                  <span className="text-xs font-bold text-[var(--arc)] uppercase">Starter / Lite</span>
                  <div className="text-2xl font-bold text-[var(--ink)]">₹999<span className="text-xs font-normal text-[var(--slate)]">/mo</span></div>
                  <ul className="text-xs text-[var(--slate)] space-y-2 pt-2 border-t border-black/5">
                    <li>• 10 Connected Accounts</li>
                    <li>• Unlimited AutoDMs</li>
                    <li>• Unlimited Automations</li>
                    <li className="text-emerald-600 font-bold">• 100% NO Watermark</li>
                  </ul>
                </div>

                <div className="rounded-2xl border-2 border-[var(--arc)] bg-orange-50/20 p-5 space-y-3">
                  <span className="text-xs font-bold text-[var(--arc)] uppercase">Growth / Custom Bundle</span>
                  <div className="text-2xl font-bold text-[var(--ink)]">₹1,999<span className="text-xs font-normal text-[var(--slate)]">/mo</span></div>
                  <ul className="text-xs text-[var(--slate)] space-y-2 pt-2 border-t border-black/5">
                    <li>• 30 Connected Accounts</li>
                    <li>• Unlimited AutoDMs & Automations</li>
                    <li>• 10 Team Members & API</li>
                    <li className="text-emerald-600 font-bold">• 100% NO Watermark</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 8: Meta Limits & Zero-Ban */}
            <section id="limits" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--ink)]">8. Meta API Limits & Zero-Ban Safeguards</h2>
                  <p className="text-xs text-[var(--slate)]">Strict official compliance</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-[var(--slate)] leading-relaxed">
                <div className="p-3 rounded-xl border border-black/5 bg-gray-50/50">
                  <strong className="text-[var(--ink)]">1. The 24-Hour Messaging Rule:</strong> Automations reply immediately within Meta's 24-hour interaction window. Tapping any button in the DM resets the window for another 24 hours.
                </div>
                <div className="p-3 rounded-xl border border-black/5 bg-gray-50/50">
                  <strong className="text-[var(--ink)]">2. 1,000 Char Limit:</strong> Messages longer than 950 characters are automatically split at sentence/paragraph breaks and delivered as readable sequential bubbles.
                </div>
                <div className="p-3 rounded-xl border border-black/5 bg-gray-50/50">
                  <strong className="text-[var(--ink)]">3. Self-Comment Filter:</strong> Comments made by your own account are filtered out to prevent infinite reply loops. Always test from a personal/secondary handle.
                </div>
              </div>
            </section>

            {/* Section 9: FAQs */}
            <section id="faqs" className="rounded-3xl border border-black/10 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--ink)]">9. Troubleshooting & Frequently Asked Questions</h2>
                  <p className="text-xs text-[var(--slate)]">Quick solutions to common questions</p>
                </div>
              </div>

              <div className="space-y-3">
                {filteredFaqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-black/10 bg-white overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full flex items-center justify-between p-4 text-left text-xs sm:text-sm font-bold text-[var(--ink)] hover:bg-gray-50/50 transition-colors"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        size={16}
                        className={`text-[var(--slate)] transition-transform duration-200 flex-shrink-0 ml-2 ${
                          expandedFaqs[idx] ? 'rotate-180 text-[var(--arc)]' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {expandedFaqs[idx] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-black/5 p-4 text-xs text-[var(--slate)] leading-relaxed bg-gray-50/30"
                        >
                          {faq.a}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  );
}
