import { AlertTriangle, Info, Plus, X } from "lucide-react";
import { useState } from "react";

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

  const addKeyword = () => {
    const trimmed = inputValue.trim().split(" ")[0];
    if (trimmed && !keywords.includes(trimmed)) {
      onChange([...keywords, trimmed]);
      setInputValue("");
    }
  };

  const suggestedKeywords = ["link", "info", "price", "send", "yes", "interested", "pdf", "free"];

  return (
    <div className="space-y-4">
      {keywords.length === 0 && (
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value.replace(/\s/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addKeyword();
              }
            }}
            placeholder="Enter a single keyword..."
            className="flex-1"
          />
          <Button type="button" onClick={addKeyword} disabled={!inputValue.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
      )}

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => {
            const conflict = conflictMap.get(keyword.toLowerCase());
            return (
              <div key={keyword} className="flex flex-col gap-1">
                <Badge
                  variant={conflict ? "destructive" : "secondary"}
                  className={`flex items-center gap-1 pl-3 pr-1 py-1 text-sm ${
                    conflict
                      ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100"
                      : ""
                  }`}
                >
                  {conflict && <AlertTriangle className="h-3 w-3 mr-0.5 flex-shrink-0" />}
                  {keyword}
                  <button
                    onClick={() => onChange(keywords.filter((item) => item !== keyword))}
                    className="rounded-full p-0.5 hover:bg-black/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
                {conflict && (
                  <p className="text-xs text-red-600 leading-tight max-w-[200px]">
                    Already used in &ldquo;{conflict.automationName}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {keywords.length === 0 && (
        <div>
          <p className="mb-2 text-sm text-[var(--slate)]">Suggested keywords:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedKeywords
              .filter((keyword) => !keywords.includes(keyword))
              .slice(0, 5)
              .map((keyword) => {
                const conflict = conflictMap.get(keyword.toLowerCase());
                return (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => !conflict && onChange([...keywords, keyword])}
                    disabled={!!conflict}
                    title={conflict ? `Already used in "${conflict.automationName}"` : undefined}
                    className={`rounded-full border border-dashed px-3 py-1 text-sm transition-colors ${
                      conflict
                        ? "border-red-200 bg-red-50 text-red-400 cursor-not-allowed opacity-60"
                        : "border-black/15 bg-white hover:border-[var(--arc)] hover:text-[var(--arc)]"
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
      )}

      <div className="flex items-center justify-between gap-4 rounded-[14px] bg-black/[0.035] p-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="case-sensitive" className="text-sm font-normal">
            Case sensitive matching
          </Label>
          <div className="group relative">
            <Info className="h-4 w-4 cursor-help text-[var(--slate)]" />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              When off, &quot;LINK&quot; and &quot;link&quot; are treated the same
            </div>
          </div>
        </div>
        <Switch id="case-sensitive" checked={caseSensitive} onCheckedChange={onCaseSensitiveChange} />
      </div>
    </div>
  );
}
