import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Condensed harmonic pattern reference (replaces full docs to cut token count)
const HARMONIC_SUMMARY = `
[하모닉 패턴 핵심 참조]
■ AB=CD: A→B→C→D 대칭구조. C 되돌림 깊이가 D 목표를 결정.
  C 되돌림 / BC확장 D후보: 0.382→2.618, 0.5→2.0, 0.618→1.618, 0.707→1.414, 0.786→1.272, 0.886→1.13
  PRZ = AB=CD 완성점 + BC확장 겹침 구간. PRZ 도달 시 반응 관찰 후 진입.
■ 5-0 패턴: 추세 끝 실패스윙(AB) → 극단확장(BC=1.618~2.24×AB) → 첫 되돌림(D)
  PRZ = BC 50% 되돌림 + Reciprocal AB=CD. 61.8%는 손절 마지노선.
■ Reciprocal AB=CD: 긴 추세 속 역방향 조정 대응. 추세 초반 되돌림 측정 도구.
`;

export async function POST(req: NextRequest) {
  try {
    const { ticker, name, currentPrice, rsi, upper, lower, history = [], news = [] } = await req.json();

    const date = new Date().toISOString().split("T")[0];
    
    const t0 = Date.now();

    // Process News from client (already fetched at search time)
    const newsList = news.map((n: any) => `- ${n.title} (${n.publisher})`);
    const t1 = Date.now();
    const dataPrepTime = t1 - t0;

    const priceHistoryStr = history.map((d: any) => `${d.date},${d.open.toFixed(2)},${d.high.toFixed(2)},${d.low.toFixed(2)},${d.close.toFixed(2)},${d.volume}`).join("\n");

    const prompt = `
당신은 금융 분석가이자 하모닉 패턴 트레이딩 전문가입니다.
종목: ${name || ticker} | 기준일: ${date}
현재가: ${currentPrice} | RSI(14): ${rsi} | 볼린저밴드: 상단 ${upper} / 하단 ${lower}

[최근 뉴스]
${newsList.length > 0 ? newsList.join("\n") : "없음"}

[최근 OHLCV (Date,Open,High,Low,Close,Volume)]
${priceHistoryStr}

${HARMONIC_SUMMARY}

위 데이터를 바탕으로 다음 4가지를 마크다운 한국어로 작성:
1. 뉴스/이벤트 기반 모멘텀 평가
2. RSI, 볼린저 밴드 해설
3. 하모닉 패턴(AB=CD, 5-0 등) 형성 가능성 분석 (PRZ, C/D 후보 포함)
4. 단기/중장기 매수·매도·관망 전략 결론 (반드시 구체적 가격 수치 포함)

반드시 리포트 마지막에 아래 형식의 JSON 블록을 추가하세요 (구분자 정확히 사용):
---PRICES_JSON---
{"entryPrice": 진입가숫자, "target1": 1차목표가숫자, "target2": 2차목표가숫자, "stopLoss": 손절가숫자}
    `;

    const t2 = Date.now();
    // Use gemini-flash-latest which is much faster
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    const t3 = Date.now();
    const aiGenerationTime = t3 - t2;

    let fullText = response.text || "";
    const confidenceScore = Math.floor(Math.random() * 20) + 80;

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
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
