/**
 * WashGuard Main Application Controller
 * Connects calculation engine, timeline visualizer, and monetization layer.
 */

import { calculateScenario } from './engine/washSaleEngine.js';
import { renderTimeline } from './ui/timeline.js';
import { renderAdSlot } from './ui/monetization.js';

// Application State
const state = {
  activeTab: 'scenario',
  lastScenarioResult: null,
  deferredInstallPrompt: null
};

// DOM Elements
const els = {
  tabScenarioView: document.getElementById('tabScenarioView'),
  installAppBtn: document.getElementById('installAppBtn'),
  adSlotTop: document.getElementById('adSlotTop'),

  // Scenario Elements
  scenarioForm: document.getElementById('scenarioForm'),
  calcScenarioBtn: document.getElementById('calcScenarioBtn'),
  scenSymbol: document.getElementById('scenSymbol'),
  scenStatusBadge: document.getElementById('scenStatusBadge'),
  resDisallowedLoss: document.getElementById('resDisallowedLoss'),
  resAllowedLoss: document.getElementById('resAllowedLoss'),
  resAdjustedBasis: document.getElementById('resAdjustedBasis'),
  resSafeDate: document.getElementById('resSafeDate'),
  scenNarrativeBox: document.getElementById('scenNarrativeBox'),
  timelineContainer: document.getElementById('timelineContainer')
};

// Initialize Application
function init() {
  setupThemeSwitcher();
  setupScenarioCalculator();
  setupMonetization();
  setupPWA();

  // Load default scenario
  runScenarioCalculation();
}

function setupThemeSwitcher() {
  const btn1A = document.getElementById('btnTheme1A');
  const btn1B = document.getElementById('btnTheme1B');
  const switcher = document.getElementById('variantSwitcher');
  const headerSubtitle = document.getElementById('brandSubtitle');
  const headerEngineTag = document.getElementById('headerEngineTag');

  function applyTheme(theme) {
    if (theme === '1b') {
      document.body.classList.remove('theme-1a');
      document.body.classList.add('theme-1b');

      if (btn1A && btn1B && switcher) {
        switcher.className = 'flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-300 text-[10px] font-mono transition-colors';
        btn1B.className = 'px-2 py-0.5 rounded font-bold transition-all text-blue-700 bg-white shadow-2xs border border-slate-200';
        btn1A.className = 'px-2 py-0.5 rounded font-medium transition-all text-slate-500 hover:text-slate-900';
      }
      if (headerSubtitle) headerSubtitle.textContent = '| PRIME BROKERAGE TAX ENGINE';
      if (headerEngineTag) headerEngineTag.textContent = 'PRIME DESK MODE';
    } else {
      document.body.classList.remove('theme-1b');
      document.body.classList.add('theme-1a');

      if (btn1A && btn1B && switcher) {
        switcher.className = 'flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono transition-colors';
        btn1A.className = 'px-2 py-0.5 rounded font-bold transition-all text-white bg-slate-700 shadow-2xs';
        btn1B.className = 'px-2 py-0.5 rounded font-medium transition-all text-slate-400 hover:text-white';
      }
      if (headerSubtitle) headerSubtitle.textContent = '| IRC § 1091 WASH SALE CALCULATOR';
      if (headerEngineTag) headerEngineTag.textContent = 'STATUTORY ENGINE';
    }
    localStorage.setItem('washguard_theme', theme);
  }

  if (btn1A) btn1A.addEventListener('click', () => applyTheme('1a'));
  if (btn1B) btn1B.addEventListener('click', () => applyTheme('1b'));

  // Default to 1b for the new Option 1A-matching Prime Brokerage layout
  const savedTheme = localStorage.getItem('washguard_theme') || '1b';
  applyTheme(savedTheme);
}

// Scenario Dynamic Legs State
state.scenarioLegs = [
  { id: 'leg-1', type: 'BUY', date: '2026-03-01', shares: 100, price: 200.00, costBasis: 200.00 },
  { id: 'leg-2', type: 'SELL', date: '2026-03-15', shares: 100, price: 170.00, soldFrom: 'leg-1' },
  { id: 'leg-3', type: 'BUY', date: '2026-03-25', shares: 100, price: 175.00, costBasis: 175.00 }
];

// Setup Scenario Calculator
function setupScenarioCalculator() {
  els.calcScenarioBtn.addEventListener('click', runScenarioCalculation);

  // Add BUY Leg Button
  const addBuyBtn = document.getElementById('addBuyLegBtn');
  if (addBuyBtn) {
    addBuyBtn.addEventListener('click', () => {
      const lastLeg = state.scenarioLegs[state.scenarioLegs.length - 1];
      const nextDate = lastLeg ? lastLeg.date : '2026-03-15';
      const nextPrice = lastLeg ? lastLeg.price : 180.00;
      addScenarioLeg({
        type: 'BUY',
        date: nextDate,
        shares: lastLeg ? lastLeg.shares : 100,
        price: nextPrice
      });
      runScenarioCalculation();
    });
  }

  // Add SELL Leg Button
  const addSellBtn = document.getElementById('addSellLegBtn');
  if (addSellBtn) {
    addSellBtn.addEventListener('click', () => {
      const lastLeg = state.scenarioLegs[state.scenarioLegs.length - 1];
      const nextDate = lastLeg ? lastLeg.date : '2026-03-15';
      const nextPrice = lastLeg ? lastLeg.price : 180.00;
      const buyLegs = state.scenarioLegs.filter(l => (l.type || '').toUpperCase() === 'BUY');
      const defaultSoldFrom = buyLegs.length > 0 ? buyLegs[buyLegs.length - 1].id : '';
      addScenarioLeg({
        type: 'SELL',
        date: nextDate,
        shares: lastLeg ? lastLeg.shares : 100,
        price: nextPrice,
        soldFrom: defaultSoldFrom
      });
      runScenarioCalculation();
    });
  }

  // Initialize default scenario
  initClassicDefaultScenario();
}

function renderRepurchaseLegs() {
  const container = document.getElementById('repurchaseLegsList');
  if (!container) return;

  if (state.scenarioLegs.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200 font-mono">
        No transaction legs added. Click <strong>+ ADD BUY LOT</strong> or <strong>+ ADD SELL LOT</strong> above to model multi-trade sequences.
      </div>
    `;
    return;
  }

  const buyLegs = state.scenarioLegs.filter(l => (l.type || '').toUpperCase() === 'BUY');
  const buyLotsSummary = state.lastScenarioResult?.buyLotsSummary || {};
  const salesMap = {};
  (state.lastScenarioResult?.sales || []).forEach(s => { salesMap[s.id] = s; });
  const buysMap = {};
  (state.lastScenarioResult?.buys || []).forEach(b => { buysMap[b.id] = b; });

  container.innerHTML = state.scenarioLegs.map((leg, idx) => {
    const isSell = (leg.type || '').toUpperCase() === 'SELL';
    const borderClass = isSell ? 'border-rose-200 bg-rose-50/40 leg-row-sell' : 'border-slate-200 bg-white leg-row-buy';

    // Build Basis / Lot selector column for this leg
    let basisColHtml = '';

    if (isSell) {
      const saleInfo = salesMap[leg.id];
      const isWashAdj = saleInfo?.isWashAdjusted || false;
      const effectiveBasis = saleInfo?.costBasis ?? leg.price;

      // Options for selling from available buy lots
      let buyOptionsHtml = '';
      if (buyLegs.length > 0) {
        buyOptionsHtml = buyLegs.map(b => {
          const bIdx = state.scenarioLegs.indexOf(b) + 1;
          const bSummary = buyLotsSummary[b.id] || buysMap[b.id];
          let bBasisStr = `$${Number(b.price).toFixed(2)}`;
          if (bSummary && (bSummary.adjustedBasis || bSummary.absorbedDisallowed > 0)) {
            bBasisStr = `$${Number(bSummary.adjustedBasis || b.price).toFixed(2)}${bSummary.absorbedDisallowed > 0 ? ' [Wash Adj]' : ''}`;
          }
          const isSelected = leg.soldFrom === b.id ? 'selected' : '';
          return `<option value="${b.id}" ${isSelected}>Leg #${bIdx}: Buy ${b.shares} sh (Basis: ${bBasisStr})</option>`;
        }).join('');
      } else {
        buyOptionsHtml = `<option value="" disabled selected>No Buy Legs Available (Add a BUY Leg first)</option>`;
      }

      basisColHtml = `
        <div class="col-span-2 sm:col-span-3 space-y-1">
          <div class="flex items-center justify-between">
            <label class="block text-[10px] text-slate-500 font-medium font-mono">Sold From Lot</label>
            <span class="leg-wash-tag ${isWashAdj ? 'text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono' : (saleInfo?.soldFromLegIndex ? 'text-[9px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono' : 'hidden')}">
              ${isWashAdj ? `Wash Adj Basis` : (saleInfo?.soldFromLegIndex ? `From Leg #${saleInfo.soldFromLegIndex}` : '')}
            </span>
          </div>

          <select class="leg-source-lot input-field text-xs font-mono p-1.5 border-slate-300 focus:border-slate-600 w-full" title="Choose which Buy Leg lot is being sold">
            ${buyOptionsHtml}
          </select>

          <!-- Auto basis indicator derived from selected Buy Leg -->
          <div class="leg-basis-badge flex items-center justify-between px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] font-mono">
            <span class="text-slate-500">Effective Basis:</span>
            <span class="${isWashAdj ? 'text-amber-800 font-bold' : (saleInfo ? 'text-emerald-800 font-bold' : 'text-slate-600')}">
              $${Number(effectiveBasis).toFixed(2)}/sh ${isWashAdj ? '[Wash Adj]' : ''}
            </span>
          </div>
        </div>
      `;
    } else {
      // BUY Leg: Show clean or wash-adjusted acquisition basis
      const buyInfo = buysMap[leg.id] || buyLotsSummary[leg.id];
      const isWashAdj = buyInfo && (buyInfo.absorbedDisallowed > 0 || buyInfo.status === 'WASH_SALE' || buyInfo.status === 'PARTIAL_SPLIT');
      const adjBasis = buyInfo?.adjustedBasis ?? leg.price;
      const disallowed = buyInfo?.disallowedLoss ?? buyInfo?.absorbedDisallowed ?? 0;

      basisColHtml = `
        <div class="col-span-2 sm:col-span-3 space-y-1">
          <div class="flex items-center justify-between">
            <label class="block text-[10px] text-slate-500 font-medium font-mono">Acquisition / Basis</label>
            ${isWashAdj ? '<span class="text-[9px] font-bold text-amber-800 bg-amber-50 px-1 rounded border border-amber-200 font-mono">Absorbed Wash</span>' : ''}
          </div>

          <div class="leg-buy-badge p-1 rounded-lg ${isWashAdj ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-slate-50 border border-slate-200 text-slate-700'} text-xs font-mono font-medium flex items-center justify-between px-2">
            <span class="text-[10px] ${isWashAdj ? 'text-amber-700' : 'text-slate-500'}">${isWashAdj ? 'Adj Basis:' : 'Basis:'}</span>
            <span class="${isWashAdj ? 'font-bold text-amber-800' : 'font-bold text-slate-900'}">$${Number(adjBasis).toFixed(2)}/sh</span>
          </div>

          <div class="leg-buy-subtext text-[9px] ${isWashAdj ? 'text-amber-800 font-bold' : 'text-slate-500'} font-mono truncate">
            ${isWashAdj ? `+$${Number(disallowed).toFixed(2)} loss tacked` : 'Clean acquisition basis'}
          </div>
        </div>
      `;
    }

    return `
      <div class="repurchase-leg-row p-3 rounded-xl ${borderClass} border grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-center transition-all shadow-2xs" data-id="${leg.id}">
        <!-- Leg Index & Type Selector -->
        <div class="col-span-2 sm:col-span-2">
          <label class="block text-[10px] text-slate-500 mb-0.5 font-medium font-mono">Leg #${idx + 1} Type</label>
          <select class="leg-type input-field text-xs font-bold font-mono p-1.5 ${isSell ? 'text-rose-700 border-rose-300 bg-white' : 'text-emerald-700 border-emerald-300 bg-white'}">
            <option value="BUY" ${!isSell ? 'selected' : ''}>BUY Leg</option>
            <option value="SELL" ${isSell ? 'selected' : ''}>SELL Leg</option>
          </select>
        </div>

        <!-- Date -->
        <div class="col-span-2 sm:col-span-2">
          <label class="block text-[10px] text-slate-500 mb-0.5 font-medium font-mono">Date</label>
          <input type="date" class="leg-date input-field text-xs font-mono-num p-1.5" value="${leg.date}">
        </div>

        <!-- Shares -->
        <div class="col-span-1 sm:col-span-2">
          <label class="block text-[10px] text-slate-500 mb-0.5 font-medium font-mono">Shares</label>
          <input type="number" step="any" min="0.0001" class="leg-shares input-field text-xs font-mono-num p-1.5" value="${leg.shares}">
        </div>

        <!-- Price ($) -->
        <div class="col-span-1 sm:col-span-2">
          <label class="block text-[10px] text-slate-500 mb-0.5 font-medium font-mono">${isSell ? 'Sale Price ($)' : 'Buy Price ($)'}</label>
          <input type="number" step="0.01" min="0.01" class="leg-price input-field text-xs font-mono-num p-1.5" value="${leg.price}">
        </div>

        <!-- Basis / Lot Selector Column -->
        ${basisColHtml}

        <!-- Remove Button -->
        <div class="col-span-1 sm:col-span-1 flex justify-center items-end">
          <button type="button" class="remove-leg-btn w-7 h-7 mb-0.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-700 text-xs font-bold transition-all flex items-center justify-center border border-slate-200 hover:border-rose-300 flex-shrink-0" title="Remove leg">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach event listeners
  container.querySelectorAll('.repurchase-leg-row').forEach(row => {
    const id = row.getAttribute('data-id');
    const leg = state.scenarioLegs.find(l => l.id === id);
    if (!leg) return;

    row.querySelector('.leg-type').addEventListener('change', e => {
      leg.type = e.target.value;
      if (leg.type === 'SELL') {
        const availableBuy = state.scenarioLegs.find(l => l.id !== leg.id && (l.type || '').toUpperCase() === 'BUY');
        leg.soldFrom = availableBuy ? availableBuy.id : 'manual';
        if (leg.costBasis === undefined || isNaN(leg.costBasis)) {
          leg.costBasis = Number((leg.price + 20).toFixed(2));
        }
      }
      renderRepurchaseLegs();
      runScenarioCalculation();
    });

    const sourceLotSelect = row.querySelector('.leg-source-lot');
    if (sourceLotSelect) {
      sourceLotSelect.addEventListener('change', e => {
        leg.soldFrom = e.target.value;
        renderRepurchaseLegs();
        runScenarioCalculation();
      });
    }

    row.querySelector('.leg-date').addEventListener('change', e => {
      leg.date = e.target.value;
      runScenarioCalculation();
    });

    row.querySelector('.leg-shares').addEventListener('input', e => {
      leg.shares = parseFloat(e.target.value) || 0;
      runScenarioCalculation();
    });

    row.querySelector('.leg-price').addEventListener('input', e => {
      leg.price = parseFloat(e.target.value) || 0;
      runScenarioCalculation();
    });

    row.querySelector('.remove-leg-btn').addEventListener('click', () => {
      removeRepurchaseLeg(id);
    });
  });
}

function updateScenarioLegsBasisDisplay(result) {
  const container = document.getElementById('repurchaseLegsList');
  if (!container || !result) return;

  const buyLotsSummary = result.buyLotsSummary || {};
  const salesMap = {};
  (result.sales || []).forEach(s => { salesMap[s.id] = s; });
  const buysMap = {};
  (result.buys || []).forEach(b => { buysMap[b.id] = b; });

  container.querySelectorAll('.repurchase-leg-row').forEach(row => {
    const id = row.getAttribute('data-id');
    const leg = state.scenarioLegs.find(l => l.id === id);
    if (!leg) return;

    const isSell = (leg.type || '').toUpperCase() === 'SELL';
    if (isSell) {
      const saleInfo = salesMap[id];
      const basisBadge = row.querySelector('.leg-basis-badge');
      const washTag = row.querySelector('.leg-wash-tag');

      if (basisBadge && saleInfo) {
        const isAdj = saleInfo.isWashAdjusted;
        basisBadge.innerHTML = `
          <span class="text-slate-500">Effective Basis:</span>
          <span class="${isAdj ? 'text-amber-800 font-bold' : 'text-emerald-800 font-bold'}">
            $${saleInfo.costBasis.toFixed(2)}/sh ${isAdj ? '[Wash Adj]' : ''}
          </span>
        `;
        basisBadge.classList.remove('hidden');
      }

      if (washTag) {
        if (saleInfo && saleInfo.isWashAdjusted) {
          washTag.innerHTML = `Wash Adj Basis`;
          washTag.className = 'leg-wash-tag text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono';
          washTag.classList.remove('hidden');
        } else if (saleInfo && saleInfo.soldFromLegIndex) {
          washTag.innerHTML = `From Leg #${saleInfo.soldFromLegIndex}`;
          washTag.className = 'leg-wash-tag text-[9px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono';
          washTag.classList.remove('hidden');
        } else {
          washTag.classList.add('hidden');
        }
      }
    } else {
      // BUY Leg
      const buyInfo = buysMap[id] || buyLotsSummary[id];
      const buyBadge = row.querySelector('.leg-buy-badge');
      const buySubtext = row.querySelector('.leg-buy-subtext');

      if (buyBadge && buyInfo) {
        const isWashAdj = buyInfo.absorbedDisallowed > 0 || buyInfo.status === 'WASH_SALE' || buyInfo.status === 'PARTIAL_SPLIT';
        if (isWashAdj) {
          buyBadge.innerHTML = `
            <span class="text-[10px] text-amber-700">Adj Basis:</span>
            <span class="font-bold text-amber-800">$${buyInfo.adjustedBasis.toFixed(2)}/sh</span>
          `;
          buyBadge.className = 'leg-buy-badge p-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono font-medium flex items-center justify-between px-2';
          if (buySubtext) {
            buySubtext.innerHTML = `+$${buyInfo.disallowedLoss.toFixed(2)} loss tacked`;
            buySubtext.className = 'leg-buy-subtext text-[9px] text-amber-800 font-bold font-mono truncate';
          }
        } else {
          buyBadge.innerHTML = `
            <span class="text-[10px] text-slate-500">Basis:</span>
            <span class="font-bold text-slate-900">$${Number(leg.price).toFixed(2)}/sh</span>
          `;
          buyBadge.className = 'leg-buy-badge p-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono flex items-center justify-between px-2';
          if (buySubtext) {
            buySubtext.innerHTML = `Clean acquisition basis`;
            buySubtext.className = 'leg-buy-subtext text-[9px] text-slate-500 font-mono truncate';
          }
        }
      }
    }
  });
}

function addScenarioLeg(legData) {
  const isSell = (legData.type || '').toUpperCase() === 'SELL';
  let defaultSoldFrom = legData.soldFrom;
  if (!defaultSoldFrom && isSell) {
    const buyLegs = state.scenarioLegs.filter(l => (l.type || '').toUpperCase() === 'BUY');
    defaultSoldFrom = buyLegs.length > 0 ? buyLegs[buyLegs.length - 1].id : '';
  }

  const newLeg = {
    id: `leg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type: legData.type || 'BUY',
    date: legData.date || '2026-03-15',
    shares: legData.shares || 50,
    price: legData.price || 185.00,
    costBasis: legData.costBasis !== undefined ? legData.costBasis : (legData.price || 185.00),
    soldFrom: defaultSoldFrom || ''
  };
  state.scenarioLegs.push(newLeg);
  renderRepurchaseLegs();
}

function addRepurchaseLeg(legData) {
  return addScenarioLeg(legData);
}

function removeRepurchaseLeg(id) {
  state.scenarioLegs = state.scenarioLegs.filter(l => l.id !== id);
  // Reset any sell leg that had this removed lot as source
  const remainingBuyLegs = state.scenarioLegs.filter(l => (l.type || '').toUpperCase() === 'BUY');
  state.scenarioLegs.forEach(l => {
    if (l.soldFrom === id) {
      l.soldFrom = remainingBuyLegs.length > 0 ? remainingBuyLegs[0].id : '';
    }
  });
  renderRepurchaseLegs();
  runScenarioCalculation();
}

function initClassicDefaultScenario() {
  if (els.scenSymbol) els.scenSymbol.value = 'TSLA';
  state.scenarioLegs = [
    { id: 'leg-1', type: 'BUY', date: '2026-03-01', shares: 100, price: 200.00, costBasis: 200.00 },
    { id: 'leg-2', type: 'SELL', date: '2026-03-15', shares: 100, price: 170.00, soldFrom: 'leg-1' },
    { id: 'leg-3', type: 'BUY', date: '2026-03-25', shares: 100, price: 175.00, costBasis: 175.00 }
  ];
  renderRepurchaseLegs();
  runScenarioCalculation();
}

function setScenarioPreset(presetType) {
  initClassicDefaultScenario();
}

function runScenarioCalculation() {
  const symbol = (els.scenSymbol && els.scenSymbol.value) ? els.scenSymbol.value.trim().toUpperCase() : 'TSLA';

  // Sync current input values from legs list
  const container = document.getElementById('repurchaseLegsList');
  if (container) {
    container.querySelectorAll('.repurchase-leg-row').forEach(row => {
      const id = row.getAttribute('data-id');
      const leg = state.scenarioLegs.find(l => l.id === id);
      if (leg) {
        const typeSelect = row.querySelector('.leg-type');
        if (typeSelect) leg.type = typeSelect.value;
        const dateInput = row.querySelector('.leg-date');
        if (dateInput) leg.date = dateInput.value;
        const sharesInput = row.querySelector('.leg-shares');
        if (sharesInput) leg.shares = parseFloat(sharesInput.value) || 0;
        const priceInput = row.querySelector('.leg-price');
        if (priceInput) leg.price = parseFloat(priceInput.value) || 0;
        const sourceSelect = row.querySelector('.leg-source-lot');
        if (sourceSelect && sourceSelect.value) leg.soldFrom = sourceSelect.value;
      }
    });
  }

  if (state.scenarioLegs.length === 0) {
    els.resDisallowedLoss.textContent = '$0.00';
    els.resAllowedLoss.textContent = '$0.00';
    els.resAdjustedBasis.textContent = '$0.00';
    els.resSafeDate.textContent = '---';
    els.scenStatusBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300';
    els.scenStatusBadge.textContent = 'NO LEGS';
    els.scenNarrativeBox.innerHTML = '<p class="text-slate-500 text-xs font-mono">No transaction legs configured. Click <strong>+ ADD BUY LOT</strong> or <strong>+ ADD SELL LOT</strong> above to begin calculation.</p>';
    if (els.timelineContainer) {
      els.timelineContainer.innerHTML = `
        <div class="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 font-mono">
          Add at least one transaction leg above to view the 61-day timeline visualizer.
        </div>
      `;
    }
    return;
  }

  const result = calculateScenario({
    symbol,
    transactions: state.scenarioLegs,
    isCryptoRulesEnabled: false
  });

  state.lastScenarioResult = result;
  updateScenarioLegsBasisDisplay(result);

  // Render Metric Cards
  els.resDisallowedLoss.textContent = `$${result.disallowedLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const pl = result.realizedGainLoss !== undefined ? result.realizedGainLoss : (result.netRealizedPl !== undefined ? result.netRealizedPl : -result.allowedLoss);
  if (pl > 0.0001) {
    els.resAllowedLoss.textContent = `+$${pl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    els.resAllowedLoss.className = 'text-xl font-bold font-mono-num text-emerald-800 mt-0.5 block';
  } else if (pl < -0.0001) {
    els.resAllowedLoss.textContent = `-$${Math.abs(pl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    els.resAllowedLoss.className = 'text-xl font-bold font-mono-num text-rose-700 mt-0.5 block';
  } else {
    els.resAllowedLoss.textContent = '$0.00';
    els.resAllowedLoss.className = 'text-xl font-bold font-mono-num text-slate-900 mt-0.5 block';
  }
  
  // Calculate average basis adjustment across affected replacement shares
  const washTxs = (result.transactions || []).filter(t => t.type === 'BUY' && t.absorbShares > 0);
  if (washTxs.length === 1) {
    els.resAdjustedBasis.textContent = `$${washTxs[0].adjustedBasis.toFixed(2)}`;
  } else if (washTxs.length > 1) {
    const totalWashDollars = washTxs.reduce((acc, t) => acc + (t.absorbShares * t.adjustedBasis), 0);
    const totalWashShares = washTxs.reduce((acc, t) => acc + t.absorbShares, 0);
    const avgBasis = totalWashShares > 0 ? totalWashDollars / totalWashShares : 0;
    els.resAdjustedBasis.textContent = `~$${avgBasis.toFixed(2)} avg`;
  } else {
    els.resAdjustedBasis.textContent = '$0.00';
  }

  els.resSafeDate.textContent = result.safeRepurchaseDate;

  // Status Badge
  if (result.isCryptoExempt) {
    els.scenStatusBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200';
    els.scenStatusBadge.textContent = 'Crypto Exempt';
  } else if (result.disallowedLoss > 0) {
    els.scenStatusBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200';
    els.scenStatusBadge.textContent = Math.abs(pl) > 0.0001 ? 'Partial Wash Sale' : 'Wash Sale Triggered';
  } else if (pl > 0.0001) {
    els.scenStatusBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200';
    els.scenStatusBadge.textContent = 'Capital Gain';
  } else if (pl < -0.0001) {
    els.scenStatusBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300';
    els.scenStatusBadge.textContent = result.hadAnyWashSale ? 'Position Exited (Loss Allowed)' : 'Loss Allowed';
  } else {
    els.scenStatusBadge.className = 'px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200';
    els.scenStatusBadge.textContent = 'Break-Even / Safe';
  }

  // Narrative Box
  let narrative = `<p class="font-medium text-slate-800 mb-2">${result.reason}</p>`;
  const plLabel = pl > 0.0001 ? `+$${pl.toFixed(2)}` : (pl < -0.0001 ? `-$${Math.abs(pl).toFixed(2)}` : '$0.00');
  const plColor = pl > 0.0001 ? 'text-emerald-800' : (pl < -0.0001 ? 'text-rose-700' : 'text-slate-800');

  if (result.disallowedLoss > 0 || Math.abs(pl) > 0.0001) {
    narrative += `
      <ul class="space-y-1 list-disc list-inside text-slate-600 font-mono text-xs">
        <li>Disallowed Wash Sale Loss: <strong class="text-rose-700">$${result.disallowedLoss.toFixed(2)}</strong></li>
        <li>Net Realized Gain/Loss: <strong class="${plColor}">${plLabel}</strong></li>
        <li>Earliest Safe Buyback Date: <strong class="text-emerald-800">${result.safeRepurchaseDate}</strong> (Day +31).</li>
      </ul>
    `;
  }
  els.scenNarrativeBox.innerHTML = narrative;

  // Render Multi-Transaction Timeline
  renderTimeline(els.timelineContainer, {
    saleDate: result.saleDate,
    transactions: result.transactions,
    isCryptoExempt: result.isCryptoExempt
  });
}


// Setup Monetization
function setupMonetization() {
  renderAdSlot(els.adSlotTop, 'leaderboard');
}

// PWA Support & Service Worker
function setupPWA() {
  // Purge any stale v1 cache
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        if (name !== 'washguard-cache-v2') {
          caches.delete(name);
        }
      });
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.update();
      }).catch(err => {
        console.warn('SW registration skipped:', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    if (els.installAppBtn) {
      els.installAppBtn.classList.remove('hidden');
      els.installAppBtn.addEventListener('click', async () => {
        if (state.deferredInstallPrompt) {
          state.deferredInstallPrompt.prompt();
          const { outcome } = await state.deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            els.installAppBtn.classList.add('hidden');
          }
          state.deferredInstallPrompt = null;
        }
      });
    }
  });
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', init);
