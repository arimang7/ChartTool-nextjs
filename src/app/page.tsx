"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2, Sparkles, Send, TrendingUp } from "lucide-react";
import { DataPoint } from "@/lib/indicators";
import ReactMarkdown from "react-markdown";
import { Sidebar } from "@/components/sidebar";

// react-plotly.js must be loaded dynamically with SSR disabled
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false, loading: () => <div className="h-[480px] flex items-center justify-center bg-slate-900/50 rounded-lg text-slate-500"><Loader2 className="w-8 h-8 animate-spin" /></div> });

export default function Home() {
  const [currentTicker, setCurrentTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DataPoint[]>([]);

  const [aiReport, setAiReport] = useState("");
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiType, setAiType] = useState<"General" | "DCF" | "">("")
  const [selectedModel, setSelectedModel] = useState("gemini-3.1-flash-lite-preview");
  const [aiDurations, setAiDurations] = useState<{dataPrep: number, aiGeneration: number, total: number} | null>(null);
  const [aiElapsed, setAiElapsed] = useState("0.0");
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSuccess, setTelegramSuccess] = useState(false);

  // Model health state
  type ModelStatus = { id: string; label: string; latency: number; status: "fast" | "normal" | "busy" };
  const [modelHealth, setModelHealth] = useState<ModelStatus[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/model-health");
        const json = await res.json();
        setModelHealth(json.models);
        setSelectedModel(json.recommended);
      } catch {
        // keep default if health check fails
      } finally {
        setHealthLoading(false);
      }
    })();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [news, setNews] = useState<{title: string, publisher: string, link: string}[]>([]);

  const fetchData = async (ticker: string, market: string, period: string) => {
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
      const res = await fetch(`/api/stock?ticker=${ticker}&period=${period}`);
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
          model: selectedModel,
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
    <div className="flex min-h-screen bg-[#0a0e1a] text-white">
      {/* Sidebar */}
      <Sidebar
        onSearch={(ticker, period) => fetchData(ticker, "US", period)}
        news={news}
        loading={loading}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white mb-6">
          {currentTicker
            ? `${companyName} (${currentTicker}) 실시간 차트 및 AI 분석`
            : "AI 주식 분석 도구"}
        </h1>

        {error && (
          <div className="bg-red-900/40 border border-red-700/60 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
            ⚠️ 오류: {error}
          </div>
        )}

        {/* Empty State */}
        {!currentTicker && !loading && !error && (
          <div className="flex flex-col items-center justify-center mt-32 text-slate-500">
            <TrendingUp className="w-20 h-20 mb-6 text-slate-700" />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">실시간 시장 데이터를 확인해 보세요.</h2>
            <p className="text-sm text-center">좌측 검색창에 종목 티커(예: TSLA, IONQ)를 입력하면<br />실시간 차트와 AI 심층 분석 리포트를 생성합니다.</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center mt-32">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <span className="ml-3 text-slate-400">데이터 로딩 중...</span>
          </div>
        )}

        {/* Data Loaded */}
        {data.length > 0 && latestData && !loading && (
          <>
            {/* Chart + Metrics Row */}
            <div className="flex gap-5">
              {/* Chart */}
              <div className="flex-1 bg-[#0d1117] rounded-xl border border-slate-800/60 overflow-hidden">
                <div className="h-[480px]">
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
                        increasing: { line: { color: '#22d3ee' } },
                        decreasing: { line: { color: '#f87171' } },
                      },
                      {
                        x: data.map(d => d.date) as any[],
                        y: data.map(d => d.Upper) as any[],
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: 'rgba(148, 163, 255, 0.6)', width: 1 },
                        name: 'Upper Band'
                      },
                      {
                        x: data.map(d => d.date) as any[],
                        y: data.map(d => d.Lower) as any[],
                        type: 'scatter',
                        mode: 'lines',
                        fill: 'tonexty',
                        fillcolor: 'rgba(99, 102, 241, 0.08)',
                        line: { color: 'rgba(148, 163, 255, 0.6)', width: 1 },
                        name: 'Lower Band'
                      },
                      {
                        x: data.map(d => d.date) as any[],
                        y: data.map(d => (d as any).MA20) as any[],
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: 'rgba(250, 204, 21, 0.7)', width: 1.5, dash: 'dash' },
                        name: 'MA20'
                      },
                    ] as any[]}
                    layout={({
                      template: 'plotly_dark',
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      margin: { t: 10, l: 50, r: 20, b: 40 },
                      xaxis: {
                        rangeslider: { visible: false },
                        gridcolor: 'rgba(255,255,255,0.05)',
                        linecolor: 'rgba(255,255,255,0.1)',
                      },
                      yaxis: {
                        gridcolor: 'rgba(255,255,255,0.05)',
                        linecolor: 'rgba(255,255,255,0.1)',
                      },
                      legend: {
                        orientation: 'h',
                        y: -0.08,
                        x: 0.3,
                        font: { size: 10, color: '#94a3b8' },
                        bgcolor: 'rgba(0,0,0,0)',
                      },
                      shapes: data.filter(d => d.Vol_Spike).map(d => ({
                        type: 'rect',
                        xref: 'x',
                        yref: 'paper',
                        x0: d.date,
                        x1: d.date,
                        y0: 0,
                        y1: 1,
                        fillcolor: 'orange',
                        opacity: 0.1,
                        line: { width: 0 },
                        layer: 'below'
                      }))
                    }) as any}
                    config={{ responsive: true, displayModeBar: false }}
                  />
                </div>
              </div>

              {/* Metrics Panel */}
              <div className="flex flex-col gap-3 w-48">
                <h3 className="text-base font-bold text-white">주요 지표</h3>

                <div className="bg-[#0d1117] border border-slate-800/60 p-4 rounded-xl">
                  <div className="text-slate-500 text-xs mb-1.5">현재가</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {currentTicker.includes(".KS") || currentTicker.includes(".KQ") ? "₩" : "$"}
                    {currentTicker.includes(".KS") || currentTicker.includes(".KQ")
                      ? latestData.close.toLocaleString()
                      : latestData.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-[#0d1117] border border-slate-800/60 p-4 rounded-xl">
                  <div className="text-slate-500 text-xs mb-1.5">RSI(14)</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {latestData.RSI !== null && latestData.RSI !== undefined ? latestData.RSI.toFixed(2) : "N/A"}
                  </div>
                </div>

                <div className="bg-[#0d1117] border border-slate-800/60 p-4 rounded-xl">
                  <div className="text-slate-500 text-xs mb-1.5">볼린저 밴드 상/하단</div>
                  <div className="text-lg font-bold text-blue-400">
                    {latestData.Upper?.toFixed(1) || "N/A"} / {latestData.Lower?.toFixed(1) || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* AI 심층 분석 리포트 - chart 아래 전체 너비 */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🪄</span>
                <h2 className="text-lg font-bold text-white">AI 심층 분석 리포트</h2>
              </div>

              <div className="flex gap-3 items-center">
                {/* Model Selector - Custom Dropdown with health badges */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    disabled={aiLoading || healthLoading}
                    onClick={() => !aiLoading && !healthLoading && setDropdownOpen(o => !o)}
                    className="flex items-center gap-2 bg-[#0d1117] border border-slate-700 hover:border-slate-500 text-slate-300 text-xs px-3 py-3.5 rounded-xl focus:outline-none disabled:opacity-50 cursor-pointer transition-colors min-w-[230px]"
                  >
                    {healthLoading ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /><span className="text-slate-500">모델 상태 확인 중...</span></>
                    ) : (
                      <>
                        <span className="flex-1 text-left">
                          {modelHealth.find(m => m.id === selectedModel)?.label || selectedModel}
                        </span>
                        {(() => {
                          const m = modelHealth.find(m => m.id === selectedModel);
                          if (!m) return null;
                          return (
                            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              m.status === "fast" ? "bg-emerald-900/60 text-emerald-400" :
                              m.status === "normal" ? "bg-yellow-900/60 text-yellow-400" :
                              "bg-red-900/60 text-red-400"
                            }`}>
                              {m.status === "fast" ? "🟢" : m.status === "normal" ? "🟡" : "🔴"} {m.latency < 90000 ? `${(m.latency/1000).toFixed(1)}s` : "Busy"}
                            </span>
                          );
                        })()}
                        <svg className={`w-3 h-3 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && !healthLoading && (
                    <div className="absolute z-50 left-0 top-full mt-1 bg-[#0d1117] border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[280px]">
                      {modelHealth.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { setSelectedModel(m.id); setDropdownOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors hover:bg-slate-800 ${
                            selectedModel === m.id ? "bg-slate-800/80 text-white" : "text-slate-300"
                          }`}
                        >
                          <span className="flex-1">{m.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m.status === "fast" ? "bg-emerald-900/60 text-emerald-400" :
                            m.status === "normal" ? "bg-yellow-900/60 text-yellow-400" :
                            "bg-red-900/60 text-red-400"
                          }`}>
                            {m.status === "fast" ? "🟢 Fast" : m.status === "normal" ? "🟡 Normal" : "🔴 Busy"}
                          </span>
                          <span className="text-slate-600 font-mono text-[10px] w-12 text-right">
                            {m.latency < 90000 ? `${(m.latency/1000).toFixed(1)}s` : "-"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => runAnalysis("ai-analysis")}
                  disabled={aiLoading}
                  className="flex-1 flex justify-center items-center gap-2 bg-[#0d1117] hover:bg-slate-800 border border-slate-700 hover:border-slate-600 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold text-sm transition-all"
                >
                  {aiLoading && aiType === "General" ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🤖</span>}
                  AI 분석 실행
                </button>
                <button
                  onClick={() => runAnalysis("dcf-analysis")}
                  disabled={aiLoading}
                  className="flex-1 flex justify-center items-center gap-2 bg-[#0d1117] hover:bg-slate-800 border border-slate-700 hover:border-slate-600 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold text-sm transition-all"
                >
                  {aiLoading && aiType === "DCF" ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>💰</span>}
                  DCF 분석 실행
                </button>
              </div>
            </div>

            {/* AI Report Result */}
            {(aiLoading || aiReport) && (
              <div className="mt-4 bg-[#0d1117] border border-slate-800/60 p-6 rounded-xl">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2 text-white">
                      {aiType === "General" ? "AI 심층 분석 중..." : "DCF 전문 분석 중..."}
                    </h2>
                    <p className="text-slate-400 mb-4 text-center text-sm max-w-md">
                      실시간 데이터와 최신 뉴스를 기반으로 프롬프트를 구성하고 추론합니다.<br />완료까지 10~30초 가량 소요될 수 있습니다.
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
                      <Sparkles className="text-yellow-400 w-5 h-5" />
                      <h2 className="text-xl font-bold">{aiType === "General" ? "AI 심층 분석 리포트" : "DCF 전문 분석 리포트"}</h2>

                      <div className="flex flex-col md:flex-row gap-2 ml-auto items-end md:items-center">
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
          </>
        )}
      </main>
    </div>
  );
}
