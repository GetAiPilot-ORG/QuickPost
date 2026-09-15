import { useEffect, useState } from "react";
import { Database, FileText, Globe2, Layers3, Pencil, Plus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/context/DialogContext";
import {
  addKnowledgeSource,
  deleteKnowledgeSource,
  fetchKnowledgeSources,
  updateKnowledgeSource,
} from "@/services/instagramApi";

export default function KnowledgeBaseUploader({ botId }: { botId?: string }) {
  const { confirm } = useDialog();
  const [sources, setSources] = useState<any[]>([]);
  const [sourceType, setSourceType] = useState("manual");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSources = async () => {
    if (!botId) return;
    setSources(await fetchKnowledgeSources(botId));
  };

  useEffect(() => {
    loadSources().catch(() => null);
  }, [botId]);

  const resetForm = () => {
    setTitle("");
    setText("");
    setUrl("");
    setSourceType("manual");
    setEditingSource(null);
  };

  const saveSource = async () => {
    if (!botId) {
      toast.error("Please click 'Save & Unlock Knowledge' above first.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bot_id: botId,
        source_type: sourceType,
        title: title || (sourceType === "website" ? url : "Manual knowledge"),
        text: sourceType === "website" ? undefined : text,
        url: sourceType === "website" ? url : undefined,
      };
      if (editingSource?.id) {
        await updateKnowledgeSource(editingSource.id, payload);
        toast.success("Knowledge updated");
      } else {
        await addKnowledgeSource(payload);
        toast.success("Knowledge processed");
      }
      resetForm();
      await loadSources();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to process knowledge");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (source: any) => {
    setEditingSource(source);
    setSourceType(source.source_type || "manual");
    setTitle(source.title || "");
    setUrl(source.original_file_url || "");
    setText((source.knowledge_chunks || []).map((chunk: any) => chunk.chunk_text).join("\n\n"));
  };

  const removeSource = async (source: any) => {
    const ok = await confirm(
      "Delete knowledge?",
      `Delete "${source.title}" from this bot knowledge base? The bot will stop using this source for replies.`,
      {
        intent: "danger",
        confirmText: "Delete source",
        cancelText: "Keep source",
      },
    );
    if (!ok) return;
    setDeletingId(source.id);
    try {
      await deleteKnowledgeSource(source.id);
      if (editingSource?.id === source.id) resetForm();
      await loadSources();
      toast.success("Knowledge deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Failed to delete knowledge");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#fffaf7] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[var(--arc)]">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--arc)]">Knowledge Base</p>
            <h2 className="text-xl font-semibold text-[var(--ink)]">Business answers</h2>
          </div>
        </div>
        <span className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-[var(--slate)]">{sources.length} sources</span>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {[
            ["manual", FileText, "Text / FAQ"],
            ["pricing", FileText, "Pricing"],
            ["policy", FileText, "Policies"],
            ["product", FileText, "Products"],
            ["website", Globe2, "Website URL"],
          ].map(([type, Icon, label]: any) => (
            <button
              type="button"
              key={type}
              onClick={() => {
                if (editingSource) {
                  resetForm();
                }
                setSourceType(type);
              }}
              className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left text-sm font-semibold transition ${
                sourceType === type ? "border-orange-300 bg-orange-50 text-[var(--ink)] shadow-sm" : "border-black/10 bg-[#f8f6f3] text-[var(--slate)] hover:border-black/20 hover:bg-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {editingSource ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-[var(--ink)]">
              <div>
                <div className="font-semibold">Editing: {editingSource.title}</div>
                <div className="mt-0.5 text-xs text-[var(--slate)]">Save changes to replace indexed chunks.</div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--slate)] transition hover:text-[var(--ink)]"
                aria-label="Cancel edit"
                title="Cancel edit"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="instapilot-input" placeholder="Source title" />
          {sourceType === "website" ? (
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="instapilot-input" placeholder="https://example.com/pricing" />
          ) : (
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="instapilot-input" placeholder="Paste FAQs, product data, pricing, booking rules, refund policy, or service details." />
          )}
          {!botId ? (
            <div className="rounded-lg border border-dashed border-black/20 bg-[#f8f6f3] p-4 text-sm text-[var(--slate)]">
              Step 1: Save the bot above. Step 2: Add this knowledge here.
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={saveSource} disabled={saving} className="gap-2 bg-[var(--arc)] text-white hover:bg-[#d95f27]">
            <Plus className="h-4 w-4" />
            {saving ? "Processing..." : botId ? (editingSource ? "Update Knowledge" : "Add Knowledge") : "Save Bot First"}
          </Button>
          {editingSource ? (
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-black/10 p-5 md:grid-cols-2 xl:grid-cols-3">
        {sources.length === 0 ? (
          <div className="col-span-full flex items-center gap-3 rounded-lg border border-dashed border-black/20 bg-[#f8f6f3] p-5 text-sm text-[var(--slate)]">
            <Layers3 className="h-5 w-5 text-[var(--arc)]" />
            No knowledge added yet. Start with FAQs, services, pricing, and policies.
          </div>
        ) : null}
        {sources.map((source) => (
          <div
            key={source.id}
            className={`rounded-lg border p-4 transition ${
              editingSource?.id === source.id ? "border-orange-300 bg-orange-50" : "border-black/10 bg-[var(--canvas)]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[var(--ink)]">{source.title}</p>
              <span className="rounded bg-white px-2 py-1 text-xs font-bold text-[var(--slate)]">{source.status}</span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--slate)]">{source.source_type}</p>
            <p className="mt-2 text-sm text-[var(--slate)]">{source.knowledge_chunks?.length || 0} chunks indexed</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(source)}
                className="inline-flex items-center gap-1.5 rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:border-orange-300 hover:text-[var(--arc)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => removeSource(source)}
                disabled={deletingId === source.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingId === source.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
