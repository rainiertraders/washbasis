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
  setupScenarioCalculator();
  setupMonetization();
  setupPWA();

  // Load default scenario
  runScenarioCalculation();
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
      <div class="p-4 text-center text-xs text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
        No transaction legs added. Click <strong>+ Add BUY Leg</strong> or <strong>+ Add SELL Leg</strong> above to model multi-trade sequences.
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
    const borderClass = isSell ? 'border-rose-900/50 bg-rose-950/20' : 'border-slate-800 bg-slate-900/90';

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
            <label class="block text-[10px] text-slate-400 font-medium">Sold From Lot</label>
            <span class="leg-wash-tag ${isWashAdj ? 'text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20' : (saleInfo?.soldFromLegIndex ? 'text-[9px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20' : 'hidden')}">
              ${isWashAdj ? `⚡ Wash Adj Basis` : (saleInfo?.soldFromLegIndex ? `From Leg #${saleInfo.soldFromLegIndex}` : '')}
            </span>
          </div>

          <select class="leg-source-lot input-field text-xs font-mono p-1.5 border-rose-500/40 focus:border-rose-500 w-full" title="Choose which Buy Leg lot is being sold">
            ${buyOptionsHtml}
          </select>

          <!-- Auto basis indicator derived from selected Buy Leg -->
          <div class="leg-basis-badge flex items-center justify-between px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono">
            <span class="text-slate-400">Effective Basis:</span>
            <span class="${isWashAdj ? 'text-amber-400 font-bold' : (saleInfo ? 'text-emerald-400 font-bold' : 'text-slate-400')}">
              $${Number(effectiveBasis).toFixed(2)}/sh ${isWashAdj ? '⚡' : '✓'}
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
            <label class="block text-[10px] text-slate-400 font-medium">Acquisition / Basis</label>
            ${isWashAdj ? '<span class="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1 rounded border border-amber-400/20">Absorbed Wash</span>' : ''}
          </div>

          <div class="leg-buy-badge p-1 rounded-lg ${isWashAdj ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300' : 'bg-slate-950/60 border border-slate-800 text-slate-400'} text-xs font-mono font-medium flex items-center justify-between px-2">
            <span class="text-[10px] ${isWashAdj ? 'text-slate-400' : 'text-slate-500'}">${isWashAdj ? 'Adj Basis:' : 'Basis:'}</span>
            <span class="${isWashAdj ? 'font-bold text-amber-400' : 'font-bold text-slate-200'}">$${Number(adjBasis).toFixed(2)}/sh</span>
          </div>

          <div class="leg-buy-subtext text-[9px] ${isWashAdj ? 'text-amber-400/90 font-bold' : 'text-slate-500'} font-mono truncate">
            ${isWashAdj ? `+$${Number(disallowed).toFixed(2)} loss tacked` : 'Clean acquisition basis'}
          </div>
        </div>
      `;
    }

    return `
      <div class="repurchase-leg-row p-3 rounded-xl ${borderClass} border grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-center transition-all" data-id="${leg.id}">
        <!-- Leg Index & Type Selector -->
        <div class="col-span-2 sm:col-span-2">
          <label class="block text-[10px] text-slate-400 mb-0.5 font-medium">Leg #${idx + 1} Type</label>
          <select class="leg-type input-field text-xs font-bold p-1.5 ${isSell ? 'text-rose-400 border-rose-500/50 bg-slate-900' : 'text-emerald-400 border-emerald-500/50 bg-slate-900'}">
            <option value="BUY" ${!isSell ? 'selected' : ''}>🟢 BUY Leg</option>
            <option value="SELL" ${isSell ? 'selected' : ''}>🔴 SELL Leg</option>
          </select>
        </div>

        <!-- Date -->
        <div class="col-span-2 sm:col-span-2">
          <label class="block text-[10px] text-slate-400 mb-0.5 font-medium">Date</label>
          <input type="date" class="leg-date input-field text-xs font-mono-num p-1.5" value="${leg.date}">
        </div>

        <!-- Shares -->
        <div class="col-span-1 sm:col-span-2">
          <label class="block text-[10px] text-slate-400 mb-0.5 font-medium">Shares</label>
          <input type="number" step="any" min="0.0001" class="leg-shares input-field text-xs font-mono-num p-1.5" value="${leg.shares}">
        </div>

        <!-- Price ($) -->
        <div class="col-span-1 sm:col-span-2">
          <label class="block text-[10px] text-slate-400 mb-0.5 font-medium">${isSell ? 'Sale Price ($)' : 'Buy Price ($)'}</label>
          <input type="number" step="0.01" min="0.01" class="leg-price input-field text-xs font-mono-num p-1.5" value="${leg.price}">
        </div>

        <!-- Basis / Lot Selector Column -->
        ${basisColHtml}

        <!-- Remove Button -->
        <div class="col-span-1 sm:col-span-1 flex justify-center items-end">
          <button type="button" class="remove-leg-btn w-7 h-7 mb-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-all flex items-center justify-center border border-rose-500/20 flex-shrink-0" title="Remove leg">
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
          <span class="text-slate-400">Effective Basis:</span>
          <span class="${isAdj ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}">
            $${saleInfo.costBasis.toFixed(2)}/sh ${isAdj ? '⚡ Wash Adj' : '✓'}
          </span>
        `;
        basisBadge.classList.remove('hidden');
      }

      if (washTag) {
        if (saleInfo && saleInfo.isWashAdjusted) {
          washTag.innerHTML = `⚡ Wash Adj Basis`;
          washTag.className = 'leg-wash-tag text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20';
          washTag.classList.remove('hidden');
        } else if (saleInfo && saleInfo.soldFromLegIndex) {
          washTag.innerHTML = `From Leg #${saleInfo.soldFromLegIndex}`;
          washTag.className = 'leg-wash-tag text-[9px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20';
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
            <span class="text-[10px] text-slate-400">Adj Basis:</span>
            <span class="font-bold text-amber-400">$${buyInfo.adjustedBasis.toFixed(2)}/sh</span>
          `;
          buyBadge.className = 'leg-buy-badge p-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium flex items-center justify-between px-2';
          if (buySubtext) {
            buySubtext.innerHTML = `+$${buyInfo.disallowedLoss.toFixed(2)} loss tacked`;
            buySubtext.className = 'leg-buy-subtext text-[9px] text-amber-400/90 font-bold font-mono truncate';
          }
        } else {
          buyBadge.innerHTML = `
            <span class="text-[10px] text-slate-500">Basis:</span>
            <span class="font-bold text-slate-200">$${Number(leg.price).toFixed(2)}/sh</span>
          `;
          buyBadge.className = 'leg-buy-badge p-1 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400 text-xs font-mono flex items-center justify-between px-2';
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
    els.scenStatusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700';
    els.scenStatusBadge.textContent = 'No Legs Added';
    els.scenNarrativeBox.innerHTML = '<p class="text-slate-400 text-xs">No transaction legs configured. Click <strong>+ Add BUY Leg</strong> or <strong>+ Add SELL Leg</strong> above to begin simulation.</p>';
    if (els.timelineContainer) {
      els.timelineContainer.innerHTML = `
        <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 text-center text-xs text-slate-400">
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
    els.resAllowedLoss.className = 'text-xl font-extrabold font-mono-num text-emerald-400 mt-1 block';
  } else if (pl < -0.0001) {
    els.resAllowedLoss.textContent = `-$${Math.abs(pl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    els.resAllowedLoss.className = 'text-xl font-extrabold font-mono-num text-rose-400 mt-1 block';
  } else {
    els.resAllowedLoss.textContent = '$0.00';
    els.resAllowedLoss.className = 'text-xl font-extrabold font-mono-num text-slate-200 mt-1 block';
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
    els.scenStatusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30';
    els.scenStatusBadge.textContent = 'Crypto Exempt';
  } else if (result.disallowedLoss > 0) {
    els.scenStatusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30';
    els.scenStatusBadge.textContent = Math.abs(pl) > 0.0001 ? 'Partial Wash Sale' : 'Wash Sale Triggered';
  } else if (pl > 0.0001) {
    els.scenStatusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    els.scenStatusBadge.textContent = 'Realized Capital Gain';
  } else if (pl < -0.0001) {
    els.scenStatusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    els.scenStatusBadge.textContent = result.hadAnyWashSale ? 'Position Exited (Loss Fully Allowed)' : 'Loss Fully Allowed';
  } else {
    els.scenStatusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700';
    els.scenStatusBadge.textContent = 'Net Break-Even / Safe';
  }

  // Narrative Box
  let narrative = `<p class="font-medium text-slate-200 mb-2">${result.reason}</p>`;
  const plLabel = pl > 0.0001 ? `+$${pl.toFixed(2)}` : (pl < -0.0001 ? `-$${Math.abs(pl).toFixed(2)}` : '$0.00');
  const plColor = pl > 0.0001 ? 'text-emerald-400' : (pl < -0.0001 ? 'text-rose-400' : 'text-slate-200');

  if (result.disallowedLoss > 0 || Math.abs(pl) > 0.0001) {
    narrative += `
      <ul class="space-y-1 list-disc list-inside text-slate-400">
        <li>Disallowed Wash Sale Loss: <strong class="text-amber-400">$${result.disallowedLoss.toFixed(2)}</strong></li>
        <li>Net Realized Gain/Loss: <strong class="${plColor}">${plLabel}</strong></li>
        <li>Earliest Safe Buyback Date: <strong class="text-emerald-400">${result.safeRepurchaseDate}</strong> (Day +31).</li>
      </ul>
    `;
    if (result.sales && result.sales.length > 1) {
      narrative += `
        <div class="mt-3 pt-2.5 border-t border-slate-800/80">
          <div class="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">Per-Sale Gain/Loss & Disallowance Breakdown:</div>
          <div class="space-y-1.5">
            ${result.sales.map((s, idx) => {
              const label = s.date ? `${s.date} (Sale Leg #${s.legIndex || (idx + 1)})` : `Sale #${idx + 1}`;
              const basisLabel = s.isWashAdjusted ? `⚡ Basis $${s.costBasis.toFixed(2)}` : `Basis $${s.costBasis.toFixed(2)}`;
              const salePl = s.recognizedPl !== undefined ? s.recognizedPl : (!s.isLoss ? s.rawPl : -s.allowedLoss);
              const salePlLabel = salePl > 0.0001 ? `+$${salePl.toFixed(2)}` : (salePl < -0.0001 ? `-$${Math.abs(salePl).toFixed(2)}` : '$0.00');
              const salePlColor = salePl > 0.0001 ? 'text-emerald-400 font-bold' : (salePl < -0.0001 ? 'text-rose-400 font-bold' : 'text-slate-400');
              return `
                <div class="flex items-center justify-between text-xs bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/80">
                  <div class="flex items-center space-x-2">
                    <span class="font-mono text-slate-200 font-semibold">${label}</span>
                    <span class="text-slate-400 text-[11px]">(${s.shares} sh @ $${s.price.toFixed(2)}, ${basisLabel})</span>
                  </div>
                  <div class="space-x-3 text-right font-mono text-xs">
                    <span class="${s.disallowedLoss > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}">Disallowed: $${s.disallowedLoss.toFixed(2)}</span>
                    <span class="${salePlColor}">Realized: ${salePlLabel}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
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
