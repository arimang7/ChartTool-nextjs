import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

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
