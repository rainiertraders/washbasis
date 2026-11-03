#!/usr/bin/env python3
"""
Test suite for multi-transaction scenario calculations:
A single sale matched against multiple buy transactions (pre-wash, post-wash, split lot, and safe buy).
"""

from datetime import datetime, timedelta

def days_between(d1, d2):
    t1 = datetime.strptime(d1[:10], "%Y-%m-%d")
    t2 = datetime.strptime(d2[:10], "%Y-%m-%d")
    return (t2 - t1).days

def calculate_multi_scenario(sale_date, shares_sold, sale_price, cost_basis, buy_transactions):
    raw_loss = shares_sold * (cost_basis - sale_price)
    loss_per_share = raw_loss / shares_sold
    remaining_loss_shares = shares_sold
    
    # Sort buys chronologically
    sorted_buys = sorted(buy_transactions, key=lambda x: x['date'])
    results = []
    total_disallowed = 0.0

    for b in sorted_buys:
        days_diff = days_between(sale_date, b['date'])
        is_in_window = abs(days_diff) <= 30
        buy_shares = b['shares']
        buy_price = b['price']

        if is_in_window and remaining_loss_shares > 0:
            absorb_shares = min(remaining_loss_shares, buy_shares)
            disallow_amount = absorb_shares * loss_per_share
            total_disallowed += disallow_amount
            remaining_loss_shares -= absorb_shares

            adj_basis_wash = buy_price + (disallow_amount / absorb_shares)
            results.append({
                'date': b['date'],
                'days_diff': days_diff,
                'status': 'WASH_SALE' if absorb_shares == buy_shares else 'PARTIAL_SPLIT',
                'absorb_shares': absorb_shares,
                'disallowed_loss': disallow_amount,
                'adj_basis': adj_basis_wash,
                'clean_shares': buy_shares - absorb_shares,
                'clean_basis': buy_price
            })
        else:
            results.append({
                'date': b['date'],
                'days_diff': days_diff,
                'status': 'SAFE',
                'absorb_shares': 0,
                'disallowed_loss': 0.0,
                'adj_basis': buy_price,
                'clean_shares': buy_shares
            })

    allowed_loss = raw_loss - total_disallowed
    return {
        'total_disallowed': round(total_disallowed, 2),
        'allowed_loss': round(allowed_loss, 2),
        'transactions': results
    }

def run_tests():
    print("Running Multi-Transaction Scenario Tests...")

    # Scenario:
    # Sale on 2026-03-01: 100 shares @ $180, basis $210 (loss = $3,000, $30/share)
    # Buy 1 on 2026-02-15 (-14d): 30 shares @ $190 (Pre-wash sale! 30 shares absorb $900)
    # Buy 2 on 2026-03-12 (+11d): 50 shares @ $175 (Post-wash sale! 50 shares absorb $1500)
    # Buy 3 on 2026-03-25 (+24d): 40 shares @ $180 (Only 20 shares needed to absorb remaining $600 -> Lot splits into 20 adj / 20 clean!)
    # Buy 4 on 2026-04-05 (+35d): 50 shares @ $185 (Outside 30-day window -> Safe buy!)
    buys = [
        {'date': '2026-02-15', 'shares': 30, 'price': 190.0},
        {'date': '2026-03-12', 'shares': 50, 'price': 175.0},
        {'date': '2026-03-25', 'shares': 40, 'price': 180.0},
        {'date': '2026-04-05', 'shares': 50, 'price': 185.0}
    ]
    res = calculate_multi_scenario('2026-03-01', 100, 180.0, 210.0, buys)

    assert res['total_disallowed'] == 3000.0, f"Expected 3000, got {res['total_disallowed']}"
    assert res['allowed_loss'] == 0.0

    txs = res['transactions']
    # Buy 1: 30 shares absorb $900 -> basis $190 + $30 = $220.00
    assert txs[0]['status'] == 'WASH_SALE'
    assert txs[0]['absorb_shares'] == 30
    assert txs[0]['disallowed_loss'] == 900.0
    assert txs[0]['adj_basis'] == 220.0

    # Buy 2: 50 shares absorb $1500 -> basis $175 + $30 = $205.00
    assert txs[1]['status'] == 'WASH_SALE'
    assert txs[1]['absorb_shares'] == 50
    assert txs[1]['disallowed_loss'] == 1500.0
    assert txs[1]['adj_basis'] == 205.0

    # Buy 3: 40 shares, absorbs remaining 20 shares ($600) -> 20 sh @ $210, 20 sh @ $180 clean!
    assert txs[2]['status'] == 'PARTIAL_SPLIT'
    assert txs[2]['absorb_shares'] == 20
    assert txs[2]['clean_shares'] == 20
    assert txs[2]['disallowed_loss'] == 600.0
    assert txs[2]['adj_basis'] == 210.0

    # Buy 4: 50 shares on day +35 -> Safe!
    assert txs[3]['status'] == 'SAFE'
    assert txs[3]['absorb_shares'] == 0
    assert txs[3]['disallowed_loss'] == 0.0

    print("✓ All Multi-Transaction Scenario tests passed!")

if __name__ == '__main__':
    run_tests()
