/**
 * WashGuard Interactive Multi-Transaction Timeline Visualizer
 * Renders a dynamic, continuous date-scale timeline supporting multiple sales and repurchases.
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

  // Compute bounding dates for timeline display
  const allDates = [saleDate, windowStart, windowEnd, safeDate, ...txList.map(t => t.date)];
  const sortedDates = [...allDates].sort();
  const earliestDate = addDays(sortedDates[0], -4);
  const latestDate = addDays(sortedDates[sortedDates.length - 1], 4);
  const totalDays = Math.max(1, daysBetween(earliestDate, latestDate));

  const getPercent = (dateStr) => {
    const days = daysBetween(earliestDate, dateStr);
    const pct = (days / totalDays) * 100;
    return Math.max(1.5, Math.min(98.5, pct));
  };

  const pWinStart = getPercent(windowStart);
  const pSale = getPercent(saleDate);
  const pWinEnd = getPercent(windowEnd);
  const pSafe = getPercent(safeDate);

  // Widths for color-coded background blocks
  const wPreSale = Math.max(0, pSale - pWinStart);
  const wPostSale = Math.max(0, pWinEnd - pSale);
  const wSafe = Math.max(0, 100 - pSafe);

  // Build Transaction Pins for ALL legs in the sequence
  const pinsHtml = txList.map((tx, idx) => {
    const pct = getPercent(tx.date);
    const daysDiff = tx.daysDiff ?? daysBetween(saleDate, tx.date);
    const dayLabel = `${daysDiff >= 0 ? '+' : ''}${daysDiff}d`;
    const isSell = (tx.type || '').toUpperCase() === 'SELL';
    const legLabel = tx.legIndex ? `Leg #${tx.legIndex}: ` : '';

    let badgeClass = 'bg-emerald-700 text-white border-emerald-800';
    let statusLabel = `${legLabel}BUY`;

    if (isSell) {
      badgeClass = 'bg-rose-700 text-white border-rose-800';
      statusLabel = `${legLabel}SELL (${tx.shares} sh)`;
    } else if (tx.status === 'CRYPTO_EXEMPT') {
      badgeClass = 'bg-blue-700 text-white border-blue-800';
      statusLabel = `${legLabel}CRYPTO`;
    } else if (tx.status === 'WASH_SALE') {
      badgeClass = 'bg-amber-600 text-white border-amber-700';
      statusLabel = `${legLabel}WASH BUY`;
    } else if (tx.status === 'PARTIAL_SPLIT') {
      badgeClass = 'bg-amber-600 text-white border-amber-700';
      statusLabel = `${legLabel}SPLIT BUY`;
    }

    // Stagger pin heights to avoid overlap
    const isEven = idx % 2 === 0;
    const topOffset = isEven ? '-top-6' : '-top-12';
    const stalkHeight = isEven ? 'h-7' : 'h-13';

    return `
      <div class="absolute ${topOffset} transition-all duration-300 z-20 group" style="left: ${pct}%; transform: translateX(-50%);">
        <!-- Pin Tooltip & Badge -->
        <div class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border shadow-xs ${badgeClass} whitespace-nowrap flex items-center gap-1 cursor-pointer mx-auto group-hover:scale-105 transition-transform">
          <span>${statusLabel}</span>
          <span class="opacity-80">(${dayLabel})</span>
        </div>
        
        <!-- Vertical Stalk -->
        <div class="w-0.5 ${stalkHeight} bg-slate-400 mx-auto"></div>

        <!-- Date & Share Label Below Pin -->
        <div class="text-[9px] font-mono text-center text-slate-800 mt-0.5 whitespace-nowrap bg-white px-1.5 py-0.5 rounded mx-auto border border-slate-300 shadow-xs">
          ${tx.date.slice(5)} • ${isSell ? `Sell $${tx.price}` : `Buy $${tx.price}`}
        </div>
      </div>
    `;
  }).join('');

  // Build Transaction Breakdown Rows
  const breakdownRowsHtml = txList.length === 0 ? `
    <tr>
      <td colspan="8" class="p-4 text-center text-slate-500 font-mono text-xs">
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
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h4 class="text-xs uppercase tracking-wider font-bold text-slate-900 font-mono">
            61-Day Statutory Timeline Horizon (IRC § 1091 Window: T-30 to T+30)
          </h4>
          <p class="text-xs font-mono text-slate-600 mt-0.5">
            Reference Loss Date: <strong class="text-rose-700">${saleDate}</strong> • Window: ${windowStart} to ${windowEnd}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pre-Sale Window (-30d)
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disallowance Zone (+30d)
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Safe Buy Horizon (+31d)
          </span>
        </div>
      </div>

      <!-- Main Continuous Timeline Track -->
      <div class="relative pt-14 pb-12 px-6">
        
        <!-- Track Background with Shaded Zones -->
        <div class="h-3.5 w-full bg-slate-100 rounded-full relative overflow-hidden flex border border-slate-300 shadow-inner">
          <!-- Pre-Window Buffer -->
          <div style="width: ${pWinStart}%" class="h-full bg-slate-100"></div>
          <!-- Pre-Sale Window (-30 to 0) -->
          <div style="width: ${wPreSale}%" class="h-full bg-amber-200/70 border-r border-rose-400" title="Pre-Sale Window (-30 to 0 days)"></div>
          <!-- Post-Sale Danger Zone (0 to +30) -->
          <div style="width: ${wPostSale}%" class="h-full bg-rose-200/70" title="Post-Sale Disallowance Zone (0 to +30 days)"></div>
          <!-- Safe Zone (+31 onwards) -->
          <div style="width: ${wSafe}%" class="h-full bg-emerald-200/70" title="Safe Buyback Zone (+31 days onwards)"></div>
        </div>

        <!-- Axis Marker: Window Start (-30 Days) -->
        <div class="absolute top-11" style="left: ${pWinStart}%; transform: translateX(-50%);">
          <div class="h-8 w-0.5 bg-amber-600 mx-auto"></div>
          <div class="text-[10px] text-amber-800 text-center font-mono whitespace-nowrap mt-1 font-semibold">
            -30d<br><span class="text-slate-500 text-[9px] font-normal">${windowStart.slice(5)}</span>
          </div>
        </div>

        <!-- Axis Marker: Reference Sale Date (Day 0) -->
        <div class="absolute top-11" style="left: ${pSale}%; transform: translateX(-50%);">
          <div class="h-8 w-0.5 bg-rose-600 mx-auto"></div>
          <div class="text-[10px] text-rose-800 text-center font-mono whitespace-nowrap mt-1 font-bold">
            Day 0<br><span class="text-slate-600 text-[9px] font-normal">${saleDate.slice(5)}</span>
          </div>
        </div>

        <!-- Axis Marker: Window End (+30 Days) -->
        <div class="absolute top-11" style="left: ${pWinEnd}%; transform: translateX(-50%);">
          <div class="h-8 w-0.5 bg-rose-600 mx-auto"></div>
          <div class="text-[10px] text-rose-800 text-center font-mono whitespace-nowrap mt-1 font-semibold">
            +30d<br><span class="text-slate-500 text-[9px] font-normal">${windowEnd.slice(5)}</span>
          </div>
        </div>

        <!-- Axis Marker: Safe Date (+31 Days) -->
        <div class="absolute top-8" style="left: ${pSafe}%; transform: translateX(-50%);">
          <div class="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-xs mx-auto"></div>
          <div class="h-5 w-0.5 bg-emerald-600 mx-auto"></div>
          <div class="text-[10px] font-bold text-emerald-800 text-center font-mono whitespace-nowrap mt-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 shadow-xs">
            +31d SAFE<br><span class="text-emerald-700 font-normal text-[9px]">${safeDate}</span>
          </div>
        </div>

        <!-- Dynamic Multi-Transaction Pins (Both BUY and SELL legs) -->
        ${pinsHtml}

      </div>

      <!-- Lot Absorption & Allocation Breakdown Table -->
      <div class="pt-4 border-t border-slate-200 space-y-3">
        <div class="flex items-center justify-between">
          <h5 class="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider">
            Lot Absorption & Tax Basis Allocation Ledger
          </h5>
          <span class="text-[11px] text-slate-500 font-mono">Chronological Section 1091 Settlement</span>
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
