# 📊 AI Stock Analysis Tool (Next.js Dashboard)

A high-performance stock analysis dashboard combining real-time market data, technical indicators, and Gemini AI.

## 🚀 Key Features

1. **Real-time Charts & Data**: Integrated with Yahoo Finance API to provide real-time candlestick charts and volume data.
2. **Technical Indicator Calculation**: Automatically calculates and visualizes major indicators such as RSI(14) and 20-day Bollinger Bands (Upper/Lower).
3. **AI Deep Analysis**: Analyzes harmonic patterns (AB=CD, 5-0) and market momentum based on 30 days of price data and the latest news. (Powered by Gemini 2.5 Flash)
4. **Professional DCF Analysis**: Generates Discounted Cash Flow (DCF) reports to evaluate the intrinsic financial value of companies.
5. **Real-time News Tab**: Instantly check the latest global news for the stock being analyzed.
6. **Telegram Notifications**: Send generated analysis reports to your personal Telegram bot with a single click.

## 📁 Project Structure

```text
nextjs/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── stock/          # API for stock history and news search
│   │   │   ├── ai-analysis/    # AI analysis API based on harmonic patterns
│   │   │   ├── dcf-analysis/   # API for Discounted Cash Flow (DCF) analysis
│   │   │   └── send-telegram/  # API for manual Telegram report transmission
│   │   ├── page.tsx            # Main dashboard UI and interaction logic
│   │   └── globals.css         # Global styles and dark mode theme configuration
│   └── lib/
│       ├── indicators.ts       # Logic for calculating RSI, Bollinger Bands, etc.
│       └── telegram.ts         # Utility for Telegram Bot API communication
├── prompt/                     # Harmonic pattern guideline documents for AI
└── public/                     # Static assets (DCF guidelines, etc.)
```

## 🛠 Usage Instructions

### 1. Environment Configuration

Create a `.env.local` file and enter the following information:

```env
GEMINI_API_KEY=your_google_ai_key
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### 2. Execution

```bash
npm install
npm run dev
```

### 3. Analysis Process

1. **Stock Search**: Enter a ticker (e.g., `TSLA`, `AAPL`) in the search bar at the top right.
2. **Chart/News Check**: Analyze the chart in the main area or check trends in the [Top News] tab.
3. **Generate Report**: Click the [AI Deep Analysis] or [DCF Professional Analysis] button at the bottom. (Takes approx. 15-20 seconds)
4. **Send Results**: Once the report is complete, click the [Send to Telegram] button at the top right of the report to receive it on your mobile device.

## ⚡ Optimization History

- **Speed Improvements**: Optimized AI analysis time from over 60 seconds to **10-20 seconds** through news pre-loading and prompt compression techniques.
- **Readability**: Applied Tailwind Typography to render AI reports in a clean, document-like format.
- **Stability**: Implemented plain text mode for Telegram transmissions to prevent Markdown parsing errors.
