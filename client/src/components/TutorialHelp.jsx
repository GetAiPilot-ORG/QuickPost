import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';

export const TUTORIALS = {
  dashboard: ['vIwDIh-RpxM', 'Dashboard tour'],
  connect: ['0S0v27OgyYI', 'Connect your social accounts'],
  compose: ['qMC937RSzSs', 'Create and schedule posts'],
  analytics: ['zLHpN7EYoxA', 'Track published posts and results'],
  instapilot: ['TegMwLlUlZs', 'Set up your AI DM bot'],
  youtube: ['_OXqsfb5G7M', 'Use YouTube Studio'],
  trends: ['iPlHl5AWTYE', 'Find ideas with Trend Feed'],
  inbox: ['ggS68hL96yw', 'Manage your Social Inbox'],
  autodm: ['UmVLo_G6JzE', 'Explore AutoDM'],
  automation: ['3othGsaoeeo', 'Build your first AutoDM'],
  account: ['D4JhJLMPiiQ', 'Profile, accounts and billing'],
};

export function tutorialForPath(path) {
  if (path.includes('/auto-dm/automations/')) return 'automation';
  if (path.includes('/auto-dm')) return 'autodm';
  const page = path.split('/').filter(Boolean)[1];
  return ({ queue: 'compose', history: 'analytics', billing: 'account', profile: 'account', channels: 'connect', guide: 'dashboard', docs: 'dashboard' })[page] || (TUTORIALS[page] ? page : 'dashboard');
}

export default function TutorialHelp({ topic }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [videoId, title] = TUTORIALS[topic || tutorialForPath(pathname)] || TUTORIALS.dashboard;
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Watch tutorial: ${title}`} title={`Watch tutorial: ${title}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ padding: 6, minWidth: 32 }}><Info size={18} aria-hidden="true" /></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Watch the step-by-step guide, then try it here.</DialogDescription></DialogHeader>
        {open && <iframe key={videoId} title={title} src={`https://www.youtube-nocookie.com/embed/${videoId}`} className="aspect-video w-full rounded-lg border-0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="underline">Watch on YouTube</a><a href="https://www.youtube.com/playlist?list=PLeoAzo_H33P8" target="_blank" rel="noopener noreferrer" className="underline">All tutorials</a></div>
      </DialogContent>
    </Dialog>
  </>;
}
