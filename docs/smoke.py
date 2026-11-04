"""Run with: python -m http.server 8765 and python tests/smoke.py"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8765/',wait_until='domcontentloaded')
    for name in ['explorer','table','paths','patterns','learn','daily','about','profile']:
        page.locator(f'.topbar [data-page="{name}"]').click() if name in ['explorer','paths','patterns','learn','about','profile'] else page.locator(f'.sidebar [data-page="{name}"]').click()
        assert page.locator(f'.page[data-page="{name}"]').is_visible(),name
    page.locator('.sidebar [data-page="table"]').click()
    page.locator('#structure-search').fill('sternum')
    assert page.locator('.table-row').count()>0
    page.locator('.table-row').first.click()
    assert page.locator('#detail-card h2').is_visible()
    page.locator('.sidebar [data-page="patterns"]').click()
    assert page.locator('#pattern-flower circle').count()>=19
    page.locator('.sidebar [data-page="learn"]').click()
    before=page.locator('#flashcard-text').inner_text()
    page.locator('#flashcard').click()
    assert page.locator('#flashcard-text').inner_text()!=before
    page.locator('.sidebar [data-page="paths"]').click()
    before=page.locator('#path-step-title').inner_text()
    page.locator('#path-next').click()
    assert page.locator('#path-step-title').inner_text()!=before
    page.locator('.sidebar [data-page="home"]').click()
    page.screenshot(path='docs/browser-preview.png',full_page=True)
    assert not errors, errors
    print('All interactive smoke checks passed.')
    browser.close()
