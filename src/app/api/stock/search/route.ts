import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const market = searchParams.get("market") || "US";

  if (!query || query.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const searchRes: any = await yahooFinance.search(query);
    const quotes = searchRes?.quotes || [];

    const marketFilters: Record<string, (sym: string, exchange: string) => boolean> = {
      US: (sym, ex) => !sym.includes(".") && /NMS|NYQ|NGM|PCX|BTS|NAS|NYS/i.test(ex),
      KR: (sym) => sym.endsWith(".KS") || sym.endsWith(".KQ"),
      HK: (sym, ex) => sym.endsWith(".HK") || /HKG/i.test(ex),
      SH: (sym, ex) => sym.endsWith(".SS") || /SHH|SHZ/i.test(ex),
    };

    const filterFn = marketFilters[market] || marketFilters.US;

    const results = quotes
      .filter((q: any) => {
        if (!q || !q.symbol) return false;
        return filterFn(q.symbol, q.exchange || "");
      })
      .slice(0, 10)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        market,
      }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Search API Error:", error.message);
    return NextResponse.json({ results: [] });
  }
}
