import { Instagram, Loader2, RefreshCw, Zap, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAutoDMStatus, importInstagramAccountFromSocial } from "@/services/autodm/accounts";
import { KeywordInput } from "./KeywordInput";
import { ResponseFlowBuilder } from "./ResponseFlowBuilder";

const triggerOptions = [
  { value: "comment_on_post", label: "Comments on this post" },
  { value: "comment_on_reel", label: "Comments on this reel" },
];

export const defaultComposerAutoDMConfig = {
  enabled: false,
  name: "Auto DM for new Instagram post",
  triggerType: "comment_on_post",
  keywords: [],
  isCaseSensitive: false,
  commentReplyEnabled: true,
  commentReplyText: "Sent you the details in DM.",
  requireFollow: false,
  fallbackCommentReply: "Please follow our account to receive the link!",
  responseFlow: {
    opening_message_enabled: true,
    opening_message: "Hey there! Thanks for your interest ✨\nClick below to get the details.",
    opening_button: "Send me the link",
    nodes: [
      {
        id: "composer_card_1",
        type: "card",
        card_title: "Here is what you requested",
        card_subtitle: "",
        card_image_url: "",
        buttons: [
          {
            id: "btn_1",
            type: "web_url",
            title: "Visit Website",
            url: "https://"
          }
        ]
      },
    ],
  },
};

export function AutoDMComposerPanel({ config, onChange, postType }: any) {
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const instagramReady = Boolean(status?.autodmAccounts?.length);
  const canImport = Boolean(status?.hasSocialInstagramConnection);

  const update = (updates: any) => onChange({ ...config, ...updates });

  useEffect(() => {
    let cancelled = false;
    if (!config.enabled) return;

    setChecking(true);
    getAutoDMStatus()
      .then((nextStatus) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch((error: any) => {
        if (!cancelled) toast.error(error.message || "Failed to check Auto DM account");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config.enabled]);

  useEffect(() => {
    if (postType === "reel" && config.triggerType !== "comment_on_reel") {
      update({ triggerType: "comment_on_reel" });
    }
  }, [postType]);

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${config.enabled ? 'border-black/15' : 'border-black/10'}`}>
      
      {/* Header Area */}
      <div className={`flex items-center justify-between p-4 transition-colors ${config.enabled ? 'bg-orange-50/50' : ''}`}>
        <div className="flex items-center gap-3.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${config.enabled ? 'bg-[var(--arc)] text-white' : 'bg-black/5 text-[var(--slate)]'}`}>
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)]">Auto DM Setup</h3>
            <p className="text-xs text-[var(--slate)] mt-0.5">Automate replies and DMs for this post</p>
          </div>
        </div>
        <Switch checked={config.enabled} onCheckedChange={(checked) => update({ enabled: checked })} />
      </div>

      {/* Expanded Content Area */}
      <AnimatePresence>
        {config.enabled && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-black/5 overflow-hidden"
          >
            <div className="p-4 space-y-6 bg-white">
              
              {/* Account Status Banner */}
              <div className="rounded-xl border border-black/10 bg-gray-50/70 p-3">
                {checking ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--slate)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking Instagram connection...
                  </div>
                ) : instagramReady ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <Instagram className="h-4 w-4" />
                    Instagram connected and ready for Auto DM
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-rose-600">Instagram not linked to Auto DM</p>
                      <p className="mt-1 text-xs text-[var(--slate)]">
                        Please import your Instagram account to enable automations.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="bg-white"
                      disabled={!canImport || syncing}
                      onClick={async () => {
                        setSyncing(true);
                        try {
                          await importInstagramAccountFromSocial();
                          const nextStatus = await getAutoDMStatus();
                          setStatus(nextStatus);
                          toast.success("Instagram imported successfully!");
                        } catch (error: any) {
                          toast.error(error.message || "Failed to import Instagram");
                        } finally {
                          setSyncing(false);
                        }
                      }}
                    >
                      {syncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                      Import Account
                    </Button>
                  </div>
                )}
              </div>

              {/* Step 1: Trigger */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">1</div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">When someone comments</h4>
                </div>
                
                <div className="pl-8 space-y-5">
                  <div className="grid gap-2">
                    <Label className="text-xs text-[var(--slate)]">Trigger Source</Label>
                    <Select value={config.triggerType} onValueChange={(value) => update({ triggerType: value })}>
                      <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {triggerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs text-[var(--slate)]">Trigger Keywords</Label>
                    <KeywordInput
                      keywords={config.keywords}
                      onChange={(keywords) => update({ keywords })}
                      caseSensitive={config.isCaseSensitive}
                      onCaseSensitiveChange={(isCaseSensitive) => update({ isCaseSensitive })}
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Public Reply */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">2</div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">Publicly reply to them</h4>
                </div>
                
                <div className="pl-8">
                  <div className="rounded-xl border border-black/10 bg-white p-4 transition-all focus-within:border-[var(--arc)] focus-within:ring-1 focus-within:ring-[var(--arc)]">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[var(--slate)]" />
                        <span className="text-xs font-medium text-[var(--ink)]">Enable public reply</span>
                      </div>
                      <Switch checked={config.commentReplyEnabled} onCheckedChange={(commentReplyEnabled) => update({ commentReplyEnabled })} />
                    </div>
                    {config.commentReplyEnabled && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <Textarea
                          className="mt-2 min-h-[80px] resize-none border-none bg-gray-50/50 focus-visible:ring-0 p-3 text-sm rounded-lg"
                          value={config.commentReplyText}
                          onChange={(event) => update({ commentReplyText: event.target.value })}
                          placeholder="e.g. Sent you the details in DM!"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Follow Gate */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">3</div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">Instagram Follow Gate</h4>
                </div>
                
                <div className="pl-8">
                  <div className="rounded-xl border border-black/10 bg-white p-4 transition-all focus-within:border-[var(--arc)] focus-within:ring-1 focus-within:ring-[var(--arc)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[var(--ink)]">Only send DM if they follow</div>
                        <p className="text-xs text-[var(--slate)] mt-1">Require users to follow your account before sending them a DM.</p>
                      </div>
                      <Switch checked={config.requireFollow} onCheckedChange={(requireFollow) => update({ requireFollow })} />
                    </div>
                    {config.requireFollow && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <div className="mt-4 pt-4 border-t border-black/5">
                          <Label className="text-xs text-[var(--slate)] mb-2 block">Fallback Comment Reply</Label>
                          <Textarea
                            className="min-h-[60px] resize-none border-none bg-gray-50/50 focus-visible:ring-0 p-3 text-sm rounded-lg"
                            value={config.fallbackCommentReply}
                            onChange={(event) => update({ fallbackCommentReply: event.target.value })}
                            placeholder="Please follow our account to receive the link!"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 4: Private DM */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">4</div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">Privately send them a DM</h4>
                </div>
                
                <div className="pl-8 space-y-4">
                  {/* Opening DM Card */}
                  <div className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
                    <div className="bg-gray-50/50 border-b border-black/5 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1683dd] text-sm font-bold text-white">
                          1
                        </span>
                        <div>
                          <p className="font-semibold text-sm text-[var(--ink)]">Opening DM</p>
                          <p className="text-xs text-[var(--slate)]">Sent first with a button, like the screenshot.</p>
                        </div>
                      </div>
                      <Switch
                        checked={Boolean(config.responseFlow?.opening_message_enabled)}
                        onCheckedChange={(checked) =>
                          update({
                            responseFlow: {
                              ...config.responseFlow,
                              opening_message_enabled: checked,
                            },
                          })
                        }
                      />
                    </div>

                    {config.responseFlow?.opening_message_enabled && (
                      <div className="space-y-3 p-4 bg-white">
                        <Textarea
                          value={config.responseFlow?.opening_message || ""}
                          onChange={(e) =>
                            update({
                              responseFlow: {
                                ...config.responseFlow,
                                opening_message: e.target.value,
                              },
                            })
                          }
                          placeholder="Hey there! Thanks for your interest ✨&#10;Click below to get the details."
                          className="min-h-[100px] resize-none rounded-lg border border-black/10 text-sm leading-relaxed p-3 focus-visible:ring-1 focus-visible:ring-[var(--arc)]"
                        />
                        <Input
                          value={config.responseFlow?.opening_button || ""}
                          onChange={(e) =>
                            update({
                              responseFlow: {
                                ...config.responseFlow,
                                opening_button: e.target.value,
                              },
                            })
                          }
                          placeholder="Send me the link"
                          className="rounded-lg border border-black/10 text-sm h-10 px-3 focus-visible:ring-1 focus-visible:ring-[var(--arc)]"
                        />
                      </div>
                    )}
                  </div>

                  {/* Flow Builder Card */}
                  <div className="rounded-xl border border-black/10 bg-white shadow-sm overflow-hidden">
                    <div className="bg-gray-50/50 border-b border-black/5 p-4 flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#111111] text-sm font-bold text-white">
                        {config.responseFlow?.opening_message_enabled ? "2" : "1"}
                      </span>
                      <div>
                        <p className="font-semibold text-sm text-[var(--ink)]">
                          {config.responseFlow?.opening_message_enabled ? "After they tap the button" : "Direct Message Flow"}
                        </p>
                        <p className="text-xs text-[var(--slate)]">
                          {config.responseFlow?.opening_message_enabled
                            ? `Shown after the user sends “${config.responseFlow?.opening_button || 'Send me the link'}”.`
                            : "Sent directly to the user in DM."}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-[var(--canvas-lifted)]">
                      <ResponseFlowBuilder
                        responseFlow={config.responseFlow}
                        onChange={(responseFlow: any) => update({ responseFlow })}
                        compact={true}
                        step={config.responseFlow?.opening_message_enabled ? 2 : 0}
                        hideHeader={true}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
