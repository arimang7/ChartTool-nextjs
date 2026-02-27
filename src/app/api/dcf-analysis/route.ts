import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { sendTelegramMessage } from "@/lib/telegram";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { ticker, name, currentPrice, rsi } = await req.json();

    const t0 = Date.now();

    // Read DCF instructions
    let dcfInstructions = "";
    try {
      const filePath = path.join(process.cwd(), "public", "DCF_analysis.md");
      dcfInstructions = fs.readFileSync(filePath, "utf-8");
    } catch (e) {
      console.warn("Could not read DCF_analysis.md, fallback to default instructions.");
      dcfInstructions = "Perform a deep corporate finance analysis and calculate intrinsic value.";
    }

    const t1 = Date.now();
    const dataPrepTime = t1 - t0;

    const date = new Date().toISOString().split("T")[0];
    const prompt = `
${dcfInstructions}

[시스템 지침] 현재 시점은 2026년 2월입니다. 제공된 기업(${name})과 티커(${ticker})는 실시간 시장 데이터가 존재하는 상장사입니다. 
당신의 학습 데이터(Cut-off)상 비상장으로 알고 있더라도, 현재는 상장된 상태이오니 비상장 관련 경고나 "가정하에 분석한다"는 멘트를 생략하고 즉시 상장사 기준의 분석(Narrative + Reverse DCF 등)을 수행하세요.
제공된 현재가와 지표는 실제 시장 데이터입니다.

분석 대상 기업: ${name} (${ticker})
현재 시장 데이터 (${date}):
- 현재가: ${currentPrice}
- RSI(14): ${rsi}

위 가이드라인에 따라 즉시 분석 결과를 출력해 주세요. 서론이나 준비 멘트 없이 바로 본론(10 Key Points)으로 시작하세요.

반드시 리포트 마지막에 아래 형식의 JSON 블록을 추가하세요 (구분자 정확히 사용):
---PRICES_JSON---
{"fairValue": 적정주가숫자, "bullishValue": 강세시적정가숫자, "bearishValue": 약세시적정가숫자}
    `;

    const t2 = Date.now();
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    const t3 = Date.now();
    const aiGenerationTime = t3 - t2;

    let fullText = response.text || "";
    // DCF is fixed high confidence
    const confidenceScore = 95;

    // Parse prices JSON block
    let prices: Record<string, number> = {};
    const priceMatch = fullText.match(/---PRICES_JSON---[\s\n]*(\{[^}]+\})/)
    if (priceMatch) {
      try {
        prices = JSON.parse(priceMatch[1]);
      } catch {}
      fullText = fullText.replace(/---PRICES_JSON---[\s\S]*$/, "").trim();
    }

    return NextResponse.json({ 
        report: fullText, 
        confidenceScore,
        prices,
        durations: {
            dataPrep: dataPrepTime,
            aiGeneration: aiGenerationTime,
            total: t3 - t0
        }
    });
  } catch (error: any) {
    console.error("DCF Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
