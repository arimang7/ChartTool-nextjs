"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, User, Search, LineChart } from "lucide-react";

export function Sidebar() {
  const { data: session, status } = useSession();

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <LineChart className="w-8 h-8 text-blue-400" />
        <h1 className="text-xl font-bold">ChartTool AI</h1>
      </div>

      <div className="mb-8">
        <h2 className="text-sm text-gray-400 font-semibold mb-4 uppercase">계정</h2>
        {status === "loading" ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : session ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              <span className="truncate">{session.user?.email}</span>
            </div>
            <button
              onClick={() => signOut()}
              className="mt-2 flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm text-gray-400">
            <div>Guest User</div>
            <button
              onClick={() => signIn("google")}
              className="mt-2 flex items-center justify-center gap-2 w-full bg-white text-black hover:bg-gray-100 py-2 px-4 rounded transition-colors text-sm font-medium"
            >
              <LogIn className="w-4 h-4" />
              <span>Google 로그인</span>
            </button>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm text-gray-400 font-semibold mb-4 uppercase">메뉴</h2>
        <div className="flex items-center gap-2 text-sm hover:text-blue-400 cursor-pointer transition-colors p-2 rounded hover:bg-slate-800">
          <Search className="w-4 h-4" />
          <span>종목 검색</span>
        </div>
        {/* Watchlist could be added here in the future */}
      </div>
    </div>
  );
}
