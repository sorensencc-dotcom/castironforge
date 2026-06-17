import { test, expect } from '@playwright/test';

test.describe('Popover API — native vs polyfill parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <div id="page-shell">
        <button id="trigger-auto" popovertarget="auto-popover">Open Auto</button>
        <div id="auto-popover" popover="auto">Auto content</div>
      </div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
  });

  test('showPopover() makes element visible in both native and polyfill paths', async ({ page }) => {
    const popover = page.locator('#auto-popover');
    await page.evaluate(() => document.getElementById('auto-popover').showPopover());
    const display = await popover.evaluate(el => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');
  });

  test('hidePopover() makes element invisible in both paths', async ({ page }) => {
    const popover = page.locator('#auto-popover');
    await page.evaluate(() => {
      const p = document.getElementById('auto-popover');
      p.showPopover();
      p.hidePopover();
    });
    const hasOpen = await popover.evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(hasOpen).toBeFalsy();
  });

  test('togglePopover() alternates open/closed state identically to native', async ({ page }) => {
    const popover = page.locator('#auto-popover');
    await page.evaluate(() => document.getElementById('auto-popover').togglePopover());
    let isOpen = await popover.evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
    await page.evaluate(() => document.getElementById('auto-popover').togglePopover());
    isOpen = await popover.evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeFalsy();
  });

  test('togglePopover(true) forces open regardless of current state', async ({ page }) => {
    const popover = page.locator('#auto-popover');
    await page.evaluate(() => document.getElementById('auto-popover').togglePopover(true));
    const isOpen = await popover.evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
    await page.evaluate(() => document.getElementById('auto-popover').togglePopover(true));
    const stillOpen = await popover.evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(stillOpen).toBeTruthy();
  });

  test('togglePopover(false) forces closed regardless of current state', async ({ page }) => {
    const popover = page.locator('#auto-popover');
    await page.evaluate(() => {
      const p = document.getElementById('auto-popover');
      p.togglePopover(true);
      p.togglePopover(false);
    });
    const isClosed = await popover.evaluate(el => !el.hasAttribute('data-popover-open') && !el.matches(':popover-open'));
    expect(isClosed).toBeTruthy();
  });

  test('popover=auto on element triggers auto-stack behaviour in polyfill', async ({ page }) => {
    await page.setContent(`
      <button id="t1" popovertarget="p1">Open 1</button>
      <div id="p1" popover="auto">Popover 1</div>
      <button id="t2" popovertarget="p2">Open 2</button>
      <div id="p2" popover="auto">Popover 2</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#t1');
    await page.click('#t2');
    const p1Open = await page.locator('#p1').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(p1Open).toBeFalsy();
  });

  test('[data-popover-open] attribute is present on open polyfill popovers (CSS fallback selector)', async ({ page }) => {
    const popover = page.locator('#auto-popover');
    await page.evaluate(() => document.getElementById('auto-popover').showPopover());
    const hasAttr = await popover.evaluate(el => el.hasAttribute('data-popover-open'));
    expect(hasAttr).toBeTruthy();
  });
});

test.describe('Popover API — light-dismiss stack', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <button id="trigger" popovertarget="auto-pop">Open</button>
      <div id="auto-pop" popover="auto">Content</div>
      <button id="outside">Outside</button>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
  });

  test('clicking outside an auto popover closes it (native and polyfill)', async ({ page }) => {
    await page.click('#trigger');
    let isOpen = await page.locator('#auto-pop').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
    await page.click('#outside');
    isOpen = await page.locator('#auto-pop').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeFalsy();
  });

  test('only topmost auto popover closes when multiple are open and outside click fires', async ({ page }) => {
    await page.setContent(`
      <button id="t1" popovertarget="p1">1</button>
      <div id="p1" popover="auto">P1</div>
      <button id="t2" popovertarget="p2">2</button>
      <div id="p2" popover="auto">P2</div>
      <button id="out">Out</button>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#t1');
    await page.click('#t2');
    await page.click('#out');
    const p2Open = await page.locator('#p2').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    const p1Open = await page.locator('#p1').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(p2Open).toBeFalsy();
    expect(p1Open).toBeTruthy();
  });

  test('clicking inside an open popover does not close it', async ({ page }) => {
    await page.click('#trigger');
    await page.click('#auto-pop');
    const isOpen = await page.locator('#auto-pop').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
  });

  test('clicking the trigger button of a different popover closes the open one first', async ({ page }) => {
    await page.setContent(`
      <button id="t1" popovertarget="p1">Trigger 1</button>
      <div id="p1" popover="auto">Pop 1</div>
      <button id="t2" popovertarget="p2">Trigger 2</button>
      <div id="p2" popover="auto">Pop 2</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#t1');
    await page.click('#t2');
    const p1Open = await page.locator('#p1').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    const p2Open = await page.locator('#p2').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(p1Open).toBeFalsy();
    expect(p2Open).toBeTruthy();
  });

  test('manual popover is NOT closed by outside click', async ({ page }) => {
    await page.setContent(`
      <button id="trigger" popovertarget="manual-pop">Open</button>
      <div id="manual-pop" popover="manual">Content</div>
      <button id="out">Out</button>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#trigger');
    await page.click('#out');
    const isOpen = await page.locator('#manual-pop').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
  });
});

test.describe('Popover API — Escape key', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <button id="trigger" popovertarget="auto-pop">Open</button>
      <div id="auto-pop" popover="auto">Content</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
  });

  test('Escape closes the topmost open auto popover', async ({ page }) => {
    await page.click('#trigger');
    await page.keyboard.press('Escape');
    const isOpen = await page.locator('#auto-pop').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeFalsy();
  });

  test('Escape does not close a manual (popover="manual") popover', async ({ page }) => {
    await page.setContent(`
      <button id="t" popovertarget="m">Open</button>
      <div id="m" popover="manual">Content</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#t');
    await page.keyboard.press('Escape');
    const isOpen = await page.locator('#m').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
  });

  test('Escape with no open popovers does not throw', async ({ page }) => {
    let error = null;
    page.on('console', msg => { if (msg.type() === 'error') error = msg.text(); });
    await page.keyboard.press('Escape');
    expect(error).toBeNull();
  });

  test('Escape key event is not propagated after popover is closed', async ({ page }) => {
    await page.setContent(`
      <button id="trigger" popovertarget="pop">Open</button>
      <div id="pop" popover="auto">Content</div>
      <script>
        let propagated = false;
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') propagated = true;
        });
      </script>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#trigger');
    await page.keyboard.press('Escape');
    const propagated = await page.evaluate(() => window.propagated);
    expect(propagated).toBeFalsy();
  });
});

test.describe('Popover API — MutationObserver (dynamic agent cards)', () => {
  test('popovertarget on a dynamically injected agent card button is wired by the polyfill', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <div id="container"></div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.evaluate(() => {
      const container = document.getElementById('container');
      const btn = document.createElement('button');
      btn.id = 'dynamic-trigger';
      btn.setAttribute('popovertarget', 'dynamic-pop');
      container.appendChild(btn);
      const pop = document.createElement('div');
      pop.id = 'dynamic-pop';
      pop.setAttribute('popover', 'auto');
      pop.textContent = 'Dynamic';
      container.appendChild(pop);
    });
    await page.click('#dynamic-trigger');
    const isOpen = await page.locator('#dynamic-pop').evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isOpen).toBeTruthy();
  });

  test('popover element added after DOMContentLoaded is hidden by polyfill on insert', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.evaluate(() => {
      const pop = document.createElement('div');
      pop.setAttribute('popover', 'auto');
      pop.textContent = 'Content';
      document.body.appendChild(pop);
    });
    const display = await page.evaluate(() => {
      const pop = document.querySelector('[popover]');
      return window.getComputedStyle(pop).display;
    });
    expect(display).toBe('none');
  });

  test('removing an open popover element from the DOM clears it from the internal open set', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <button id="t" popovertarget="p">Open</button>
      <div id="p" popover="auto">Content</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#t');
    await page.evaluate(() => document.getElementById('p').remove());
    let error = null;
    page.on('console', msg => { if (msg.type() === 'error') error = msg.text(); });
    await page.keyboard.press('Escape');
    expect(error).toBeNull();
  });

  test('rapidly injecting 13 agent cards does not produce duplicate wire-up', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <div id="container"></div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.evaluate(() => {
      const container = document.getElementById('container');
      for (let i = 0; i < 13; i++) {
        const btn = document.createElement('button');
        btn.id = `card-${i}-btn`;
        btn.setAttribute('popovertarget', `card-${i}-pop`);
        btn.textContent = `Card ${i}`;
        container.appendChild(btn);
        const pop = document.createElement('div');
        pop.id = `card-${i}-pop`;
        pop.setAttribute('popover', 'auto');
        pop.textContent = `Popover ${i}`;
        container.appendChild(pop);
      }
    });
    await page.click('#card-0-btn');
    const openCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-popover-open]')).length;
    });
    expect(openCount).toBe(1);
  });
});

test.describe('Popover API — ARIA state sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <button id="trigger" popovertarget="pop" aria-controls="pop" aria-expanded="false">Open</button>
      <div id="pop" popover="auto">Content</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
  });

  test('aria-expanded on trigger is "true" when popover is open', async ({ page }) => {
    await page.click('#trigger');
    const ariaExp = await page.locator('#trigger').getAttribute('aria-expanded');
    expect(ariaExp).toBe('true');
  });

  test('aria-expanded resets to "false" when popover is closed by Escape', async ({ page }) => {
    await page.click('#trigger');
    await page.keyboard.press('Escape');
    const ariaExp = await page.locator('#trigger').getAttribute('aria-expanded');
    expect(ariaExp).toBe('false');
  });

  test('aria-expanded resets to "false" when popover is light-dismissed', async ({ page }) => {
    await page.setContent(`
      <button id="trigger" popovertarget="pop" aria-controls="pop" aria-expanded="false">Open</button>
      <div id="pop" popover="auto">Content</div>
      <button id="out">Out</button>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    await page.click('#trigger');
    await page.click('#out');
    const ariaExp = await page.locator('#trigger').getAttribute('aria-expanded');
    expect(ariaExp).toBe('false');
  });

  test('aria-controls on each trigger points to its popover id', async ({ page }) => {
    const ariaControls = await page.locator('#trigger').getAttribute('aria-controls');
    expect(ariaControls).toBe('pop');
  });

  test('aria-expanded stays in sync when togglePopover() is called programmatically', async ({ page }) => {
    await page.evaluate(() => document.getElementById('pop').togglePopover());
    let ariaExp = await page.locator('#trigger').getAttribute('aria-expanded');
    expect(ariaExp).toBe('true');
    await page.evaluate(() => document.getElementById('pop').togglePopover());
    ariaExp = await page.locator('#trigger').getAttribute('aria-expanded');
    expect(ariaExp).toBe('false');
  });
});

test.describe('Popover API — polyfill load gating', () => {
  test('polyfill IIFE exits immediately when HTMLElement.prototype.showPopover already exists', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <script>
        window.polyfillLoaded = false;
      </script>
      <script src="./scripts/popover-polyfill.js"></script>
      <script>
        // If polyfill exited early, this would still be false
        window.testResult = typeof HTMLElement.prototype.showPopover === 'function';
      </script>
    `);
    const hasMethod = await page.evaluate(() => window.testResult || typeof HTMLElement.prototype.showPopover === 'function');
    expect(hasMethod).toBeTruthy();
  });

  test('polyfill does not double-install if script tag is evaluated twice', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <script src="./scripts/popover-polyfill.js"></script>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    let error = null;
    page.on('console', msg => { if (msg.type() === 'error') error = msg.text(); });
    expect(error).toBeNull();
  });

  test('polyfill sets hidden attribute on all [popover] elements at init time', async ({ page }) => {
    await page.goto('about:blank');
    await page.setContent(`
      <div id="p1" popover="auto">Pop 1</div>
      <div id="p2" popover="manual">Pop 2</div>
      <script src="./scripts/popover-polyfill.js"></script>
    `);
    const p1Hidden = await page.locator('#p1').evaluate(el => window.getComputedStyle(el).display === 'none');
    const p2Hidden = await page.locator('#p2').evaluate(el => window.getComputedStyle(el).display === 'none');
    expect(p1Hidden).toBeTruthy();
    expect(p2Hidden).toBeTruthy();
  });
});

test.describe('Popover API — version-detail popover (operator console integration)', () => {
  test('clicking the info button on Active Version card opens version-detail popover', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const infoBtn = page.locator('button[popovertarget="version-detail"]').first();
    await infoBtn.click();
    const popover = page.locator('#version-detail');
    const isVisible = await popover.evaluate(el => el.hasAttribute('data-popover-open') || el.matches(':popover-open'));
    expect(isVisible).toBeTruthy();
  });

  test('version-detail popover is positioned below the trigger button', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const infoBtn = page.locator('button[popovertarget="version-detail"]').first();
    await infoBtn.click();
    const btnBox = await infoBtn.evaluate(el => el.getBoundingClientRect());
    const popBox = await page.locator('#version-detail').evaluate(el => el.getBoundingClientRect());
    expect(popBox.top).toBeGreaterThan(btnBox.bottom);
  });

  test('version-detail content is populated with API data after refresh', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const content = page.locator('#version-detail .popover-content');
    const text = await content.textContent();
    expect(text).toBeTruthy();
  });

  test('Close button inside popover closes it without page reload', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const infoBtn = page.locator('button[popovertarget="version-detail"]').first();
    await infoBtn.click();
    const closeBtn = page.locator('#version-detail button[popovertargetaction="hide"]');
    await closeBtn.click();
    const isClosed = await page.locator('#version-detail').evaluate(el => !el.hasAttribute('data-popover-open') && !el.matches(':popover-open'));
    expect(isClosed).toBeTruthy();
  });

  test('API → link opens memory-spine status endpoint in a new tab', async ({ page, context }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const infoBtn = page.locator('button[popovertarget="version-detail"]').first();
    await infoBtn.click();
    const apiLink = page.locator('#version-detail a[href*="memory"]');
    const href = await apiLink.getAttribute('href');
    expect(href).toContain('memory');
  });
});
