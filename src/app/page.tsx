"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Search, Loader2, Sparkles, Send } from "lucide-react";
import { DataPoint } from "@/lib/indicators";
import ReactMarkdown from "react-markdown";

// react-plotly.js must be loaded dynamically with SSR disabled
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-900 rounded-lg text-slate-500"><Loader2 className="w-8 h-8 animate-spin" /></div> });

export default function Home() {
  const [tickerInput, setTickerInput] = useState("AAPL");
  const [currentTicker, setCurrentTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DataPoint[]>([]);

  const [aiReport, setAiReport] = useState("");
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiType, setAiType] = useState<"General" | "DCF" | "">("");
  const [aiDurations, setAiDurations] = useState<{dataPrep: number, aiGeneration: number, total: number} | null>(null);
  const [aiElapsed, setAiElapsed] = useState("0.0");
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState(false);
  
  const [news, setNews] = useState<{title: string, publisher: string, link: string}[]>([]);
  const [leftTab, setLeftTab] = useState<"chart" | "news">("chart");

  const fetchData = async (ticker: string) => {
    if (!ticker) return;
    setLoading(true);
    setError("");
    setAiReport("");
    setAiScore(null);
    setAiType("");
    setAiDurations(null);
    setAiElapsed("0.0");
    setTelegramSuccess(false);
    try {
      const res = await fetch(`/api/stock?ticker=${ticker}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setData(json.history);
      setCompanyName(json.name);
      setCurrentTicker(ticker.toUpperCase());
      setNews(json.news || []);
      setLeftTab("chart");
    } catch (err: any) {
      setError(err.message);
      setData([]);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(tickerInput);
  };

  const runAnalysis = async (type: "ai-analysis" | "dcf-analysis") => {
    if (!currentTicker || data.length === 0) return;
    setAiLoading(true);
    setAiReport("");
    setAiScore(null);
    setAiType(type === "ai-analysis" ? "General" : "DCF");
    setAiDurations(null);
    setAiElapsed("0.0");
    setTelegramSuccess(false);

    const startTime = Date.now();
    const intervalTimer = setInterval(() => {
        setAiElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    const latest = data[data.length - 1];
    try {
      const res = await fetch(`/api/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: currentTicker,
          name: companyName,
          currentPrice: latest.close,
          rsi: latest.RSI,
          upper: latest.Upper,
          lower: latest.Lower,
          history: data.slice(-30),
          news: news,
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAiReport(json.report);
      setAiScore(json.confidenceScore);
      if (json.durations) {
        setAiDurations(json.durations);
      }
    } catch (error: any) {
      setAiReport(`분석 실패: ${error.message}`);
    } finally {
      clearInterval(intervalTimer);
      setAiLoading(false);
    }
  };

  const handleSendTelegram = async () => {
    if (!aiReport || !currentTicker) return;
    setSendingTelegram(true);
    setTelegramSuccess(false);
    try {
      const res = await fetch("/api/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: currentTicker,
          report: aiReport,
          type: aiType,
          confidenceScore: aiScore
        })
      });
      if (!res.ok) throw new Error("전송 실패");
      setTelegramSuccess(true);
      setTimeout(() => setTelegramSuccess(false), 3000);
    } catch (e) {
      alert("텔레그램 전송에 실패했습니다.");
    } finally {
      setSendingTelegram(false);
    }
  };

  const latestData = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">
          {currentTicker ? `${companyName} (${currentTicker}) 실시간 차트 및 AI 분석` : "AI 주식 분석 도구"}
        </h1>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="티커 입력 (예: TSLA, 005930)"
            className="bg-slate-800 text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-8">
          ⚠️ 오류: {error}
        </div>
      )}

      {!currentTicker && !loading && !error && (
        <div className="text-center mt-32 text-slate-400">
          <LineChartIcon className="w-24 h-24 mx-auto mb-6 text-slate-700" />
          <h2 className="text-2xl font-semibold text-slate-300 mb-2">실시간 시장 데이터를 확인해 보세요.</h2>
          <p>우측 상단 검색창에 궁금한 종목의 티커(예: TSLA, IONQ)를 입력하면<br />실시간 차트와 AI 심층 분석 리포트를 생성합니다.</p>
        </div>
      )}

      {data.length > 0 && latestData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Section (Tabs) */}
          <div className="lg:col-span-3 flex flex-col gap-4">
             <div className="flex gap-4 border-b border-slate-700 pb-2">
               <button 
                 onClick={() => setLeftTab("chart")} 
                 className={`text-lg font-semibold pb-1 border-b-2 transition-colors ${leftTab === "chart" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
               >
                 실시간 차트
               </button>
               <button 
                 onClick={() => setLeftTab("news")} 
                 className={`text-lg font-semibold pb-1 border-b-2 transition-colors ${leftTab === "news" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-300"}`}
               >
                 주요 뉴스
               </button>
             </div>

             {leftTab === "chart" ? (
               <div className="bg-slate-900 rounded-lg p-4 h-[600px] overflow-hidden">
                 <Plot
              className="w-full h-full"
              data={[
                {
                  x: data.map(d => d.date) as any[],
                  close: data.map(d => d.close) as any[],
                  high: data.map(d => d.high) as any[],
                  low: data.map(d => d.low) as any[],
                  open: data.map(d => d.open) as any[],
                  type: 'candlestick',
                  name: 'Price'
                },
                {
                  x: data.map(d => d.date) as any[],
                  y: data.map(d => d.Upper) as any[],
                  type: 'scatter',
                  mode: 'lines',
                  line: { color: 'rgba(173, 216, 230, 0.5)' },
                  name: 'Upper Band'
                },
                {
                  x: data.map(d => d.date) as any[],
                  y: data.map(d => d.Lower) as any[],
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tonexty',
                  fillcolor: 'rgba(173, 216, 230, 0.1)',
                  line: { color: 'rgba(173, 216, 230, 0.5)' },
                  name: 'Lower Band'
                }
              ] as any[]}
              layout={({
                template: 'plotly_dark',
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { t: 10, l: 40, r: 40, b: 40 },
                xaxis: { rangeslider: { visible: false } },
                shapes: data.filter(d => d.Vol_Spike).map(d => ({
                  type: 'rect',
                  xref: 'x',
                  yref: 'paper',
                  x0: d.date,
                  x1: d.date, // Plotly rect uses x0 to x1, to make it wide we can add some logic or just rely on vrect
                  y0: 0,
                  y1: 1,
                  fillcolor: 'orange',
                  opacity: 0.1,
                  line: { width: 0 },
                  layer: 'below'
                }))
              }) as any}
              config={{ responsive: true }}
            />
               </div>
             ) : (
               <div className="bg-slate-900 rounded-lg p-6 h-[600px] overflow-y-auto space-y-4">
                 <h2 className="text-xl font-bold mb-4">{companyName} 최신 뉴스</h2>
                 {news.length === 0 ? (
                    <div className="text-slate-400 py-8 text-center">뉴스가 없습니다.</div>
                 ) : (
                    news.map((n, i) => (
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block bg-slate-800 p-4 rounded hover:bg-slate-700 transition">
                        <div className="font-semibold text-blue-300 mb-2">{n.title}</div>
                        <div className="text-sm text-slate-400">{n.publisher}</div>
                      </a>
                    ))
                 )}
               </div>
             )}
          </div>

          {/* Metrics Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold mb-2">주요 지표</h3>
            <div className="bg-slate-900 p-4 rounded-lg">
              <div className="text-slate-400 text-sm mb-1">현재가</div>
              <div className="text-2xl font-bold text-yellow-400">
                {currentTicker.includes(".KS") || currentTicker.includes(".KQ") ? "₩" : "$"}
                {currentTicker.includes(".KS") || currentTicker.includes(".KQ")
                  ? latestData.close.toLocaleString()
                  : latestData.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg">
              <div className="text-slate-400 text-sm mb-1">RSI(14)</div>
              <div className="text-2xl font-bold text-emerald-400">
                {latestData.RSI !== null && latestData.RSI !== undefined ? latestData.RSI.toFixed(2) : "N/A"}
              </div>
            </div>
            <div className="bg-slate-900 p-4 rounded-lg">
              <div className="text-slate-400 text-sm mb-1">볼린저 밴드 상/하단</div>
              <div className="text-xl font-bold text-blue-400">
                {latestData.Upper?.toFixed(1) || "N/A"} / {latestData.Lower?.toFixed(1) || "N/A"}
              </div>
            </div>
            
            {/* AI Analysis Buttons Placeholder */}
            <div className="mt-8 flex flex-col gap-3">
              <h3 className="text-xl font-bold mb-2">🪄 AI 심층 분석</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => runAnalysis("ai-analysis")}
                  disabled={aiLoading}
                  className="flex-1 flex justify-center items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded font-semibold transition-colors"
                >
                  {aiLoading && aiType === "General" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  AI 분석 실행
                </button>
                <button
                  onClick={() => runAnalysis("dcf-analysis")}
                  disabled={aiLoading}
                  className="flex-1 flex justify-center items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-3 rounded font-semibold transition-colors"
                >
                  {aiLoading && aiType === "DCF" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  DCF 전문 분석
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Report Section */}
      {(aiLoading || aiReport) && (
        <div className="mt-8 bg-slate-900 p-6 rounded-lg border border-slate-700">
          {aiLoading ? (
             <div className="flex flex-col items-center justify-center py-12">
               <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
               <h2 className="text-xl font-bold mb-2 text-white">
                 {aiType === "General" ? "AI 심층 분석 중..." : "DCF 전문 분석 중..."}
               </h2>
               <p className="text-slate-400 mb-4 text-center max-w-md">
                 실시간 데이터와 최신 뉴스를 기반으로 프롬프트를 구성하고 추론합니다. <br/>완료까지 10~30초 가량 소요될 수 있습니다.
               </p>
               <div className="text-2xl font-mono text-blue-400 bg-slate-800 px-6 py-3 rounded-lg border border-slate-700 shadow-inner">
                 {aiElapsed}초 경과
               </div>
               
               <div className="mt-8 w-full max-w-md space-y-3 text-sm">
                 <div className={`flex items-center gap-3 ${Number(aiElapsed) < 3.5 ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
                   {Number(aiElapsed) < 3.5 ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center text-[10px]">✓</div>}
                   {aiType === "General" ? "주요 증권사 뉴스 수집 및 하모닉 패턴 분석..." : "글로벌 재무 분석 지침 로드 및 데이터 구조화 중..."}
                 </div>
                 <div className={`flex items-center gap-3 ${Number(aiElapsed) >= 3.5 ? 'text-blue-400 font-semibold' : 'text-slate-600'}`}>
                   {Number(aiElapsed) >= 3.5 ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4" />}
                   {aiType === "General" ? "슈퍼컴퓨터급 Gemini Flash가 시장 방향성 추론 중..." : "Gemini Flash가 Reverse DCF 및 적정주가 산출 중..."}
                 </div>
               </div>
             </div>
          ) : (
             <>
               <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                 <Sparkles className="text-yellow-400 w-6 h-6" />
                 <h2 className="text-2xl font-bold">{aiType === "General" ? "AI 심층 분석 리포트" : "DCF 전문 분석 리포트"}</h2>
                 
                 <div className="flex flex-col md:flex-row gap-3 ml-auto items-end md:items-center">
                   {aiDurations && (
                     <div className="text-xs text-slate-400 flex gap-2 font-mono bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                       <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">전처리: {(aiDurations.dataPrep / 1000).toFixed(1)}s</span>
                       <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">AI모델: {(aiDurations.aiGeneration / 1000).toFixed(1)}s</span>
                       <span className="bg-blue-900/40 text-blue-300 px-2 py-1 rounded border border-blue-900/60">총계: {(aiDurations.total / 1000).toFixed(1)}s</span>
                     </div>
                   )}
                   {aiScore !== null && (
                     <span className="text-sm bg-blue-900/50 text-blue-300 px-3 py-1.5 rounded-full border border-blue-800/50 whitespace-nowrap font-semibold">
                       신뢰도 점수: {aiScore}
                     </span>
                   )}
                   <button 
                     onClick={handleSendTelegram} 
                     disabled={sendingTelegram}
                     className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full flex items-center gap-2 border border-slate-600 transition-colors text-sm font-semibold"
                   >
                     {sendingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                     {telegramSuccess ? "전송 완료!" : "텔레그램 전송"}
                   </button>
                 </div>
               </div>
               <div className="prose prose-invert max-w-none">
                 <ReactMarkdown>{aiReport}</ReactMarkdown>
               </div>
             </>
          )}
        </div>
      )}
    </div>
  );
}

// Icon for empty state
function LineChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}
