const SERPER_URL = "https://google.serper.dev/search";

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  position: number;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  knowledgeGraph?: Record<string, unknown>;
}

async function serperSearch(query: string): Promise<SerperResponse> {
  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });

  if (!res.ok) {
    throw new Error(`Serper request failed: ${res.status}`);
  }

  return res.json();
}

// Domains that show up in results but are never the "official site"
const JUNK_DOMAINS = [
  "wikipedia.org",
  "youtube.com",
  "linkedin.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "crunchbase.com",
  "glassdoor.com",
  "indeed.com",
  "reddit.com",
];

function isJunkDomain(url: string): boolean {
  try {
    const host = new URL(normalizeWebsiteUrl(url)).hostname.replace("www.", "");
    return JUNK_DOMAINS.some((junk) => host.includes(junk));
  } catch {
    return true; // malformed url, treat as junk
  }
}

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

/**
 * Given a company name, find its most likely official website.
 * Strategy: take Google's #1 ranked result, skip known junk domains
 * (Wikipedia, YouTube, social media) if they appear before a real site.
 */
export async function findOfficialWebsite(companyName: string): Promise<{
  url: string;
  snippet?: string;
} | null> {
  const data = await serperSearch(`${companyName} official website`);
  const results = data.organic || [];

  for (const result of results) {
    if (!isJunkDomain(result.link)) {
      return { url: normalizeWebsiteUrl(result.link), snippet: result.snippet };
    }
  }

  // Nothing but junk domains found
  return results[0]
    ? { url: normalizeWebsiteUrl(results[0].link), snippet: results[0].snippet }
    : null;
}

/**
 * Gather supporting info: contact details + competitors, run in parallel
 * to keep total request time down (important for serverless timeouts).
 */
export async function gatherSupportingInfo(companyName: string, domain: string) {
  const [contactRes, competitorRes] = await Promise.all([
    serperSearch(`${companyName} phone number address contact`),
    serperSearch(`${companyName} competitors alternatives`),
  ]);

  const contactSnippets =
    contactRes.organic?.slice(0, 3).map((r) => r.snippet).filter(Boolean) || [];

  const competitorSnippets =
    competitorRes.organic?.slice(0, 5).map((r) => `${r.title}: ${r.snippet ?? ""}`) || [];

  return { contactSnippets, competitorSnippets };
}

export { isJunkDomain };
