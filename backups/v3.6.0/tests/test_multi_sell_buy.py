#!/usr/bin/env python3
"""
Test suite for multi-sell and multi-buy scenario calculations:
Supports multiple sales (anchor sale + additional sell legs) and multiple buys (buy legs).
"""

from datetime import datetime, timezone

def days_between(d1, d2):
    t1 = datetime.strptime(d1[:10], "%Y-%m-%d")
    t2 = datetime.strptime(d2[:10], "%Y-%m-%d")
    return (t2 - t1).days

def calculate_multi_sell_buy_scenario(all_legs):
    """
    all_legs is a list of:
    { 'id', 'type': 'BUY'|'SELL', 'date', 'shares', 'price', 'cost_basis' (if manual), 'sold_from' }
    """
    # Sort chronologically, buys before sells on same date
    sorted_legs = sorted(all_legs, key=lambda x: (x['date'], 0 if x['type'] == 'BUY' else 1))
    
    buy_lots = []
    sales_to_match = []
    processed_sales = []
    total_raw_losses = 0.0
    total_disallowed_losses = 0.0

    for leg in sorted_legs:
        if leg['type'] == 'BUY':
            buy_lot = {
                'id': leg['id'],
                'date': leg['date'],
                'initial_shares': leg['shares'],
                'remaining_shares': leg['shares'],
                'capacity': leg['shares'],
                'absorbed_shares': 0,
                'price': leg['price'],
                'absorbed_disallowed': 0.0,
                'sub_lots': []
            }

            # Check if any prior sale with unabsorbed loss can wash into this buy lot
            for s in sales_to_match:
                if buy_lot['capacity'] <= 0:
                    break
                if s['remaining_loss_shares'] <= 0:
                    continue
                # Cannot wash into the lot being sold
                if s.get('sold_from') == buy_lot['id']:
                    continue

                days_diff = days_between(s['date'], buy_lot['date'])
                if 0 <= days_diff <= 30:
                    absorb = min(s['remaining_loss_shares'], buy_lot['capacity'])
                    disallow = absorb * s['loss_per_share']
                    buy_lot['capacity'] -= absorb
                    buy_lot['absorbed_shares'] = buy_lot.get('absorbed_shares', 0) + absorb
                    buy_lot['absorbed_disallowed'] += disallow
                    s['remaining_loss_shares'] -= absorb
                    s['disallowed_loss'] += disallow
                    s['allowed_loss'] = s['raw_loss'] - s['disallowed_loss']
                    s['recognized_pl'] = -s['allowed_loss']
                    total_disallowed_losses += disallow

                    s['matched_buys'].append({
                        'buy_id': buy_lot['id'],
                        'buy_date': buy_lot['date'],
                        'absorb': absorb,
                        'disallow': disallow
                    })

            buy_lots.append(buy_lot)

        elif leg['type'] == 'SELL':
            shares = leg['shares']
            sell_price = leg['price']
            sell_date = leg['date']
            sold_from = leg.get('sold_from', 'manual')
            effective_cost_basis = leg.get('cost_basis', sell_price)
            is_wash_adjusted = False
            sold_from_lot = None

            if sold_from and sold_from != 'manual':
                for b in buy_lots:
                    if b['id'] == sold_from:
                        sold_from_lot = b
                        wash_shares = b.get('absorbed_shares', b['initial_shares'] - b['capacity'])
                        if wash_shares > 0 and b['absorbed_disallowed'] > 0:
                            is_wash_adjusted = True
                            if shares <= wash_shares:
                                effective_cost_basis = b['price'] + (b['absorbed_disallowed'] / wash_shares)
                            else:
                                wash_basis_total = wash_shares * (b['price'] + (b['absorbed_disallowed'] / wash_shares))
                                clean_shares = min(shares - wash_shares, b['capacity'])
                                clean_basis_total = clean_shares * b['price']
                                total_sold = wash_shares + clean_shares
                                effective_cost_basis = (wash_basis_total + clean_basis_total) / total_sold if total_sold > 0 else b['price']
                        else:
                            effective_cost_basis = b['price']
                        b['remaining_shares'] = max(0, b.get('remaining_shares', b['initial_shares']) - shares)
                        b['capacity'] = min(b['capacity'], b['remaining_shares'])
                        break

            raw_pl = shares * (sell_price - effective_cost_basis)
            raw_loss = abs(raw_pl) if raw_pl < -0.0001 else 0.0
            loss_per_share = raw_loss / shares if shares > 0 else 0.0

            sale_record = {
                'id': leg['id'],
                'date': sell_date,
                'shares': shares,
                'sell_price': sell_price,
                'cost_basis': effective_cost_basis,
                'sold_from': sold_from,
                'is_wash_adjusted': is_wash_adjusted,
                'raw_pl': raw_pl,
                'raw_loss': raw_loss,
                'loss_per_share': loss_per_share,
                'disallowed_loss': 0.0,
                'allowed_loss': raw_loss,
                'recognized_pl': raw_pl if raw_pl >= 0 else -raw_loss,
                'remaining_loss_shares': shares if raw_loss > 0 else 0,
                'matched_buys': []
            }

            if raw_loss > 0:
                total_raw_losses += raw_loss
                # Match against PRE-SALE buys (within 30 days before this sale)
                for b in buy_lots:
                    if sale_record['remaining_loss_shares'] <= 0:
                        break
                    # Cannot wash into the lot being sold
                    if b['id'] == sold_from:
                        continue
                    # A pre-sale buy must still be held (not already closed in an earlier sale)
                    available_cap = min(b['capacity'], b.get('remaining_shares', b['capacity']))
                    if available_cap <= 0:
                        continue

                    days_diff = days_between(b['date'], sell_date)
                    if 0 <= days_diff <= 30:
                        absorb = min(sale_record['remaining_loss_shares'], available_cap)
                        disallow = absorb * loss_per_share
                        b['capacity'] -= absorb
                        b['absorbed_shares'] = b.get('absorbed_shares', 0) + absorb
                        b['absorbed_disallowed'] += disallow
                        sale_record['remaining_loss_shares'] -= absorb
                        sale_record['disallowed_loss'] += disallow
                        sale_record['allowed_loss'] = sale_record['raw_loss'] - sale_record['disallowed_loss']
                        sale_record['recognized_pl'] = -sale_record['allowed_loss']
                        total_disallowed_losses += disallow

                        sale_record['matched_buys'].append({
                            'buy_id': b['id'],
                            'buy_date': b['date'],
                            'absorb': absorb,
                            'disallow': disallow
                        })

                if sale_record['remaining_loss_shares'] > 0:
                    sales_to_match.append(sale_record)

            processed_sales.append(sale_record)

    # Calculate net disallowed loss still remaining deferred in open buy lots
    net_disallowed_loss = 0.0
    for b in buy_lots:
        rem_shares = b.get('remaining_shares', b['initial_shares'])
        abs_shares = b.get('absorbed_shares', 0)
        abs_disallowed = b.get('absorbed_disallowed', 0.0)
        if rem_shares > 0 and abs_shares > 0:
            rem_wash = min(rem_shares, abs_shares)
            net_disallowed_loss += rem_wash * (abs_disallowed / abs_shares)

    total_allowed = sum(s.get('allowed_loss', 0.0) for s in processed_sales)
    realized_gain_loss = sum(s.get('recognized_pl', 0.0) for s in processed_sales)

    return {
        'total_disallowed': round(net_disallowed_loss, 2),
        'total_allowed': round(total_allowed, 2),
        'realized_gain_loss': round(realized_gain_loss, 2),
        'sales': processed_sales,
        'buys': buy_lots
    }

def run_tests():
    print("Running Multi-Sell & Multi-Buy Scenario Tests...")

    # Scenario 1:
    # Leg 1 (SELL): 2026-03-01, 50 sh @ $180 (cost basis $210) -> Loss $1500 ($30/sh)
    # Leg 2 (SELL): 2026-03-08, 50 sh @ $170 (cost basis $210) -> Loss $2000 ($40/sh)
    # Leg 3 (BUY):  2026-03-15, 60 sh @ $175
    #   -> Absorbs 50 sh from Leg 1 ($1500 loss)
    #   -> Absorbs 10 sh from Leg 2 ($400 loss)
    # Leg 4 (BUY):  2026-04-15, 40 sh @ $190 (+38d from Leg 2) -> Safe!
    legs = [
        {'id': 'sale-1', 'type': 'SELL', 'date': '2026-03-01', 'shares': 50, 'price': 180.0, 'cost_basis': 210.0, 'sold_from': 'manual'},
        {'id': 'sale-2', 'type': 'SELL', 'date': '2026-03-08', 'shares': 50, 'price': 170.0, 'cost_basis': 210.0, 'sold_from': 'manual'},
        {'id': 'buy-1',  'type': 'BUY',  'date': '2026-03-15', 'shares': 60, 'price': 175.0},
        {'id': 'buy-2',  'type': 'BUY',  'date': '2026-04-15', 'shares': 40, 'price': 190.0}
    ]

    res = calculate_multi_sell_buy_scenario(legs)
    assert res['total_disallowed'] == 1900.0, f"Expected 1900 disallowed, got {res['total_disallowed']}"
    assert res['total_allowed'] == 1600.0, f"Expected 1600 allowed, got {res['total_allowed']}"

    b1 = [b for b in res['buys'] if b['id'] == 'buy-1'][0]
    assert b1['capacity'] == 0
    assert b1['absorbed_disallowed'] == 1900.0

    b2 = [b for b in res['buys'] if b['id'] == 'buy-2'][0]
    assert b2['capacity'] == 40
    assert b2['absorbed_disallowed'] == 0.0

    print("✓ Test 1: Multi-Sell & Multi-Buy with shared buy absorption passed!")

    # Test 2: Starting with a BUY Leg (Classic Default Preset: Buy 14 days before Sell)
    legs_prebuy = [
        {'id': 'leg-1', 'type': 'BUY',  'date': '2026-02-15', 'shares': 100, 'price': 190.0},
        {'id': 'leg-2', 'type': 'SELL', 'date': '2026-03-01', 'shares': 100, 'price': 180.0, 'cost_basis': 210.0, 'sold_from': 'manual'}
    ]
    res_pre = calculate_multi_sell_buy_scenario(legs_prebuy)
    assert res_pre['total_disallowed'] == 3000.0, f"Expected 3000 disallowed, got {res_pre['total_disallowed']}"
    assert res_pre['total_allowed'] == 0.0
    assert res_pre['realized_gain_loss'] == 0.0
    b_pre = res_pre['buys'][0]
    assert b_pre['capacity'] == 0
    assert b_pre['absorbed_disallowed'] == 3000.0
    assert (b_pre['price'] + b_pre['absorbed_disallowed'] / b_pre['absorbed_shares']) == 220.0
    print("✓ Test 2: Pre-Wash Sale starting with BUY leg (Classic Default: Buy $190, Sell $180 w/ $210 basis) passed!")

    # Test 3: Chain with 'sold_from' lot selection and wash-adjusted basis propagation
    # Leg 1 (BUY):  2026-02-01, 100 sh @ $200 (buy-orig)
    # Leg 2 (SELL): 2026-03-01, 100 sh @ $170, sold_from='buy-orig' -> Realizes -$3,000 loss ($30/sh)
    # Leg 3 (BUY):  2026-03-15, 100 sh @ $175 (buy-repl) -> Absorbs $3,000 wash loss, adj basis = $205/sh
    # Leg 4 (SELL): 2026-04-20, 100 sh @ $190, sold_from='buy-repl' -> Cost basis is automatically $205!
    #   Proceeds: $19,000. Cost basis: $20,500. Realized loss: -$1,500. Safe (>30d), so fully deductible!
    legs_chain = [
        {'id': 'buy-orig', 'type': 'BUY',  'date': '2026-02-01', 'shares': 100, 'price': 200.0},
        {'id': 'sale-1',   'type': 'SELL', 'date': '2026-03-01', 'shares': 100, 'price': 170.0, 'sold_from': 'buy-orig'},
        {'id': 'buy-repl', 'type': 'BUY',  'date': '2026-03-15', 'shares': 100, 'price': 175.0},
        {'id': 'sale-2',   'type': 'SELL', 'date': '2026-04-20', 'shares': 100, 'price': 190.0, 'sold_from': 'buy-repl'}
    ]
    res_chain = calculate_multi_sell_buy_scenario(legs_chain)

    sale_1 = [s for s in res_chain['sales'] if s['id'] == 'sale-1'][0]
    sale_2 = [s for s in res_chain['sales'] if s['id'] == 'sale-2'][0]
    buy_repl = [b for b in res_chain['buys'] if b['id'] == 'buy-repl'][0]

    # Sale 1 should have cost basis $200, raw loss $3000, 100% disallowed
    assert sale_1['cost_basis'] == 200.0
    assert sale_1['raw_loss'] == 3000.0
    assert sale_1['disallowed_loss'] == 3000.0

    # Replacement buy absorbed $3000
    assert buy_repl['absorbed_disallowed'] == 3000.0

    # Sale 2 should automatically have cost basis $205.0 ($175 + $3000/100)
    assert sale_2['cost_basis'] == 205.0, f"Expected 205.0, got {sale_2['cost_basis']}"
    assert sale_2['is_wash_adjusted'] == True
    # Realized loss on Sale 2: 100 * (190 - 205) = -1500
    assert sale_2['raw_loss'] == 1500.0
    # Safe from further wash sales
    assert sale_2['disallowed_loss'] == 0.0

    # Position is completely exited: Disallowed loss released and allowed!
    assert res_chain['total_disallowed'] == 0.0
    assert res_chain['total_allowed'] == 1500.0
    assert res_chain['realized_gain_loss'] == -1500.0
    print("✓ Test 3: 'sold_from' lot selection and wash-adjusted basis chain verified successfully!")

    # Test 4: User Scenario - 4 Batches (DEF Stock)
    # Batch 1: Buy 100 shares of DEF at $100 on March 1.
    # Batch 2: Buy 100 shares of DEF at $90 on March 10.
    # Batch 3: Sell Batch 1 (the $100 shares) at $80 on March 15. This triggers a $2,000 loss.
    # Batch 4: Sell Batch 2 (now carrying the adjusted basis) at $70 on March 25.
    legs_def = [
        {'id': 'batch-1', 'type': 'BUY',  'date': '2026-03-01', 'shares': 100, 'price': 100.0},
        {'id': 'batch-2', 'type': 'BUY',  'date': '2026-03-10', 'shares': 100, 'price': 90.0},
        {'id': 'batch-3', 'type': 'SELL', 'date': '2026-03-15', 'shares': 100, 'price': 80.0, 'sold_from': 'batch-1'},
        {'id': 'batch-4', 'type': 'SELL', 'date': '2026-03-25', 'shares': 100, 'price': 70.0, 'sold_from': 'batch-2'}
    ]
    res_def = calculate_multi_sell_buy_scenario(legs_def)

    sale_batch3 = [s for s in res_def['sales'] if s['id'] == 'batch-3'][0]
    sale_batch4 = [s for s in res_def['sales'] if s['id'] == 'batch-4'][0]
    buy_batch2 = [b for b in res_def['buys'] if b['id'] == 'batch-2'][0]

    # March 15 (Sale of Batch 1):
    # Raw Loss: $2,000, Disallowed: $2,000, Allowed: $0, Recognized P/L: $0.00
    # Added $2,000 to Batch 2's cost basis, raising it from $9,000 ($90/sh) to $11,000 ($110/sh)
    assert sale_batch3['cost_basis'] == 100.0
    assert sale_batch3['raw_loss'] == 2000.0
    assert sale_batch3['disallowed_loss'] == 2000.0
    assert sale_batch3['allowed_loss'] == 0.0
    assert sale_batch3['recognized_pl'] == 0.0
    assert buy_batch2['absorbed_disallowed'] == 2000.0
    effective_b2_basis = buy_batch2['price'] + (buy_batch2['absorbed_disallowed'] / buy_batch2['initial_shares'])
    assert effective_b2_basis == 110.0

    # March 25 (Sale of Batch 2):
    # Proceeds $7,000 - Basis $11,000 ($110/sh) = -$4,000 loss
    # Disallowed: $0 (no further purchases within 30 days, and Batch 1 was already closed)
    # Allowed Loss: $4,000, Recognized P/L: -$4,000.00
    assert sale_batch4['cost_basis'] == 110.0, f"Expected 110.0, got {sale_batch4['cost_basis']}"
    assert sale_batch4['is_wash_adjusted'] == True
    assert sale_batch4['raw_loss'] == 4000.0
    assert sale_batch4['disallowed_loss'] == 0.0, f"Expected 0 disallowed, got {sale_batch4['disallowed_loss']}"
    assert sale_batch4['allowed_loss'] == 4000.0
    assert sale_batch4['recognized_pl'] == -4000.0

    # Overall Scenario Totals:
    # Batch 2 was sold and closed, releasing the prior deferred $2,000 loss.
    # Total remaining disallowed loss is $0.00, and Net Realized Gain/Loss is -$4,000.00.
    assert res_def['total_disallowed'] == 0.0, f"Expected 0 disallowed, got {res_def['total_disallowed']}"
    assert res_def['total_allowed'] == 4000.0, f"Expected 4000 allowed, got {res_def['total_allowed']}"
    assert res_def['realized_gain_loss'] == -4000.0, f"Expected -4000.0, got {res_def['realized_gain_loss']}"
    print("✓ Test 4: User scenario (DEF 4-batch wash sale chain: -$4,000.00 realized P/L) verified successfully!")

    # Test 5: Capital Gain (Selling for a profit with positive P/L)
    legs_gain = [
        {'id': 'buy-xyz',  'type': 'BUY',  'date': '2026-04-01', 'shares': 100, 'price': 100.0},
        {'id': 'sale-xyz', 'type': 'SELL', 'date': '2026-04-15', 'shares': 100, 'price': 130.0, 'sold_from': 'buy-xyz'}
    ]
    # Test 6: Default 3-Leg Sequence (BUY Leg 1 -> SELL Leg 2 from Leg 1 -> BUY Leg 3 Repurchase)
    legs_classic_default = [
        {'id': 'leg-1', 'type': 'BUY',  'date': '2026-03-01', 'shares': 100, 'price': 200.0},
        {'id': 'leg-2', 'type': 'SELL', 'date': '2026-03-15', 'shares': 100, 'price': 170.0, 'sold_from': 'leg-1'},
        {'id': 'leg-3', 'type': 'BUY',  'date': '2026-03-25', 'shares': 100, 'price': 175.0}
    ]
    res_default = calculate_multi_sell_buy_scenario(legs_classic_default)
    assert res_default['total_disallowed'] == 3000.0, f"Expected 3000 disallowed, got {res_default['total_disallowed']}"
    assert res_default['total_allowed'] == 0.0
    assert res_default['realized_gain_loss'] == 0.0
    
    b3 = [b for b in res_default['buys'] if b['id'] == 'leg-3'][0]
    assert b3['absorbed_disallowed'] == 3000.0
    assert (b3['price'] + b3['absorbed_disallowed'] / b3['absorbed_shares']) == 205.0
    print("✓ Test 6: Default 3-leg sequence (BUY $200 -> SELL $170 from Leg 1 -> BUY $175: basis $205) passed!")

    print("\nAll Multi-Sell & Multi-Buy tests passed successfully!")

if __name__ == '__main__':
    run_tests()
