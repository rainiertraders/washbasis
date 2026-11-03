/**
 * WashGuard CSV Parser & Sample Generator
 * Parses standard generic trade CSV files and generates templates.
 */

export function parseCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row.');
  }

  // Parse header
  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  
  // Find column indices
  const dateIdx = rawHeaders.findIndex(h => h.includes('date') || h.includes('time'));
  const symIdx = rawHeaders.findIndex(h => h.includes('symbol') || h.includes('ticker') || h.includes('asset'));
  const typeIdx = rawHeaders.findIndex(h => h.includes('type') || h.includes('action') || h.includes('side'));
  const sharesIdx = rawHeaders.findIndex(h => h.includes('share') || h.includes('qty') || h.includes('quantity') || h.includes('amount'));
  const priceIdx = rawHeaders.findIndex(h => h.includes('price') || h.includes('cost') || h.includes('rate'));

  if (dateIdx === -1 || symIdx === -1 || typeIdx === -1 || sharesIdx === -1 || priceIdx === -1) {
    throw new Error(
      'Could not detect required columns. Please ensure your CSV includes: Date, Symbol, Type (Buy/Sell), Shares, and Price.'
    );
  }

  const trades = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle standard CSV split (simple regex for comma not within quotes)
    const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^["']|["']$/g, ''));

    const dateVal = cols[dateIdx];
    const symVal = cols[symIdx];
    const typeVal = cols[typeIdx];
    const sharesVal = parseFloat(cols[sharesIdx].replace(/[$,]/g, ''));
    const priceVal = parseFloat(cols[priceIdx].replace(/[$,]/g, ''));

    if (!dateVal || !symVal || !typeVal || isNaN(sharesVal) || isNaN(priceVal)) {
      errors.push(`Row ${i + 1}: Invalid or missing values.`);
      continue;
    }

    const normType = typeVal.toUpperCase().includes('B') ? 'BUY' : 'SELL';
    
    // Normalize date format to YYYY-MM-DD
    let normDate = dateVal;
    if (dateVal.includes('/')) {
      const parts = dateVal.split('/');
      if (parts.length === 3) {
        // MM/DD/YYYY or M/D/YY
        const m = parts[0].padStart(2, '0');
        const d = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = '20' + y;
        normDate = `${y}-${m}-${d}`;
      }
    }

    trades.push({
      id: `trade-${i}`,
      date: normDate,
      symbol: symVal.toUpperCase(),
      type: normType,
      shares: Math.abs(sharesVal),
      price: Math.abs(priceVal)
    });
  }

  return { trades, errors };
}

/**
 * Generate standard sample CSV string for testing and templates
 */
export function getSampleCSV() {
  return `Date,Symbol,Type,Shares,Price
2026-01-10,AAPL,BUY,100,180.00
2026-02-15,AAPL,SELL,100,160.00
2026-03-01,AAPL,BUY,100,165.00
2026-03-10,NVDA,BUY,50,120.00
2026-04-05,NVDA,SELL,50,90.00
2026-04-18,NVDA,BUY,20,95.00
2026-05-01,TSLA,BUY,40,250.00
2026-06-10,TSLA,SELL,40,190.00
2026-06-20,TSLA,BUY,40,195.00
2026-07-01,BTC,BUY,0.5,62000.00
2026-07-15,BTC,SELL,0.5,55000.00
2026-07-22,BTC,BUY,0.5,56000.00`;
}
