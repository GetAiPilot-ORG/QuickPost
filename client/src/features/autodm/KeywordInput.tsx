import { AlertTriangle, Plus, X } from "lucide-react";
import { useState } from "react";

import InfoHelp from "@/components/InfoHelp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface KeywordConflict {
  keyword: string;
  automationName: string;
  automationId: string;
}

export function KeywordInput({
  keywords,
  onChange,
  caseSensitive,
  onCaseSensitiveChange,
  conflictingKeywords = [],
}: {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (value: boolean) => void;
  conflictingKeywords?: KeywordConflict[];
}) {
  const [inputValue, setInputValue] = useState("");

  const conflictMap = new Map(
    conflictingKeywords.map((c) => [c.keyword.toLowerCase(), c])
  );

  const addKeyword = (wordToAdd?: string) => {
    const raw = (typeof wordToAdd === "string" ? wordToAdd : inputValue).trim();
    if (!raw) return;
    const cleanWord = raw.replace(/\s+/g, " ");
    if (!keywords.some((k) => k.toLowerCase() === cleanWord.toLowerCase())) {
      onChange([...keywords, cleanWord]);
    }
    if (typeof wordToAdd !== "string") {
      setInputValue("");
    }
  };

  const suggestedKeywords = ["link", "info", "price", "send", "yes", "interested", "pdf", "free"];

  return (
    <div className="space-y-3">
      {/* Any comment indicator or Active keywords */}
      {keywords.length === 0 ? (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
            Any comment
          </span>
          <InfoHelp text="Triggers on any comment. Leave empty to reply to everyone, or add keywords below to filter." />
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[var(--ink)]">
                Filtering by keywords ({keywords.length})
              </span>
              <InfoHelp text="Trigger will only activate when a comment contains at least one of these keywords." />
            </div>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-[var(--slate)] hover:text-red-500 transition-colors"
            >
              Clear all (trigger on any comment)
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((keyword) => {
              const conflict = conflictMap.get(keyword.toLowerCase());
              return (
                <div key={keyword} className="flex flex-col gap-1">
                  <Badge
                    variant={conflict ? "destructive" : "secondary"}
                    className={`flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs font-semibold rounded-lg shadow-sm border ${
                      conflict
                        ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        : "bg-orange-50/80 text-[var(--arc,#ea580c)] border-orange-200/70 hover:bg-orange-100/80"
                    }`}
                  >
                    {conflict && <AlertTriangle className="h-3 w-3 mr-0.5 flex-shrink-0" />}
                    <span>{keyword}</span>
                    <button
                      type="button"
                      onClick={() => onChange(keywords.filter((item) => item !== keyword))}
                      className="rounded-full p-0.5 hover:bg-black/10 transition-colors ml-0.5"
                      aria-label={`Remove ${keyword}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                  {conflict && (
                    <p className="text-[10px] text-red-600 leading-tight max-w-[200px]">
                      Already used in &ldquo;{conflict.automationName}&rdquo;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input box */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addKeyword();
            }
          }}
          placeholder={
            keywords.length === 0
              ? "Type a keyword (e.g. price, link, send)..."
              : "Add another keyword..."
          }
          className="flex-1 h-8 text-xs rounded-lg border-black/10 bg-white focus-visible:ring-1 focus-visible:ring-[var(--arc,#ea580c)]"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => addKeyword()}
          disabled={!inputValue.trim()}
          className="h-8 px-3 bg-[var(--arc,#ea580c)] hover:bg-[var(--arc,#ea580c)]/90 text-white font-medium text-xs rounded-lg"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Suggested keywords: Quick add */}
      <div>
        <p className="mb-1 text-[11px] font-medium text-[var(--slate)]">Suggested keywords:</p>
        <div className="flex flex-wrap gap-1.5">
          {suggestedKeywords
            .filter((kw) => !keywords.some((k) => k.toLowerCase() === kw.toLowerCase()))
            .slice(0, 6)
            .map((keyword) => {
              const conflict = conflictMap.get(keyword.toLowerCase());
              return (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => !conflict && addKeyword(keyword)}
                  disabled={!!conflict}
                  title={conflict ? `Already used in "${conflict.automationName}"` : undefined}
                  className={`rounded-full border border-dashed px-2.5 py-0.5 text-[11px] transition-colors ${
                    conflict
                      ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed opacity-60"
                      : "border-black/15 bg-white text-[var(--slate)] hover:border-[var(--arc,#ea580c)] hover:text-[var(--arc,#ea580c)] hover:bg-orange-50/40"
                  }`}
                >
                  {conflict ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {keyword}
                    </span>
                  ) : (
                    `+ ${keyword}`
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Case sensitivity: Only show when at least 1 keyword is configured */}
      {keywords.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-black/[0.06]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-black/10 select-none">
              Aa
            </span>
            <Label htmlFor="case-sensitive" className="text-xs font-medium text-gray-700 cursor-pointer select-none">
              Case-sensitive matching
            </Label>
            <span className="text-[11px] text-gray-400 font-normal">
              {caseSensitive ? "(exact match only)" : "(e.g. LINK and link both match)"}
            </span>
          </div>
          <Switch
            id="case-sensitive"
            checked={caseSensitive}
            onCheckedChange={onCaseSensitiveChange}
            className="scale-90"
          />
        </div>
      )}
    </div>
  );
}
