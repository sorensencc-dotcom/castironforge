// TODO: Activate by installing Playwright and a test browser:
//   npm install -D @playwright/test && npx playwright install chromium
// Then replace test.todo() with async ({ page }) => { ... } bodies.
// Run with --native flag to test native path, --polyfill to force-load the polyfill.
import { test, describe } from 'node:test';

describe('Popover API — native vs polyfill parity', () => {
  test.todo('showPopover() makes element visible in both native and polyfill paths');
  test.todo('hidePopover() makes element invisible in both paths');
  test.todo('togglePopover() alternates open/closed state identically to native');
  test.todo('togglePopover(true) forces open regardless of current state');
  test.todo('togglePopover(false) forces closed regardless of current state');
  test.todo('popover=auto on element triggers auto-stack behaviour in polyfill');
  test.todo('[data-popover-open] attribute is present on open polyfill popovers (CSS fallback selector)');
});

describe('Popover API — light-dismiss stack', () => {
  test.todo('clicking outside an auto popover closes it (native and polyfill)');
  test.todo('only topmost auto popover closes when multiple are open and outside click fires');
  test.todo('clicking inside an open popover does not close it');
  test.todo('clicking the trigger button of a different popover closes the open one first');
  test.todo('manual popover is NOT closed by outside click');
});

describe('Popover API — Escape key', () => {
  test.todo('Escape closes the topmost open auto popover');
  test.todo('Escape does not close a manual (popover="manual") popover');
  test.todo('Escape with no open popovers does not throw');
  test.todo('Escape key event is not propagated after popover is closed');
});

describe('Popover API — MutationObserver (dynamic agent cards)', () => {
  test.todo('popovertarget on a dynamically injected agent card button is wired by the polyfill');
  test.todo('popover element added after DOMContentLoaded is hidden by polyfill on insert');
  test.todo('removing an open popover element from the DOM clears it from the internal open set');
  test.todo('rapidly injecting 13 agent cards does not produce duplicate wire-up');
});

describe('Popover API — ARIA state sync', () => {
  test.todo('aria-expanded on trigger is "true" when popover is open');
  test.todo('aria-expanded resets to "false" when popover is closed by Escape');
  test.todo('aria-expanded resets to "false" when popover is light-dismissed');
  test.todo('aria-controls on each trigger points to its popover id');
  test.todo('aria-expanded stays in sync when togglePopover() is called programmatically');
});

describe('Popover API — polyfill load gating', () => {
  test.todo('polyfill IIFE exits immediately when HTMLElement.prototype.showPopover already exists');
  test.todo('polyfill does not double-install if script tag is evaluated twice');
  test.todo('polyfill sets hidden attribute on all [popover] elements at init time');
});

describe('Popover API — version-detail popover (operator console integration)', () => {
  test.todo('clicking the info button on Active Version card opens version-detail popover');
  test.todo('version-detail popover is positioned below the trigger button');
  test.todo('version-detail content is populated with API data after refresh');
  test.todo('Close button inside popover closes it without page reload');
  test.todo('API → link opens memory-spine status endpoint in a new tab');
});
