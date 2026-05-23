import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const market = searchParams.get("market") || "US";

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  // Detect Hangul characters
  const hasHangul = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(query);

  // If search is for KR market or contains Hangul, search local KRX database
  if (market === "KR" || hasHangul) {
    try {
      const csvPath = path.join(process.cwd(), "..", "data", "krx_stocks.csv");
      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, "utf-8");
        const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
        
        const results = [];
        const qLower = query.toLowerCase();

        // Skip header: code,name,name_en,market
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(",");
          if (parts.length >= 4) {
            const code = parts[0].trim();
            const name = parts[1].trim();
            const nameEn = parts[2].trim();
            const mkt = parts[3].trim(); // KOSPI or KOSDAQ

            if (
              code.includes(query) ||
              name.toLowerCase().includes(qLower) ||
              nameEn.toLowerCase().includes(qLower)
            ) {
              const suffix = mkt.toUpperCase() === "KOSDAQ" ? ".KQ" : ".KS";
              results.push({
                symbol: `${code}${suffix}`,
                name: name,
                exchange: mkt,
                quoteType: "EQUITY"
              });
            }
          }
        }
        
        if (results.length > 0) {
          return NextResponse.json({ results: results.slice(0, 8) });
        }
      }
    } catch (e) {
      console.warn("Local KRX CSV search error, falling back to Yahoo Finance:", e);
    }
  }

  // Standard Yahoo Finance search (fallback or non-KR search)
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }});
    const json = await res.json();
    
    if (!json || !json.quotes) {
      return NextResponse.json({ results: [] });
    }

    const results = json.quotes
      .filter((q: any) => q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "MUTUALFUND")
      .slice(0, 7)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchange,
        quoteType: q.quoteType,
      }));

    return NextResponse.json({ results });
  } catch (e) {
    console.warn("Search API error:", e);
    return NextResponse.json({ results: [] });
  }
}
