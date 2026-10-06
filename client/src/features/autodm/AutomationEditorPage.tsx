import {
  AlertTriangle,
  ArrowLeft,
  Image as ImageIcon,
  Instagram,
  Loader2,
  MessageCircle,
  MessageSquare,
  Play,
  Radio,
  Save,
  Share2,
  Tv2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createAutomation, getAutomationById, listAutomations, updateAutomation } from "@/services/autodm/automations";
import { useAutoDM } from "./AutoDMContext";
import { AutoDMConnectionGate } from "./AutoDMConnectionGate";
import { KeywordInput } from "./KeywordInput";
import type { KeywordConflict } from "./KeywordInput";
import { MediaSelector } from "./MediaSelector";
import { ResponseFlowBuilder } from "./ResponseFlowBuilder";

const triggerTypes = [
  { value: "comment_on_post", label: "User comments on your post", icon: MessageCircle, available: true },
  { value: "comment_on_reel", label: "User comments on your reel", icon: Play, available: true },
  { value: "dm_received", label: "User sends you a DM", icon: MessageSquare, available: true },
  { value: "live_comment", label: "User comments on your live", icon: Radio, available: true },
  { value: "story_reply", label: "User replies to your story", icon: Share2, available: true },
  { value: "story_mention", label: "User mentions you in story", icon: Tv2, available: false },
];

export default function AutomationEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { socialUser, activeAccount } = useAutoDM();
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [name, setName] = useState("Untitled");
  const [triggerType, setTriggerType] = useState("comment_on_post");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [applyToAllMedia, setApplyToAllMedia] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [commentReplyEnabled, setCommentReplyEnabled] = useState(false);
  const [commentReplyText, setCommentReplyText] = useState("");
  const [requireFollow, setRequireFollow] = useState(false);
  const [fallbackCommentReply, setFallbackCommentReply] = useState("");
  const [responseFlow, setResponseFlow] = useState<any>({ nodes: [], opening_message_enabled: false, opening_message: "" });
  const [isActive, setIsActive] = useState(false);

  // All existing automations for conflict detection
  const [allAutomations, setAllAutomations] = useState<any[]>([]);

  useEffect(() => {
    if (!socialUser?.userId || !activeAccount?.id) return;

    // Load all existing automations for conflict detection
    listAutomations({ instagramAccountId: activeAccount.id })
      .then(setAllAutomations)
      .catch(() => {/* non-critical */});
  }, [socialUser?.userId, activeAccount?.id]);

  useEffect(() => {
    if (isNew || !socialUser?.userId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const automation = await getAutomationById(id, socialUser?.userId);
        if (!automation) {
          toast.error("Automation not found");
          navigate("/dashboard/auto-dm/automations");
          return;
        }
        setName(automation.name || "Untitled");
        setTriggerType(automation.trigger_type);
        setSelectedMedia(
          automation.media_id
            ? {
                id: automation.media_id,
                media_url: automation.media_url,
                thumbnail_url: automation.media_thumbnail,
              }
            : null
        );
        setApplyToAllMedia(!automation.media_id);
        setKeywords(automation.keywords || []);
        setIsCaseSensitive(Boolean(automation.is_case_sensitive));
        setCommentReplyEnabled(Boolean(automation.comment_reply_enabled));
        const rawReply = String(automation.comment_reply_text || "");
        const cleanReply = rawReply.includes("|||") ? rawReply.split("|||")[0].trim() : rawReply.trim();
        setCommentReplyText(cleanReply);
        setRequireFollow(Boolean(automation.require_follow));
        setFallbackCommentReply(automation.fallback_comment_reply || "");
        setResponseFlow(automation.response_flow || { nodes: [], opening_message_enabled: false, opening_message: "" });
        setIsActive(Boolean(automation.is_active));
      } catch (error: any) {
        toast.error(error.message || "Failed to load automation");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, socialUser?.userId]);

  // Compute keyword conflicts — check other automations on the same post
  const conflictingKeywords = useMemo<KeywordConflict[]>(() => {
    if (!keywords.length || !allAutomations.length) return [];

    const currentMediaId = applyToAllMedia ? null : (selectedMedia?.id ?? null);

    const conflicts: KeywordConflict[] = [];

    for (const automation of allAutomations) {
      // Skip self when editing
      if (!isNew && automation.id === id) continue;

      // Only check automations on the same post (or "all posts" scope)
      const otherMediaId = automation.media_id ?? null;
      const sameScope =
        currentMediaId === otherMediaId ||
        // "All posts" automation conflicts with specific post automation on same trigger
        currentMediaId === null ||
        otherMediaId === null;

      if (!sameScope) continue;

      for (const kw of keywords) {
        const otherKeywords: string[] = automation.keywords ?? [];
        const conflictFound = otherKeywords.some(
          (ok) => ok.trim().toLowerCase() === kw.trim().toLowerCase()
        );
        if (conflictFound) {
          // Avoid duplicate conflict entries for the same keyword
          if (!conflicts.find((c) => c.keyword.toLowerCase() === kw.toLowerCase())) {
            conflicts.push({
              keyword: kw,
              automationName: automation.name || "Unnamed Automation",
              automationId: automation.id,
            });
          }
        }
      }
    }

    return conflicts;
  }, [keywords, allAutomations, selectedMedia, applyToAllMedia, id, isNew]);

  const hasConflicts = conflictingKeywords.length > 0;

  const handleSave = async () => {
    if (!keywords.length) {
      toast.error("Add at least one keyword");
      return;
    }
    if (!responseFlow.nodes.length) {
      toast.error("Add at least one response");
      return;
    }
    if (hasConflicts) {
      const conflictNames = [...new Set((conflictingKeywords || []).map((c: any) => `"${c.automationName}"`))]
        .join(", ");
      toast.error(
        `Keyword conflict with ${conflictNames}. Please use different keywords.`,
        { duration: 5000 }
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: socialUser?.userId,
        instagram_account_id: activeAccount?.id,
        name,
        trigger_type: triggerType,
        media_id: applyToAllMedia ? null : selectedMedia?.id || null,
        media_url: applyToAllMedia ? null : selectedMedia?.media_url || null,
        media_thumbnail: applyToAllMedia ? null : selectedMedia?.thumbnail_url || selectedMedia?.media_url || null,
        keywords,
        is_case_sensitive: isCaseSensitive,
        comment_reply_enabled: commentReplyEnabled,
        comment_reply_text: commentReplyEnabled ? commentReplyText : null,
        require_follow: requireFollow,
        fallback_comment_reply: fallbackCommentReply,
        response_flow: responseFlow,
        is_active: isActive,
      };
      if (isNew) {
        await createAutomation(payload);
        toast.success("Automation created");
      } else {
        await updateAutomation(id, socialUser.userId, payload);
        toast.success("Automation updated");
      }
      navigate("/dashboard/auto-dm/automations");
    } catch (error: any) {
      toast.error(error.message || "Failed to save automation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AutoDMConnectionGate>
      {!activeAccount ? (
        <div className="rounded-3xl border border-black/10 bg-white p-12 text-center shadow-sm">
          <Instagram className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-4 font-medium text-slate-900">
            Connect an Instagram account first
          </p>
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Toolbar */}
          <div className="flex items-center justify-between rounded-2xl border border-black/8 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 rounded-xl text-slate-500 hover:bg-slate-100"
                onClick={() => navigate("/dashboard/auto-dm/automations")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="h-5 w-px bg-black/10" />
              <Input
                value={name}
                onChange={(event: any) => setName(event.target.value)}
                className="h-auto min-w-0 max-w-xs border-0 bg-transparent px-0 text-base font-semibold text-slate-900 focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2.5">
              {!isNew && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-black/10 text-slate-600"
                  onClick={() =>
                    toast.success(
                      "Re-trigger flow wired for existing automations",
                    )
                  }
                >
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Re-Trigger
                </Button>
              )}
              <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white px-3 py-2 shadow-sm">
                <span className="text-sm text-muted-foreground">Status</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || hasConflicts}
                className="rounded-xl gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>

          {/* Conflict banner */}
          {hasConflicts && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Keyword conflict detected</p>
                <p className="mt-0.5 text-red-600">
                  {conflictingKeywords.map((c) => (
                    <span key={c.keyword}>
                      &ldquo;<strong>{c.keyword}</strong>&rdquo; is already used in &ldquo;{c.automationName}&rdquo;.{" "}
                    </span>
                  ))}
                  Each automation on the same post must have unique keywords.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Left column */}
            <div className="space-y-4">
              {/* Trigger */}
              <Card className="overflow-hidden rounded-2xl border-black/8 shadow-sm">
                <CardHeader className="border-b border-black/5 bg-slate-50/60 pb-3 pt-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    Select a Trigger
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <Select value={triggerType} onValueChange={setTriggerType}>
                    <SelectTrigger className="h-auto rounded-xl border-black/10 py-3">
                      {(() => {
                        const trigger = triggerTypes.find(
                          (t) => t.value === triggerType,
                        );
                        const Icon = trigger?.icon || Zap;
                        return (
                          <Icon className="mr-1 h-4 w-4 flex-shrink-0 text-slate-500" />
                        );
                      })()}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {triggerTypes.map((trigger) => {
                        const Icon = trigger.icon;
                        return (
                          <SelectItem
                            key={trigger.value}
                            value={trigger.value}
                            disabled={!trigger.available}
                            className="bg-white"
                          >
                            <div className="flex items-center gap-2.5 py-0.5">
                              <Icon className="h-4 w-4 text-slate-500" />
                              <span>{trigger.label}</span>
                              {!trigger.available && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  Coming soon
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Media selection */}
              {["comment_on_post", "comment_on_reel"].includes(triggerType) && (
                <Card className="overflow-hidden rounded-2xl border-black/8 shadow-sm">
                  <CardHeader className="border-b border-black/5 bg-slate-50/60 pb-3 pt-4">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Which post or reel should trigger this?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between rounded-xl border border-black/8 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          All posts and reels
                        </p>
                        <p className="text-xs text-slate-400">
                          Use this automation on every post and reel.
                        </p>
                      </div>
                      <Switch
                        checked={applyToAllMedia}
                        onCheckedChange={(checked: any) => {
                          setApplyToAllMedia(checked);
                          if (checked) setSelectedMedia(null);
                        }}
                      />
                    </div>
                    {!applyToAllMedia &&
                      (selectedMedia ? (
                        <div className="space-y-2">
                          <div className="overflow-hidden rounded-xl">
                            <img
                              src={
                                selectedMedia.thumbnail_url ||
                                selectedMedia.media_url
                              }
                              alt=""
                              className="h-48 w-full object-cover"
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-black/10"
                            onClick={() => setSelectedMedia(null)}
                          >
                            Change selection
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="group w-full rounded-xl border-2 border-dashed border-slate-200 p-8 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
                          onClick={() => setMediaDialogOpen(true)}
                        >
                          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-primary/10">
                            <ImageIcon className="h-5 w-5 text-slate-400 transition-colors group-hover:text-primary" />
                          </div>
                          <p className="text-sm font-medium text-slate-700 group-hover:text-primary">
                            Select Instagram media
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Choose a specific post or reel
                          </p>
                        </button>
                      ))}
                  </CardContent>
                </Card>
              )}

              {/* Keywords */}
              <Card className="overflow-hidden rounded-2xl border-black/8 shadow-sm">
                <CardHeader className="border-b border-black/5 bg-slate-50/60 pb-3 pt-4">
                  <CardTitle className="text-sm font-semibold text-slate-900">
                    Trigger Keywords
                  </CardTitle>
                  <p className="text-xs text-slate-400">
                    The automation fires when a comment or DM contains one of
                    these words.
                  </p>
                </CardHeader>
                <CardContent className="p-4">
                  <KeywordInput
                    keywords={keywords}
                    onChange={setKeywords}
                    caseSensitive={isCaseSensitive}
                    onCaseSensitiveChange={setIsCaseSensitive}
                    conflictingKeywords={conflictingKeywords}
                  />
                </CardContent>
              </Card>

              {/* Comment reply */}
              {["comment_on_post", "comment_on_reel", "live_comment"].includes(
                triggerType,
              ) && (
                <Card className="overflow-hidden rounded-2xl border-black/8 shadow-sm">
                  <CardHeader className="border-b border-black/5 bg-slate-50/60 pb-3 pt-4">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Comment Reply
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      Optionally reply to the triggering comment publicly.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-700">
                        Enable public comment reply
                      </Label>
                      <Switch
                        checked={commentReplyEnabled}
                        onCheckedChange={setCommentReplyEnabled}
                      />
                    </div>
                    {commentReplyEnabled && (
                      <Textarea
                        value={commentReplyText}
                        onChange={(event: any) =>
                          setCommentReplyText(event.target.value)
                        }
                        rows={3}
                        placeholder="Check your DM!"
                        className="resize-none rounded-xl border-black/10 text-sm"
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Follow Gate */}
              {["comment_on_post", "comment_on_reel"].includes(
                triggerType,
              ) && (
                <Card className="overflow-hidden rounded-2xl border-black/8 shadow-sm">
                  <CardHeader className="border-b border-black/5 bg-slate-50/60 pb-3 pt-4">
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Instagram Follow Gate
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      Require users to follow your account before sending them a DM.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-slate-700">
                        Only send DM if they follow
                      </Label>
                      <Switch
                        checked={requireFollow}
                        onCheckedChange={setRequireFollow}
                      />
                    </div>
                    {requireFollow && (
                      <div className="space-y-2 mt-2 pt-2 border-t border-black/5">
                        <Label className="text-sm text-slate-700">
                          Fallback Comment Reply
                        </Label>
                        <p className="text-xs text-slate-400 mb-2">
                          If they don't follow you, we'll reply to their comment with this text instead of sending a DM.
                        </p>
                        <Textarea
                          value={fallbackCommentReply}
                          onChange={(event: any) =>
                            setFallbackCommentReply(event.target.value)
                          }
                          rows={2}
                          placeholder="Please follow our account to receive the link!"
                          className="resize-none rounded-xl border-black/10 text-sm"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: Response Flow */}
            <ResponseFlowBuilder
              responseFlow={responseFlow}
              onChange={setResponseFlow}
              step={0}
            />
          </div>

          <MediaSelector
            open={mediaDialogOpen}
            onOpenChange={setMediaDialogOpen}
            onSelect={(media: any) => {
              setSelectedMedia(media);
              setMediaDialogOpen(false);
            }}
          />
        </div>
      )}
    </AutoDMConnectionGate>
  );
}
