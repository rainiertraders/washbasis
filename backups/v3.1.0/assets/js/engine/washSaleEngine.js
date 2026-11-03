/**
 * WashGuard Core Engine
 * Client-side calculation engine for IRS Section 1091 Wash Sales & Scenario Simulation.
 * Educational simulator for informational and strategic purposes only. Not tax advice.
 */

export const KNOWN_CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK',
  'SHIB', 'LTC', 'BCH', 'UNI', 'NEAR', 'BNB', 'USDT', 'USDC'
]);

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date) {
  if (typeof date === 'string') return date.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD string to Date object at UTC midnight to avoid timezone shifting
 */
export function parseDate(dateStr) {
  const parts = dateStr.slice(0, 10).split('-');
  return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
}

/**
 * Calculate difference in calendar days between two dates (date2 - date1)
 */
export function daysBetween(dateStr1, dateStr2) {
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a YYYY-MM-DD string
 */
export function addDays(dateStr, days) {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Multi-Transaction Scenario Calculator
 * Evaluates arbitrary combinations of BUY and SELL legs.
 * Supports multiple sales, multiple buys, pre-buys, post-buys, and split lots.
 */
export function calculateMultiScenario({
  symbol = 'AAPL',
  saleDate,
  sharesSold,
  salePrice,
  costBasisPerShare,
  transactions = [],
  isCryptoRulesEnabled = false
}) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const isCrypto = KNOWN_CRYPTO_SYMBOLS.has(cleanSymbol);

  // Normalize all legs into a unified array
  const allSales = [];
  const allBuys = [];

  // Add primary anchor sale if provided
  if (saleDate && sharesSold > 0) {
    allSales.push({
      id: 'sale-anchor',
      type: 'SELL',
      isAnchor: true,
      date: saleDate,
      shares: Number(sharesSold),
      price: Number(salePrice),
      costBasis: Number(costBasisPerShare)
    });
  }

  // Separate and normalize all transactions
  const rawLegs = [];

  // Add primary anchor sale if provided (for backwards compatibility)
  if (saleDate && sharesSold > 0) {
    rawLegs.push({
      id: 'sale-anchor',
      type: 'SELL',
      isAnchor: true,
      legIndex: 1,
      date: saleDate,
      shares: Number(sharesSold),
      price: Number(salePrice),
      costBasis: Number(costBasisPerShare),
      soldFrom: 'manual'
    });
  }

  // Add additional transactions
  transactions.forEach((tx, idx) => {
    const isSell = (tx.type || '').toUpperCase() === 'SELL';
    rawLegs.push({
      id: tx.id || `leg-${idx + 1}`,
      legIndex: tx.legIndex || (rawLegs.length + 1),
      type: isSell ? 'SELL' : 'BUY',
      isAnchor: false,
      date: tx.date,
      shares: Number(tx.shares),
      price: Number(tx.price),
      costBasis: tx.costBasis !== undefined ? Number(tx.costBasis) : Number(tx.price),
      soldFrom: tx.soldFrom || 'manual'
    });
  });

  // Sort chronologically (buys before sells on the same date)
  const sortedLegs = [...rawLegs].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.type === 'BUY' ? -1 : 1;
  });

  // Track active Buy Lots & Sales
  const buyLots = [];
  const salesToMatch = [];
  const processedSales = [];
  const processedBuys = [];

  let totalRawLoss = 0;
  let totalDisallowedLoss = 0;

  for (const leg of sortedLegs) {
    if (leg.type === 'BUY') {
      const buyLot = {
        id: leg.id,
        legIndex: leg.legIndex,
        date: leg.date,
        type: 'BUY',
        initialShares: leg.shares,
        shares: leg.shares,
        capacity: leg.shares, // available to absorb wash sales
        remainingShares: leg.shares, // available to be sold
        absorbedShares: 0,
        price: leg.price,
        absorbedDisallowed: 0,
        subLots: [],
        get adjustedBasis() {
          if (this.absorbedShares > 0 && this.absorbedDisallowed > 0) {
            return this.price + (this.absorbedDisallowed / this.absorbedShares);
          }
          return this.price;
        },
        get averageBasis() {
          return this.price + (this.initialShares > 0 ? (this.absorbedDisallowed / this.initialShares) : 0);
        }
      };

      // If crypto rules are enabled or non-crypto asset:
      // Check if any prior sale with unabsorbed loss can wash into this new buy lot
      if (!isCrypto || isCryptoRulesEnabled) {
        for (const s of salesToMatch) {
          if (buyLot.capacity <= 0) break;
          if (s.remainingLossShares <= 0) continue;

          const daysDiff = daysBetween(s.date, buyLot.date);
          if (daysDiff >= 0 && daysDiff <= 30) {
            // Cannot wash into the exact lot being sold
            if (s.soldFrom === buyLot.id) continue;

            const absorb = Math.min(s.remainingLossShares, buyLot.capacity);
            const disallow = absorb * s.lossPerShare;

            buyLot.capacity -= absorb;
            buyLot.absorbedShares = (buyLot.absorbedShares || 0) + absorb;
            buyLot.absorbedDisallowed += disallow;
            s.remainingLossShares -= absorb;
            s.disallowedLoss += disallow;
            totalDisallowedLoss += disallow;

            s.matchedBuys.push({
              buyId: buyLot.id,
              buyDate: buyLot.date,
              buyLegIndex: buyLot.legIndex,
              absorbShares: absorb,
              disallowAmount: disallow,
              daysDiff
            });

            buyLot.subLots.push({
              saleId: s.id,
              saleDate: s.date,
              saleLegIndex: s.legIndex,
              shares: absorb,
              disallowAmount: disallow,
              lossPerShare: s.lossPerShare
            });
          }
        }
      }

      buyLots.push(buyLot);
      processedBuys.push(buyLot);
    } else {
      // Leg is SELL
      let effectiveCostBasis = leg.costBasis;
      let isWashAdjusted = false;
      let soldFromLot = null;

      if (leg.soldFrom && leg.soldFrom !== 'manual') {
        soldFromLot = buyLots.find(b => b.id === leg.soldFrom);
        if (soldFromLot) {
          const washShares = soldFromLot.absorbedShares || 0;
          if (washShares > 0 && soldFromLot.absorbedDisallowed > 0) {
            isWashAdjusted = true;
            if (leg.shares <= washShares) {
              effectiveCostBasis = soldFromLot.price + (soldFromLot.absorbedDisallowed / washShares);
            } else {
              const washBasisTotal = washShares * (soldFromLot.price + (soldFromLot.absorbedDisallowed / washShares));
              const cleanShares = Math.max(0, leg.shares - washShares);
              const cleanBasisTotal = cleanShares * soldFromLot.price;
              const totalSold = washShares + cleanShares;
              effectiveCostBasis = totalSold > 0 ? (washBasisTotal + cleanBasisTotal) / totalSold : soldFromLot.price;
            }
          } else {
            effectiveCostBasis = soldFromLot.price;
          }
          soldFromLot.remainingShares = Math.max(0, soldFromLot.remainingShares - leg.shares);
        }
      }

      if (effectiveCostBasis === undefined || isNaN(effectiveCostBasis)) {
        effectiveCostBasis = leg.price;
      }

      const rawPl = leg.shares * (leg.price - effectiveCostBasis);
      const isLoss = rawPl < -0.0001;
      const rawLoss = isLoss ? Math.abs(rawPl) : 0;
      const lossPerShare = leg.shares > 0 ? rawLoss / leg.shares : 0;

      const saleRecord = {
        id: leg.id,
        legIndex: leg.legIndex,
        date: leg.date,
        type: 'SELL',
        shares: leg.shares,
        price: leg.price,
        costBasis: effectiveCostBasis,
        soldFrom: leg.soldFrom || 'manual',
        soldFromLegIndex: soldFromLot ? soldFromLot.legIndex : null,
        soldFromDate: soldFromLot ? soldFromLot.date : null,
        isWashAdjusted,
        rawPl,
        isLoss,
        rawLoss,
        lossPerShare,
        disallowedLoss: 0,
        remainingLossShares: isLoss ? leg.shares : 0,
        matchedBuys: []
      };

      if (isLoss && (!isCrypto || isCryptoRulesEnabled)) {
        totalRawLoss += rawLoss;

        // Check if any PRE-SALE buys (within 30 days BEFORE this sale) can absorb this loss
        for (const b of buyLots) {
          if (saleRecord.remainingLossShares <= 0) break;
          // Cannot wash into the lot being sold
          if (b.id === saleRecord.soldFrom) continue;

          // A pre-sale buy must still be held (not already closed in an earlier sale)
          const availableCapacity = Math.min(b.capacity, b.remainingShares);
          if (availableCapacity <= 0) continue;

          const daysDiff = daysBetween(b.date, saleRecord.date);
          if (daysDiff >= 0 && daysDiff <= 30) {
            const absorb = Math.min(saleRecord.remainingLossShares, availableCapacity);
            const disallow = absorb * lossPerShare;

            b.capacity -= absorb;
            b.absorbedShares = (b.absorbedShares || 0) + absorb;
            b.absorbedDisallowed += disallow;
            saleRecord.remainingLossShares -= absorb;
            saleRecord.disallowedLoss += disallow;
            totalDisallowedLoss += disallow;

            saleRecord.matchedBuys.push({
              buyId: b.id,
              buyDate: b.date,
              buyLegIndex: b.legIndex,
              absorbShares: absorb,
              disallowAmount: disallow,
              daysDiff: -daysDiff
            });

            b.subLots.push({
              saleId: saleRecord.id,
              saleDate: saleRecord.date,
              saleLegIndex: saleRecord.legIndex,
              shares: absorb,
              disallowAmount: disallow,
              lossPerShare
            });
          }
        }

        // If remainingLossShares > 0, save for matching against subsequent buys
        if (saleRecord.remainingLossShares > 0) {
          salesToMatch.push(saleRecord);
        }
      } else if (isLoss && isCrypto && !isCryptoRulesEnabled) {
        totalRawLoss += rawLoss;
      }

      processedSales.push(saleRecord);
    }
  }

  // Anchor & reference dates
  const lossSales = processedSales.filter(s => s.isLoss);
  const primarySale = lossSales[0] || processedSales[0];
  const anchorDate = saleDate || (primarySale ? primarySale.date : (processedBuys[0] ? processedBuys[0].date : new Date().toISOString().slice(0, 10)));
  const windowStart = addDays(anchorDate, -30);
  const windowEnd = addDays(anchorDate, 30);
  const lastLossSale = lossSales.length > 0 ? lossSales[lossSales.length - 1] : null;
  const safeBuybackDate = lastLossSale
    ? addDays(lastLossSale.date, 31)
    : (processedSales.length > 0 ? addDays(processedSales[processedSales.length - 1].date, 31) : 'N/A');

  // Format finalized sales
  const finalizedSales = processedSales.map(s => {
    const allowedLoss = s.isLoss ? (s.rawLoss - s.disallowedLoss) : 0;
    const recognizedPl = !s.isLoss ? s.rawPl : -allowedLoss;

    let note = '';
    if (!s.isLoss) {
      note = `Gain: +$${s.rawPl.toFixed(2)}`;
    } else if (s.disallowedLoss > 0) {
      const plStr = recognizedPl < -0.0001 ? `-$${Math.abs(recognizedPl).toFixed(2)}` : '$0.00';
      note = `Wash: -$${s.disallowedLoss.toFixed(2)} disallowed (Recognized: ${plStr})`;
    } else {
      note = `Allowed loss: -$${s.rawLoss.toFixed(2)}`;
    }

    if (s.isWashAdjusted) {
      note += ` [Used wash-adjusted basis $${s.costBasis.toFixed(2)} from Leg #${s.soldFromLegIndex}]`;
    } else if (s.soldFromLegIndex) {
      note += ` [Cost basis from Leg #${s.soldFromLegIndex}]`;
    }

    return {
      ...s,
      daysDiff: daysBetween(anchorDate, s.date),
      allowedLoss,
      recognizedPl,
      status: !s.isLoss ? 'SELL_GAIN' : (s.disallowedLoss > 0 ? 'SELL_WASH' : 'SELL_ALLOWED'),
      note
    };
  });

  // Format finalized buys
  const finalizedBuys = processedBuys.map(b => {
    const daysDiff = daysBetween(anchorDate, b.date);
    const absorbedShares = b.absorbedShares || 0;
    const isAbsorbed = absorbedShares > 0;
    const cleanShares = Math.max(0, b.initialShares - absorbedShares);
    const isSplit = isAbsorbed && cleanShares > 0;

    let status = 'SAFE';
    if (isCrypto && !isCryptoRulesEnabled) {
      status = 'CRYPTO_EXEMPT';
    } else if (isSplit) {
      status = 'PARTIAL_SPLIT';
    } else if (isAbsorbed) {
      status = 'WASH_SALE';
    }

    let note = '';
    if (status === 'CRYPTO_EXEMPT') {
      note = `Crypto Exempt: ${b.initialShares} sh @ $${b.price.toFixed(2)}`;
    } else if (isSplit) {
      note = `Split: ${absorbedShares} sh @ $${b.adjustedBasis.toFixed(2)} (Wash Adj), ${cleanShares} sh @ $${b.price.toFixed(2)} (Clean)`;
    } else if (isAbsorbed) {
      note = `Wash Adj: $${b.absorbedDisallowed.toFixed(2)} added to basis (New basis: $${b.adjustedBasis.toFixed(2)}/sh)`;
    } else {
      note = `Safe: ${b.initialShares} sh clean`;
    }

    return {
      ...b,
      daysDiff,
      isInWindow: Math.abs(daysDiff) <= 30,
      status,
      absorbShares: absorbedShares,
      cleanShares,
      disallowedLoss: b.absorbedDisallowed,
      adjustedBasis: b.adjustedBasis,
      cleanBasis: b.price,
      note
    };
  });

  // Unified chronological list
  const unifiedTransactions = [...finalizedSales, ...finalizedBuys].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.type === 'BUY' ? -1 : 1;
  });

  // Map of buy lots for quick UI lookup
  const buyLotsSummary = {};
  finalizedBuys.forEach(b => {
    buyLotsSummary[b.id] = {
      id: b.id,
      legIndex: b.legIndex,
      date: b.date,
      shares: b.initialShares,
      price: b.price,
      adjustedBasis: b.adjustedBasis,
      absorbedDisallowed: b.absorbedDisallowed,
      isWashAdjusted: b.absorbedDisallowed > 0
    };
  });

  // Calculate net disallowed loss still remaining deferred in open buy lots
  let netDisallowedLoss = 0;
  for (const b of finalizedBuys) {
    const remShares = b.remainingShares !== undefined ? b.remainingShares : b.initialShares;
    const absShares = b.absorbedShares || 0;
    const absDisallowed = b.absorbedDisallowed || 0;
    if (remShares > 0 && absShares > 0) {
      const remWash = Math.min(remShares, absShares);
      netDisallowedLoss += remWash * (absDisallowed / absShares);
    }
  }

  // Net Realized Gain/Loss across all sales in the scenario (+ for gain, - for loss)
  const totalRealizedGainLoss = finalizedSales.reduce((acc, s) => acc + (s.recognizedPl || 0), 0);
  const netAllowedLoss = finalizedSales.reduce((acc, s) => acc + (s.allowedLoss || 0), 0);
  const hadAnyWashSale = totalDisallowedLoss > 0;
  const isWashSale = netDisallowedLoss > 0;

  const plFormatted = totalRealizedGainLoss > 0.0001
    ? `+$${totalRealizedGainLoss.toFixed(2)}`
    : (totalRealizedGainLoss < -0.0001 ? `-$${Math.abs(totalRealizedGainLoss).toFixed(2)}` : '$0.00');

  let reason = '';
  if (isWashSale) {
    reason = `Wash sale triggered! Disallowed \$${netDisallowedLoss.toFixed(2)} deferred into basis of open replacement shares. Net Realized Gain/Loss: ${plFormatted}.`;
  } else if (hadAnyWashSale && Math.abs(totalRealizedGainLoss) > 0.0001) {
    reason = `Prior wash sale loss was rolled into replacement shares and fully recognized upon position exit. Net disallowed loss is \$0.00, and Net Realized Gain/Loss is ${plFormatted}.`;
  } else if (Math.abs(totalRealizedGainLoss) > 0.0001) {
    reason = `No wash sales currently disallowed. Net Realized Gain/Loss across trades is ${plFormatted}.`;
  } else {
    reason = 'All transactions resulted in capital gains or clean trades with zero net deferred loss.';
  }

  return {
    symbol: cleanSymbol,
    saleDate: anchorDate,
    sharesSold: sharesSold || (primarySale ? primarySale.shares : 0),
    salePrice: salePrice || (primarySale ? primarySale.price : 0),
    costBasisPerShare: costBasisPerShare || (primarySale ? primarySale.costBasis : 0),
    isLoss: totalRealizedGainLoss < -0.0001 || netDisallowedLoss > 0,
    rawLoss: totalRawLoss,
    allowedLoss: netAllowedLoss,
    realizedGainLoss: totalRealizedGainLoss,
    netRealizedPl: totalRealizedGainLoss,
    disallowedLoss: netDisallowedLoss,
    hadAnyWashSale,
    windowStart,
    windowEnd,
    safeRepurchaseDate: safeBuybackDate,
    isCryptoExempt: false,
    isWashSale,
    reason,
    sales: finalizedSales,
    buys: finalizedBuys,
    buyLotsSummary,
    transactions: unifiedTransactions
  };
}

/**
 * Single Scenario Calculator (Wrapper around calculateMultiScenario for convenience)
 */
export function calculateScenario({
  symbol = 'AAPL',
  saleDate,
  sharesSold,
  salePrice,
  costBasisPerShare,
  repurchaseDate,
  sharesRepurchased,
  repurchasePrice,
  transactions = null,
  isCryptoRulesEnabled = false
}) {
  const txList = transactions || (repurchaseDate ? [{
    id: 'repurchase-1',
    date: repurchaseDate,
    shares: sharesRepurchased || sharesSold,
    price: repurchasePrice || salePrice
  }] : []);

  const multiRes = calculateMultiScenario({
    symbol,
    saleDate,
    sharesSold,
    salePrice,
    costBasisPerShare,
    transactions: txList,
    isCryptoRulesEnabled
  });

  const firstTx = multiRes.transactions[0] || {};

  return {
    ...multiRes,
    daysDiff: firstTx.daysDiff || 0,
    washShares: firstTx.absorbShares || 0,
    unaffectedShares: firstTx.cleanShares || 0,
    isPartial: firstTx.status === 'PARTIAL_SPLIT',
    lossPerWashShare: firstTx.absorbShares > 0 ? firstTx.disallowedLoss / firstTx.absorbShares : 0,
    adjustedBasisPerShare: firstTx.adjustedBasis || (repurchasePrice || 0),
    totalAdjustedBasis: (firstTx.absorbShares * (firstTx.adjustedBasis || 0)) + (firstTx.cleanShares * (firstTx.cleanBasis || 0))
  };
}


/**
 * Multi-Trade Portfolio Matcher (FIFO Lot Accounting)
 * Takes an array of trades:
 * [
 *   { id, date: 'YYYY-MM-DD', symbol: 'AAPL', type: 'BUY'|'SELL', shares: 100, price: 150 }
 * ]
 */
export function analyzeTradeHistory(trades, { isCryptoRulesEnabled = false } = {}) {
  // Sort trades strictly by date, then buys before sells on same date
  const sorted = [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.type === 'BUY' && b.type === 'SELL') return -1;
    if (a.type === 'SELL' && b.type === 'BUY') return 1;
    return 0;
  });

  // Group by symbol
  const symbolGroups = {};
  for (const t of sorted) {
    const sym = t.symbol.trim().toUpperCase();
    if (!symbolGroups[sym]) symbolGroups[sym] = [];
    symbolGroups[sym].push({ ...t, symbol: sym });
  }

  const allProcessedSales = [];
  const allReplacementLots = [];
  let totalDisallowedLosses = 0;
  let totalRealizedLosses = 0;
  let totalRealizedGains = 0;

  for (const [symbol, symTrades] of Object.entries(symbolGroups)) {
    const isCrypto = KNOWN_CRYPTO_SYMBOLS.has(symbol);
    const applyRules = !isCrypto || isCryptoRulesEnabled;

    const openBuyLots = [];
    const buyLotsHistory = [];

    for (const trade of symTrades) {
      if (trade.type === 'BUY') {
        const buyLot = {
          id: trade.id || `buy-${buyLotsHistory.length + 1}`,
          date: trade.date,
          symbol,
          shares: Number(trade.shares),
          remainingShares: Number(trade.shares),
          absorptionCapacity: Number(trade.shares),
          absorbedDisallowedLoss: 0,
          originalPrice: Number(trade.price),
          adjustedPrice: Number(trade.price),
          holdingPeriodDaysBonus: 0
        };
        openBuyLots.push(buyLot);
        buyLotsHistory.push(buyLot);
      } else if (trade.type === 'SELL') {
        let sharesToSell = Number(trade.shares);
        const sellPrice = Number(trade.price);
        const sellDate = trade.date;

        while (sharesToSell > 0 && openBuyLots.length > 0) {
          const currentLot = openBuyLots[0];
          const matchedShares = Math.min(sharesToSell, currentLot.remainingShares);
          const costBasisPerShare = currentLot.adjustedPrice;
          const costBasis = matchedShares * costBasisPerShare;
          const proceeds = matchedShares * sellPrice;
          const rawPl = proceeds - costBasis;

          const saleRecord = {
            id: `sale-${allProcessedSales.length + 1}`,
            date: sellDate,
            symbol,
            shares: matchedShares,
            sellPrice,
            costBasisPerShare,
            totalCostBasis: costBasis,
            proceeds,
            rawPl,
            isLoss: rawPl < -0.0001,
            disallowedLoss: 0,
            allowedLoss: rawPl < -0.0001 ? Math.abs(rawPl) : 0,
            isWashSale: false,
            replacementLotId: null,
            replacementDate: null,
            notes: []
          };

          if (saleRecord.isLoss) {
            totalRealizedLosses += Math.abs(rawPl);

            if (applyRules) {
              let remainingDisallowedShares = matchedShares;
              const lossPerShare = Math.abs(rawPl) / matchedShares;

              for (const candidateBuy of buyLotsHistory) {
                if (remainingDisallowedShares <= 0) break;
                if (candidateBuy.id === currentLot.id) continue;
                if (candidateBuy.absorptionCapacity <= 0) continue;

                const daysDiff = daysBetween(sellDate, candidateBuy.date);
                if (Math.abs(daysDiff) <= 30) {
                  // For a pre-sale buy (candidateBuy.date <= sellDate), it can only absorb if the shares are still held!
                  const isPreSaleBuy = daysBetween(candidateBuy.date, sellDate) >= 0;
                  if (isPreSaleBuy && candidateBuy.remainingShares <= 0) continue;

                  const availableCapacity = isPreSaleBuy
                    ? Math.min(candidateBuy.absorptionCapacity, candidateBuy.remainingShares)
                    : candidateBuy.absorptionCapacity;
                  if (availableCapacity <= 0) continue;

                  const absorbShares = Math.min(remainingDisallowedShares, availableCapacity);
                  const disallowAmount = absorbShares * lossPerShare;
                  const originalHoldingDays = Math.max(0, daysBetween(currentLot.date, sellDate));

                  saleRecord.isWashSale = true;
                  saleRecord.disallowedLoss += disallowAmount;
                  saleRecord.allowedLoss -= disallowAmount;
                  saleRecord.replacementLotId = candidateBuy.id;
                  saleRecord.replacementDate = candidateBuy.date;

                  // Check if this buy lot needs to be split
                  if (absorbShares < candidateBuy.shares) {
                    // Partial lot split: Split into Wash Adjusted sub-lot and Clean unadjusted sub-lot
                    const adjustedSubLot = {
                      id: `${candidateBuy.id}-adj`,
                      date: candidateBuy.date,
                      symbol,
                      shares: absorbShares,
                      remainingShares: Math.min(candidateBuy.remainingShares, absorbShares),
                      absorptionCapacity: 0,
                      absorbedDisallowedLoss: disallowAmount,
                      originalPrice: candidateBuy.originalPrice,
                      adjustedPrice: candidateBuy.originalPrice + (disallowAmount / absorbShares),
                      holdingPeriodDaysBonus: originalHoldingDays
                    };

                    const cleanSubLot = {
                      id: `${candidateBuy.id}-clean`,
                      date: candidateBuy.date,
                      symbol,
                      shares: candidateBuy.shares - absorbShares,
                      remainingShares: Math.max(0, candidateBuy.remainingShares - absorbShares),
                      absorptionCapacity: candidateBuy.absorptionCapacity - absorbShares,
                      absorbedDisallowedLoss: 0,
                      originalPrice: candidateBuy.originalPrice,
                      adjustedPrice: candidateBuy.originalPrice,
                      holdingPeriodDaysBonus: 0
                    };

                    // Update candidateBuy in place to be the adjusted sub-lot
                    Object.assign(candidateBuy, adjustedSubLot);

                    // Insert clean sub-lot into history and open lots
                    const histIdx = buyLotsHistory.indexOf(candidateBuy);
                    if (histIdx !== -1) {
                      buyLotsHistory.splice(histIdx + 1, 0, cleanSubLot);
                    }
                    const openIdx = openBuyLots.indexOf(candidateBuy);
                    if (openIdx !== -1) {
                      openBuyLots.splice(openIdx + 1, 0, cleanSubLot);
                    }

                    saleRecord.notes.push(`Partial Wash Sale: ${absorbShares} sh split into adjusted lot @ $${adjustedSubLot.adjustedPrice.toFixed(2)} (${cleanSubLot.shares} sh unadjusted)`);
                  } else {
                    // 100% of candidateBuy is absorbed
                    candidateBuy.absorptionCapacity = 0;
                    candidateBuy.absorbedDisallowedLoss += disallowAmount;
                    candidateBuy.adjustedPrice += (disallowAmount / candidateBuy.shares);
                    candidateBuy.holdingPeriodDaysBonus += originalHoldingDays;
                    saleRecord.notes.push(`Wash Sale: Disallowed \$${disallowAmount.toFixed(2)} added to buy lot on ${candidateBuy.date}`);
                  }

                  remainingDisallowedShares -= absorbShares;
                }
              }

              totalDisallowedLosses += saleRecord.disallowedLoss;
            } else {
              saleRecord.notes.push('Crypto exempt under current IRC Section 1091 guidelines.');
            }
          } else {
            totalRealizedGains += rawPl;
          }

          allProcessedSales.push(saleRecord);

          currentLot.remainingShares -= matchedShares;
          currentLot.absorptionCapacity = Math.min(currentLot.absorptionCapacity, currentLot.remainingShares);
          sharesToSell -= matchedShares;

          if (currentLot.remainingShares <= 0) {
            openBuyLots.shift();
          }
        }

        if (sharesToSell > 0) {
          allProcessedSales.push({
            id: `sale-${allProcessedSales.length + 1}`,
            date: sellDate,
            symbol,
            shares: sharesToSell,
            sellPrice,
            costBasisPerShare: 0,
            totalCostBasis: 0,
            proceeds: sharesToSell * sellPrice,
            rawPl: sharesToSell * sellPrice,
            isLoss: false,
            disallowedLoss: 0,
            allowedLoss: 0,
            isWashSale: false,
            notes: ['Unmatched sell / short lot (cost basis unknown)']
          });
        }
      }
    }

    for (const b of buyLotsHistory) {
      if (b.absorbedDisallowedLoss > 0) {
        allReplacementLots.push(b);
      }
    }
  }

  const netAllowedLosses = totalRealizedLosses - totalDisallowedLosses;
  const netCapitalPl = totalRealizedGains - netAllowedLosses;

  return {
    sales: allProcessedSales,
    replacementLots: allReplacementLots,
    summary: {
      totalRealizedGains,
      totalRealizedLosses,
      totalDisallowedLosses,
      netAllowedLosses,
      netCapitalPl,
      totalTrades: trades.length,
      isCryptoRulesEnabled
    }
  };
}
