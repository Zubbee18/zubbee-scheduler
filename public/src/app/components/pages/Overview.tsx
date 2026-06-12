import { useState } from "react";
import {
  Globe,
  Search,
  Network,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { Card, AreaSpark } from "../primitives";
import { API_KEY, scrapedSeries } from "../data";

const endpoints = [
  { icon: Globe, name: "Scrape", desc: "Get web data from websites — Markdown, JSON, screenshots, etc." },
  { icon: Search, name: "Search", badge: "NEW", desc: "Search the web and get full content from results." },
  { icon: Network, name: "Crawl", desc: "Crawl all the pages on a website and get data for each page." },
  { icon: Sparkles, name: "Extract", desc: "Get structured data from websites with AI." },
];

const integrations = [
  "Python", "JS/TS SDK", "Langchain",
  "Langchain JS", "LlamaIndex", "Zapier",
  "Make", "Discord", "CrewAI",
  "Dify", "Pixelse", "Pipedream",
  "n8n", "Composio", "Langflow",
  "Vectorize", "CAMEL-AI", "Praison AI",
  "Superinterface", "RAGaaS", "Cargo",
  "Pabbly Connect",
];

const exampleProjects = [
  { title: "30+ Examples", desc: "Collection of simple projects built with Firecrawl", tags: ["TypeScript", "Python", "Firecrawl SDK"] },
  { title: "LLMs.txt Generator", desc: "Generate an llms.txt web app built on Next.js", tags: ["TypeScript", "Next.js", "Firecrawl SDK"] },
  { title: "Trend Finder", desc: "Stay on top of trending topics on the web with AI", tags: ["TypeScript", "Firecrawl SDK"] },
  { title: "Open Deep Research", desc: "Open source version of OpenAI's Deep Research", tags: ["Next.js", "AI SDK", "Firecrawl SDK"] },
  { title: "Full App Examples", desc: "Full Firecrawl apps with source code and instructions", tags: ["Python", "TypeScript", "Firecrawl SDK"] },
];

const mcpSnippet = `{
  "mcpServers": {
    "firecrawl-mcp": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "$API_KEY"
      }
    }
  }
}`;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="grid size-7 place-items-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-600">{children}</span>
  );
}

export function Overview() {
  const [revealed, setRevealed] = useState(false);
  const total = scrapedSeries.reduce((s, d) => s + d.pages, 0);

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <div>
        <h1 className="text-[22px] tracking-tight text-neutral-900">Explore our endpoints</h1>
        <p className="mt-1 text-[13px] text-neutral-500">
          Power your applications with our comprehensive scraping API.
        </p>
      </div>

      {/* Endpoints */}
      <div className="grid grid-cols-1 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {endpoints.map(({ icon: Icon, name, desc, badge }) => (
          <button key={name} className="group p-4 text-left transition-colors hover:bg-neutral-50">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-neutral-700" />
              <span className="text-[13px] text-neutral-900">{name}</span>
              {badge && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-600">{badge}</span>
              )}
              <ChevronDown className="ml-auto size-3.5 text-neutral-300" />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">{desc}</p>
          </button>
        ))}
      </div>

      {/* Chart + API key + MCP */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[14px] text-neutral-900">Scraped pages — Last 7 days</h2>
              <p className="text-[12px] text-neutral-400">Credit usage differs</p>
            </div>
            <span className="text-[26px] tabular-nums tracking-tight text-neutral-900">{total}</span>
          </div>
          <div className="mt-4">
            <AreaSpark data={scrapedSeries} height={168} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-[14px] text-neutral-900">API Key</h2>
            <p className="text-[12px] text-neutral-400">Start scraping right away</p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
              <code className="flex-1 truncate font-mono text-[12px] text-neutral-700">
                {revealed ? API_KEY : "fc-•••••••••••••••••••••••••••••a8a"}
              </code>
              <button onClick={() => setRevealed((r) => !r)} className="text-neutral-400 hover:text-neutral-600">
                {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <CopyButton value={API_KEY} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[14px] text-neutral-900">MCP Integration</h2>
                <p className="text-[12px] text-neutral-400">Connect with AI tools</p>
              </div>
              <CopyButton value={mcpSnippet} />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 p-4 font-mono text-[11px] leading-relaxed text-neutral-200">
              {mcpSnippet}
            </pre>
          </Card>
        </div>
      </div>

      {/* Concurrent browsers */}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] text-neutral-900">Concurrent Browsers</h2>
            <span className="flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600">
              <span className="size-1.5 rounded-full bg-emerald-500" /> LIVE
            </span>
          </div>
          <p className="mt-1 text-[12px] text-neutral-400">
            # of active browsers — <span className="text-orange-500">upgrade plan</span> for faster scraping.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-full border-2 border-neutral-200 text-[15px] tabular-nums text-neutral-900">
            0
          </div>
          <span className="text-[13px] text-neutral-500">of 5 active browsers</span>
        </div>
      </Card>

      {/* Integrations + Example projects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 text-[15px] text-neutral-900">Integrations</h2>
          <Card className="grid grid-cols-1 divide-y divide-neutral-100 overflow-hidden sm:grid-cols-3 sm:divide-y-0">
            {integrations.map((name) => (
              <button
                key={name}
                className="flex items-center gap-2 px-3 py-2.5 text-left text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded bg-neutral-100 text-[10px] text-neutral-500">
                  {name[0]}
                </span>
                <span className="truncate">{name}</span>
                <ExternalLink className="ml-auto size-3 shrink-0 text-neutral-300" />
              </button>
            ))}
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-[15px] text-neutral-900">Example Projects</h2>
          <Card className="divide-y divide-neutral-100">
            {exampleProjects.map((p) => (
              <button key={p.title} className="block w-full p-4 text-left transition-colors hover:bg-neutral-50">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-neutral-900">{p.title}</span>
                  <ExternalLink className="size-3.5 text-neutral-300" />
                </div>
                <p className="mt-1 text-[12px] text-neutral-500">{p.desc}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
