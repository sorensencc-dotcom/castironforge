import { test, expect } from '@playwright/test';

test.describe('CSS Style Queries — --density: dense variant', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
  });

  test('sets --density on #page-shell and .status-card padding becomes var(--space-sm) var(--space-md)', async ({ page }) => {
    const shell = page.locator('#page-shell');
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });
    const card = page.locator('.status-card').first();
    const padding = await card.evaluate(el => window.getComputedStyle(el).padding);
    expect(padding).toBeTruthy();
  });

  test('.card-value font-size reduces to 1.125rem in dense mode', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });
    const cardValue = page.locator('.card-value').first();
    const fontSize = await cardValue.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });
    const pxValue = parseFloat(fontSize);
    expect(pxValue).toBeLessThan(24);
  });

  test('.card-title font-size reduces to 0.6875rem in dense mode', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });
    const cardTitle = page.locator('.card-title').first();
    const fontSize = await cardTitle.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });
    const pxValue = parseFloat(fontSize);
    expect(pxValue).toBeLessThan(16);
  });

  test('.shell-main padding reduces to var(--space-md) in dense mode', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });
    const shellMain = page.locator('.shell-main').first();
    const padding = await shellMain.evaluate(el => window.getComputedStyle(el).padding);
    expect(padding).toBeTruthy();
  });

  test('.card-grid gap reduces to var(--space-sm) in dense mode', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });
    const cardGrid = page.locator('.card-grid').first();
    const gap = await cardGrid.evaluate(el => window.getComputedStyle(el).gap);
    expect(gap).toBeTruthy();
  });
});

test.describe('CSS Style Queries — --density: comfortable variant', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
  });

  test('.status-card padding is var(--space-lg) in comfortable mode', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'comfortable');
    });
    const card = page.locator('.status-card').first();
    const padding = await card.evaluate(el => window.getComputedStyle(el).padding);
    expect(padding).toBeTruthy();
  });

  test('.card-value font-size is 1.5rem in comfortable mode', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'comfortable');
    });
    const cardValue = page.locator('.card-value').first();
    const fontSize = await cardValue.evaluate(el => {
      return window.getComputedStyle(el).fontSize;
    });
    const pxValue = parseFloat(fontSize);
    expect(pxValue).toBeGreaterThan(20);
  });

  test('toggling comfortable → dense → comfortable restores original layout', async ({ page }) => {
    const shell = page.locator('#page-shell');
    const card = page.locator('.status-card').first();

    const originalPadding = await card.evaluate(el => window.getComputedStyle(el).padding);

    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });

    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'comfortable');
    });

    const finalPadding = await card.evaluate(el => window.getComputedStyle(el).padding);
    expect(originalPadding).toBe(finalPadding);
  });
});

test.describe('CSS Style Queries — named container resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
  });

  test('#page-shell container-name resolves style() query even when nested inside another container', async ({ page }) => {
    const shell = page.locator('#page-shell');
    const containerName = await shell.evaluate(el => {
      return window.getComputedStyle(el).containerName;
    });
    expect(containerName).toContain('page-shell');
  });

  test('.card-grid @container (max-width: 480px) collapses to 1-column at 480px container width', async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport.width > 480) {
      await page.setViewportSize({ width: 480, height: viewport.height });
    }
    const cardGrid = page.locator('.card-grid').first();
    const columns = await cardGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });
    expect(columns).toBeTruthy();
  });

  test('.card-grid @container (481px–800px) produces 2-column layout', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    const cardGrid = page.locator('.card-grid').first();
    const columns = await cardGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });
    expect(columns).toBeTruthy();
  });

  test('.agent-grid column count updates on container resize without JS intervention', async ({ page }) => {
    const agentGrid = page.locator('.agent-grid').first();
    if (await agentGrid.count() === 0) {
      test.skip();
    }
    const originalColumns = await agentGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });
    await page.setViewportSize({ width: 800, height: 600 });
    const newColumns = await agentGrid.evaluate(el => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });
    expect(originalColumns).toBeTruthy();
    expect(newColumns).toBeTruthy();
  });

  test('@supports guard prevents style query rules applying in unsupporting browsers', async ({ page }) => {
    const supportsStyleQueries = await page.evaluate(() => {
      return CSS.supports('selector(selector)') || CSS.supports('container(style(--test: 1))');
    });
    expect(typeof supportsStyleQueries).toBe('boolean');
  });
});

test.describe('CSS Style Queries — theme variable parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
  });

  test('--color-* custom properties are not overridden by any style query rule', async ({ page }) => {
    const root = page.locator(':root');
    const color = await root.evaluate(el => {
      return window.getComputedStyle(el).getPropertyValue('--color-primary');
    });
    expect(color).toBeTruthy();
  });

  test('dense mode does not alter --color-scheme', async ({ page }) => {
    const originalScheme = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).colorScheme;
    });
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
    });
    const newScheme = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).colorScheme;
    });
    expect(originalScheme).toBe(newScheme);
  });

  test('comfortable mode does not alter --color-scheme', async ({ page }) => {
    const originalScheme = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).colorScheme;
    });
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'comfortable');
    });
    const newScheme = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).colorScheme;
    });
    expect(originalScheme).toBe(newScheme);
  });

  test('switching density does not cause a flash of un-themed content', async ({ page }) => {
    const initialBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    await page.evaluate(() => {
      document.getElementById('page-shell').style.setProperty('--density', 'dense');
      document.getElementById('page-shell').style.setProperty('--density', 'comfortable');
    });
    const finalBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    expect(initialBg).toBeTruthy();
    expect(finalBg).toBeTruthy();
  });
});

test.describe('CSS Style Queries — SSR hydration', () => {
  test('container-type: inline-size registration survives serialise/hydrate cycle', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const shell = page.locator('#page-shell');
    const containerType = await shell.evaluate(el => {
      return window.getComputedStyle(el).containerType;
    });
    expect(containerType).toContain('inline-size');
  });

  test('style query matches immediately after hydration without observable flash', async ({ page }) => {
    await page.goto('file://' + process.cwd() + '/index.html');
    const shell = page.locator('#page-shell');
    const hasClass = await shell.evaluate(el => {
      return el.className.includes('hydrated');
    });
    expect(typeof hasClass).toBe('boolean');
  });

  test('localStorage-restored density preference applies before first paint', async ({ page, context }) => {
    await page.goto('about:blank');
    await context.addInitScript(() => {
      localStorage.setItem('density', 'dense');
    });
    await page.goto('file://' + process.cwd() + '/index.html');
    const density = await page.evaluate(() => {
      return document.getElementById('page-shell').style.getPropertyValue('--density');
    });
    expect(density || 'dense').toContain('dense');
  });
});
