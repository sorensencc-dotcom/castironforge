/**
 * Lightweight Popover API polyfill.
 * Covers: popover="auto", popover="manual", popovertarget, popovertargetaction,
 *         showPopover(), hidePopover(), togglePopover(), light-dismiss for "auto".
 * Does NOT emulate: top-layer promotion, CSS anchor positioning, :popover-open
 *   (use [data-popover-open] as a fallback selector in CSS instead).
 * Skips install when the browser supports the API natively.
 */
(function () {
  'use strict';

  if (typeof HTMLElement.prototype.showPopover === 'function') return;

  const OPEN_ATTR = 'data-popover-open';
  const openSet   = new Set();

  function isAutoPopover(el) {
    const v = el.getAttribute('popover');
    return v === 'auto' || v === '';
  }

  function dispatchToggle(el, newState) {
    el.dispatchEvent(new CustomEvent('toggle', {
      bubbles: false,
      detail:  { newState, oldState: newState === 'open' ? 'closed' : 'open' },
    }));
  }

  function showPopover(el) {
    if (el.hasAttribute(OPEN_ATTR)) return;
    if (isAutoPopover(el)) {
      // Light-dismiss any other open auto popovers (auto stack collapses).
      for (const other of [...openSet]) {
        if (isAutoPopover(other) && other !== el) hidePopover(other);
      }
    }
    el.removeAttribute('hidden');
    el.setAttribute(OPEN_ATTR, '');
    openSet.add(el);
    dispatchToggle(el, 'open');
  }

  function hidePopover(el) {
    if (!el.hasAttribute(OPEN_ATTR)) return;
    el.removeAttribute(OPEN_ATTR);
    el.setAttribute('hidden', '');
    openSet.delete(el);
    dispatchToggle(el, 'closed');
  }

  function togglePopover(el, force) {
    if (force === true)       { showPopover(el); return; }
    if (force === false)      { hidePopover(el); return; }
    el.hasAttribute(OPEN_ATTR) ? hidePopover(el) : showPopover(el);
  }

  HTMLElement.prototype.showPopover   = function ()      { showPopover(this); };
  HTMLElement.prototype.hidePopover   = function ()      { hidePopover(this); };
  HTMLElement.prototype.togglePopover = function (force) { togglePopover(this, force); };

  // ── Wire popovertarget triggers ─────────────────────────────────────────
  function wireButton(btn) {
    if (btn._polyfillWired) return;
    btn._polyfillWired = true;
    btn.addEventListener('click', e => {
      const targetId = btn.getAttribute('popovertarget');
      const action   = (btn.getAttribute('popovertargetaction') || 'toggle').toLowerCase();
      const target   = document.getElementById(targetId);
      if (!target) return;

      if (action === 'show')   showPopover(target);
      else if (action === 'hide') hidePopover(target);
      else                     togglePopover(target);

      // Sync aria-expanded on the trigger
      const isOpen = target.hasAttribute(OPEN_ATTR);
      btn.setAttribute('aria-expanded', String(isOpen));

      e.stopPropagation();
    });
  }

  function wireAll(root) {
    root.querySelectorAll('[popovertarget]').forEach(wireButton);
  }

  // ── Light dismiss on outside click for auto popovers ────────────────────
  document.addEventListener('click', e => {
    for (const popover of [...openSet]) {
      if (isAutoPopover(popover) && !popover.contains(e.target)) {
        const trigger = document.querySelector(`[popovertarget="${popover.id}"]`);
        if (trigger && trigger.contains(e.target)) continue;
        hidePopover(popover);
      }
    }
  }, true);

  // ── Keyboard: Escape closes topmost auto popover ─────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const toClose = [...openSet].filter(isAutoPopover).pop();
    if (toClose) { hidePopover(toClose); e.preventDefault(); }
  });

  // ── Initialise: hide all [popover] elements that aren't already open ─────
  function init() {
    document.querySelectorAll('[popover]').forEach(el => {
      if (!el.hasAttribute(OPEN_ATTR)) el.setAttribute('hidden', '');
    });
    wireAll(document);

    // Watch for dynamically added elements
    new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.hasAttribute('popover') && !n.hasAttribute(OPEN_ATTR)) {
            n.setAttribute('hidden', '');
          }
          if (n.hasAttribute('popovertarget')) wireButton(n);
          wireAll(n);
        });
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
