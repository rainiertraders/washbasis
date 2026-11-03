/**
 * WashGuard Interactive Multi-Transaction Timeline Visualizer
 * Renders a dynamic, continuous date-scale timeline supporting multiple sales and repurchases.
 * Features a collision-free 3-layer architecture:
 *   - Layer 1 (Top, above track): Multi-tier pins with adaptive stalk heights
 *   - Layer 2 (Middle): Continuous track bar with shaded statutory zones
 *   - Layer 3 (Bottom, below track): Statutory milestones including unified +30d/+31d boundary
 */

import { addDays, daysBetween, parseDate } from '../engine/washSaleEngine.js';

export function renderTimeline(containerEl, {
  saleDate,
  transactions = [],
  // Backwards compatibility for single scenario calls
  repurchaseDate,
  isWashSale,
  isCryptoExempt
}) {
  if (!containerEl || !saleDate) return;

  // Normalize transactions list
  let txList = [...transactions];
  if (txList.length === 0 && repurchaseDate) {
    let status = 'SAFE';
    if (isCryptoExempt) status = 'CRYPTO_EXEMPT';
    else if (isWashSale) status = 'WASH_SALE';

    txList = [{
      id: 'repurchase-1',
      type: 'BUY',
      date: repurchaseDate,
      shares: 100,
      price: 0,
      daysDiff: daysBetween(saleDate, repurchaseDate),
      status,
      absorbShares: isWashSale ? 100 : 0,
      cleanShares: isWashSale ? 0 : 100,
      disallowedLoss: 0,
      adjustedBasis: 0,
      note: status
    }];
  }

  const windowStart = addDays(saleDate, -30);
  const windowEnd = addDays(saleDate, 30);
  const safeDate = addDays(saleDate, 31);

  // Compute bounding dates for timeline display with padding
  const allDates = [saleDate, windowStart, windowEnd, safeDate, ...txList.map(t => t.date)];
  const sortedDates = [...allDates].sort();
  const earliestDate = addDays(sortedDates[0], -5);
  const latestDate = addDays(sortedDates[sortedDates.length - 1], 5);
  const totalDays = Math.max(1, daysBetween(earliestDate, latestDate));

  // Percentage position helper clamped safely within [5%, 95%] to prevent badge clipping
  const getPercent = (dateStr) => {
    const days = daysBetween(earliestDate, dateStr);
    const pct = (days / totalDays) * 100;
    return Math.max(5, Math.min(95, pct));
  };

  const pWinStart = getPercent(windowStart);
  const pSale = getPercent(saleDate);
  const pWinEnd = getPercent(windowEnd);

  // Widths for continuous color-coded background blocks (100% total coverage, no gaps)
  const wPreSale = Math.max(0, pSale - pWinStart);
  const wPostSale = Math.max(0, pWinEnd - pSale);
  const wSafe = Math.max(0, 100 - pWinEnd);

  // Multi-tier height assignment to prevent any pin-on-pin card overlap
  const STALK_HEIGHTS = [16, 50, 84, 118];
  const COLLISION_THRESHOLD_PCT = 14;

  const sortedTx = txList.map((tx, idx) => ({
    ...tx,
    originalIdx: idx,
    pct: getPercent(tx.date)
  })).sort((a, b) => a.pct - b.pct);

  const assignedTiers = new Map();
  sortedTx.forEach((tx) => {
    const nearbyTiers = new Set();
    sortedTx.forEach((other) => {
      if (other.originalIdx !== tx.originalIdx && assignedTiers.has(other.originalIdx)) {
        if (Math.abs(other.pct - tx.pct) < COLLISION_THRESHOLD_PCT) {
          nearbyTiers.add(assignedTiers.get(other.originalIdx));
        }
      }
    });

    let tier = 0;
    while (nearbyTiers.has(tier) && tier < STALK_HEIGHTS.length - 1) {
      tier++;
    }
    assignedTiers.set(tx.originalIdx, tier);
  });

  const maxTier = txList.length > 0 ? Math.max(0, ...Array.from(assignedTiers.values())) : 0;
  let trackPaddingTop = 'pt-20';
  if (maxTier === 1) trackPaddingTop = 'pt-28';
  else if (maxTier === 2) trackPaddingTop = 'pt-36';
  else if (maxTier >= 3) trackPaddingTop = 'pt-44';

  // Build Transaction Pins positioned strictly ABOVE the track line
  const pinsHtml = txList.map((tx, idx) => {
    const pct = getPercent(tx.date);
    const daysDiff = tx.daysDiff ?? daysBetween(saleDate, tx.date);
    const dayLabel = `${daysDiff >= 0 ? '+' : ''}${daysDiff}d`;
    const isSell = (tx.type || '').toUpperCase() === 'SELL';
    const legLabel = tx.legIndex ? `Leg #${tx.legIndex}: ` : '';

    let badgeBg = 'bg-emerald-700 text-white border-emerald-800';
    let dotColor = 'bg-emerald-600';
    let statusLabel = `${legLabel}BUY`;

    if (isSell) {
      badgeBg = 'bg-rose-700 text-white border-rose-800';
      dotColor = 'bg-rose-600';
      statusLabel = `${legLabel}SELL`;
    } else if (tx.status === 'CRYPTO_EXEMPT') {
      badgeBg = 'bg-blue-700 text-white border-blue-800';
      dotColor = 'bg-blue-600';
      statusLabel = `${legLabel}CRYPTO`;
    } else if (tx.status === 'WASH_SALE') {
      badgeBg = 'bg-amber-600 text-white border-amber-700';
      dotColor = 'bg-amber-600';
      statusLabel = `${legLabel}WASH BUY`;
    } else if (tx.status === 'PARTIAL_SPLIT') {
      badgeBg = 'bg-amber-600 text-white border-amber-700';
      dotColor = 'bg-amber-600';
      statusLabel = `${legLabel}SPLIT BUY`;
    }

    const tier = assignedTiers.get(idx) ?? 0;
    const stalkH = STALK_HEIGHTS[tier] || 16;

    return `
      <div class="absolute group z-20 flex flex-col items-center pointer-events-auto"
           style="left: ${pct}%; bottom: 8px; transform: translateX(-50%);">
        
        <!-- Pin Tooltip & Badge -->
        <div class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border shadow-xs ${badgeBg} whitespace-nowrap flex items-center gap-1 group-hover:scale-105 transition-transform cursor-pointer">
          <span>${statusLabel}</span>
          <span class="opacity-80">(${dayLabel})</span>
        </div>
        
        <!-- Date & Share/Price Detail Tag -->
        <div class="text-[9px] font-mono text-center text-slate-700 bg-white/95 px-1.5 py-0.5 rounded border border-slate-300 shadow-2xs whitespace-nowrap -mt-0.5">
          ${tx.date.slice(5)} • ${tx.shares} sh @ $${Number(tx.price).toFixed(2)}
        </div>

        <!-- Vertical Stalk -->
        <div class="w-0.5 bg-slate-400" style="height: ${stalkH}px;"></div>

        <!-- Anchor Dot centered on track bar midline -->
        <div class="w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs ${dotColor} -mb-1"></div>
      </div>
    `;
  }).join('');

  // Build Statutory Axis Milestones positioned strictly BELOW the track line
  const axisMarkersHtml = `
    <!-- Axis Marker: Window Start (-30 Days) -->
    <div class="absolute top-4 pointer-events-auto" style="left: ${pWinStart}%; transform: translateX(-50%);">
      <div class="h-3 w-0.5 bg-amber-500 mx-auto"></div>
      <div class="text-center font-mono whitespace-nowrap mt-1">
        <div class="inline-block px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold shadow-2xs">
          -30d Start
        </div>
        <div class="text-[9px] text-slate-500 font-normal mt-0.5">
          ${windowStart.slice(5)}
        </div>
      </div>
    </div>

    <!-- Axis Marker: Reference Sale Date (Day 0) -->
    <div class="absolute top-4 pointer-events-auto" style="left: ${pSale}%; transform: translateX(-50%);">
      <div class="h-3 w-0.5 bg-rose-600 mx-auto"></div>
      <div class="text-center font-mono whitespace-nowrap mt-1">
        <div class="inline-block px-1.5 py-0.5 rounded bg-rose-50 border border-rose-300 text-rose-900 text-[10px] font-bold shadow-2xs">
          Day 0 Sale
        </div>
        <div class="text-[9px] text-rose-700 font-semibold mt-0.5">
          ${saleDate.slice(5)}
        </div>
      </div>
    </div>

    <!-- Axis Marker: Unified Statutory Boundary (+30d Window End → +31d SAFE) -->
    <div class="absolute top-4 pointer-events-auto" style="left: ${pWinEnd}%; transform: translateX(-50%);">
      <div class="h-3 w-0.5 bg-emerald-600 mx-auto"></div>
      <div class="text-center font-mono whitespace-nowrap mt-1">
        <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold shadow-2xs">
          <span>+30d End</span>
          <span class="text-emerald-400">→</span>
          <span class="text-emerald-700 font-extrabold">+31d SAFE</span>
        </div>
        <div class="text-[9px] text-slate-600 font-normal mt-0.5">
          Window Closes: ${windowEnd.slice(5)} • Safe: <strong class="text-emerald-700 font-bold">${safeDate}</strong>
        </div>
      </div>
    </div>
  `;

  // Build Transaction Breakdown Rows
  const breakdownRowsHtml = txList.length === 0 ? `
    <tr>
      <td colspan="9" class="p-4 text-center text-slate-500 font-mono text-xs">
        No transactions recorded.
      </td>
    </tr>
  ` : txList.map((tx, idx) => {
    const daysDiff = tx.daysDiff ?? daysBetween(saleDate, tx.date);
    const dayLabel = `${daysDiff >= 0 ? '+' : ''}${daysDiff}d`;
    const isSell = (tx.type || '').toUpperCase() === 'SELL';

    const typeBadge = isSell
      ? `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-800 border border-rose-200 font-bold font-mono">SELL</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono">BUY</span>`;

    let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-mono font-semibold">Clean</span>`;
    if (isSell) {
      if (tx.status === 'SELL_WASH') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-300 font-mono font-bold">Wash Disallowed</span>`;
      } else if (tx.status === 'SELL_ALLOWED') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 border border-slate-300 font-mono font-bold">Allowed Loss</span>`;
      } else if (tx.status === 'SELL_GAIN') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold">Capital Gain</span>`;
      }
    } else {
      if (tx.status === 'CRYPTO_EXEMPT') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold">Crypto Exempt</span>`;
      } else if (tx.status === 'WASH_SALE') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-300 font-mono font-bold">Wash Absorbed</span>`;
      } else if (tx.status === 'PARTIAL_SPLIT') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-300 font-mono font-bold">Partial Split</span>`;
      }
    }

    let detailDisplay = '';
    let basisDisplay = '';
    let disallowedDisplay = '';

    if (isSell) {
      const basisSourceText = tx.soldFromLegIndex
        ? `from Leg #${tx.soldFromLegIndex}${tx.isWashAdjusted ? ' [Wash Adj]' : ''}`
        : 'Manual';
      detailDisplay = `
        ${tx.shares} sh @ $${Number(tx.price).toFixed(2)}
        <span class="text-slate-500 text-[10px] block font-mono">Basis: $${Number(tx.costBasis || tx.price).toFixed(2)} (${basisSourceText})</span>
      `;
      disallowedDisplay = tx.disallowedLoss > 0
        ? `<span class="text-amber-700 font-bold">-$${tx.disallowedLoss.toFixed(2)}</span>`
        : `<span class="text-slate-500">$0.00</span>`;
      basisDisplay = tx.soldFromLegIndex
        ? `<span class="${tx.isWashAdjusted ? 'text-amber-800 font-bold' : 'text-slate-800 font-mono'}">$${Number(tx.costBasis).toFixed(2)}</span>
           <span class="text-[9px] block ${tx.isWashAdjusted ? 'text-amber-700 font-bold' : 'text-slate-500'}">From Leg #${tx.soldFromLegIndex} ${tx.isWashAdjusted ? '[Wash Adj]' : ''}</span>`
        : `<span class="text-slate-800 font-mono">$${Number(tx.costBasis || tx.price).toFixed(2)}</span>
           <span class="text-[9px] block text-slate-500">(Manual)</span>`;
    } else {
      detailDisplay = `${tx.shares} sh @ $${Number(tx.price).toFixed(2)}`;
      disallowedDisplay = tx.disallowedLoss > 0
        ? `<span class="text-amber-700 font-bold">+$${tx.disallowedLoss.toFixed(2)}</span>`
        : `<span class="text-slate-500">$0.00</span>`;

      if (tx.status === 'PARTIAL_SPLIT') {
        basisDisplay = `
          <span class="text-amber-800 font-bold">${tx.absorbShares} sh @ $${Number(tx.adjustedBasis).toFixed(2)}</span>
          <span class="text-slate-500 text-[10px] block">(${tx.cleanShares} sh @ $${Number(tx.price).toFixed(2)})</span>
        `;
      } else {
        basisDisplay = `$${Number(tx.adjustedBasis || tx.price).toFixed(2)}`;
      }
    }

    const legNum = tx.legIndex ? `Leg #${tx.legIndex}` : `Leg #${idx + 1}`;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="p-2.5 font-bold font-mono text-slate-900">${legNum}</td>
        <td class="p-2.5 text-slate-700 font-mono">${tx.date}</td>
        <td class="p-2.5">${typeBadge}</td>
        <td class="p-2.5 font-bold font-mono text-slate-800">${dayLabel}</td>
        <td class="p-2.5 font-mono text-slate-800">${detailDisplay}</td>
        <td class="p-2.5">${statusBadge}</td>
        <td class="p-2.5 font-mono">${disallowedDisplay}</td>
        <td class="p-2.5 font-mono text-slate-900 font-semibold">${basisDisplay}</td>
        <td class="p-2.5 text-[11px] text-slate-500 font-mono">${tx.note || '---'}</td>
      </tr>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div class="timeline-wrapper bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
      
      <!-- Top Title & Legends -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h4 class="text-xs uppercase tracking-wider font-bold text-slate-900 font-mono">
            61-Day Statutory Timeline Horizon (Window: T-30 to T+30)
          </h4>
          <p class="text-xs font-mono text-slate-600 mt-0.5">
            Reference Loss Date: <strong class="text-rose-700">${saleDate}</strong> • Window: ${windowStart} to ${windowEnd}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-[10px] sm:text-[11px] font-mono">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pre-Sale Window (-30d)
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300 whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disallowance Zone (+30d)
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Safe Buy Horizon (+31d)
          </span>
        </div>
      </div>

      <!-- Main Continuous Timeline Track Container -->
      <div class="relative ${trackPaddingTop} pb-16 px-6 sm:px-10">
        
        <div class="relative w-full">
          <!-- Continuous Track Bar with Shaded Statutory Zones -->
          <div class="h-4 w-full bg-slate-100 rounded-full relative border border-slate-300 shadow-inner flex overflow-hidden text-[9px] font-mono select-none">
            <!-- Pre-Window Buffer -->
            <div style="width: ${pWinStart}%" class="h-full bg-slate-100 shrink-0" title="Pre-Window Buffer"></div>
            <!-- Pre-Sale Window (-30 to 0) -->
            <div style="width: ${wPreSale}%" class="h-full bg-amber-200/80 border-r border-rose-400 shrink-0 flex items-center justify-center text-amber-900 font-semibold truncate px-1" title="Pre-Sale Window (-30 to Day 0)">
              <span class="hidden md:inline">Pre-Sale (-30d)</span>
            </div>
            <!-- Disallowance Zone (0 to +30) -->
            <div style="width: ${wPostSale}%" class="h-full bg-rose-200/80 border-r border-emerald-500 shrink-0 flex items-center justify-center text-rose-900 font-semibold truncate px-1" title="Disallowance Zone (Day 0 to +30d)">
              <span class="hidden md:inline">Disallowance Zone (+30d)</span>
            </div>
            <!-- Safe Zone (+31 onwards) -->
            <div style="width: ${wSafe}%" class="h-full bg-emerald-200/80 shrink-0 flex items-center justify-center text-emerald-900 font-semibold truncate px-1" title="Safe Buyback Zone (+31d onwards)">
              <span class="hidden md:inline">Safe Zone (+31d →)</span>
            </div>
          </div>

          <!-- Dynamic Multi-Transaction Pins Layer (Strictly Above Track) -->
          <div class="absolute inset-0 pointer-events-none">
            ${pinsHtml}
          </div>

          <!-- Statutory Axis Milestones Layer (Strictly Below Track) -->
          <div class="absolute inset-0 pointer-events-none">
            ${axisMarkersHtml}
          </div>
        </div>

      </div>

      <!-- Lot Absorption & Allocation Breakdown Table -->
      <div class="pt-4 border-t border-slate-200 space-y-3">
        <div class="flex items-center justify-between">
          <h5 class="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider">
            Lot Absorption & Tax Basis Allocation Ledger
          </h5>
          <span class="text-[11px] text-slate-500 font-mono">Chronological Settlement Ledger</span>
        </div>

        <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table class="w-full text-left text-xs text-slate-800 border-collapse">
            <thead>
              <tr class="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-600 font-semibold bg-slate-100 font-mono">
                <th class="p-2.5">Lot</th>
                <th class="p-2.5">Date</th>
                <th class="p-2.5">Action</th>
                <th class="p-2.5">Window Offset</th>
                <th class="p-2.5">Shares & Execution Basis</th>
                <th class="p-2.5">Wash Status</th>
                <th class="p-2.5">Disallowed / Realized</th>
                <th class="p-2.5">Adjusted Basis / Share</th>
                <th class="p-2.5">Lot Settlement Notes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-mono-num">
              ${breakdownRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
