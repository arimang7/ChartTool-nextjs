import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const { ticker, report, type, confidenceScore } = await req.json();
    
    if (!ticker || !report) {
      return NextResponse.json({ error: "Missing ticker or report" }, { status: 400 });
    }

    const titlePrefix = type === "DCF" ? "[DCF 전문 분석]" : "[AI 심층 분석]";
    const message = `🚀 ${titlePrefix} ${ticker} 분석 리포트\n신뢰도: ${confidenceScore || 'N/A'}\n\n${report}`;

    // Telegram's message limit is 4096 characters, so trim if necessary.
    const truncatedMessage = message.length > 4000 ? message.slice(0, 4000) + "\n\n... (내용 잘림)" : message;
    
    await sendTelegramMessage(truncatedMessage);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Telegram send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
