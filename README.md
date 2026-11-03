# WashBasis 🛡️
### Institutional Wash Sale Calculator & Statutory Window Visualizer

**WashBasis** ([washbasis.com](https://washbasis.com)) is a privacy-first, client-side web application designed to simulate wash sale mechanics, visualize 61-day statutory replacement windows, and calculate multi-leg BUY and SELL sequences with automatic cost basis propagation and partial lot splitting.

> **Legal Disclaimer:** WashBasis is an educational simulation and mathematical utility for personal trading strategy and scenario analysis. It does NOT provide formal tax advisory, legal, investment, or certified public accountant (CPA) tax filing services. Consult a licensed CPA or tax professional regarding your actual tax liabilities.

---

## Key Features

1. **⚡ Multi-Leg Transaction Blotter**:
   - Dynamic entry for arbitrary BUY and SELL legs in chronological order.
   - **"Sold From Lot" Selector**: Link SELL legs to specific prior BUY lots.
   - **Automatic Basis Propagation**: Disallowed wash losses automatically tack onto replacement lots.
   - Pro-rata partial lot splitting and holding period tacking.

2. **📅 Collision-Free 61-Day Statutory Horizon**:
   - Interactive date-scale timeline visualizing the pre-sale 30-day window, Day 0 reference loss sale, 30-day disallowance zone, and Day +31 safe clearance horizon.
   - 4-tier adaptive stalk heights preventing visual pin overlap.
   - Chronological Lot Absorption & Tax Basis Allocation Ledger table.

3. **🔒 100% Client-Side Privacy**:
   - Zero external servers, databases, or trade logging. All financial computations run strictly inside your web browser via local JavaScript.
   - Zero retention of broker credentials, portfolio values, or account numbers.

4. **📱 Offline PWA & Mobile Ready**:
   - Service worker caching (`sw.js`) and Web App Manifest (`manifest.json`) enable full offline functionality.
   - Can be installed as a standalone web app on iOS and Android.

5. **💼 Monetization & AdSense Ready**:
   - Dedicated AdSense-compliant `privacy.html` and `terms.html`.
   - Production `robots.txt`, `sitemap.xml`, and publisher `ads.txt`.
   - Support for Google AdSense auto anchor ads and widescreen side rails.

---

## Project Structure

```
├── index.html            # Main single-page application & execution blotter
├── privacy.html          # Google AdSense-compliant Privacy Policy
├── terms.html            # Terms of Use & non-CPA disclaimers
├── robots.txt            # Search engine crawler instructions
├── sitemap.xml           # XML sitemap with canonical URLs
├── ads.txt               # AdSense publisher authorization file
├── manifest.json         # Progressive Web App (PWA) manifest
├── sw.js                 # Service worker for offline caching
├── assets/
│   ├── css/style.css     # Tailored custom styles & timeline layout
│   ├── icons/            # SVG vector logo badges
│   └── js/
│       ├── app.js        # Main UI application controller
│       ├── engine/       # Wash sale calculation & basis tacking engines
│       └── ui/           # Timeline visualizer & monetization modules
├── tests/                # Automated Python verification test suites
└── rollback.py           # Snapshot version manager & rollback utility
```

---

## Quick Start (Local Development)

WashBasis is a zero-dependency, static web application. Run it instantly with Python's built-in HTTP server:

```bash
# Start local server on port 8080
python3 -m http.server 8080
```

Open your browser and navigate to:
👉 **`http://localhost:8080`**

---

## Automated Verification Tests

To run the automated calculation verification test suites:

```bash
python3 tests/test_multi_sell_buy.py
python3 tests/test_engine.py
python3 tests/test_lot_split.py
python3 tests/test_multi_scenario.py
```

---

## Publishing to GitHub & GitHub Pages

1. **Initialize Git & Commit**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of WashBasis v3.8.4"
   ```

2. **Push to GitHub**:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

3. **Host for Free on GitHub Pages**:
   - On GitHub, go to **Settings** $\to$ **Pages**.
   - Under **Build and deployment**, select **Source: Deploy from a branch**.
   - Select branch **`main`** and folder **`/ (root)`**, then click **Save**.
   - Under **Custom domain**, enter `washbasis.com` and enable **Enforce HTTPS**.

---

## License

© 2026 WashBasis. All rights reserved. For personal and analytical portfolio simulation.
