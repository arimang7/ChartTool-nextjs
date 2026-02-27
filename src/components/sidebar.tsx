"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, User, Search, LineChart, Loader2 } from "lucide-react";

interface SearchResult {
  symbol: string;
  name: string;
  market: string;
}

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
}

interface SidebarProps {
  onSearch: (ticker: string, period: string) => void;
  news: NewsItem[];
  loading?: boolean;
}

export function Sidebar({ onSearch, news = [], loading }: SidebarProps) {
  const { data: session, status } = useSession();
  const [market, setMarket] = useState("US");
  const [tickerInput, setTickerInput] = useState("");
  const [period, setPeriod] = useState("1y");
  const [autocompleteResults, setAutocompleteResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [acIndex, setAcIndex] = useState(-1);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const marketPlaceholders: Record<string, string> = {
    US: "종목명 또는 티커 (예: AAPL)",
    KR: "종목명 또는 코드 (예: 삼성전자)",
    HK: "종목명 또는 코드 (예: Tencent)",
    SH: "종목명 또는 코드 (예: 600519)",
  };

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchTicker = async (query: string) => {
    if (query.length < 1) {
      setShowDropdown(false);
      return;
    }
    try {
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}&market=${market}`);
      const data = await res.json();
      const results = data.results || data || [];
      setAutocompleteResults(results);
      setShowDropdown(results.length > 0);
      setAcIndex(-1);
    } catch {
      setShowDropdown(false);
    }
  };

  const handleInputChange = (value: string) => {
    setTickerInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTicker(value.trim()), 300);
  };

  const selectItem = (symbol: string) => {
    setTickerInput(symbol);
    setShowDropdown(false);
    onSearch(symbol, period);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || autocompleteResults.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearchClick();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcIndex((prev) => Math.min(prev + 1, autocompleteResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (acIndex >= 0 && acIndex < autocompleteResults.length) {
        selectItem(autocompleteResults[acIndex].symbol);
      } else {
        setShowDropdown(false);
        handleSearchClick();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleSearchClick = () => {
    const t = tickerInput.trim();
    if (!t) return;
    setShowDropdown(false);
    onSearch(t, period);
  };

  const handleMarketChange = (m: string) => {
    setMarket(m);
    setTickerInput("");
    setShowDropdown(false);
  };

  return (
    <div className="w-72 bg-slate-900 text-white min-h-screen p-4 flex flex-col border-r border-slate-800 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <LineChart className="w-7 h-7 text-blue-400" />
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          📈 AI 주식 분석
        </h1>
      </div>

      {/* Auth */}
      <div className="mb-4">
        {status === "loading" ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : session ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="truncate text-gray-300">{session.user?.email}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-gray-300 py-1.5 px-3 rounded text-xs transition-colors"
            >
              <LogOut className="w-3 h-3" />
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="flex items-center justify-center gap-2 w-full bg-white text-black hover:bg-gray-100 py-2 px-4 rounded transition-colors text-sm font-medium"
          >
            <LogIn className="w-4 h-4" />
            Google 로그인
          </button>
        )}
      </div>

      <div className="h-px bg-slate-800 my-2" />

      {/* Search Section */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">📈 종목 검색</h2>

        {/* Market selector */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-1 block">시장 선택</label>
          <select
            value={market}
            onChange={(e) => handleMarketChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="US">🇺🇸 US 미국</option>
            <option value="KR">🇰🇷 KR 한국</option>
            <option value="HK">🇭🇰 HK 홍콩</option>
            <option value="SH">🇨🇳 SH 상해</option>
          </select>
        </div>

        {/* Ticker input with autocomplete */}
        <div className="mb-3" ref={wrapperRef}>
          <label className="text-xs text-gray-400 mb-1 block">종목명 / 티커</label>
          <div className="relative">
            <input
              type="text"
              value={tickerInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={marketPlaceholders[market]}
              autoComplete="off"
              className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showDropdown && autocompleteResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-700 border-t-0 rounded-b max-h-60 overflow-y-auto z-50 shadow-lg">
                {autocompleteResults.map((r, i) => (
                  <div
                    key={r.symbol}
                    onClick={() => selectItem(r.symbol)}
                    className={`flex justify-between items-center px-3 py-2 cursor-pointer text-sm border-b border-slate-700/50 last:border-b-0 transition-colors ${
                      i === acIndex ? "bg-blue-600/20 text-white" : "text-gray-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="text-blue-400 font-semibold text-xs ml-2 whitespace-nowrap">{r.symbol}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Period selector */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-1 block">조회 기간</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="1mo">1개월</option>
            <option value="3mo">3개월</option>
            <option value="6mo">6개월</option>
            <option value="1y">1년</option>
            <option value="2y">2년</option>
          </select>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearchClick}
          disabled={loading || !tickerInput.trim()}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-2.5 rounded font-semibold text-sm transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          검색
        </button>
      </div>

      <div className="h-px bg-slate-800 my-2" />

      {/* News Section */}
      <div className="flex-1 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">📰 최근 주요 뉴스</h2>
        {news.length === 0 ? (
          <p className="text-xs text-gray-500 italic">종목을 검색하면 뉴스가 표시됩니다.</p>
        ) : (
          <div className="space-y-2">
            {news.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-slate-800/50 border border-slate-700/50 p-2.5 rounded text-xs text-gray-300 hover:bg-slate-700/50 hover:border-blue-500/30 transition-all leading-relaxed"
              >
                <div className="font-medium text-blue-300 mb-1">{n.title}</div>
                <div className="text-gray-500 text-[10px]">{n.publisher}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
