#!/usr/bin/env python3
"""
WashGuard Automated Test Suite
Verifies IRS 61-day window calculations, basis adjustments, partial lot allocations,
and crypto rule toggles.
"""

from datetime import datetime, timedelta, timezone

KNOWN_CRYPTO_SYMBOLS = {
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK'
}

def parse_date(date_str):
    return datetime.strptime(date_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)

def days_between(date_str1, date_str2):
    d1 = parse_date(date_str1)
    d2 = parse_date(date_str2)
    return (d2 - d1).days

def add_days(date_str, days):
    d = parse_date(date_str) + timedelta(days=days)
    return d.strftime("%Y-%m-%d")

def calculate_scenario(symbol, sale_date, shares_sold, sale_price, cost_basis_per_share,
                       repurchase_date, shares_repurchased, repurchase_price,
                       is_crypto_rules_enabled=False):
    symbol = symbol.strip().upper()
    is_crypto = symbol in KNOWN_CRYPTO_SYMBOLS

    raw_pl = (shares_sold * sale_price) - (shares_sold * cost_basis_per_share)
    raw_loss = abs(raw_pl) if raw_pl < -0.0001 else 0.0

    if is_crypto and not is_crypto_rules_enabled:
        return {
            'is_wash_sale': False,
            'is_crypto_exempt': True,
            'disallowed_loss': 0.0,
            'allowed_loss': raw_loss,
            'adjusted_basis_per_share': repurchase_price
        }

    if raw_loss <= 0.0:
        return {
            'is_wash_sale': False,
            'disallowed_loss': 0.0,
            'allowed_loss': 0.0,
            'adjusted_basis_per_share': repurchase_price
        }

    days_diff = days_between(sale_date, repurchase_date) if repurchase_date else None
    if days_diff is None or abs(days_diff) > 30:
        return {
            'is_wash_sale': False,
            'disallowed_loss': 0.0,
            'allowed_loss': raw_loss,
            'adjusted_basis_per_share': repurchase_price
        }

    wash_shares = min(shares_sold, shares_repurchased)
    fraction_disallowed = wash_shares / shares_sold
    disallowed_loss = raw_loss * fraction_disallowed
    allowed_loss = raw_loss - disallowed_loss
    loss_per_wash_share = disallowed_loss / wash_shares

    adjusted_basis_per_share = repurchase_price + loss_per_wash_share

    return {
        'is_wash_sale': True,
        'days_diff': days_diff,
        'wash_shares': wash_shares,
        'disallowed_loss': round(disallowed_loss, 2),
        'allowed_loss': round(allowed_loss, 2),
        'adjusted_basis_per_share': round(adjusted_basis_per_share, 2),
        'safe_repurchase_date': add_days(sale_date, 31)
    }

def run_tests():
    print("Running WashGuard Engine Verification Tests...")

    # Test 1: Standard 100% Wash Sale
    # Bought at $100, sold 100 shares at $80 on 2026-03-01 (Loss $2,000).
    # Repurchased 100 shares at $75 on 2026-03-15 (+14 days).
    t1 = calculate_scenario('AAPL', '2026-03-01', 100, 80.0, 100.0,
                            '2026-03-15', 100, 75.0)
    assert t1['is_wash_sale'] is True, "Test 1 failed: Should be wash sale"
    assert t1['disallowed_loss'] == 2000.0, f"Expected disallowed 2000, got {t1['disallowed_loss']}"
    assert t1['allowed_loss'] == 0.0, "Expected allowed 0"
    # Adjusted basis = $75 + ($2000 / 100) = $95.00
    assert t1['adjusted_basis_per_share'] == 95.0, f"Expected basis 95, got {t1['adjusted_basis_per_share']}"
    assert t1['safe_repurchase_date'] == '2026-04-01', f"Expected safe date 2026-04-01, got {t1['safe_repurchase_date']}"
    print("✓ Test 1 Passed: Classic 100% Wash Sale & Basis Adjustment")

    # Test 2: Pre-Wash Sale (Bought replacement 10 days BEFORE selling original at loss)
    t2 = calculate_scenario('MSFT', '2026-05-20', 50, 400.0, 450.0,
                            '2026-05-10', 50, 410.0)
    assert t2['is_wash_sale'] is True, "Test 2 failed: Pre-wash sale should trigger"
    assert t2['days_diff'] == -10, f"Expected -10 days, got {t2['days_diff']}"
    assert t2['disallowed_loss'] == 2500.0, f"Expected 2500 disallowed, got {t2['disallowed_loss']}"
    print("✓ Test 2 Passed: Pre-Wash Sale (-10 days before sale)")

    # Test 3: Partial Wash Sale (Sold 100 shares at loss, only rebought 40 shares)
    # Sold 100 shares @ $50 (basis $70) -> Total loss $2,000.
    # Rebought 40 shares @ $48 -> 40/100 = 40% disallowed = $800.
    # Allowed loss = $1,200.
    # Adjusted basis for 40 shares = $48 + ($800/40) = $48 + $20 = $68.
    t3 = calculate_scenario('NVDA', '2026-06-01', 100, 50.0, 70.0,
                            '2026-06-10', 40, 48.0)
    assert t3['is_wash_sale'] is True
    assert t3['disallowed_loss'] == 800.0, f"Expected 800 disallowed, got {t3['disallowed_loss']}"
    assert t3['allowed_loss'] == 1200.0, f"Expected 1200 allowed, got {t3['allowed_loss']}"
    assert t3['adjusted_basis_per_share'] == 68.0, f"Expected 68.0, got {t3['adjusted_basis_per_share']}"
    print("✓ Test 3 Passed: Partial Wash Sale (40% wash, 60% allowed loss)")

    # Test 4: Safe Repurchase (+31 days)
    t4 = calculate_scenario('AMZN', '2026-01-01', 100, 150.0, 180.0,
                            '2026-02-01', 100, 155.0)
    assert t4['is_wash_sale'] is False, "Test 4 failed: +31 days should be safe"
    assert t4['disallowed_loss'] == 0.0
    assert t4['allowed_loss'] == 3000.0
    print("✓ Test 4 Passed: Safe Repurchase at +31 days (No Wash Sale)")

    # Test 5: Crypto Rules Toggle
    # Case A: Crypto rule OFF (Current IRS rule) -> Exempt from wash sale
    t5a = calculate_scenario('BTC', '2026-08-01', 1, 50000.0, 60000.0,
                             '2026-08-05', 1, 51000.0, is_crypto_rules_enabled=False)
    assert t5a['is_wash_sale'] is False, "Crypto should be exempt when toggle is off"
    assert t5a['disallowed_loss'] == 0.0
    assert t5a['allowed_loss'] == 10000.0

    # Case B: Crypto rule ON (Prospective experimental rule) -> Wash sale triggers
    t5b = calculate_scenario('BTC', '2026-08-01', 1, 50000.0, 60000.0,
                             '2026-08-05', 1, 51000.0, is_crypto_rules_enabled=True)
    assert t5b['is_wash_sale'] is True, "Crypto should trigger wash sale when toggle is on"
    assert t5b['disallowed_loss'] == 10000.0
    assert t5b['adjusted_basis_per_share'] == 61000.0
    print("✓ Test 5 Passed: Cryptocurrency Exemption & Experimental Toggle")

    print("\n🎉 ALL 5 VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
