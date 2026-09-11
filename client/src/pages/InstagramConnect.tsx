import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ConnectCard from "@/components/instagram/ConnectCard";
import { Button } from "@/components/ui/button";
import { useInstagramAccounts } from "@/hooks/useInstagramAccounts";

export default function InstagramConnect() {
  const { accounts, loading, syncing, error, refresh } = useInstagramAccounts({ autoSync: true });

  return (
    <div className="min-h-full bg-[var(--canvas)] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--arc)]">GAP Social Pilot</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[var(--ink)]">Instagram Connect</h1>
          </div>
          <Button type="button" variant="outline" asChild className="gap-2">
            <Link to="/dashboard/instapilot?mode=builder">
              <ArrowLeft className="h-4 w-4" />
              Bot Builder
            </Link>
          </Button>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
        {loading || syncing ? (
          <div className="rounded-lg border border-black/10 bg-white p-5 text-sm text-[var(--slate)]">
            {syncing ? "Syncing your existing Social Pilot Instagram connection..." : "Loading connection..."}
          </div>
        ) : null}
        <ConnectCard accounts={accounts} onChanged={refresh} />
      </div>
    </div>
  );
}
