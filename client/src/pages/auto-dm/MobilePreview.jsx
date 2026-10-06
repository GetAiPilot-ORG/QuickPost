import React, { useState } from 'react';
import {
  Bookmark,
  Camera,
  ChevronLeft,
  Grid3X3,
  Heart,
  Home,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Phone,
  PlusCircle,
  Search,
  Send,
  Smile,
  Video,
  Wifi,
} from 'lucide-react';
import { useAutoDM } from '../../context/AutoDMContext';
import { Switch } from '@/components/ui/switch';

function EmptyPostMedia() {
  return (
    <div className="grid h-full w-full place-items-center bg-gray-100">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-black/10 bg-black/[0.03] text-black/25">
        <ImageIcon className="h-6 w-6" />
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="relative z-30 flex h-[30px] items-center justify-between px-[28px] pt-2 text-[12px] font-bold text-black">
      <span>12:40</span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-end gap-0.5">
          <span className="h-1.5 w-1 rounded-sm bg-black" />
          <span className="h-2 w-1 rounded-sm bg-black" />
          <span className="h-2.5 w-1 rounded-sm bg-black" />
          <span className="h-3 w-1 rounded-sm bg-black" />
        </div>
        <Wifi className="h-3.5 w-3.5" />
        <span className="relative h-2.5 w-4 rounded-[2px] border border-black">
          <span className="absolute inset-[1px] rounded-[1px] bg-black" />
        </span>
      </div>
    </div>
  );
}

function PhoneFrame({ children }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[600px] w-[285px] rounded-[10px] bg-[#e0deda] p-[2.5px] shadow-[0_26px_58px_rgba(0,0,0,0.15)] ring-1 ring-[#c5c3be]">
        {/* Hardware Buttons (Android - Right Side) */}
        <div className="absolute -right-[2.5px] top-[130px] h-[35px] w-[2.5px] rounded-r-sm bg-[#c5c3be]" />
        <div className="absolute -right-[2.5px] top-[180px] h-[75px] w-[2.5px] rounded-r-sm bg-[#c5c3be]" />

        {/* Screen Background with Inner Bezel */}
        <div className="relative h-full w-full overflow-hidden rounded-[8px] border-[5px] border-[#1a1a1a] bg-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
          
          {/* Hole Punch Camera */}
          <div className="absolute left-1/2 top-[10px] z-40 flex h-[11px] w-[11px] -translate-x-1/2 items-center justify-center rounded-full bg-[#111] border border-black shadow-[inset_0_0_2px_rgba(255,255,255,0.2)]">
             <div className="h-[4px] w-[4px] rounded-full bg-[#1a2b4c] opacity-80"></div>
          </div>

          <StatusBar />
          <div className="absolute inset-x-0 bottom-0 top-[28px] bg-white">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ src, username, className = 'h-7 w-7' }) {
  if (!src) {
    return (
      <span
        className={`${className} grid place-items-center rounded-full border border-black/10 bg-gray-200 text-[10px] font-bold uppercase text-black`}
      >
        {username?.[0] || '?'}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={username}
      className={`${className} rounded-full border border-black/10 object-cover`}
    />
  );
}

function formatPreviewTemplate(text) {
  if (!text) return '';
  return String(text)
    .replace(/\{\{\s*(first_name|firstname)\s*\}\}/gi, 'Alex')
    .replace(/\{\{\s*username\s*\}\}/gi, '@alex_dev')
    .replace(/\{\{\s*(name|full_name)\s*\}\}/gi, 'Alex');
}

export default function MobilePreview({
  selectedMedia,
  keywords,
  responseFlow,
  commentReplyText,
  commentReplyEnabled,
  requireFollow,
  fallbackCommentReply,
  activeTab = 'Post',
  onTabChange,
  account,
  scale = 1.1,
}) {
  let contextAccount = null;
  try {
    const ctx = useAutoDM();
    contextAccount = ctx?.activeAccount;
  } catch {
    // Safe when rendered outside AutoDMProvider
  }

  const activeAccount = account || contextAccount;
  const username = activeAccount?.username || 'cricboss121';
  const avatar = activeAccount?.profile_picture_url || activeAccount?.profilePicture || '';
  const triggerKeyword = keywords?.[0] || 'link';
  const openingMessage =
    responseFlow?.opening_message ||
    "Hey there! I'm so happy you're here,\nthanks so much for your interest \uD83D\uDE0A\n\nClick below and I'll send you the link in\njust a sec \u2728";
  const openingButton = responseFlow?.opening_button || 'Send me the link';
  const selectedMediaSrc = selectedMedia?.thumbnail_url || selectedMedia?.media_url || '';

  const renderFlowNode = (node, index) => {
    const nodeType = String(node?.type || 'text').toLowerCase();
    const buttons = Array.isArray(node?.buttons) ? node.buttons : [];

    if (nodeType === 'delay') {
      return (
        <div key={node.id || index} className="ml-7 text-[10px] font-semibold text-gray-500">
          Wait {node.delay_seconds || 5}s
        </div>
      );
    }

    return (
      <div key={node.id || index} className="mt-2 flex w-full flex-col items-start gap-1">
        <div className="flex w-full items-start gap-2">
          <Avatar src={avatar} username={username} className="mt-1 h-6 w-6 shrink-0" />
          <div className="max-w-[205px] overflow-hidden rounded-[20px] rounded-bl-sm bg-[#efefef] text-[11px] font-normal text-black" style={{ letterSpacing: '-0.02em' }}>
            {nodeType === 'image' ? (
              <>
                {node.image_url ? (
                  <img src={node.image_url} alt="" className="h-[150px] w-[190px] object-cover" />
                ) : (
                  <div className="grid h-[120px] w-[180px] place-items-center bg-gray-200 text-[10px] text-gray-500">
                    Image
                  </div>
                )}
                {node.content ? <p className="whitespace-pre-wrap px-3.5 py-2.5 leading-[1.3]">{node.content}</p> : null}
              </>
            ) : nodeType === 'card' ? (
              <>
                {node.card_image_url ? <img src={node.card_image_url} alt="" className="h-[110px] w-full object-cover" /> : null}
                <div className="space-y-0.5 px-3 py-2">
                  <p className="font-semibold text-[10px]">{node.card_title || 'Card title'}</p>
                  <p className="text-[9px] text-gray-500">{node.card_subtitle || 'Card subtitle'}</p>
                </div>
              </>
            ) : nodeType === 'lead_form' ? (
              <div className="space-y-0.5 px-3 py-2">
                <p className="font-semibold text-[10px]">{node.form_title || 'Lead form'}</p>
                <p className="text-[9px] text-gray-500">Form fields will appear here.</p>
              </div>
            ) : nodeType === 'carousel' ? (
              <div className="space-y-0.5 px-3 py-2">
                <p className="font-semibold text-[10px]">Carousel</p>
                <p className="text-[9px] text-gray-500">{node.items?.length || 1} item(s)</p>
              </div>
            ) : (
              <div className="whitespace-pre-wrap px-3.5 py-2.5 leading-[1.3]">
                {node.content || 'Write a message'}
              </div>
            )}
          </div>
        </div>

        {buttons.length > 0 ? (
          <div className="ml-8 flex w-full max-w-[205px] flex-col gap-1.5 mt-1">
            {buttons.map((btn, btnIdx) => (
              <div key={btn.id || btnIdx} className="rounded-[16px] bg-[#efefef] px-4 py-2 text-center text-[11px] font-semibold text-black" style={{ letterSpacing: '-0.01em' }}>
                {btn.title || 'Button'}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderPost = () => (
    <div className="flex h-full flex-col bg-white text-black">
      <div className="border-b border-gray-200 px-3 pb-2 pt-1 bg-white flex items-center justify-between">
        <ChevronLeft className="h-6 w-6 text-black" strokeWidth={1.5} />
        <div className="text-center leading-none flex-1">
          <p className="text-[14px] font-bold tracking-tight">Posts</p>
          <p className="mt-0.5 text-[11px] text-gray-500 font-semibold">{username}</p>
        </div>
        <div className="w-6" />
      </div>
      <div className="flex items-center justify-between px-3 py-2 bg-white">
        <div className="flex items-center gap-2.5">
          <Avatar src={avatar} username={username} className="h-8 w-8" />
          <span className="text-[13px] font-semibold">{username}</span>
        </div>
        <MoreHorizontal className="h-5 w-5 text-black" strokeWidth={1.5} />
      </div>
      <div className="h-[280px] w-full bg-gray-100 border-y border-gray-200">
        {selectedMediaSrc ? (
          <img
            src={selectedMediaSrc}
            alt="Instagram post"
            className="h-full w-full object-cover"
          />
        ) : (
          <EmptyPostMedia />
        )}
      </div>
      <div className="px-3 py-2 bg-white flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3.5">
            <Heart className="h-[24px] w-[24px] text-black" strokeWidth={1.5} />
            <MessageCircle className="h-[24px] w-[24px] text-black" strokeWidth={1.5} style={{ transform: 'scaleX(-1)' }} />
            <Send className="h-[24px] w-[24px] text-black" strokeWidth={1.5} />
          </div>
          <Bookmark className="h-[24px] w-[24px] text-black" strokeWidth={1.5} />
        </div>
        
        {/* Likes */}
        <div className="mt-2 text-[13px] font-semibold tracking-tight">
          {selectedMedia?.like_count ? `${selectedMedia.like_count.toLocaleString()} likes` : '1,234 likes'}
        </div>
        
        {/* Caption */}
        <div className="mt-1 text-[13px] leading-tight">
          <span className="font-semibold mr-1.5 tracking-tight">{username}</span>
          <span className="text-gray-900">{selectedMedia?.caption || 'This is a preview of your Instagram post...'}</span>
        </div>

        {/* Comments count */}
        <div className="mt-1 text-[13px] text-gray-500 font-medium">
          View all {selectedMedia?.comments_count ? selectedMedia.comments_count.toLocaleString() : '89'} comments
        </div>
      </div>
      <div className="mt-auto grid h-[46px] grid-cols-5 items-center border-t border-gray-200 bg-white px-5 text-black pb-1 shrink-0">
        <Home className="h-[24px] w-[24px] fill-black" strokeWidth={1.5} />
        <Search className="h-[24px] w-[24px] text-black mx-auto" strokeWidth={1.5} />
        <PlusCircle className="h-[24px] w-[24px] text-black mx-auto" strokeWidth={1.5} />
        <Grid3X3 className="h-[24px] w-[24px] text-black mx-auto" strokeWidth={1.5} />
        <Avatar src={avatar} username={username} className="h-6 w-6 ml-auto" />
      </div>
    </div>
  );

  const renderComments = () => (
    <div className="relative h-full overflow-hidden bg-white text-black">
      <div className="absolute inset-x-0 top-0 h-[250px] bg-black">
        {selectedMediaSrc ? (
          <img
            src={selectedMediaSrc}
            alt="Instagram post"
            className="h-full w-full object-cover opacity-70 blur-[3px] scale-105"
          />
        ) : (
          <div className="h-full w-full opacity-70 blur-[3px] scale-105">
            <EmptyPostMedia />
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur-md px-3 pb-2 pt-1 flex items-center justify-between">
        <ChevronLeft className="h-6 w-6 text-black" strokeWidth={1.5} />
        <div className="text-center leading-none flex-1">
          <p className="text-[14px] font-bold tracking-tight">Posts</p>
          <p className="mt-0.5 text-[11px] text-gray-500 font-semibold">{username}</p>
        </div>
        <div className="w-6" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-20 h-[375px] rounded-t-[22px] bg-white shadow-[0_-16px_45px_rgba(0,0,0,0.1)]">
        <div className="relative flex items-center justify-center pt-3 pb-2 border-b border-gray-100">
          <span className="absolute top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-gray-300" />
          <span className="text-[15px] font-bold mt-2">Comments</span>
          <Send className="absolute right-4 top-4 h-[22px] w-[22px] text-black" strokeWidth={1.5} />
        </div>
        <div className="px-4 pt-4">
          <div className="flex gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-200 overflow-hidden">
              <span className="h-full w-full bg-gray-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-tight">
                <span className="font-semibold">username</span> <span className="text-gray-500 text-[10px]">1h</span>
              </p>
              <p className="text-[11px] leading-[1.3] mt-0.5 text-black">{triggerKeyword}</p>
              <p className="mt-1 text-[10px] font-semibold text-gray-500 flex gap-4">
                <span>Reply</span>
                <span>See Translation</span>
              </p>
            </div>
            <Heart className="mt-1 h-[14px] w-[14px] text-gray-400" strokeWidth={1.5} />
          </div>
          {commentReplyEnabled ? (
            <div className="mt-4 flex gap-3 pl-11">
              <Avatar src={avatar} username={username} className="h-7 w-7" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-tight">
                  <span className="font-semibold">{username}</span> <span className="text-gray-500 text-[10px]">Now</span>
                </p>
                <p className="text-[11px] leading-[1.3] mt-0.5 text-black">
                  {formatPreviewTemplate(
                    requireFollow && !previewAsFollower 
                      ? fallbackCommentReply || 'Please follow our account to receive the link!' 
                      : commentReplyText || 'Check your DM'
                  )}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-gray-500 flex gap-4">
                  <span>Reply</span>
                  <span>See Translation</span>
                </p>
              </div>
              <Heart className="mt-1 h-[14px] w-[14px] text-gray-400" strokeWidth={1.5} />
            </div>
          ) : null}
        </div>
        <div className="absolute bottom-[60px] left-4 right-4 flex justify-between text-[26px]">
          {['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'].map((emoji) => (
            <span key={emoji}>{emoji}</span>
          ))}
        </div>
        <div className="absolute bottom-4 left-3 right-3 flex items-center gap-3">
          <Avatar src={avatar} username={username} className="h-8 w-8 shrink-0" />
          <div className="flex h-10 flex-1 items-center rounded-full border border-gray-300 bg-white px-4">
            <span className="flex-1 text-[14px] text-gray-400">Add a comment...</span>
            <div className="flex items-center gap-3 text-black opacity-60">
              <ImageIcon className="h-[20px] w-[20px]" strokeWidth={1.5} />
              <div className="rounded-[4px] border-[1.5px] border-current px-1 text-[10px] font-bold">GIF</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDM = () => (
    <div className="flex h-full flex-col bg-white text-black">
      <div className="flex h-[50px] items-center justify-between border-b border-gray-200 px-3">
        <div className="flex items-center gap-2">
          <ChevronLeft className="h-5 w-5 text-black" />
          <Avatar src={avatar} username={username} className="h-8 w-8" />
          <span className="text-[14px] font-semibold">{username}</span>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-black" />
          <Video className="h-5 w-5 text-black" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-3 py-4">
        <div className="flex max-w-[240px] items-end gap-2">
          <Avatar src={avatar} username={username} className="h-5 w-5 shrink-0" />
          <div className="rounded-[18px] rounded-tl-sm bg-[#f0f0f0] p-3">
            <p className="whitespace-pre-line text-[11px] font-normal leading-[1.35]">{formatPreviewTemplate(openingMessage)}</p>
            <div className="mt-2 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-center text-[10px] font-semibold text-[#0095f6]">
              {openingButton}
            </div>
          </div>
        </div>
        <div className="ml-auto rounded-[18px] rounded-br-sm bg-[#7357f6] px-4 py-2 text-[11px] font-normal text-white max-w-[220px] text-left leading-[1.35]">
          {openingButton}
        </div>
        {(!responseFlow?.nodes || !Array.isArray(responseFlow.nodes) || responseFlow.nodes.length === 0) ? (
            <div className="mt-4 flex items-center gap-2">
              <Avatar src={avatar} username={username} className="h-5 w-5 shrink-0" />
              <div className="rounded-[18px] rounded-tl-sm bg-[#f0f0f0] px-4 py-2 text-[11px] font-normal text-gray-500">
                Write a message
              </div>
            </div>
          ) : (
            responseFlow.nodes.map(renderFlowNode)
          )}
      </div>
      <div className="px-3 pb-4">
        <div className="flex h-10 items-center rounded-full bg-gray-100 px-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0095f6]">
            <Camera className="h-4 w-4 text-white" />
          </span>
          <span className="ml-3 flex-1 text-[10px] text-gray-500">Message...</span>
          <div className="flex items-center gap-2 text-black">
            <ImageIcon className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
            <Smile className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex flex-col items-center origin-top transition-all duration-300"
      style={{ transform: `scale(${scale})` }}
    >
      {requireFollow && activeTab === 'Comments' && (
        <div className="mb-6 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5 text-[11px]">
          <span className={previewAsFollower ? "font-semibold text-primary" : "text-gray-400"}>Following</span>
          <Switch 
            checked={!previewAsFollower} 
            onCheckedChange={(c) => setPreviewAsFollower(!c)} 
          />
          <span className={!previewAsFollower ? "font-semibold text-primary" : "text-gray-400"}>Not Following</span>
        </div>
      )}
      <PhoneFrame>
        {activeTab === 'Post' ? renderPost() : null}
        {activeTab === 'Comments' ? renderComments() : null}
        {activeTab === 'DM' ? renderDM() : null}
      </PhoneFrame>
      <div className="mt-5 flex h-8 items-center rounded-full bg-gray-200/50 p-1 text-[12px] font-semibold text-gray-500">
        {['Post', 'Comments', 'DM'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange ? onTabChange(tab) : null}
            className={`h-6 min-w-[62px] rounded-full px-3 transition ${
              activeTab === tab ? 'bg-white text-black shadow-sm font-bold' : ''
            } ${activeTab === 'DM' && tab === 'DM' ? 'ring-2 ring-blue-500' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
