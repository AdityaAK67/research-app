import { NextRequest, NextResponse } from "next/server";
import { findOfficialWebsite, gatherSupportingInfo } from "@/lib/serper";
import { crawlWebsite } from "@/lib/crawler";
import { runResearchAnalysis, DEFAULT_MODEL } from "@/lib/ai";

// Give this route room to breathe: search + crawl + AI call can take
// longer than the default limit. Adjust based on what your Vercel plan
// actually allows (check dashboard — this changes over time).
export const maxDuration = 60;

function isUrl(input: string): boolean {
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$/i.test(
    input.trim()
  );
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

function extractCompanyNameFromUrl(url: string): string {
  const host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  const parts = host.split(".");

  if (parts.length <= 2) {
    return capitalize(parts[0]);
  }

  const secondLevel = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  const commonSlds = new Set([
    "co.uk",
    "com.au",
    "co.nz",
    "com.br",
    "co.in",
    "com.sg",
    "com.cn",
    "ac.uk",
  ]);

  if (commonSlds.has(secondLevel) && parts.length >= 3) {
    return capitalize(parts[parts.length - 3]);
  }

  return capitalize(parts[parts.length - 2]);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = body?.input?.trim();
    const model: string = body?.model || DEFAULT_MODEL;

    if (!input) {
      return NextResponse.json(
        { error: "Missing 'input' (company name or website URL)" },
        { status: 400 }
      );
    }

    let websiteUrl: string;
    let companyName: string;
    let searchSnippet: string | undefined;

    if (isUrl(input)) {
      websiteUrl = normalizeUrl(input);
      companyName = extractCompanyNameFromUrl(input);
    } else {
      companyName = input;
      const official = await findOfficialWebsite(input);

      if (!official) {
        return NextResponse.json(
          { error: `Could not find an official website for "${input}"` },
          { status: 404 }
        );
      }

      websiteUrl = official.url;
      searchSnippet = official.snippet;
    }

    // Crawl in parallel with the supporting-info search calls to save time
    const [crawlResult, supportingInfo] = await Promise.all([
      crawlWebsite(websiteUrl),
      gatherSupportingInfo(companyName, websiteUrl).catch(() => ({
        contactSnippets: [],
        competitorSnippets: [],
      })),
    ]);

    if (!crawlResult.succeeded && !searchSnippet) {
      return NextResponse.json(
        {
          error:
            "Could not access the website and no search fallback data was available.",
        },
        { status: 502 }
      );
    }

    // Build the prompt content, degrading gracefully if crawling failed
    const crawledText = crawlResult.pages
      .map((p: { url: string; text: string }) => `--- ${p.url} ---\n${p.text}`)
      .join("\n\n");

    const promptParts = [
      `Company: ${companyName}`,
      `Website: ${websiteUrl}`,
      searchSnippet ? `Search snippet: ${searchSnippet}` : "",
      crawledText ? `Website content:\n${crawledText}` : "(Website content unavailable)",
      supportingInfo.contactSnippets.length
        ? `Contact info search results:\n${supportingInfo.contactSnippets.join("\n")}`
        : "",
      supportingInfo.competitorSnippets.length
        ? `Competitor search results:\n${supportingInfo.competitorSnippets.join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const analysis = await runResearchAnalysis(promptParts, model);

    return NextResponse.json({
      ...analysis,
      website: websiteUrl,
      crawledPages: crawlResult.pages.map((p: { url: string }) => p.url),
    });
  } catch (err) {
    console.error("Research route error:", err);
    return NextResponse.json(
      { error: "Something went wrong during research. Please try again." },
      { status: 500 }
    );
  }
}

