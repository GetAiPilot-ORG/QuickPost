import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  AtSign,
  Clock,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  Instagram,
  Layers,
  Loader2,
  MessageCircle,
  MousePointer,
  Pencil,
  Play,
  Plus,
  Radio,
  Save,
  Trash2,
  Type,
  Video,
  X,
  Zap,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAutoDM } from '../../context/AutoDMContext';
import { KeywordInput } from '../../features/autodm/KeywordInput';

import ResponseFlowBuilder from '../../features/autodm/ResponseFlowBuilder';
import MobilePreview from './MobilePreview';


const triggerTypes = [
  {
    value: 'comment_on_post',
    label: 'User comments on your post',
    icon: Instagram,
    description: 'Trigger when someone comments on one of your Instagram posts',
    available: true,
  },
  {
    value: 'comment_on_reel',
    label: 'User comments on your reel',
    icon: Instagram,
    description: 'Trigger when someone comments on one of your Instagram reels',
    available: true,
  },
  {
    value: 'dm_received',
    label: 'User DMs to you',
    icon: MessageCircle,
    description: 'Trigger when you receive a direct message',
    available: true,
  },
  {
    value: 'live_comment',
    label: 'User Comments on your LIVE',
    icon: Video,
    description: 'Trigger when someone comments during your live stream',
    available: true,
  },
  {
    value: 'story_reply',
    label: 'User replies to your stories',
    icon: Radio,
    description: 'Trigger when someone replies to your story',
    available: true,
  },
  {
    value: 'story_mention',
    label: 'User mentions you in story',
    icon: AtSign,
    description: 'Trigger when someone mentions you in their story',
    available: false,
  },
];

const responseTypes = [
  { type: 'text', label: 'Text Message', shortLabel: 'Text', icon: Type, description: 'Send a simple text message' },
  { type: 'image', label: 'Image', shortLabel: 'Image', icon: ImageIcon, description: 'Send an image with optional text' },
  { type: 'card', label: 'Card', shortLabel: 'Card', icon: FileText, description: 'Rich card with image, title, and buttons' },
  { type: 'carousel', label: 'Carousel', shortLabel: 'Carousel', icon: Layers, description: 'Multiple cards in a swipeable carousel' },
  { type: 'buttons', label: 'Buttons', shortLabel: 'Buttons', icon: MousePointer, description: 'Quick reply buttons or links' },
  { type: 'lead_form', label: 'Lead Form', shortLabel: 'Lead Form', icon: FileText, description: 'Capture lead information' },
  { type: 'delay', label: 'Delay', shortLabel: 'Delay', icon: Clock, description: 'Wait before sending next message' },
];

const defaultResponseFlow = {
  nodes: [
    {
      id: 'starter-text',
      type: 'text',
      content: 'Hey there! I\'m so happy you\'re here, thanks so much for your interest 😄\n\nClick below and I\'ll send you the link right away!',
      buttons: [{ id: 'starter-button', type: 'postback', title: 'Send me the link', payload: 'send_link' }],
    },
    {
      id: 'starter-card',
      type: 'card',
      card_title: 'Get your free guide',
      card_subtitle: 'Here is the link as promised!',
      buttons: [{ id: 'starter-setup', type: 'url', title: 'Open link', url: 'https://your-link.com' }],
    },
  ],
};

Object.assign(defaultResponseFlow, {
  opening_message_enabled: true,
  opening_message:
    "Hey there! I'm so happy you're here,\nthanks so much for your interest \uD83D\uDE0A\n\nClick below and I'll send you the link\nin just a sec \u2728",
  opening_button: 'Send me the link',
  nodes: [
    {
      id: 'link-message',
      type: 'text',
      content: 'Write a message',
      buttons: [{ id: 'open-link', type: 'url', title: 'Open link', url: 'https://your-link.com' }],
    },
  ],
});

function normalizeResponseFlow(flow) {
  const source = flow && typeof flow === 'object' ? flow : {};
  const nodes = Array.isArray(source.nodes) && source.nodes.length ? source.nodes : defaultResponseFlow.nodes;
  const firstNode = nodes[0] || defaultResponseFlow.nodes[0];

  return {
    ...defaultResponseFlow,
    ...source,
    opening_message_enabled: source.opening_message_enabled !== false,
    opening_message: source.opening_message || defaultResponseFlow.opening_message,
    opening_button: source.opening_button || firstNode.buttons?.[0]?.title || defaultResponseFlow.opening_button,
    nodes: nodes.map((node) => ({ ...node })),
  };
}

function generateId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatScheduleDate(value) {
  if (!value) return 'now';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StepBadge({ step }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-white">
      {step}
    </span>
  );
}

function EditorInfo({ text }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-black/30 bg-white text-[var(--slate)] transition-colors hover:border-primary hover:text-primary">
        <Info className="h-3 w-3" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-6 z-30 hidden w-72 -translate-x-1/2 rounded-md bg-[#1a1a1a] px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block">
        <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#1a1a1a]" />
        {text}
      </span>
    </span>
  );
}

function triggerIcon(value) {
  return triggerTypes.find((trigger) => trigger.value === value)?.icon || Zap;
}

function createResponseNode(type) {
  const id = generateId('node');
  if (type === 'text') return { id, type, content: '' };
  if (type === 'image') return { id, type, image_url: '', content: '' };
  if (type === 'card') {
    return {
      id,
      type,
      card_image_url: '',
      card_title: '',
      card_subtitle: '',
      buttons: [{ id: generateId('button'), type: 'postback', title: 'SETUP', payload: 'setup' }],
    };
  }
  if (type === 'buttons') {
    return {
      id,
      type,
      content: 'Choose an option below.',
      buttons: [{ id: generateId('button'), type: 'url', title: 'Open link', url: '' }],
    };
  }
  if (type === 'carousel') return { id, type, items: [createCarouselItem()] };
  if (type === 'lead_form') return { id, type, form_title: 'Lead form', form_fields: [] };
  return { id, type: 'delay', delay_seconds: 5 };
}

function createCarouselItem() {
  return {
    id: generateId('carousel'),
    image_url: '',
    title: '',
    subtitle: '',
    buttons: [{ id: generateId('button'), type: 'url', title: '', url: '' }],
  };
}

function responseSummary(node) {
  if (node.type === 'text') return node.content || 'No text added yet';
  if (node.type === 'image') return node.content || node.image_url || 'Image response';
  if (node.type === 'card') return node.card_title || 'Card response';
  if (node.type === 'buttons') return node.content || `${node.buttons?.length || 0} button(s)`;
  if (node.type === 'carousel') return `${node.items?.length || 0} item(s)`;
  if (node.type === 'lead_form') return node.form_title || 'Lead form';
  if (node.type === 'delay') return `${node.delay_seconds || 5} second delay`;
  return 'Response';
}

function MediaSelector({ open, onOpenChange, onSelect, fetchMedia }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoading(true);
    setWarning('');
    fetchMedia(30)
      .then((items) => {
        if (!mounted) return;
        setMedia(items || []);
        setWarning(items?.warning || '');
      })
      .catch((error) => {
        console.error('[AutoDM] Failed to load media:', error);
        const message = error.response?.data?.error || error.message || 'Failed to load Instagram media';
        setWarning(message);
        toast.error(message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fetchMedia, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col overflow-hidden rounded-lg bg-white">
        <DialogHeader>
          <DialogTitle>Select Post or Reel</DialogTitle>
          <DialogDescription>Choose one Instagram post/reel for this automation.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : media.length === 0 ? (
            <div className="mx-auto max-w-md py-12 text-center text-sm text-[var(--slate)]">
              <ImageIcon className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="font-semibold text-[var(--ink)]">No posts or reels found yet.</p>
              <p className="mt-2 leading-relaxed">
                {warning || 'If this account has posts, reconnect Instagram or refresh after Meta finishes syncing media permissions.'}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-md"
                onClick={() => {
                  setLoading(true);
                  setWarning('');
                  fetchMedia(30)
                    .then((items) => {
                      setMedia(items || []);
                      setWarning(items?.warning || '');
                    })
                    .catch((error) => {
                      const message = error.response?.data?.error || error.message || 'Failed to load Instagram media';
                      setWarning(message);
                      toast.error(message);
                    })
                    .finally(() => setLoading(false));
                }}
              >
                Refresh posts
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-black/10"
                  onClick={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                >
                  <img src={item.thumbnail_url || item.media_url} alt={item.caption || 'Instagram media'} className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AutomationEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { loading: accountLoading, activeAccount, getAutomation, createAutomation, updateAutomation, fetchInstagramMedia } = useAutoDM();
  const isNew = !id || id === 'new';

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const [headerLeftTarget, setHeaderLeftTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-actions-portal'));
    setHeaderLeftTarget(document.getElementById('header-left-portal'));
  }, []);

  const [name, setName] = useState('Untitled');
  const [triggerType, setTriggerType] = useState(searchParams.get('trigger') || 'comment_on_post');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [applyToAllMedia, setApplyToAllMedia] = useState(true);
  const [keywordMatchType, setKeywordMatchType] = useState('specific');
  const [keywords, setKeywords] = useState([]);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [commentReplyEnabled, setCommentReplyEnabled] = useState(true);
  const [commentReplyText, setCommentReplyText] = useState('Sent it to your DM. Tap SETUP to continue.');
  const [requireFollow, setRequireFollow] = useState(false);
  const [fallbackCommentReply, setFallbackCommentReply] = useState('');
  const [scheduleType, setScheduleType] = useState('duration');
  const [durationDays, setDurationDays] = useState('7');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [responseFlow, setResponseFlow] = useState(defaultResponseFlow);
  const [isActive, setIsActive] = useState(false);
  const [recentMedia, setRecentMedia] = useState([]);
  const [isLoadingRecentMedia, setIsLoadingRecentMedia] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState('Post');

  useEffect(() => {
    let mounted = true;
    if (activeAccount && !applyToAllMedia && recentMedia.length === 0) {
      setIsLoadingRecentMedia(true);
      fetchInstagramMedia(4).then(media => {
        if (mounted) {
          setRecentMedia(media || []);
          setIsLoadingRecentMedia(false);
        }
      }).catch(err => {
        console.error('Failed to load recent media:', err);
        if (mounted) setIsLoadingRecentMedia(false);
      });
    }
    return () => { mounted = false; };
  }, [activeAccount, applyToAllMedia, fetchInstagramMedia, recentMedia.length]);

  useEffect(() => {
    if (isNew || !id) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const data = await getAutomation(id);
        if (!mounted) return;
        if (!data) throw new Error('Automation not found');
        setName(data.name || 'Untitled');
        setTriggerType(data.trigger_type || 'comment_on_post');
        setSelectedMedia(
          data.media_id
            ? {
                id: data.media_id,
                media_url: data.media_url || '',
                thumbnail_url: data.media_thumbnail || '',
                caption: data.media_caption || '',
                permalink: data.media_permalink || '',
                like_count: data.media_like_count || 0,
                comments_count: data.media_comments_count || 0,
              }
            : null
        );
        setApplyToAllMedia(!data.media_id);
        const savedKeywords = data.keywords || [];
        if (savedKeywords.length === 1 && savedKeywords[0] === '*') {
          setKeywordMatchType('any');
          setKeywords([]);
        } else {
          setKeywordMatchType('specific');
          setKeywords(savedKeywords);
        }
        setIsCaseSensitive(Boolean(data.is_case_sensitive));
        setCommentReplyEnabled(data.comment_reply_enabled !== false);
        setCommentReplyText(data.comment_reply_text || 'Sent it to your DM. Tap SETUP to continue.');
        setRequireFollow(Boolean(data.require_follow));
        setFallbackCommentReply(data.fallback_comment_reply || '');
        setScheduleType(data.schedule_type || 'manual');
        setStartsAt(toDateTimeLocalValue(data.starts_at));
        setEndsAt(toDateTimeLocalValue(data.ends_at));
        setResponseFlow(normalizeResponseFlow(data.response_flow || defaultResponseFlow));
        setIsActive(Boolean(data.is_active));
      } catch (error) {
        toast.error(error.message || 'Failed to load automation');
        navigate('/dashboard/auto-dm/automations');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getAutomation, id, isNew, navigate]);

  useEffect(() => {
    if (!['comment_on_post', 'comment_on_reel'].includes(triggerType)) {
      setSelectedMedia(null);
      setApplyToAllMedia(true);
    }
    if (['comment_on_post', 'comment_on_reel', 'live_comment'].includes(triggerType)) {
      setCommentReplyEnabled(true);
      setCommentReplyText((value) => value || 'Sent it to your DM. Tap SETUP to continue.');
    }
  }, [triggerType]);

  const buildSchedulePayload = () => {
    if (scheduleType === 'manual') {
      return { ok: true, value: { schedule_type: 'manual', starts_at: null, ends_at: null } };
    }

    const start = startsAt ? new Date(startsAt) : new Date();
    if (Number.isNaN(start.getTime())) return { ok: false, error: 'Please select a valid start date.' };

    let end;
    if (scheduleType === 'duration') {
      const days = Number(durationDays);
      if (!Number.isFinite(days) || days <= 0) return { ok: false, error: 'Please select a valid duration.' };
      end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    } else {
      if (!endsAt) return { ok: false, error: 'Please select when this automation should stop.' };
      end = new Date(endsAt);
    }

    if (Number.isNaN(end.getTime()) || end <= start) return { ok: false, error: 'End time must be after the start time.' };
    return { ok: true, value: { schedule_type: scheduleType, starts_at: start.toISOString(), ends_at: end.toISOString() } };
  };

  const getSchedulePreview = () => {
    const schedule = buildSchedulePayload();
    if (!schedule.ok) return schedule.error;
    if (!schedule.value.ends_at) return 'Runs until you manually pause or delete it.';
    return `Runs from ${formatScheduleDate(schedule.value.starts_at)} to ${formatScheduleDate(schedule.value.ends_at)}.`;
  };

  const handleSave = async () => {
    if (!activeAccount) {
      toast.error('Please connect an Instagram account first');
      return;
    }
    if (['comment_on_post', 'comment_on_reel'].includes(triggerType) && !applyToAllMedia && !selectedMedia) {
      toast.error('Please select a post/reel or choose all posts.');
      return;
    }
    if (keywordMatchType === 'specific' && !keywords.length) {
      toast.error('Please add at least one keyword');
      return;
    }
    if (!(responseFlow.nodes || []).length) {
      toast.error('Please add at least one response in the flow');
      return;
    }

    const schedule = buildSchedulePayload();
    if (!schedule.ok) {
      toast.error(schedule.error);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        instagram_account_id: activeAccount.id,
        name,
        trigger_type: triggerType,
        media_id: applyToAllMedia ? null : selectedMedia?.id || null,
        media_url: applyToAllMedia ? null : selectedMedia?.media_url || null,
        media_thumbnail: applyToAllMedia ? null : selectedMedia?.thumbnail_url || selectedMedia?.media_url || null,
        media_like_count: applyToAllMedia ? null : selectedMedia?.like_count ?? null,
        media_comments_count: applyToAllMedia ? null : selectedMedia?.comments_count ?? null,
        media_caption: applyToAllMedia ? null : selectedMedia?.caption ?? null,
        media_permalink: applyToAllMedia ? null : selectedMedia?.permalink ?? null,
        keywords: keywordMatchType === 'any' ? ['*'] : keywords,
        is_case_sensitive: isCaseSensitive,
        comment_reply_enabled: commentReplyEnabled,
        comment_reply_text: commentReplyEnabled ? commentReplyText : null,
        require_follow: requireFollow,
        fallback_comment_reply: fallbackCommentReply,
        response_flow: responseFlow,
        is_active: isActive,
        ...schedule.value,
        expired_at: null,
      };

      if (isNew) {
        await createAutomation({ ...payload, follower_count_at_create: activeAccount.followers_count || null });
        toast.success('Automation created!');
      } else {
        await updateAutomation(id, payload);
        toast.success('Automation saved!');
      }
      navigate('/dashboard/auto-dm/automations');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save automation');
    } finally {
      setIsSaving(false);
    }
  };

  if (accountLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-12 text-center shadow-sm">
        <Instagram className="mx-auto h-10 w-10 text-[var(--slate)]" />
        <p className="mt-4 font-medium text-[var(--ink)]">Connect an Instagram account first</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedTrigger = triggerTypes.find((trigger) => trigger.value === triggerType) || triggerTypes[0];
  const SelectedTriggerIcon = triggerIcon(triggerType);
  const needsMediaSelection = ['comment_on_post', 'comment_on_reel'].includes(triggerType);
  const isCommentTrigger = ['comment_on_post', 'comment_on_reel', 'live_comment'].includes(triggerType);
  const keywordStep = needsMediaSelection ? 3 : 2;
  const responseStep = keywordStep + 1;
  const commentStep = responseStep + 1;
  const durationStep = isCommentTrigger ? commentStep + 1 : responseStep + 1;
  return (
    <div className="autodm-editor-screen flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Left Sidebar - Form */}
      <div className="autodm-editor-panel bg-white border-r border-black/5 w-[450px] flex-shrink-0 flex flex-col h-full overflow-hidden relative z-10">
        
        {/* Portaled Header Items */}
        {headerLeftTarget ? createPortal(
          <div className="flex items-center gap-2 ml-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard/auto-dm/automations')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex flex-col">
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="h-7 bg-transparent border-transparent px-1 font-bold text-base sm:text-lg focus-visible:ring-1 focus-visible:ring-primary shadow-none w-[110px] sm:w-[200px]"
                placeholder="Untitled Automation"
              />
            </div>
          </div>,
          headerLeftTarget
        ) : null}

        {portalTarget ? createPortal(
          <div className="flex items-center gap-2 sm:gap-4 mr-2 sm:mr-4">
             <span className="hidden sm:inline-block text-xs font-medium text-gray-500">{isSaving ? 'Saving...' : 'Saved'}</span>
             <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="px-2 sm:px-3">
               {isSaving ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Save className="h-4 w-4 sm:mr-2" />}
               <span className="hidden sm:inline-block">Save</span>
             </Button>
             <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm font-medium w-[60px] text-left">{isActive ? 'Active' : 'Inactive'}</span>
             </div>
          </div>,
          portalTarget
        ) : null}

        {/* Scrollable Form Content */}
        <div className="autodm-editor-scroll flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Section 1: When someone comments on */}
          <div className="space-y-4" onFocusCapture={() => setActivePreviewTab('Post')} onClickCapture={() => setActivePreviewTab('Post')}>
            <h3 className="autodm-editor-heading text-lg flex items-center gap-2">
              <Instagram className="w-5 h-5" />
              When someone comments on
            </h3>
            <div className="autodm-editor-card p-4 space-y-4">
               <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                     <input 
                        type="radio" 
                        name="post_selection" 
                        className="w-4 h-4 text-primary" 
                        checked={!applyToAllMedia}
                        onChange={() => {
                          setApplyToAllMedia(false);
                          setTriggerType('comment_on_post');
                        }}
                     />
                     <span className="font-medium text-gray-700">a specific post or reel</span>
                  </label>
                  
                  {!applyToAllMedia && (
                    <div className="autodm-editor-nested ml-8 p-4">
                        {selectedMedia ? (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 relative">
                                      <img src={selectedMedia.thumbnail_url || selectedMedia.media_url} alt="Media" className="w-full h-full object-cover" />
                                      {selectedMedia.media_type === 'VIDEO' && (
                                        <div className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                                          <Video className="w-3 h-3 text-white" />
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 line-clamp-3">{selectedMedia.caption || 'No caption'}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setShowMediaSelector(true)} className="w-full bg-white">
                                    Change Media
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {isLoadingRecentMedia ? (
                                    <div className="grid grid-cols-4 gap-2">
                                        {[1, 2, 3, 4].map(i => (
                                          <Skeleton key={i} className="aspect-square w-full rounded-md bg-gray-200" />
                                        ))}
                                    </div>
                                ) : recentMedia.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2">
                                        {recentMedia.map(media => (
                                            <div 
                                              key={media.id} 
                                              onClick={() => setSelectedMedia(media)}
                                              className="relative aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                                            >
                                                <img src={media.thumbnail_url || media.media_url} alt="Media" className="w-full h-full object-cover" />
                                                {media.media_type === 'VIDEO' && (
                                                    <div className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                                                        <Video className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <Button variant="outline" size="sm" onClick={() => setShowMediaSelector(true)} className="w-full bg-white text-primary font-medium hover:bg-gray-50 border-gray-200 shadow-sm mt-1">
                                    Show All Posts
                                </Button>
                            </div>
                        )}
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                     <input 
                        type="radio" 
                        name="post_selection" 
                        className="w-4 h-4 text-primary" 
                        checked={applyToAllMedia}
                        onChange={() => {
                          setApplyToAllMedia(true);
                          setTriggerType('comment_any_post');
                        }}
                     />
                     <span className="font-medium text-gray-700">any post or reel</span>
                  </label>
               </div>
            </div>
          </div>

          {/* Section 2: And this comment has */}
          <div className="space-y-4" onFocusCapture={() => setActivePreviewTab('Comments')} onClickCapture={() => setActivePreviewTab('Comments')}>
            <h3 className="autodm-editor-heading text-lg">And this comment has</h3>
            <div className="autodm-editor-card flex flex-col">
                <div className="p-1">
                    <div className={`p-4 rounded-xl transition-all ${keywordMatchType === 'specific' ? 'bg-black/[0.02]' : 'hover:bg-gray-50'}`}>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="radio" checked={keywordMatchType === 'specific'} onChange={() => setKeywordMatchType('specific')} className="w-4 h-4 text-primary" />
                            <span className="font-medium text-gray-800">A specific word or words</span>
                        </label>
                        {keywordMatchType === 'specific' && (
                            <div className="mt-4 ml-7">
                                <KeywordInput 
                                    keywords={keywords}
                                    onChange={setKeywords}
                                    caseSensitive={isCaseSensitive}
                                    onCaseSensitiveChange={setIsCaseSensitive}
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className={`p-4 mt-1 rounded-xl transition-all ${keywordMatchType === 'any' ? 'bg-black/[0.02]' : 'hover:bg-gray-50'}`}>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="radio" checked={keywordMatchType === 'any'} onChange={() => setKeywordMatchType('any')} className="w-4 h-4 text-primary" />
                            <span className="font-medium text-gray-800">Any word or comment</span>
                        </label>
                    </div>
                </div>
                
                {/* Public comment reply */}
                <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                   <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold text-gray-800 block">Public Comment Reply</Label>
                        <p className="text-xs text-gray-500 mt-1">Reply to the triggering comment publicly.</p>
                      </div>
                      <Switch 
                          checked={commentReplyEnabled} 
                          onCheckedChange={setCommentReplyEnabled} 
                      />
                   </div>
                   {commentReplyEnabled && (
                      <div className="mt-4">
                          <Textarea 
                              value={commentReplyText}
                              onChange={(e) => setCommentReplyText(e.target.value)}
                              placeholder="Sent it to your DM. Tap SETUP to continue."
                              className="w-full text-sm resize-none rounded-xl border-gray-200 focus:ring-1 focus:ring-primary focus:border-primary min-h-[60px] p-3 bg-white"
                          />
                      </div>
                   )}
                </div>

                {/* Follow Gate */}
                <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                   <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold text-gray-800 block">Instagram Follow Gate</Label>
                        <p className="text-xs text-gray-500 mt-1">Require users to follow your account before sending a DM.</p>
                      </div>
                      <Switch 
                          checked={requireFollow} 
                          onCheckedChange={setRequireFollow} 
                      />
                   </div>
                   {requireFollow && (
                      <div className="mt-4 pt-4 border-t border-gray-200/60">
                          <Label className="text-sm font-semibold text-gray-800 block">Fallback Comment Reply</Label>
                          <p className="text-xs text-gray-500 mt-1 mb-3">If they don't follow you, we'll reply to their comment with this text instead of sending a DM.</p>
                          <Textarea 
                              value={fallbackCommentReply}
                              onChange={(e) => setFallbackCommentReply(e.target.value)}
                              placeholder="Please follow our account to receive the link!"
                              className="w-full text-sm resize-none rounded-xl border-gray-200 focus:ring-1 focus:ring-primary focus:border-primary min-h-[60px] p-3 bg-white"
                          />
                      </div>
                   )}
                </div>
            </div>
          </div>

          {/* Section 3: Two-step DM flow */}
          <div className="space-y-4 pb-20" onFocusCapture={() => setActivePreviewTab('DM')} onClickCapture={() => setActivePreviewTab('DM')}>
            <h3 className="autodm-editor-heading text-lg">They will get</h3>

            <div className="autodm-editor-card overflow-hidden">
              <div className="autodm-editor-card-head flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1683dd] text-sm font-bold text-white">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">Opening DM</p>
                    <p className="text-xs font-medium text-gray-500">Sent first with a button, like the screenshot.</p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(responseFlow.opening_message_enabled)}
                  onCheckedChange={(checked) => setResponseFlow((prev) => ({ ...prev, opening_message_enabled: checked }))}
                />
              </div>

              {responseFlow.opening_message_enabled ? (
                <div className="space-y-4 p-5">
                  <Textarea
                    value={responseFlow.opening_message || ''}
                    onChange={(event) => setResponseFlow((prev) => ({ ...prev, opening_message: event.target.value }))}
                    placeholder="Hey there! I'm so happy you're here..."
                    className="min-h-[126px] resize-none rounded-md border-gray-200 text-sm leading-relaxed focus-visible:ring-1"
                  />
                  <Input
                    value={responseFlow.opening_button || ''}
                    onChange={(event) => setResponseFlow((prev) => ({ ...prev, opening_button: event.target.value }))}
                    placeholder="Send me the link"
                    className="rounded-md border-gray-200"
                  />
                </div>
              ) : null}
            </div>

            <div className="autodm-editor-card overflow-hidden">
              <div className="autodm-editor-card-head p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#111111] text-sm font-bold text-white">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900">After they tap the button</p>
                    <p className="text-xs font-medium text-gray-500">Shown after the user sends “{responseFlow.opening_button || 'Send me the link'}”.</p>
                  </div>
                </div>
              </div>

              <div className="p-0">
                <ResponseFlowBuilder
                  responseFlow={responseFlow}
                  onChange={setResponseFlow}
                  step={2}
                  hideHeader
                  compact
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Canvas - Mobile Preview */}
      <div className="autodm-preview-canvas flex-1 relative overflow-y-auto flex justify-center items-start pt-12 pb-12">
         <div className="absolute inset-0 pattern-dots pointer-events-none" />
         <div className="relative z-10 transition-transform duration-300 flex justify-center w-[400px]">
            <MobilePreview 
                triggerType={triggerType}
                keywords={keywords}
                selectedMedia={selectedMedia}
                responseFlow={responseFlow}
                commentReplyText={commentReplyText}
                commentReplyEnabled={commentReplyEnabled}
                requireFollow={requireFollow}
                fallbackCommentReply={fallbackCommentReply}
                activeTab={activePreviewTab}
                onTabChange={setActivePreviewTab}
            />
         </div>
      </div>

      <MediaSelector 
        open={showMediaSelector} 
        onOpenChange={setShowMediaSelector} 
        onSelect={(media) => {
          setSelectedMedia(media);
          setShowMediaSelector(false);
        }} 
        fetchMedia={fetchInstagramMedia} 
      />
    </div>
  );
}
