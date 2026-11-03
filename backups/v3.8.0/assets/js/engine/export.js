/**
 * WashGuard Export Engine
 * Generates personal trade analysis logs and portfolio basis adjustments.
 * Note: Educational and analytical trading summaries for personal records. Not a tax preparation or filing service.
 */

export function exportTradeAnalysisCSV(analysisResults) {
  const headers = [
    'Sale ID',
    'Sale Date',
    'Symbol',
    'Shares',
    'Sell Price',
    'Cost Basis Per Share',
    'Total Cost Basis',
    'Proceeds',
    'Raw P/L',
    'Wash Sale Disallowed Loss',
    'Net Allowed Loss',
    'Replacement Lot Date',
    'Status Notes'
  ];

  const rows = analysisResults.sales.map(s => [
    s.id,
    s.date,
    s.symbol,
    s.shares,
    s.sellPrice.toFixed(2),
    s.costBasisPerShare.toFixed(2),
    s.totalCostBasis.toFixed(2),
    s.proceeds.toFixed(2),
    s.rawPl.toFixed(2),
    s.disallowedLoss.toFixed(2),
    s.allowedLoss.toFixed(2),
    s.replacementDate || 'N/A',
    `"${(s.notes || []).join('; ').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csvContent, 'washguard_trade_analysis.csv', 'text/csv;charset=utf-8;');
}

export function exportAdjustedLotsCSV(analysisResults) {
  const headers = [
    'Lot ID',
    'Buy Date',
    'Symbol',
    'Shares',
    'Original Price',
    'Adjusted Price (Post-Wash)',
    'Total Absorbed Disallowed Loss',
    'Holding Period Days Bonus'
  ];

  const rows = (analysisResults.replacementLots || []).map(b => [
    b.id,
    b.date,
    b.symbol,
    b.shares,
    b.originalPrice.toFixed(2),
    b.adjustedPrice.toFixed(2),
    b.absorbedDisallowedLoss.toFixed(2),
    b.holdingPeriodDaysBonus
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csvContent, 'washguard_adjusted_lots.csv', 'text/csv;charset=utf-8;');
}

export function exportSummaryJSON(analysisResults) {
  const jsonContent = JSON.stringify(analysisResults, null, 2);
  downloadBlob(jsonContent, 'washguard_analysis_backup.json', 'application/json');
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
