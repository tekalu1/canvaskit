/**
 * Generates a `<script>` block to inject into preview HTML for
 * bidirectional node selection between VS Code extension and preview iframe.
 *
 * Features:
 * - Click on `[data-node-id]` elements → blue outline overlay + postMessage
 * - Hover → semi-transparent blue highlight
 * - Receive `canvaskit:selectNode` → overlay + scrollIntoView
 * - Overlay uses position:fixed divs (no element style mutation)
 * - Recalculates on scroll/resize
 * - Sends `canvaskit:ready` on load
 */
export function getSelectionOverlayScript(): string {
  return `<script>
(function() {
  'use strict';

  // --- Overlay elements ---
  var hoverOverlay = document.createElement('div');
  hoverOverlay.id = '__ck_hover';
  hoverOverlay.style.cssText =
    'position:fixed;pointer-events:none;z-index:99998;' +
    'border:2px solid rgba(59,130,246,0.5);background:rgba(59,130,246,0.08);' +
    'display:none;transition:all 60ms ease;box-sizing:border-box;';

  var selectOverlay = document.createElement('div');
  selectOverlay.id = '__ck_select';
  selectOverlay.style.cssText =
    'position:fixed;pointer-events:none;z-index:99999;' +
    'border:2px solid #3b82f6;background:rgba(59,130,246,0.12);' +
    'display:none;box-sizing:border-box;';

  var labelEl = document.createElement('div');
  labelEl.style.cssText =
    'position:absolute;top:-20px;left:-1px;font:11px/16px system-ui,sans-serif;' +
    'color:#fff;background:#3b82f6;padding:0 6px;border-radius:3px 3px 0 0;' +
    'white-space:nowrap;pointer-events:none;';
  selectOverlay.appendChild(labelEl);

  document.body.appendChild(hoverOverlay);
  document.body.appendChild(selectOverlay);

  // --- State ---
  var selectedNodeId = null;
  var selectedEl = null;
  var hoveredEl = null;

  // --- Helpers ---
  function findNodeEl(el) {
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.nodeId) return el;
      el = el.parentElement;
    }
    return null;
  }

  function positionOverlay(overlay, el) {
    if (!el) { overlay.style.display = 'none'; return; }
    var r = el.getBoundingClientRect();
    overlay.style.left   = r.left   + 'px';
    overlay.style.top    = r.top    + 'px';
    overlay.style.width  = r.width  + 'px';
    overlay.style.height = r.height + 'px';
    overlay.style.display = 'block';
  }

  function updateOverlays() {
    if (hoveredEl && document.body.contains(hoveredEl)) {
      positionOverlay(hoverOverlay, hoveredEl);
    } else {
      hoverOverlay.style.display = 'none';
      hoveredEl = null;
    }
    if (selectedEl && document.body.contains(selectedEl)) {
      positionOverlay(selectOverlay, selectedEl);
    } else {
      selectOverlay.style.display = 'none';
      selectedEl = null;
      selectedNodeId = null;
    }
  }

  var SEL_STORAGE_KEY = '__ck_selected_node';

  function selectNode(nodeId, skipScroll) {
    selectedNodeId = nodeId;
    // Persist selection across reloads
    try {
      if (nodeId) sessionStorage.setItem(SEL_STORAGE_KEY, nodeId);
      else sessionStorage.removeItem(SEL_STORAGE_KEY);
    } catch(e) {}

    if (!nodeId) {
      selectedEl = null;
      selectOverlay.style.display = 'none';
      labelEl.textContent = '';
      return;
    }
    var el = document.querySelector('[data-node-id="' + CSS.escape(nodeId) + '"]');
    if (!el) return;
    selectedEl = el;
    labelEl.textContent = nodeId;
    positionOverlay(selectOverlay, el);
    if (!skipScroll) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }

  function postMsg(msg) {
    window.parent.postMessage(msg, '*');
  }

  // --- Event listeners ---

  // Hover
  document.addEventListener('mousemove', function(e) {
    // Suppress hover during pan
    if (window.__ck_nav && (window.__ck_nav._isPanning || window.__ck_nav._spaceDown)) {
      if (hoveredEl) { hoveredEl = null; hoverOverlay.style.display = 'none'; }
      return;
    }
    var el = findNodeEl(e.target);
    if (el === hoveredEl) return;
    hoveredEl = el;
    if (el && el !== selectedEl) {
      positionOverlay(hoverOverlay, el);
    } else {
      hoverOverlay.style.display = 'none';
    }
  }, true);

  document.addEventListener('mouseleave', function() {
    hoveredEl = null;
    hoverOverlay.style.display = 'none';
  });

  // Click — use capture phase for selection but do NOT stopPropagation
  // so that other handlers (context menu close, drag, etc.) still fire.
  document.addEventListener('click', function(e) {
    // Ignore clicks on overlay elements themselves
    if (e.target === hoverOverlay || e.target === selectOverlay) return;
    // Ignore clicks on UI elements (toolbar, props panel, context menu, resize handles)
    var uiCheck = e.target;
    while (uiCheck && uiCheck !== document.body) {
      if (uiCheck.id && uiCheck.id.indexOf('__ck_') === 0 && uiCheck.id !== '__ck_canvas') return;
      if (uiCheck.className === '__ck_resize_handle') return;
      uiCheck = uiCheck.parentElement;
    }
    // Ignore clicks when panning (space+drag or middle mouse)
    if (window.__ck_nav && window.__ck_nav._wasPanning) {
      window.__ck_nav._wasPanning = false;
      return;
    }

    var el = findNodeEl(e.target);
    if (el) {
      e.preventDefault();
      // Do NOT call e.stopPropagation() — let event bubble for context menu close, etc.
      var nodeId = el.dataset.nodeId;
      selectNode(nodeId);
      postMsg({ type: 'canvaskit:nodeClicked', nodeId: nodeId });
    } else {
      // Clear selection
      selectNode(null);
      postMsg({ type: 'canvaskit:selectionCleared' });
    }
  }, true);

  // Scroll / Resize / Canvas transform
  window.addEventListener('scroll', updateOverlays, true);
  window.addEventListener('resize', updateOverlays);
  window.addEventListener('__ck_transform', updateOverlays);

  // Incoming messages from extension
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || typeof msg.type !== 'string') return;
    if (!msg.type.startsWith('canvaskit:')) return;

    if (msg.type === 'canvaskit:selectNode' && msg.nodeId) {
      selectNode(msg.nodeId);
    } else if (msg.type === 'canvaskit:clearSelection') {
      selectNode(null);
    }
  });

  // Restore selection from previous session (after hot reload)
  try {
    var restoredId = sessionStorage.getItem(SEL_STORAGE_KEY);
    if (restoredId) {
      // Use requestAnimationFrame to let the DOM settle after reload
      requestAnimationFrame(function() {
        selectNode(restoredId, true); // skipScroll = true to avoid view jump
        // Notify editor UI of restored selection
        postMsg({ type: 'canvaskit:nodeClicked', nodeId: restoredId });
      });
    }
  } catch(e) {}

  // Ready signal
  postMsg({ type: 'canvaskit:ready' });
})();
</script>`;
}
