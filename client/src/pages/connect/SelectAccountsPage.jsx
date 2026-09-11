import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import apiClient from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { countConnectedTargets } from "../../utils/connectedAccounts";

export default function SelectAccountsPage() {
  const { connectedAccounts, refreshAccounts, user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const provider = params.get("provider") || "platform";
  const pending = params.get("pending");
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [serverLimits, setServerLimits] = useState(null);

  const connectedCount = serverLimits?.connectedCount ?? countConnectedTargets(connectedAccounts);
  const accountLimit = serverLimits?.accountLimit ?? user?.entitlements?.limits?.social_accounts ?? Infinity;
  const availableSlots = Math.max(0, accountLimit - connectedCount);

  useEffect(() => {
    if (!pending) {
      setError("Missing selection token.");
      setLoading(false);
      return;
    }
    apiClient
      .get(`/api/auth/pending-selection/${pending}`)
      .then((res) => {
        const rows = res.data.accounts || [];
        const slots = res.data.availableSlots ?? availableSlots;
        const existing = rows.filter((account) => account.alreadyConnected);
        const newAccounts = rows.filter((account) => !account.alreadyConnected);
        setServerLimits({
          accountLimit: res.data.accountLimit ?? Infinity,
          connectedCount: res.data.connectedCount ?? 0,
        });
        setAccounts(rows);
        if (provider === "facebook" && rows.length < 2) {
          setNotice(
            "Meta returned only one Facebook Page. To add another Page, reconnect Facebook and choose Edit settings in the Meta dialog, then enable the missing Page.",
          );
        } else {
          setNotice("");
        }
        setSelected(new Set([
          ...existing.map((account) => String(account.id)),
          ...newAccounts.slice(0, slots).map((account) => String(account.id)),
        ]));
      })
      .catch((err) => setError(err.response?.data?.error || err.message || "Selection expired."))
      .finally(() => setLoading(false));
  }, [pending]);

  const selectedNewCount = useMemo(
    () => accounts.filter((account) => selected.has(String(account.id)) && !account.alreadyConnected).length,
    [accounts, selected],
  );
  const selectableAccounts = useMemo(
    () => [
      ...accounts.filter((account) => account.alreadyConnected),
      ...accounts.filter((account) => !account.alreadyConnected).slice(0, availableSlots),
    ],
    [accounts, availableSlots],
  );
  const allSelected = useMemo(
    () => selectableAccounts.length > 0 && selectableAccounts.every((account) => selected.has(String(account.id))),
    [selectableAccounts, selected],
  );
  const exceedsLimit = connectedCount + selectedNewCount > accountLimit;

  const toggle = (id) => {
    const account = accounts.find((row) => String(row.id) === String(id));
    if (account?.alreadyConnected) return;
    const next = new Set(selected);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post(`/api/auth/pending-selection/${pending}`, {
        selectedIds: [...selected],
      });
      await refreshAccounts();
      navigate(`/dashboard?success=${provider}_connected`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save accounts.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--canvas)] px-4 py-10 text-[var(--ink)]">
      <section className="mx-auto max-w-3xl">
        <p className="eyebrow">Connect accounts</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
          Choose {provider} accounts
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--slate)]">
          Selected accounts will be available as separate publish targets.
        </p>

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-[var(--slate)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelected(allSelected ? new Set(accounts.filter((a) => a.alreadyConnected).map((a) => String(a.id))) : new Set(selectableAccounts.map((a) => String(a.id))))}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
                disabled={availableSlots === 0}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {notice ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {notice}
                </div>
              ) : null}
              {accounts.map((account) => {
                const checked = selected.has(String(account.id));
                const alreadyConnected = Boolean(account.alreadyConnected);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => toggle(account.id)}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                      alreadyConnected
                        ? "border-green-200 bg-green-50"
                        : checked ? "border-black bg-white shadow-sm" : "border-black/10 bg-white/70"
                    }`}
                    aria-pressed={checked}
                  >
                    {account.picture ? (
                      <img src={account.picture} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-black/10" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-semibold">{account.name || account.id}</span>
                    {alreadyConnected ? (
                      <span className="rounded-full border border-green-200 bg-white px-2 py-1 text-xs font-semibold text-green-700">
                        Already connected
                      </span>
                    ) : checked ? (
                      <span className="rounded-full border border-black/10 bg-black px-2 py-1 text-xs font-semibold text-white">
                        Selected
                      </span>
                    ) : null}
                    {checked ? <Check className="h-5 w-5" /> : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={saving || selected.size === 0 || exceedsLimit}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save selected accounts
            </button>
            {exceedsLimit ? (
              <p className="mt-3 text-sm text-red-700">
                Your plan allows {accountLimit} connected account{accountLimit === 1 ? "" : "s"}. Deselect accounts or upgrade.
              </p>
            ) : null}
            {availableSlots === 0 ? (
              <p className="mt-3 text-sm text-red-700">
                Your plan already has {connectedCount} connected account{connectedCount === 1 ? "" : "s"}. Disconnect one account or upgrade to connect Facebook.
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
