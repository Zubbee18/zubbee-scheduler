import { useState } from "react";
import { Copy, Check, Plus, Sparkles } from "lucide-react";
import { Card, BarMini } from "../primitives";
import { API_KEY, scrapedSeries } from "../data";

export function Extract() {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="pt-2 text-center">
        <h1 className="text-[30px] tracking-tight text-neutral-900">Extract</h1>
        <p className="mt-1 text-[13px] text-neutral-500">
          Get structured data from any website with AI.
        </p>
      </div>
      <Card className="mt-6 p-2 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="ml-2 size-4 text-orange-500" />
          <input
            placeholder="https:// example.com/*"
            className="flex-1 bg-transparent px-1 py-2 text-[14px] outline-none placeholder:text-neutral-400"
          />
          <button className="rounded-lg bg-orange-500 px-4 py-2 text-[13px] text-white hover:bg-orange-600">
            Extract
          </button>
        </div>
      </Card>
      <Card className="mt-4 p-5">
        <p className="text-[13px] text-neutral-500">
          Describe what you want, then refine the schema in the Playground. Extraction runs against
          every page matched by your URL pattern.
        </p>
      </Card>
    </div>
  );
}

export function Usage() {
  const total = scrapedSeries.reduce((s, d) => s + d.pages, 0);
  return (
    <div className="mx-auto max-w-[1100px]">
      <h1 className="text-[22px] tracking-tight text-neutral-900">Usage</h1>
      <p className="mt-1 text-[13px] text-neutral-500">Track your credit consumption over time.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Credits used", value: "145" },
          { label: "Credits remaining", value: "1,855" },
          { label: "Plan", value: "Free" },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-[12px] text-neutral-400">{s.label}</p>
            <p className="mt-1 text-[26px] tabular-nums tracking-tight text-neutral-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-[14px] text-neutral-900">Credits used — last 7 days</h2>
        <div className="mt-4">
          <BarMini data={scrapedSeries} height={224} />
        </div>
        <p className="mt-2 text-[12px] text-neutral-400">{total} pages scraped this period.</p>
      </Card>
    </div>
  );
}

export function ApiKeys() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] tracking-tight text-neutral-900">API Keys</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Manage keys used to authenticate requests.</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-[13px] text-white hover:bg-orange-600">
          <Plus className="size-4" /> Create key
        </button>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="grid grid-cols-[1fr_2fr_120px] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 text-[11px] uppercase tracking-wide text-neutral-400">
          <span>Name</span>
          <span>Key</span>
          <span>Created</span>
        </div>
        <div className="grid grid-cols-[1fr_2fr_120px] items-center gap-3 px-4 py-3 text-[13px]">
          <span className="text-neutral-700">Default</span>
          <div className="flex items-center gap-2">
            <code className="truncate font-mono text-[12px] text-neutral-600">{API_KEY}</code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(API_KEY);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              }}
              className="text-neutral-400 hover:text-neutral-600"
            >
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          <span className="text-[12px] text-neutral-500">Aug 12, 2025</span>
        </div>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-[700px]">
      <h1 className="text-[22px] tracking-tight text-neutral-900">Settings</h1>
      <p className="mt-1 text-[13px] text-neutral-500">Manage your team and account preferences.</p>

      <Card className="mt-6 divide-y divide-neutral-100">
        {[
          { label: "Team name", value: "Personal Team" },
          { label: "Email", value: "samiee@content.mobbin.com" },
          { label: "Plan", value: "Free" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] text-neutral-500">{row.label}</span>
            <span className="text-[13px] text-neutral-800">{row.value}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
