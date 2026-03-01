"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Sparkles, Send } from "lucide-react";
import { DataPoint } from "@/lib/indicators";
import ReactMarkdown from "react-markdown";
import { Sidebar } from "@/components/sidebar";

// react-plotly.js must be loaded dynamically with SSR disabled
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false, loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-900 rounded-lg text-slate-500"><Loader2 className="w-8 h-8 animate-spin" /></div> });

interface AnalysisStep {
  step: number;
  label: string;
  status: "running" | "done" | "waiting";
  elapsed?: number;
}

interface PriceLines {
  entryPrice?: number;
  target1?: number;
  target2?: number;
  stopLoss?: number;
  fairValue?: number;
  bullishValue?: number;
  bearishValue?: number;
}

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
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([]);
  const [priceLines, setPriceLines] = useState<PriceLines>({});

  const fetchData = async (ticker: string, period?: string) => {
    if (!ticker) return;
    setLoading(true);
    setError("");
    setAiReport("");
    setAiScore(null);
    setAiType("");
    setAiDurations(null);
    setAiElapsed("0.0");
    setTelegramSuccess(false);
    setAnalysisSteps([]);
    setPriceLines({});
    try {
      const p = period || "1y";
      const res = await fetch(`/api/stock?ticker=${ticker}&period=${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setData(json.history);
      setCompanyName(json.name);
      setCurrentTicker(ticker.toUpperCase());
      setNews(json.news || []);
    } catch (err: any) {
      setError(err.message);
      setData([]);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSidebarSearch = (ticker: string, period: string) => {
    setTickerInput(ticker);
    fetchData(ticker, period);
  };

  const runAnalysis = async (type: "ai-analysis" | "dcf-analysis") => {
    if (!currentTicker || data.length === 0) return;
    const analysisLabel = type === "ai-analysis" ? "General" : "DCF";
    setAiLoading(true);
    setAiReport("");
    setAiScore(null);
    setAiType(analysisLabel);
    setAiDurations(null);
    setAiElapsed("0.0");
    setTelegramSuccess(false);

    // Initialize steps
    const steps: AnalysisStep[] = type === "ai-analysis"
      ? [
          { step: 1, label: "데이터 로딩 중...", status: "running" },
          { step: 2, label: "기업 정보 조회 중...", status: "waiting" },
          { step: 3, label: `${analysisLabel} 분석 중...`, status: "waiting" },
        ]
      : [
          { step: 1, label: "데이터 로딩 중...", status: "running" },
          { step: 2, label: "기업 정보 조회 중...", status: "waiting" },
          { step: 3, label: "DCF 분석 중...", status: "waiting" },
        ];
    setAnalysisSteps([...steps]);

    const stepStartTimes = [Date.now(), 0, 0];
    const startTime = Date.now();
    const intervalTimer = setInterval(() => {
        setAiElapsed(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    // Simulate step 1 done quickly
    await new Promise(r => setTimeout(r, 400));
    steps[0] = { ...steps[0], label: "데이터 로딩 완료", status: "done", elapsed: parseFloat(((Date.now() - stepStartTimes[0]) / 1000).toFixed(1)) };
    steps[1] = { ...steps[1], label: "기업 정보 조회 중...", status: "running" };
    stepStartTimes[1] = Date.now();
    setAnalysisSteps([...steps]);

    const latest = data[data.length - 1];
    try {
      // Step 2: simulate brief delay
      await new Promise(r => setTimeout(r, 600));
      steps[1] = { ...steps[1], label: "기업 정보 조회 완료", status: "done", elapsed: parseFloat(((Date.now() - stepStartTimes[1]) / 1000).toFixed(1)) };
      steps[2] = { ...steps[2], status: "running" };
      stepStartTimes[2] = Date.now();
      setAnalysisSteps([...steps]);

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

      steps[2] = { ...steps[2], label: `${analysisLabel} 분석 완료`, status: "done", elapsed: parseFloat(((Date.now() - stepStartTimes[2]) / 1000).toFixed(1)) };
      setAnalysisSteps([...steps]);

      setAiReport(json.report);
      setAiScore(json.confidenceScore);
      if (json.prices) {
        setPriceLines(json.prices);
      }
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
    <div className="flex min-h-screen">
      <Sidebar onSearch={handleSidebarSearch} news={news} loading={loading} />
      <div className="flex-1 p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {currentTicker ? `${companyName} (${currentTicker}) 실시간 차트 및 AI 분석` : "AI 주식 분석 도구"}
        </h1>
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
          <p>왼쪽 검색창에 궁금한 종목의 티커(예: TSLA, IONQ)를 입력하면<br />실시간 차트와 AI 심층 분석 리포트를 생성합니다.</p>
        </div>
      )}

      {data.length > 0 && latestData && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-3 flex flex-col gap-4">
               <div className="bg-card/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4 h-[600px] overflow-hidden">
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
                  name: 'Price',
                  increasing: { line: { color: '#00f2ff' }, fillcolor: '#00f2ff' },
                  decreasing: { line: { color: '#ff3d71' }, fillcolor: '#ff3d71' }
                },
                {
                  x: data.map(d => d.date) as any[],
                  y: data.map(d => d.MA20) as any[],
                  type: 'scatter',
                  mode: 'lines',
                  line: { color: '#ffd700', dash: 'dash', width: 1.2 },
                  name: 'MA20'
                },
                {
                  x: data.map(d => d.date) as any[],
                  y: data.map(d => d.Upper) as any[],
                  type: 'scatter',
                  mode: 'lines',
                  line: { color: 'rgba(99, 102, 241, 0.5)', width: 1 },
                  name: 'Upper Band'
                },
                {
                  x: data.map(d => d.date) as any[],
                  y: data.map(d => d.Lower) as any[],
                  type: 'scatter',
                  mode: 'lines',
                  fill: 'tonexty',
                  fillcolor: 'rgba(99, 102, 241, 0.05)',
                  line: { color: 'rgba(99, 102, 241, 0.5)', width: 1 },
                  name: 'Lower Band'
                }
              ] as any[]}
              layout={(() => {
                const priceShapes: any[] = [];
                const priceAnnotations: any[] = [];
                const addPriceLine = (price: number, label: string, color: string, dash: string, width: number) => {
                  priceShapes.push({
                    type: 'line', xref: 'paper', yref: 'y',
                    x0: 0, x1: 1, y0: price, y1: price,
                    line: { color, width, dash },
                    layer: 'above'
                  });
                  priceAnnotations.push({
                    x: 1, xref: 'paper', y: price, yref: 'y',
                    text: `${label} ${price.toLocaleString()}`,
                    showarrow: false, xanchor: 'left',
                    font: { color, size: 10 },
                    bgcolor: 'rgba(15,15,26,0.85)',
                    bordercolor: color, borderwidth: 1, borderpad: 2,
                  });
                };
                if (priceLines.fairValue) addPriceLine(priceLines.fairValue, 'DCF 적정가', '#FFD700', 'solid', 2);
                if (priceLines.bullishValue) addPriceLine(priceLines.bullishValue, '강세 적정가', '#00CED1', 'dot', 1);
                if (priceLines.bearishValue) addPriceLine(priceLines.bearishValue, '약세 적정가', '#FF8C00', 'dot', 1);
                if (priceLines.entryPrice) addPriceLine(priceLines.entryPrice, '진입가', '#FFD700', 'dash', 1.5);
                if (priceLines.target1) addPriceLine(priceLines.target1, '1차 목표', '#00CED1', 'dash', 1.5);
                if (priceLines.target2) addPriceLine(priceLines.target2, '2차 목표', '#32CD32', 'dash', 1.5);
                if (priceLines.stopLoss) addPriceLine(priceLines.stopLoss, '손절가', '#FF4444', 'dash', 1.5);

                return {
                  template: 'plotly_dark',
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  margin: { t: 40, l: 50, r: 50, b: 100 },
                  font: { family: 'inherit', color: '#94a3b8', size: 10 },
                  xaxis: { 
                    rangeslider: { visible: false },
                    gridcolor: 'rgba(255,255,255,0.03)',
                    zeroline: false,
                    showline: false
                  },
                  yaxis: { 
                    gridcolor: 'rgba(255,255,255,0.03)',
                    zeroline: false,
                    showline: false,
                    side: 'right'
                  },
                  legend: {
                    orientation: 'h',
                    y: -0.2,
                    x: 0.5,
                    xanchor: 'center',
                    font: { size: 10 }
                  },
                  hovermode: 'x unified',
                  shapes: [
                    ...data.filter(d => d.Vol_Spike).map(d => ({
                      type: 'rect', xref: 'x', yref: 'paper',
                      x0: d.date, x1: d.date, y0: 0, y1: 1,
                      fillcolor: 'orange', opacity: 0.1,
                      line: { width: 0 }, layer: 'below'
                    })),
                    ...priceShapes
                  ],
                  annotations: priceAnnotations,
                };
              })() as any}
              config={{ responsive: true }}
            />
               </div>
          </div>

          {/* Metrics Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold mb-2">주요 지표</h3>
            <div className="bg-card border border-white/5 p-5 rounded-2xl shadow-sm">
              <div className="text-slate-400 text-sm mb-2 font-medium">현재가</div>
              <div className="text-3xl font-bold text-[#a5b4fc]">
                {currentTicker.includes(".KS") || currentTicker.includes(".KQ") ? "₩" : "$"}
                {currentTicker.includes(".KS") || currentTicker.includes(".KQ")
                   ? latestData.close.toLocaleString()
                   : latestData.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-card border border-white/5 p-5 rounded-2xl shadow-sm">
              <div className="text-slate-400 text-sm mb-2 font-medium">RSI(14)</div>
              <div className="text-3xl font-bold text-[#a5b4fc]">
                {latestData.RSI !== null && latestData.RSI !== undefined ? latestData.RSI.toFixed(2) : "N/A"}
              </div>
            </div>
            <div className="bg-card border border-white/5 p-5 rounded-2xl shadow-sm">
              <div className="text-slate-400 text-sm mb-2 font-medium">볼린저 밴드 상/하단</div>
              <div className="text-xl font-bold text-[#a5b4fc]">
                {latestData.Upper?.toFixed(1) || "N/A"} / {latestData.Lower?.toFixed(1) || "N/A"}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* AI Analysis Section */}
      {data.length > 0 && latestData && (
        <div className="mt-8">
          <div className="border-t border-slate-700 pt-6 mb-6">
            <h2 className="text-xl font-bold mb-4">🪄 AI 심층 분석 리포트</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => runAnalysis("ai-analysis")}
                disabled={aiLoading}
                className="flex justify-center items-center gap-2 bg-slate-800/80 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-700/50 disabled:opacity-50 text-white py-4 rounded-lg font-semibold transition-all"
              >
                {aiLoading && aiType === "General" ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>🤖</span>}
                AI 분석 실행
              </button>
              <button
                onClick={() => runAnalysis("dcf-analysis")}
                disabled={aiLoading}
                className="flex justify-center items-center gap-2 bg-slate-800/80 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-700/50 disabled:opacity-50 text-white py-4 rounded-lg font-semibold transition-all"
              >
                {aiLoading && aiType === "DCF" ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>💰</span>}
                DCF 분석 실행
              </button>
            </div>
          </div>

          {/* Analysis Progress Steps */}
          {analysisSteps.length > 0 && (
            <div className="bg-card/50 border border-white/5 backdrop-blur-md rounded-2xl p-6 mb-6">
              <div className="space-y-3">
                {analysisSteps.map((s) => (
                  <div key={s.step} className="flex items-center gap-3">
                    {s.status === "done" ? (
                      <div className="w-5 h-5 rounded-full bg-teal-500/20 border-2 border-teal-400 flex items-center justify-center text-teal-400 text-[10px] flex-shrink-0">✓</div>
                    ) : s.status === "running" ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />
                    )}
                    <span className={`flex-1 text-sm ${s.status === "running" ? "text-white font-medium" : s.status === "done" ? "text-gray-300" : "text-gray-500"}`}>
                      {s.label}
                    </span>
                    {s.status === "done" && s.elapsed !== undefined && (
                      <span className="text-xs text-gray-500 bg-slate-800 px-2.5 py-0.5 rounded-full tabular-nums">{s.elapsed}s</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Report */}
          {aiReport && !aiLoading && (
            <div className="bg-card border border-white/5 p-8 rounded-2xl shadow-xl">
               <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                 <Sparkles className="text-yellow-400 w-6 h-6" />
                 <h2 className="text-2xl font-bold">{aiType === "General" ? "AI 심층 분석 리포트" : "DCF 전문 분석 리포트"}</h2>
                 <div className="flex flex-col md:flex-row gap-3 ml-auto items-end md:items-center">
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
            </div>
          )}
        </div>
      )}
    </div>
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
