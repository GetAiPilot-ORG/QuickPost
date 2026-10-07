import {
  Instagram,
  Loader2,
  RefreshCw,
  Zap,
  Workflow,
  MessageSquare,
  Heart,
  Plus,
  CheckCircle2,
  Info,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import HeartLikeCheckbox from "@/components/HeartLikeCheckbox";
import {
  getAutoDMStatus,
  importInstagramAccountFromSocial,
} from "@/services/autodm/accounts";
import { KeywordInput } from "./KeywordInput";
import { ResponseFlowBuilder } from "./ResponseFlowBuilder";

export const defaultComposerAutoDMConfig = {
  enabled: false,
  name: "Auto DM for new Instagram post",
  triggerType: "comment_on_post",
  triggerFilter: "all",
  keywords: ["*"],
  isCaseSensitive: false,
  commentReplyEnabled: true,
  commentReplyText: "Sent you the details in DM! ✨",
  commentReplyTexts: [
    "Sent you the details in DM! ✨",
    "Check your direct messages! 📩",
  ],
  autoLikeComment: true,
  requireFollow: false,
  fallbackCommentReply: "Please follow our account to receive the link!",
  responseFlow: {
    opening_message_enabled: true,
    opening_message:
      "Hey there! Thanks for your interest ✨\nClick below to get the details.",
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
            url: "https://",
          },
        ],
      },
    ],
  },
};

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeAbove: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const placeAbove = rect.top > 90;
    setCoords({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left: Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2)),
      placeAbove,
    });
  };

  const showTooltip = () => {
    updatePosition();
    setVisible(true);
  };

  const hideTooltip = () => {
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const handleScrollOrResize = () => setVisible(false);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="relative inline-flex items-center cursor-help ml-1.5 align-middle select-none"
      >
        <Info className="h-3.5 w-3.5 text-black/35 hover:text-black/70 transition-colors" />
      </span>
      {visible &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed pointer-events-none z-[999999] w-max max-w-[240px] rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white shadow-2xl whitespace-normal text-center"
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.placeAbove
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
            }}
          >
            {text}
            <span
              className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                coords.placeAbove
                  ? "top-full border-t-gray-900 -mt-0.5"
                  : "bottom-full border-b-gray-900 -mb-0.5"
              }`}
            />
          </div>,
          document.body
        )}
    </>
  );
}

export function AutoDMComposerPanel({ config, onChange, postType, onSectionFocus }: any) {
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
        if (!cancelled)
          toast.error(error.message || "Failed to check Auto DM account");
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

  const triggerFilter =
    config.triggerFilter ||
    (config.keywords?.includes("*") ? "all" : "keywords");

  const replyInputRef = useRef<HTMLInputElement>(null);

  const insertVariable = (
    variable: "first_name" | "username",
    target: "reply" | "fallback" | "opening" = "reply"
  ) => {
    const tag = variable === "username" ? "@{{username}}" : `{{${variable}}}`;
    if (target === "reply") {
      const current = config.commentReplyText || "";
      const inputEl = replyInputRef.current;
      let nextText = "";
      if (inputEl && typeof inputEl.selectionStart === "number") {
        const start = inputEl.selectionStart;
        const end = inputEl.selectionEnd ?? start;
        nextText = current.slice(0, start) + tag + current.slice(end);
        update({
          commentReplyText: nextText,
          commentReplyTexts: [nextText],
        });
        setTimeout(() => {
          inputEl.focus();
          const nextPos = start + tag.length;
          inputEl.setSelectionRange(nextPos, nextPos);
        }, 10);
        return;
      } else {
        nextText = current ? `${current} ${tag}` : tag;
      }
      update({
        commentReplyText: nextText,
        commentReplyTexts: [nextText],
      });
    } else if (target === "fallback") {
      const current = config.fallbackCommentReply || "";
      update({ fallbackCommentReply: current ? `${current} ${tag}` : tag });
    } else if (target === "opening") {
      const current = config.responseFlow?.opening_message || "";
      update({
        responseFlow: {
          ...config.responseFlow,
          opening_message: current ? `${current} ${tag}` : tag,
        },
      });
    }
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
        config.enabled ? "border-black/15 shadow-sm" : "border-black/10"
      }`}
    >
      {/* Header Area */}
      <div
        className={`flex items-center justify-between p-3.5 transition-colors ${
          config.enabled ? "bg-orange-50/40" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              config.enabled
                ? "bg-[var(--arc,#ea580c)] text-white shadow-sm"
                : "bg-black/5 text-[var(--slate)]"
            }`}
          >
            <Workflow className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)]">
              Auto DM Setup
            </h3>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => update({ enabled: checked })}
        />
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
            <div className="p-4 space-y-5 bg-white">
              {/* Account Status Indicator (Only shown if Instagram is not linked) */}
              {!checking && !instagramReady && (
                <div className="rounded-lg border border-black/[0.07] bg-rose-50/60 p-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-rose-600">
                        Instagram not linked to Auto DM
                      </p>
                      <p className="text-[11px] text-[var(--slate)]">
                        Please import your Instagram account to enable automations.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="bg-white h-7 text-xs"
                      disabled={!canImport || syncing}
                      onClick={async () => {
                        setSyncing(true);
                        try {
                          await importInstagramAccountFromSocial();
                          const nextStatus = await getAutoDMStatus();
                          setStatus(nextStatus);
                          toast.success("Instagram imported successfully!");
                        } catch (error: any) {
                          toast.error(
                            error.message || "Failed to import Instagram"
                          );
                        } finally {
                          setSyncing(false);
                        }
                      }}
                    >
                      {syncing ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3 w-3" />
                      )}
                      Import Account
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 1: Trigger */}
              <div
                className="space-y-3 cursor-pointer"
                onClickCapture={() => onSectionFocus?.("Comments")}
                onFocusCapture={() => onSectionFocus?.("Comments")}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">
                    1
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    When someone comments
                  </h4>
                  <InfoTooltip text="Triggers automatically when someone comments on this post. Leave empty to reply to every comment, or add keywords to reply only to specific words." />
                </div>

                <div className="pl-7 pt-1">
                  <KeywordInput
                    keywords={(config.keywords || []).filter(
                      (k: string) => k && k !== "*"
                    )}
                    onChange={(cleanKeywords) => {
                      if (!cleanKeywords || cleanKeywords.length === 0) {
                        update({
                          keywords: ["*"],
                          triggerFilter: "all",
                        });
                      } else {
                        update({
                          keywords: cleanKeywords,
                          triggerFilter: "keywords",
                        });
                      }
                    }}
                    caseSensitive={config.isCaseSensitive}
                    onCaseSensitiveChange={(isCaseSensitive) =>
                      update({ isCaseSensitive })
                    }
                  />
                </div>
              </div>

              {/* Step 2: Public Reply */}
              <div
                className="space-y-3 cursor-pointer"
                onClickCapture={() => onSectionFocus?.("Comments")}
                onFocusCapture={() => onSectionFocus?.("Comments")}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">
                    2
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    Public comment reply
                  </h4>
                </div>

                <div className="pl-7">
                  <div className="rounded-xl border border-black/10 bg-white p-3.5 transition-all focus-within:border-[var(--arc,#ea580c)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 text-[var(--slate)] mr-1.5" />
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          Enable public reply
                        </span>
                        <InfoTooltip text="Randomly alternates between variations below to avoid Instagram bot/spam detection." />
                      </div>
                      <Switch
                        checked={config.commentReplyEnabled}
                        onCheckedChange={(commentReplyEnabled) =>
                          update({ commentReplyEnabled })
                        }
                      />
                    </div>

                    {config.commentReplyEnabled && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-2 pt-3"
                      >
                        <Input
                          ref={replyInputRef}
                          className="h-8 text-xs rounded-lg border-black/10 bg-white focus-visible:ring-1 focus-visible:ring-[var(--arc,#ea580c)]"
                          value={config.commentReplyText || ""}
                          onChange={(event) => {
                            const val = event.target.value;
                            update({
                              commentReplyText: val,
                              commentReplyTexts: [val],
                            });
                          }}
                          placeholder="e.g. Sent you the details in DM! ✨"
                        />

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[11px] text-[var(--slate)] font-medium">
                            Insert variable:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => insertVariable("first_name", "reply")}
                              className="px-2 py-0.5 rounded-md border border-black/10 bg-gray-50/80 hover:bg-orange-50 hover:border-orange-200 hover:text-[var(--arc,#ea580c)] transition-colors font-mono text-[10px] text-gray-700 font-medium"
                              title="Inserts user's first name"
                            >
                              + &#123;&#123;first_name&#125;&#125;
                            </button>
                            <button
                              type="button"
                              onClick={() => insertVariable("username", "reply")}
                              className="px-2 py-0.5 rounded-md border border-black/10 bg-gray-50/80 hover:bg-orange-50 hover:border-orange-200 hover:text-[var(--arc,#ea580c)] transition-colors font-mono text-[10px] text-gray-700 font-medium"
                              title="Inserts user's @username mention"
                            >
                              + @&#123;&#123;username&#125;&#125;
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Auto-like comment toggle (Coming Soon) */}
                    <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-black/5">
                      <div className="flex items-center gap-2.5">
                        <HeartLikeCheckbox
                          checked={false}
                          disabled={true}
                          onChange={() => toast('Auto-like comment feature is coming soon!', { icon: '✨' })}
                          size={24}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="text-xs font-semibold text-[var(--ink)] cursor-pointer"
                              onClick={() => toast('Auto-like comment feature is coming soon!', { icon: '✨' })}
                            >
                              Auto-like comment
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] font-semibold tracking-wide uppercase bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                              Coming Soon
                            </span>
                          </div>
                        </div>
                      </div>
                      <div onClick={() => toast('Auto-like comment feature is coming soon!', { icon: '✨' })}>
                        <Switch
                          checked={false}
                          disabled={true}
                          className="opacity-50 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Follow Gate */}
              <div
                className="space-y-3 cursor-pointer"
                onClickCapture={() => onSectionFocus?.("Comments")}
                onFocusCapture={() => onSectionFocus?.("Comments")}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">
                    3
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    Instagram Follow Gate
                  </h4>
                </div>

                <div className="pl-7">
                  <div className="rounded-xl border border-black/10 bg-white p-3.5 transition-all focus-within:border-[var(--arc,#ea580c)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center">
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          Only send DM if they follow
                        </span>
                        <InfoTooltip text="Requires users to follow your account before sending them the DM link. If they don't follow, your fallback comment reply is posted instead." />
                      </div>
                      <Switch
                        checked={config.requireFollow}
                        onCheckedChange={(requireFollow) =>
                          update({ requireFollow })
                        }
                      />
                    </div>

                    {config.requireFollow && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="pt-3 border-t border-black/5 mt-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Label className="text-xs text-[var(--slate)]">
                              Fallback Comment Reply
                            </Label>
                            <InfoTooltip text="Public reply posted when the commenter does not follow your account." />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                insertVariable("first_name", "fallback")
                              }
                              className="px-2 py-0.5 rounded-md border border-black/10 bg-gray-50/80 hover:bg-orange-50 hover:border-orange-200 hover:text-[var(--arc,#ea580c)] transition-colors font-mono text-[10px] text-gray-700 font-medium"
                            >
                              + &#123;&#123;first_name&#125;&#125;
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                insertVariable("username", "fallback")
                              }
                              className="px-2 py-0.5 rounded-md border border-black/10 bg-gray-50/80 hover:bg-orange-50 hover:border-orange-200 hover:text-[var(--arc,#ea580c)] transition-colors font-mono text-[10px] text-gray-700 font-medium"
                            >
                              + @&#123;&#123;username&#125;&#125;
                            </button>
                          </div>
                        </div>
                        <Textarea
                          className="min-h-[50px] resize-none border border-black/10 bg-white focus-visible:ring-1 focus-visible:ring-[var(--arc,#ea580c)] p-2 text-xs rounded-lg"
                          value={config.fallbackCommentReply}
                          onChange={(event) =>
                            update({
                              fallbackCommentReply: event.target.value,
                            })
                          }
                          placeholder="Please follow our account first so we can send you the link!"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 4: Private DM */}
              <div
                className="space-y-3 cursor-pointer"
                onClickCapture={() => onSectionFocus?.("DM")}
                onFocusCapture={() => onSectionFocus?.("DM")}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/5 text-[10px] font-bold text-[var(--slate)]">
                    4
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    Private DM flow
                  </h4>
                </div>

                <div className="pl-7 space-y-3">
                  {/* Opening DM Card */}
                  <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          Opening DM with Button
                        </span>
                        <InfoTooltip text="Recommended by Meta: The user taps an interactive button first to open Instagram's 24-hour messaging window." />
                      </div>
                      <Switch
                        checked={Boolean(
                          config.responseFlow?.opening_message_enabled
                        )}
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
                      <div className="p-3.5 pt-0 border-t border-black/5 space-y-2.5 bg-gray-50/20">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-[var(--slate)]">
                              Message Text
                            </Label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  insertVariable("first_name", "opening")
                                }
                                className="px-2 py-0.5 rounded-md border border-black/10 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-[var(--arc,#ea580c)] transition-colors font-mono text-[10px] text-gray-700 font-medium"
                              >
                                + &#123;&#123;first_name&#125;&#125;
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  insertVariable("username", "opening")
                                }
                                className="px-2 py-0.5 rounded-md border border-black/10 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-[var(--arc,#ea580c)] transition-colors font-mono text-[10px] text-gray-700 font-medium"
                              >
                                + @&#123;&#123;username&#125;&#125;
                              </button>
                            </div>
                          </div>
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
                            className="min-h-[70px] resize-none rounded-lg border border-black/10 text-xs leading-relaxed p-2 bg-white focus-visible:ring-1 focus-visible:ring-[var(--arc,#ea580c)]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-[var(--slate)]">
                            Button Text
                          </Label>
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
                            className="rounded-lg border border-black/10 text-xs h-8 px-2.5 bg-white focus-visible:ring-1 focus-visible:ring-[var(--arc,#ea580c)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flow Builder Card */}
                  <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          {config.responseFlow?.opening_message_enabled
                            ? "Message after button tap"
                            : "Direct Message Content"}
                        </span>
                        <InfoTooltip
                          text={
                            config.responseFlow?.opening_message_enabled
                              ? `Delivered immediately after the user taps “${
                                  config.responseFlow?.opening_button ||
                                  "Send me the link"
                                }”.`
                              : "Delivered directly into the user's Instagram DMs."
                          }
                        />
                      </div>
                    </div>
                    <div className="p-3.5 pt-0 bg-white">
                      <ResponseFlowBuilder
                        responseFlow={config.responseFlow}
                        onChange={(responseFlow: any) =>
                          update({ responseFlow })
                        }
                        compact={true}
                        step={
                          config.responseFlow?.opening_message_enabled ? 2 : 0
                        }
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
