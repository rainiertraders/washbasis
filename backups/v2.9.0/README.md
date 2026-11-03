# WashGuard 🛡️
### Wash Sale Calculator & Trading Scenario Simulator (Web & Mobile PWA)

A privacy-first, client-side web and mobile application designed to calculate IRS Section 1091 wash sale rules, visualize 61-day wash sale windows, and match multi-leg BUY and SELL trades with partial lot splitting.

> **Legal Disclaimer:** WashGuard is an educational simulation and analytical tool for personal trading strategy and record-keeping. It is not tax advice, tax preparation, or a tax filing service.

---

## Key Features

1. **⚡ Interactive Multi-Leg Scenario Simulator**:
   - Immediate feedback on whether planned trades trigger wash sales.
   - Dynamic support for multiple SELL and BUY legs.
   - Interactive 61-day visual timeline showing the pre-sale 30 days, transaction dates, post-sale danger zone, and the safe buyback date (Day +31).
   - Dynamic computation of disallowed loss, allowed loss, and replacement lot cost basis adjustment with partial lot splitting.

2. **📊 Batch & CSV Trade Analyzer**:
   - Drag-and-drop standard generic CSV import (`Date, Symbol, Type, Shares, Price`).
   - Quick-add manual trade form with BUY and SELL legs.
   - Automated FIFO lot matching and wash sale absorption calculations.
   - Comprehensive audit table of all sales and replacement lot basis adjustments.
   - Export analysis as clean CSV files for personal trading logs.

3. **🪙 Crypto Wash Sale Rules Toggle**:
   - Under current IRS law, cryptocurrency is treated as property and exempt from IRC Section 1091.
   - Includes an experimental toggle to simulate future proposed regulations where crypto wash sales become active.

4. **🔒 100% Client-Side Privacy**:
   - Zero trade data is sent to any server or database. All parsing, calculations, and exports run entirely inside the user's browser.

---

## Monetization Architecture

### 1. Ad Units (Google AdSense + Sell-Side Platforms)
- Configured in `assets/js/ui/monetization.js`.
- Responsive top leaderboard and in-content slots.
- Ready for Google AdSense (`adsbygoogle`) by simply inserting your publisher ID (`ca-pub-XXXXXXXXXX`).
- Compatible with Header Bidding / Sell-Side Platforms (Prebid / OpenX / Magnite).
- High-CPM fallback cards for financial affiliate partners (e.g., TradingView, Interactive Brokers) to ensure monetization even when adblockers or unapproved domains are active.

### 2. Pro Subscription Tier (Freemium Gating)
- Free tier includes full Quick Scenario Calculator and up to 15 batch trades.
- Pro tier unlocks:
  - Unlimited batch trades & CSV uploads.
  - Cross-broker wash sale matching.
  - Multi-leg BUY and SELL lot splitting.
  - CSV audit exports.
  - 100% ad-free experience.
- Pricing structure:
  - **Monthly**: $7.99 / month
  - **Annual**: $49.00 / year (Save 48%)
  - **Season Pass**: $19.99 (60-day tax season access)
- Built-in Stripe integration hook (`handleCheckout`) with a seamless Demo Mode for testing.

---

## Quick Start / Running Locally

WashGuard requires zero build steps or heavy dependencies. You can run it immediately using Python's built-in HTTP server:

```bash
cd /Users/maurice/.gemini/antigravity/scratch/wash-guard
python3 -m http.server 8080
```

Open your browser and visit:
👉 `http://localhost:8080`

---

## Deploying to Web (Zero-Cost Hosting)

Because WashGuard is a pure client-side static web application with maximum privacy, you can host it for free on any static host:

- **Cloudflare Pages**: Connect your GitHub repository or drag and drop the `wash-guard` folder.
- **GitHub Pages**: Push to a GitHub repository and enable Pages in repository settings.
- **Firebase Hosting**: Run `firebase init hosting` and deploy in seconds.
- **Vercel / Netlify**: Deploy via git or CLI (`vercel deploy`).

---

## Mobile App Packaging (PWA & Native App Store)

### 1. Instant Mobile PWA (iOS & Android)
WashGuard includes a Web App Manifest (`manifest.json`) and Service Worker (`sw.js`).
- **iOS**: Open the hosted URL in Safari, tap **Share** $\to$ **Add to Home Screen**.
- **Android**: Open in Chrome, tap the **Install App** button or the 3-dot menu $\to$ **Install App**.

### 2. Native iOS & Android Apps via Capacitor
To generate native iOS Xcode and Android Studio projects for the Apple App Store and Google Play Store:

```bash
# 1. Initialize Capacitor in the project folder
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# 2. Initialize Capacitor configuration
npx cap init WashGuard com.washguard.app --web-dir .

# 3. Add iOS and Android platforms
npx cap add ios
npx cap add android

# 4. Open in native IDEs
npx cap open ios      # Opens in Xcode (macOS)
npx cap open android  # Opens in Android Studio
```

---

## Automated Verification

Run the Python verification test suite to ensure IRS 61-day window math, basis adjustments, and edge cases are performing accurately:

```bash
python3 tests/test_engine.py
```
