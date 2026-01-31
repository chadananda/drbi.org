#!/usr/bin/env python3
"""View the events page and capture screenshots"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to events page
    page.goto('http://localhost:4321/events')
    page.wait_for_load_state('networkidle')

    # Take full page screenshot
    page.screenshot(path='/tmp/events_page.png', full_page=True)
    print("✅ Screenshot saved to /tmp/events_page.png")

    # Check for any recurring events
    events = page.locator('.event-calendar .event-list-full-item, .event-calendar article').all()
    print(f"\n📊 Found {len(events)} event cards on the page")

    # Check for minimal/recurring indicators
    minimal_events = page.locator('.minimal-event, .recurring-card-badge').all()
    if minimal_events:
        print(f"🔄 Found {len(minimal_events)} recurring/minimal event indicators")

    browser.close()
