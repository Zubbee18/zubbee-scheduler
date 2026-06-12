// Mock data backing the Firecrawl dashboard rebuild.

export type RunStatus = "success" | "failed" | "running";

export type Run = {
  id: string;
  url: string;
  favicon: string;
  endpoint: "Map" | "Scrape" | "Crawl" | "Search";
  status: RunStatus;
  started: string;
};

export const recentRuns: Run[] = [
  { id: "r1", url: "www.firecrawl.dev/", favicon: "🔥", endpoint: "Map", status: "success", started: "Sep 4, 2025 · 3:35 PM" },
  { id: "r2", url: "www.nngroup.com/articles/us…", favicon: "N", endpoint: "Scrape", status: "success", started: "Sep 2, 2025 · 7:44 AM" },
  { id: "r3", url: "www.nngroup.com/articles/us…", favicon: "N", endpoint: "Scrape", status: "success", started: "Sep 2, 2025 · 7:55 AM" },
  { id: "r4", url: "docs.firecrawl.dev/features", favicon: "📕", endpoint: "Crawl", status: "running", started: "Sep 1, 2025 · 11:02 AM" },
  { id: "r5", url: "stripe.com/pricing", favicon: "S", endpoint: "Scrape", status: "failed", started: "Aug 30, 2025 · 6:18 PM" },
];

export type LogEntry = {
  id: string;
  endpoint: "CRAWL" | "MAP" | "SCRAPE" | "SEARCH" | "EXTRACT";
  url: string;
  status: "COMPLETED" | "FAILED" | "RUNNING";
  credits: number;
  time: string;
};

export const activityLogs: LogEntry[] = [
  { id: "l1", endpoint: "CRAWL", url: "http://firecrawl.dev", status: "COMPLETED", credits: 18, time: "Sep 08, 25 · 09:07 AM" },
  { id: "l2", endpoint: "MAP", url: "http://www.firecrawl.dev", status: "COMPLETED", credits: 1, time: "Sep 04, 25 · 03:35 PM" },
  { id: "l3", endpoint: "SCRAPE", url: "http://www.nngroup.com/articles/usability-101-introduction-to-u…", status: "COMPLETED", credits: 5, time: "Sep 02, 25 · 07:46 AM" },
  { id: "l4", endpoint: "SCRAPE", url: "http://www.nngroup.com/articles/usability-101-introduction-to-u…", status: "COMPLETED", credits: 5, time: "Sep 02, 25 · 07:38 AM" },
  { id: "l5", endpoint: "SEARCH", url: "Top museum in New York City", status: "COMPLETED", credits: 2, time: "Sep 01, 25 · 04:55 PM" },
  { id: "l6", endpoint: "EXTRACT", url: "http://www.firecrawl.dev/pricing", status: "FAILED", credits: 0, time: "Aug 30, 25 · 06:18 PM" },
  { id: "l7", endpoint: "SCRAPE", url: "http://stripe.com/pricing", status: "COMPLETED", credits: 3, time: "Aug 29, 25 · 10:11 AM" },
  { id: "l8", endpoint: "CRAWL", url: "http://docs.firecrawl.dev", status: "RUNNING", credits: 0, time: "Aug 28, 25 · 02:30 PM" },
];

export const endpointFilters = ["All Endpoints", "Crawl", "Map", "Scrape", "Search", "Extract"] as const;
export const dateFilters = ["Last 24 hours", "Last 7 days", "Last 30 days", "All time"] as const;

// Scraped pages — last 7 days, charted as an area series.
export const scrapedSeries = [
  { day: "Sep 02", pages: 4 },
  { day: "Sep 03", pages: 9 },
  { day: "Sep 04", pages: 22 },
  { day: "Sep 05", pages: 58 },
  { day: "Sep 06", pages: 31 },
  { day: "Sep 07", pages: 14 },
  { day: "Sep 08", pages: 7 },
];

export const API_KEY = "fc-9f3b27ac4d8e41f0a6b1c5e7d2904f8a";
