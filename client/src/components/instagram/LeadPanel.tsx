import { Mail, MapPin, Phone, UserRound } from "lucide-react";

export default function LeadPanel({ lead }: { lead?: any }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-[var(--arc)]">Customer</p>
      <h2 className="mt-1 text-xl font-semibold text-[var(--ink)]">Saved details</h2>
      <div className="mt-4 space-y-3">
        <LeadField icon={<UserRound className="h-4 w-4" />} label="Name" value={lead?.name} />
        <LeadField icon={<Phone className="h-4 w-4" />} label="Phone" value={lead?.phone} />
        <LeadField icon={<Mail className="h-4 w-4" />} label="Email" value={lead?.email} />
        <LeadField icon={<MapPin className="h-4 w-4" />} label="City" value={lead?.city} />
      </div>
      <div className="mt-4 rounded-lg bg-[var(--canvas)] p-4 text-sm text-[var(--slate)]">
        {lead?.requirement || "Details appear here when a customer shares them in chat."}
      </div>
    </section>
  );
}

function LeadField({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-[var(--canvas)] px-3 py-2">
      <span className="text-[var(--slate)]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-[var(--slate)]">{label}</div>
        <div className="truncate text-sm font-semibold text-[var(--ink)]">{value || "Not captured"}</div>
      </div>
    </div>
  );
}
