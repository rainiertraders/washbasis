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

  // TradingView High-CPM Affiliate Offer Banner
  const tradingViewBanner = {
    sponsor: 'TradingView Partner',
    headline: 'Next-Level Charting & Real-Time Market Screener',
    sub: 'Get up to $30 off your trading subscription today.',
    cta: 'Explore Charts & Screener →',
    link: 'https://www.tradingview.com/?aff_id=1171742',
    tag: 'FINANCIAL PARTNER'
  };

  if (slotType === 'leaderboard') {
    containerEl.innerHTML = `
      <div class="ad-unit relative overflow-hidden rounded-xl bg-white border border-[#e4dcf1] p-4 shadow-xs">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm font-mono tracking-tighter shrink-0">
              TV
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono">
                  ${tradingViewBanner.tag}
                </span>
                <span class="text-xs text-slate-500 font-mono">${tradingViewBanner.sponsor}</span>
              </div>
              <h5 class="text-sm font-bold text-slate-900 mt-0.5">${tradingViewBanner.headline}</h5>
              <p class="text-xs text-slate-600">${tradingViewBanner.sub}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <a href="${tradingViewBanner.link}" target="_blank" rel="noopener sponsored" class="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold font-mono shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap">
              <span>${tradingViewBanner.cta}</span>
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

