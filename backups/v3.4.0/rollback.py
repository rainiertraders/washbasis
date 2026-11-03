#!/usr/bin/env python3
"""
WashGuard Rollback Utility
Enables instant rollback to verified versions:
- v2.9.0: Streamlined full-page scenario simulator (Batch removed, tab bar removed)
- v2.8.0: Dual-tab version (Scenario Simulator + Batch CSV Analyzer)
"""
import os
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUPS_DIR = os.path.join(BASE_DIR, 'backups')

VERSIONS = {
    'v3.4.0': 'Option D: Discreet Compliance Note in Calculation Summary card + clean top header area (zero eye-catching alert banner)',
    'v3.3.0': 'Restored TradingView affiliate banner, Education disclaimer, 3-column bottom guide (About, 61-Day Rule, Legal Disclaimer), and removed all IRC 1091 mentions',
    'v3.2.0': 'Collision-free 61-day Statutory Timeline Horizon (3-layer anti-collision architecture, unified +30d/+31d boundary milestone, adaptive stalk heights)',
    'v3.1.0': 'Option 1B Institutional Prime Brokerage (Matching Option 1A layout with executive styling & live 1A/1B switcher)',
    'v3.0.0': 'Option 1A Institutional Light Theme (Wall Street Terminal aesthetic, 61-day timeline visualizer, zero non-calculator wordings)',
    'v2.9.0': 'Streamlined single-page Scenario Simulator (No Batch tab, clean full-page layout, accurate wash logic)',
    'v2.8.0': 'Dual-tab version (Accurate wash logic + Batch & CSV Analyzer tab)'
}

def list_versions():
    print("Available WashGuard Versions for Rollback:")
    for v, desc in VERSIONS.items():
        vpath = os.path.join(BACKUPS_DIR, v)
        status = "✓ Ready" if os.path.exists(vpath) else "✗ Missing"
        print(f"  • {v} [{status}]: {desc}")
    print("\nUsage:")
    print("  python3 rollback.py [version]   (e.g., python3 rollback.py v3.1.0)")

def rollback(target_version='v3.1.0'):
    if target_version in ['list', '--list', '-l']:
        list_versions()
        return

    snapshot_dir = os.path.join(BACKUPS_DIR, target_version)
    if not os.path.exists(snapshot_dir):
        print(f"Error: Version '{target_version}' not found in {BACKUPS_DIR}.")
        list_versions()
        sys.exit(1)

    print(f"Restoring WashGuard to {target_version} ({VERSIONS.get(target_version, '')})...")
    for item in os.listdir(snapshot_dir):
        if item in ['backups', 'rollback.py']:
            continue
        src = os.path.join(snapshot_dir, item)
        dst = os.path.join(BASE_DIR, item)
        if os.path.isdir(src):
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
        print(f"  ✓ Restored: {item}")

    print()
    print(f"🎉 Successfully rolled back to WashGuard {target_version}!")
    print("Run `python3 tests/test_multi_sell_buy.py` to verify unit test passing.")

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'v3.1.0'
    rollback(target)
