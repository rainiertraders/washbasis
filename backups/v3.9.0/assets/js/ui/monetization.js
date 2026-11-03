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
    slotSidebar: '0987654321',
    slotAnchor: '5566778899',
    slotSideRailLeft: '1122334455',
    slotSideRailRight: '9988776655'
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
  } else if (slotType === 'anchor' || slotType === 'sticky') {
    containerEl.innerHTML = `
      <div id="anchorAdUnit" class="ad-unit ad-anchor-unit fixed bottom-0 left-0 right-0 z-40 bg-[#0C1B15] border-t border-[#1D393C] p-2.5 px-4 sm:px-8 shadow-2xl transition-all duration-300">
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs font-mono text-white">
          <div class="flex items-center gap-2.5 truncate">
            <span class="inline-flex items-center gap-1 bg-[#1D393C] text-[#C5D9E3] px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border border-[#284f53] flex-shrink-0">
              <svg class="w-2.5 h-2.5 fill-[#C5D9E3]" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              ADSENSE ANCHOR
            </span>
            <div class="truncate font-sans">
              <span class="font-bold text-[#F6F4EF]">Interactive Brokers:</span>
              <span class="text-[#C5D9E3] hidden md:inline ml-1.5">Trade global equities with automated wash-sale tax tracking & 4.83% USD cash yield.</span>
            </div>
          </div>
          <div class="flex items-center gap-2.5 flex-shrink-0">
            <a href="https://www.interactivebrokers.com/" target="_blank" rel="noopener sponsored" class="px-3 py-1.5 rounded-lg bg-[#1D393C] hover:bg-[#284f53] text-[#F6F4EF] border border-[#C5D9E3]/30 text-xs font-bold transition-all whitespace-nowrap shadow-xs">
              Learn More →
            </a>
            <button id="dismissAnchorAdBtn" class="w-6 h-6 rounded-md bg-[#1D393C] hover:bg-rose-950/80 text-[#B4C4C3] hover:text-rose-200 border border-[#284f53] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer" title="Dismiss AdSense Anchor">
              ✕
            </button>
          </div>
        </div>

        <!-- Google AdSense Live Script/Ins Tag (Anchor Ad edge unit) -->
        <div class="hidden adsense-real-slot">
          <ins class="adsbygoogle"
               style="display:block"
               data-ad-client="${MONETIZATION_CONFIG.adSense.client}"
               data-ad-slot="${MONETIZATION_CONFIG.adSense.slotAnchor}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>
      </div>
    `;

    // Smooth dismiss action
    const closeBtn = containerEl.querySelector('#dismissAnchorAdBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const unit = containerEl.querySelector('#anchorAdUnit');
        if (unit) {
          unit.style.opacity = '0';
          unit.style.transform = 'translateY(100%)';
          setTimeout(() => {
            containerEl.innerHTML = '';
            const main = document.querySelector('main');
            if (main) main.classList.remove('pb-16');
          }, 250);
        }
      });
    }
  } else if (slotType === 'siderail-left') {
    containerEl.innerHTML = `
      <div class="w-[160px] h-[600px] bg-white border border-[#C5D9E3] rounded-xl p-2.5 shadow-xs flex flex-col justify-between text-center font-mono text-[10px]">
        <div>
          <div class="flex items-center justify-between text-[9px] text-slate-500 border-b border-slate-100 pb-1.5 mb-3">
            <span class="font-bold text-[#0C1B15]">AdSense Rail</span>
            <span class="text-slate-400">160×600</span>
          </div>
          <div class="space-y-3 p-1">
            <div class="w-11 h-11 mx-auto rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-emerald-800 text-xs shadow-2xs">
              CPA
            </div>
            <div class="font-bold text-[#0C1B15] text-xs font-sans leading-tight">Tax-Loss Harvesting Tools</div>
            <p class="text-[11px] text-slate-600 font-sans leading-relaxed">Automate 1099-B wash sale reconciliation for your trading portfolio.</p>
            <a href="https://www.interactivebrokers.com/" target="_blank" rel="noopener sponsored" class="block w-full py-2 px-1 rounded-lg bg-[#F6F4EF] hover:bg-[#e9e6dd] text-[11px] text-[#0C1B15] font-bold border border-[#C5D9E3] transition-all">
              Compare Top CPAs →
            </a>
          </div>
        </div>

        <!-- Google AdSense Live Markup -->
        <div class="hidden adsense-real-slot">
          <ins class="adsbygoogle"
               style="display:inline-block;width:160px;height:600px"
               data-ad-client="${MONETIZATION_CONFIG.adSense.client}"
               data-ad-slot="${MONETIZATION_CONFIG.adSense.slotSideRailLeft}"></ins>
        </div>

        <div class="text-[9px] text-slate-400 pt-1.5 border-t border-slate-100 flex items-center justify-center gap-1">
          <span>AdChoices</span> ⓘ
        </div>
      </div>
    `;
  } else if (slotType === 'siderail-right') {
    containerEl.innerHTML = `
      <div class="w-[160px] h-[600px] bg-white border border-[#C5D9E3] rounded-xl p-2.5 shadow-xs flex flex-col justify-between text-center font-mono text-[10px]">
        <div>
          <div class="flex items-center justify-between text-[9px] text-slate-500 border-b border-slate-100 pb-1.5 mb-3">
            <span class="font-bold text-[#0C1B15]">AdSense Rail</span>
            <span class="text-slate-400">160×600</span>
          </div>
          <div class="space-y-3 p-1">
            <div class="w-11 h-11 mx-auto rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-900 text-xs shadow-2xs">
              PRO
            </div>
            <div class="font-bold text-[#0C1B15] text-xs font-sans leading-tight">Zero-Fee Trading Accounts</div>
            <p class="text-[11px] text-slate-600 font-sans leading-relaxed">Access Level-2 market depth and algorithmic trade execution.</p>
            <a href="https://www.interactivebrokers.com/" target="_blank" rel="noopener sponsored" class="block w-full py-2 px-1 rounded-lg bg-[#F6F4EF] hover:bg-[#e9e6dd] text-[11px] text-[#0C1B15] font-bold border border-[#C5D9E3] transition-all">
              View Broker Rates →
            </a>
          </div>
        </div>

        <!-- Google AdSense Live Markup -->
        <div class="hidden adsense-real-slot">
          <ins class="adsbygoogle"
               style="display:inline-block;width:160px;height:600px"
               data-ad-client="${MONETIZATION_CONFIG.adSense.client}"
               data-ad-slot="${MONETIZATION_CONFIG.adSense.slotSideRailRight}"></ins>
        </div>

        <div class="text-[9px] text-slate-400 pt-1.5 border-t border-slate-100 flex items-center justify-center gap-1">
          <span>AdChoices</span> ⓘ
        </div>
      </div>
    `;
  }
}

export function renderAnchorAd(containerEl) {
  renderAdSlot(containerEl, 'anchor');
}

export function renderSideRails(leftEl, rightEl) {
  if (leftEl) renderAdSlot(leftEl, 'siderail-left');
  if (rightEl) renderAdSlot(rightEl, 'siderail-right');
}

export function openProModal() {}
export function closeProModal() {}
export function handleCheckout() {}

