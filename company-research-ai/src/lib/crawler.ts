import axios from "axios";
import * as cheerio from "cheerio";

const PAGE_KEYWORDS = [
  "about",
  "product",
  "service",
  "solution",
  "contact",
  "pricing",
];

const SKIP_KEYWORDS = [
  "login",
  "signin",
  "sign-in",
  "register",
  "signup",
  "sign-up",
  "cart",
  "checkout",
  "privacy",
  "terms",
  "cookie",
  "legal",
];

const FETCH_TIMEOUT_MS = 7000;
const MAX_PAGES = 5;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

interface CrawledPage {
  url: string;
  text: string;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await axios.get(url, {
      headers: HEADERS,
      signal: controller.signal,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });

    clearTimeout(timeout);
    return res.data;
  } catch {
    return null; // dead page, blocked, or timed out — caller handles fallback
  }
}

function extractCleanText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, noscript, svg, iframe").remove();

  const text = $("body").text().replace(/\s+/g, " ").trim();

  // Cap length per page so we don't blow the AI context / prompt size
  return text.slice(0, 3000);
}

function discoverInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const found = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      return;
    }

    // Only same-domain links
    if (absolute.hostname.replace("www.", "") !== base.hostname.replace("www.", "")) {
      return;
    }

    const path = absolute.pathname.toLowerCase();

    if (SKIP_KEYWORDS.some((skip) => path.includes(skip))) return;

    if (PAGE_KEYWORDS.some((keyword) => path.includes(keyword))) {
      // Strip query/hash to dedupe variants of the same page
      absolute.search = "";
      absolute.hash = "";
      found.add(absolute.toString());
    }
  });

  return Array.from(found);
}

/**
 * Crawl a company website: homepage + up to MAX_PAGES-1 discovered
 * relevant pages (about/products/contact/pricing etc).
 * Returns clean extracted text per page. Never throws — degrades
 * gracefully to whatever pages succeeded, even if some/all fail.
 */
export async function crawlWebsite(startUrl: string): Promise<{
  pages: CrawledPage[];
  succeeded: boolean;
}> {
  const homeHtml = await fetchPage(startUrl);

  if (!homeHtml) {
    return { pages: [], succeeded: false };
  }

  const pages: CrawledPage[] = [
    { url: startUrl, text: extractCleanText(homeHtml) },
  ];

  const linksToVisit = discoverInternalLinks(homeHtml, startUrl).slice(
    0,
    MAX_PAGES - 1
  );

  const results = await Promise.all(
    linksToVisit.map(async (link) => {
      const html = await fetchPage(link);
      if (!html) return null;
      return { url: link, text: extractCleanText(html) };
    })
  );

  for (const page of results) {
    if (page && page.text.length > 50) {
      pages.push(page);
    }
  }

  return { pages, succeeded: true };
}
