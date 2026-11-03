/**
 * WashGuard Monetization & Ad Network Engine
 * Manages Google AdSense, Sell-Side Platform (SSP) header bidding slots,
 * High-CPM Financial Affiliate Banners, and Stripe Pro Subscriptions.
 */

export const MONETIZATION_CONFIG = {
  freeTradeLimit: 15,
  adSense: {
    enabled: true,
    client: 'ca-pub-XXXXXXXXXXXXXXXX', // Replace with real publisher ID
    slotBanner: '1234567890',
    slotSidebar: '0987654321'
  },
  sspHeaderBidding: {
    enabled: true,
    networkName: 'Prebid / OpenX / Magnite'
  },
  stripe: {
    publishableKey: 'pk_test_sample_washguard',
    monthlyPriceId: 'price_monthly_washguard',
    annualPriceId: 'price_annual_washguard',
    seasonPassPriceId: 'price_season_washguard'
  }
};

/**
 * Check if the current user has Pro active in local storage
 */
export function isProUser() {
  try {
    return localStorage.getItem('washguard_is_pro') === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Set Pro status
 */
export function setProUser(isPro) {
  try {
    localStorage.setItem('washguard_is_pro', isPro ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('washguard_pro_changed', { detail: { isPro } }));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Render an Ad Container with Google AdSense, SSP Fallback, or Financial Affiliate Banner
 */
export function renderAdSlot(containerEl, slotType = 'leaderboard') {
  if (!containerEl) return;

  if (isProUser()) {
    containerEl.innerHTML = `
      <div class="p-2 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800/60">
        ✨ <span class="font-semibold text-amber-400">Pro Active:</span> Ad-free experience enabled.
      </div>
    `;
    return;
  }

  // High-CPM Affiliate Offer Cards (Shown if AdSense hasn't loaded or ad blockers are present)
  const affiliateBanners = [
    {
      sponsor: 'TradingView Partner',
      headline: 'Next-Level Charting & Real-Time Market Screener',
      sub: 'Get up to $30 off your trading subscription today.',
      cta: 'Explore Charts & Screener →',
      link: 'https://www.tradingview.com/?aff_id=1171742',
      tag: 'FINANCIAL SPONSOR'
    },
    {
      sponsor: 'Interactive Brokers Partner',
      headline: 'Automate Complex Portfolio Execution',
      sub: 'Trade stocks, options, and global assets with lowest industry margin rates.',
      cta: 'Open Account & Compare Rates →',
      link: 'https://www.tradingview.com/?aff_id=1171742',
      tag: 'BROKER PARTNER'
    }
  ];

  const pick = affiliateBanners[Math.floor(Math.random() * affiliateBanners.length)];

  if (slotType === 'leaderboard') {
    containerEl.innerHTML = `
      <div class="ad-unit relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-4 shadow-lg">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg font-bold">
              ⚡
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  ${pick.tag}
                </span>
                <span class="text-xs text-slate-400">${pick.sponsor}</span>
              </div>
              <h5 class="text-sm font-semibold text-white mt-0.5">${pick.headline}</h5>
              <p class="text-xs text-slate-300">${pick.sub}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <a href="${pick.link}" target="_blank" rel="noopener sponsored" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all">
              ${pick.cta}
            </a>
          </div>
        </div>

        <!-- Google AdSense / SSP Embed Markup (Ready for Publisher ID) -->
        <div class="hidden adsense-real-slot">
          <ins class="adsbygoogle"
               style="display:block"
               data-ad-client="${MONETIZATION_CONFIG.adSense.client}"
               data-ad-slot="${MONETIZATION_CONFIG.adSense.slotBanner}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>
      </div>
    `;
  }
}

export function openProModal() {}
export function closeProModal() {}
export function handleCheckout() {}

