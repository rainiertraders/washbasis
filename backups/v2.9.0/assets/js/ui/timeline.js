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

    let badgeClass = 'bg-emerald-500 text-white border-emerald-300';
    let icon = '🛡️';
    let statusLabel = `${legLabel}Safe Buy`;

    if (isSell) {
      badgeClass = 'bg-rose-600 text-white border-rose-400';
      icon = '🔴';
      statusLabel = `${legLabel}Sell (${tx.shares} sh)`;
    } else if (tx.status === 'CRYPTO_EXEMPT') {
      badgeClass = 'bg-blue-500 text-white border-blue-400';
      icon = '🪙';
      statusLabel = `${legLabel}Crypto Exempt`;
    } else if (tx.status === 'WASH_SALE') {
      badgeClass = 'bg-rose-600 text-white border-rose-300';
      icon = '🛒';
      statusLabel = `${legLabel}Wash Buy`;
    } else if (tx.status === 'PARTIAL_SPLIT') {
      badgeClass = 'bg-amber-600 text-white border-amber-300';
      icon = '✂️';
      statusLabel = `${legLabel}Split Buy`;
    }

    // Stagger pin heights to avoid overlap
    const isEven = idx % 2 === 0;
    const topOffset = isEven ? '-top-6' : '-top-12';
    const stalkHeight = isEven ? 'h-7' : 'h-13';

    return `
      <div class="absolute ${topOffset} transition-all duration-300 z-20 group" style="left: ${pct}%; transform: translateX(-50%);">
        <!-- Pin Tooltip & Badge -->
        <div class="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border shadow-lg ${badgeClass} whitespace-nowrap flex items-center gap-1 cursor-pointer mx-auto group-hover:scale-110 transition-transform">
          <span>${icon}</span>
          <span>${statusLabel}</span>
          <span class="opacity-80">(${dayLabel})</span>
        </div>
        
        <!-- Vertical Stalk -->
        <div class="w-0.5 ${stalkHeight} bg-slate-200/80 mx-auto shadow"></div>

        <!-- Date & Share Label Below Pin -->
        <div class="text-[9px] sm:text-[10px] font-mono text-center text-slate-300 mt-0.5 whitespace-nowrap bg-slate-950/80 px-1 rounded mx-auto border border-slate-800">
          ${tx.date.slice(5)} • ${isSell ? `Sell $${tx.price}` : `Buy $${tx.price}`}
        </div>
      </div>
    `;
  }).join('');

  // Build Transaction Breakdown Rows
  const breakdownRowsHtml = txList.length === 0 ? `
    <tr>
      <td colspan="8" class="p-4 text-center text-slate-500 font-sans text-xs">
        No transactions added yet.
      </td>
    </tr>
  ` : txList.map((tx, idx) => {
    const daysDiff = tx.daysDiff ?? daysBetween(saleDate, tx.date);
    const dayLabel = `${daysDiff >= 0 ? '+' : ''}${daysDiff}d`;
    const isSell = (tx.type || '').toUpperCase() === 'SELL';

    const typeBadge = isSell
      ? `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase">SELL</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold uppercase">BUY</span>`;

    let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">Safe Clean</span>`;
    if (isSell) {
      if (tx.status === 'SELL_WASH') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">Wash Disallowed</span>`;
      } else if (tx.status === 'SELL_ALLOWED') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">Allowed Loss</span>`;
      } else if (tx.status === 'SELL_GAIN') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">Capital Gain</span>`;
      }
    } else {
      if (tx.status === 'CRYPTO_EXEMPT') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">Crypto Exempt</span>`;
      } else if (tx.status === 'WASH_SALE') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">Wash Absorbed</span>`;
      } else if (tx.status === 'PARTIAL_SPLIT') {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">Partial Split</span>`;
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
        <span class="text-slate-400 text-[10px] block font-mono">Basis: $${Number(tx.costBasis || tx.price).toFixed(2)} (${basisSourceText})</span>
      `;
      disallowedDisplay = tx.disallowedLoss > 0
        ? `<span class="text-amber-400 font-bold">-$${tx.disallowedLoss.toFixed(2)}</span>`
        : `<span class="text-slate-400">$0.00</span>`;
      basisDisplay = tx.soldFromLegIndex
        ? `<span class="${tx.isWashAdjusted ? 'text-amber-400 font-bold' : 'text-slate-300 font-mono'}">$${Number(tx.costBasis).toFixed(2)}</span>
           <span class="text-[9px] block ${tx.isWashAdjusted ? 'text-amber-400 font-bold' : 'text-slate-500'}">From Leg #${tx.soldFromLegIndex} ${tx.isWashAdjusted ? '[Wash Adj]' : ''}</span>`
        : `<span class="text-slate-300 font-mono">$${Number(tx.costBasis || tx.price).toFixed(2)}</span>
           <span class="text-[9px] block text-slate-500">(Manual)</span>`;
    } else {
      detailDisplay = `${tx.shares} sh @ $${Number(tx.price).toFixed(2)}`;
      disallowedDisplay = tx.disallowedLoss > 0
        ? `<span class="text-amber-400 font-bold">+$${tx.disallowedLoss.toFixed(2)}</span>`
        : `<span class="text-slate-400">$0.00</span>`;

      if (tx.status === 'PARTIAL_SPLIT') {
        basisDisplay = `
          <span class="text-amber-400 font-bold">${tx.absorbShares} sh @ $${Number(tx.adjustedBasis).toFixed(2)}</span>
          <span class="text-slate-500 text-[10px] block">(${tx.cleanShares} sh @ $${Number(tx.price).toFixed(2)})</span>
        `;
      } else {
        basisDisplay = `$${Number(tx.adjustedBasis || tx.price).toFixed(2)}`;
      }
    }

    const legNum = tx.legIndex ? `#${tx.legIndex}` : `#${idx + 1}`;

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="p-2.5 font-bold font-mono text-slate-300">${legNum}</td>
        <td class="p-2.5 text-slate-300 font-mono">${tx.date}</td>
        <td class="p-2.5">${typeBadge}</td>
        <td class="p-2.5 font-bold font-mono text-slate-200">${dayLabel}</td>
        <td class="p-2.5">${detailDisplay}</td>
        <td class="p-2.5">${statusBadge}</td>
        <td class="p-2.5 font-mono">${disallowedDisplay}</td>
        <td class="p-2.5 font-mono">${basisDisplay}</td>
        <td class="p-2.5 text-[11px] text-slate-400 font-sans">${tx.note || '---'}</td>
      </tr>
    `;
  }).join('');

  containerEl.innerHTML = `
    <div class="timeline-wrapper bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md space-y-6">
      
      <!-- Top Title & Legends -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h4 class="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2">
            <span>🗓️</span> Multi-Leg 61-Day Visualizer
          </h4>
          <p class="text-sm font-semibold text-slate-200 mt-0.5">
            Reference Loss Date: <span class="font-bold text-rose-400 font-mono">${saleDate}</span>
            <span class="text-xs text-slate-400 font-normal font-sans ml-2">(${txList.length} total leg${txList.length === 1 ? '' : 's'} in sequence)</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-medium">
            <span class="w-2 h-2 rounded-full bg-rose-500"></span> Sell Legs (Loss/Gain)
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
            <span class="w-2 h-2 rounded-full bg-amber-500"></span> Pre-Sale Window (-30d)
          </span>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Safe Buy Zone (+31d)
          </span>
        </div>
      </div>

      <!-- Main Continuous Timeline Track -->
      <div class="relative pt-16 pb-12 px-6">
        
        <!-- Track Background with Shaded Zones -->
        <div class="h-3.5 w-full bg-slate-800 rounded-full relative overflow-hidden flex shadow-inner">
          <!-- Pre-Window Buffer -->
          <div style="width: ${pWinStart}%" class="h-full bg-slate-800/80"></div>
          <!-- Pre-Sale Window (-30 to 0) -->
          <div style="width: ${wPreSale}%" class="h-full bg-amber-500/35 border-r border-rose-500" title="Pre-Sale Window (-30 to 0 days)"></div>
          <!-- Post-Sale Danger Zone (0 to +30) -->
          <div style="width: ${wPostSale}%" class="h-full bg-rose-500/35" title="Post-Sale Danger Zone (0 to +30 days)"></div>
          <!-- Safe Zone (+31 onwards) -->
          <div style="width: ${wSafe}%" class="h-full bg-emerald-500/35" title="Safe Buyback Zone (+31 days onwards)"></div>
        </div>

        <!-- Axis Marker: Window Start (-30 Days) -->
        <div class="absolute top-11" style="left: ${pWinStart}%; transform: translateX(-50%);">
          <div class="h-8 w-0.5 bg-amber-500/80 mx-auto"></div>
          <div class="text-[10px] text-amber-400 text-center font-mono whitespace-nowrap mt-1">
            -30d<br><span class="text-slate-400 text-[9px]">${windowStart.slice(5)}</span>
          </div>
        </div>

        <!-- Axis Marker: Reference Sale Date (Day 0) -->
        <div class="absolute top-11" style="left: ${pSale}%; transform: translateX(-50%);">
          <div class="h-8 w-0.5 bg-rose-500 mx-auto"></div>
          <div class="text-[10px] text-rose-400 text-center font-mono whitespace-nowrap mt-1 font-bold">
            Day 0<br><span class="text-slate-300 text-[9px] font-normal">${saleDate.slice(5)}</span>
          </div>
        </div>

        <!-- Axis Marker: Window End (+30 Days) -->
        <div class="absolute top-11" style="left: ${pWinEnd}%; transform: translateX(-50%);">
          <div class="h-8 w-0.5 bg-rose-500/80 mx-auto"></div>
          <div class="text-[10px] text-rose-400 text-center font-mono whitespace-nowrap mt-1">
            +30d<br><span class="text-slate-400 text-[9px]">${windowEnd.slice(5)}</span>
          </div>
        </div>

        <!-- Axis Marker: Safe Date (+31 Days) -->
        <div class="absolute top-8" style="left: ${pSafe}%; transform: translateX(-50%);">
          <div class="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-md shadow-emerald-400/50 mx-auto"></div>
          <div class="h-5 w-0.5 bg-emerald-400 mx-auto"></div>
          <div class="text-[11px] font-extrabold text-emerald-400 text-center font-mono whitespace-nowrap mt-1 bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-900/60">
            SAFE (+31d)<br><span class="text-emerald-300 font-normal text-[10px]">${safeDate}</span>
          </div>
        </div>

        <!-- Dynamic Multi-Transaction Pins (Both BUY and SELL legs) -->
        ${pinsHtml}

      </div>

      <!-- Lot Absorption & Allocation Breakdown Table -->
      <div class="pt-4 border-t border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <h5 class="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <span>📑</span> Multi-Leg Transaction Audit & Basis Allocation Table
          </h5>
          <span class="text-[11px] text-slate-400">Chronological lot absorption across all BUY and SELL legs</span>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/40">
          <table class="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400 font-semibold bg-slate-900/60">
                <th class="p-2.5">Leg</th>
                <th class="p-2.5">Date</th>
                <th class="p-2.5">Type</th>
                <th class="p-2.5">Window Offset</th>
                <th class="p-2.5">Shares & Price / Cost Basis</th>
                <th class="p-2.5">Wash Status</th>
                <th class="p-2.5">Disallowed / Realized</th>
                <th class="p-2.5">Adjusted Basis / Share</th>
                <th class="p-2.5">Lot Split & Allocation Notes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50 font-mono-num">
              ${breakdownRowsHtml}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
