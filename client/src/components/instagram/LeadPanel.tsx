import React from "react";
import { Link } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  RefreshIcon,
  UserIcon,
  CallIcon,
  Mail01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export default function LeadPanel({
  lead,
  onRefresh,
  syncing,
}: {
  lead?: any;
  onRefresh?: () => void;
  syncing?: boolean;
}) {
  return (
    <section className="flex flex-col justify-between h-full min-h-0 rounded-lg border border-black/10 bg-white p-4 shadow-sm overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
        {/* Actions inside Saved details box */}
        <div className="flex items-center gap-2 pb-3.5 border-b border-black/10 mb-3.5">
          <Button variant="outline" size="sm" asChild className="flex-1 gap-1.5 text-xs h-8 bg-white">
            <Link to="/dashboard/instapilot?mode=builder">
              <HugeiconsIcon icon={ArrowLeft02Icon} size={14} strokeWidth={1.8} />
              Builder
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={syncing}
            className="flex-1 gap-1.5 text-xs h-8 bg-white"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={14}
              strokeWidth={1.8}
              className={syncing ? "animate-spin" : ""}
            />
            {syncing ? "Syncing..." : "Sync"}
          </Button>
        </div>

        <p className="text-[11px] font-semibold text-[var(--arc)]">Customer</p>
        <h2 className="text-lg font-bold text-[var(--ink)]">Saved details</h2>

        <div className="mt-3 space-y-2.5">
          <LeadField icon={<HugeiconsIcon icon={UserIcon} size={16} strokeWidth={1.8} />} label="Name" value={lead?.name} />
          <LeadField icon={<HugeiconsIcon icon={CallIcon} size={16} strokeWidth={1.8} />} label="Phone" value={lead?.phone} />
          <LeadField icon={<HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={1.8} />} label="Email" value={lead?.email} />
          <LeadField icon={<HugeiconsIcon icon={Location01Icon} size={16} strokeWidth={1.8} />} label="City" value={lead?.city} />
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-[var(--canvas)] p-3 text-xs leading-relaxed text-[var(--slate)] shrink-0">
        {lead?.requirement || "Details appear here when a customer shares them in chat."}
      </div>
    </section>
  );
}

function LeadField({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-black/10 bg-[var(--canvas)] px-3 py-2">
      <span className="text-[var(--slate)] shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-[var(--slate)]">{label}</div>
        <div className="truncate text-xs font-bold text-[var(--ink)]">{value || "Not captured"}</div>
      </div>
    </div>
  );
}
