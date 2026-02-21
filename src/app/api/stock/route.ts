import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import { calculateIndicators, DataPoint } from "@/lib/indicators";

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

async function fetchNaverData(tickerDigits: string, count = 250): Promise<DataPoint[] | null> {
  try {
    const url = `https://fchart.stock.naver.com/sise.naver?symbol=${tickerDigits}&timeframe=day&count=${count}&requestType=0`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const text = await res.text();
    
    // Naver returns simple XML, we can regex extract `<item data="..." />`
    const regex = /<item data="(.*?)" \/>/g;
    let match;
    const dataList: DataPoint[] = [];

    while ((match = regex.exec(text)) !== null) {
      const parts = match[1].split("|");
      if (parts.length >= 6) {
        const ds = parts[0];
        dataList.push({
          date: `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`,
          open: parseFloat(parts[1]),
          high: parseFloat(parts[2]),
          low: parseFloat(parts[3]),
          close: parseFloat(parts[4]),
          volume: parseInt(parts[5], 10),
        });
      }
    }

    return dataList.length > 0 ? dataList : null;
  } catch (e) {
    console.error("Naver fetch error:", e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let ticker = searchParams.get("ticker");
  let period = searchParams.get("period") || "1y";

  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  try {
    let rawData: DataPoint[] = [];
    let companyName = ticker;
    const isKr = /^\d{6}$/.test(ticker);

    if (isKr) {
      const naverData = await fetchNaverData(ticker);
      if (naverData) {
        rawData = naverData;
        // Try getting name from Yahoo Finance
        try {
          const qs = await yahooFinance.quote(`${ticker}.KS`);
          if (qs) companyName = (qs as any).longName || (qs as any).shortName || companyName;
        } catch {}
      } else {
        ticker = `${ticker}.KS`;
      }
    }

    if (rawData.length === 0) {
      // Start date computation based on period
      let start = new Date();
      if (period === "1mo") start.setMonth(start.getMonth() - 1);
      else if (period === "3mo") start.setMonth(start.getMonth() - 3);
      else if (period === "6mo") start.setMonth(start.getMonth() - 6);
      else if (period === "1y") start.setFullYear(start.getFullYear() - 1);
      else if (period === "2y") start.setFullYear(start.getFullYear() - 2);
      else start.setFullYear(start.getFullYear() - 1);

      let result: any[] = [];
      try {
        result = await yahooFinance.historical(ticker, {
          period1: start,
          period2: new Date(),
          interval: "1d",
        });
      } catch (e: any) {
        console.error("Yahoo Finance Historical Error:", e.message || e);
      }

      if (!result || result.length === 0) {
        if (isKr && ticker.endsWith(".KS")) {
          // fallback to kosdaq
          ticker = ticker.replace(".KS", ".KQ");
          let fallback: any[] = [];
          try {
            fallback = await yahooFinance.historical(ticker, {
              period1: start,
              period2: new Date(),
              interval: "1d",
            });
          } catch (e: any) {
            console.error("Yahoo Finance Historical Fallback Error:", e.message || e);
          }
          
          if (fallback && fallback.length > 0) {
            rawData = fallback.map((r: any) => ({
              date: r.date.toISOString().split("T")[0],
              open: r.open,
              high: r.high,
              low: r.low,
              close: r.close,
              volume: r.volume,
            }));
          } else {
            return NextResponse.json({ error: `No data found for ${ticker}` }, { status: 404 });
          }
        } else {
          return NextResponse.json({ error: `No data found for ${ticker}` }, { status: 404 });
        }
      } else {
        rawData = result.map((r: any) => ({
          date: r.date.toISOString().split("T")[0],
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume,
        }));
      }

      try {
        const qs = await yahooFinance.quote(ticker);
        if (qs) companyName = (qs as any).longName || (qs as any).shortName || companyName;
      } catch {}
    }

    // Apply technical indicators
    const dataWithIndicators = calculateIndicators(rawData);

    // Fetch News concurrently
    let newsList: {title: string, publisher: string, link: string}[] = [];
    try {
      const searchPromise = yahooFinance.search(ticker);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("News fetch timeout")), 2000));
      const searchRes: any = await Promise.race([searchPromise, timeoutPromise]);
      if (searchRes && searchRes.news && searchRes.news.length > 0) {
        newsList = searchRes.news.slice(0, 5).map((n: any) => ({
          title: n.title,
          publisher: n.publisher,
          link: n.link
        }));
      }
    } catch (e) {
      console.warn("Stock search news fetch failed/timeout:", e);
    }

    return NextResponse.json({
      name: companyName,
      history: dataWithIndicators,
      news: newsList,
    });
  } catch (error: any) {
    console.error("Stock API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch stock data" }, { status: 500 });
  }
}
