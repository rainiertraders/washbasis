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
      <div class="ad-unit relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 p-4 shadow-lg">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg font-bold">
              TV
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  ${tradingViewBanner.tag}
                </span>
                <span class="text-xs text-slate-400 font-mono">${tradingViewBanner.sponsor}</span>
              </div>
              <h5 class="text-sm font-semibold text-white mt-0.5">${tradingViewBanner.headline}</h5>
              <p class="text-xs text-slate-300">${tradingViewBanner.sub}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <a href="${tradingViewBanner.link}" target="_blank" rel="noopener sponsored" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-mono shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap">
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
  } else if (slotType === 'midstream') {
    containerEl.innerHTML = `
      <div class="ad-unit p-4 rounded-xl bg-gradient-to-r from-emerald-950 via-[#0C1B15] to-[#1D393C] border border-emerald-500/30 shadow-md text-white font-mono">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
              IBKR
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  BROKER INTEGRATION SPONSOR
                </span>
                <span class="text-[11px] text-slate-400">Interactive Brokers Group</span>
              </div>
              <div class="text-xs font-semibold text-white mt-0.5 font-sans">Automated Tax-Loss Harvesting & Global Stock Execution</div>
              <p class="text-[11px] text-[#C5D9E3] font-sans">Sync positions directly with real-time wash sale prevention rules.</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <a href="https://www.interactivebrokers.com/" target="_blank" rel="noopener sponsored" class="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xs transition-all whitespace-nowrap">
              Open Pro Account →
            </a>
          </div>
        </div>
      </div>
    `;
  } else if (slotType === 'sticky') {
    containerEl.innerHTML = `
      <div class="ad-unit sticky bottom-0 z-30 w-full bg-[#0C1B15]/95 backdrop-blur-md border-t border-[#1D393C] p-2.5 px-4 sm:px-6 shadow-2xl">
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs font-mono text-white">
          <div class="flex items-center gap-3 truncate">
            <span class="px-1.5 py-0.5 rounded bg-[#A19ABD] text-[#0C1B15] font-black text-[10px]">AD</span>
            <div class="truncate font-sans">
              <span class="font-bold text-[#C5D9E3]">Automate Wash Sale & Form 8949 Accounting:</span>
              <span class="text-slate-300 hidden md:inline ml-1">Connect your trading accounts for 1-click tax reconciliation.</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <a href="https://www.tradingview.com/?aff_id=1171742" target="_blank" rel="noopener sponsored" class="px-3 py-1 rounded bg-[#1D393C] hover:bg-[#284f53] text-[#F6F4EF] border border-[#C5D9E3]/30 text-xs font-bold transition-all">
              Learn More
            </a>
            <button onclick="this.closest('.ad-unit').remove()" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors" title="Dismiss">
              ✕
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

export function openProModal() {}
export function closeProModal() {}
export function handleCheckout() {}

