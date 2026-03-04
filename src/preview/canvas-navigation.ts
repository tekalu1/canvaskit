/**
 * Canvas navigation script — Figma-compatible zoom/pan controls.
 *
 * Controls:
 * - Scroll wheel          → vertical scroll (normal)
 * - Shift + scroll        → horizontal scroll
 * - Ctrl/Cmd + scroll     → zoom in/out (cursor-centered)
 * - Ctrl/Cmd + 0          → reset zoom (100%, centered)
 * - Ctrl/Cmd + 1          → zoom to fit
 * - Ctrl/Cmd + =          → zoom in
 * - Ctrl/Cmd + -          → zoom out
 * - Space + drag          → pan (hand tool)
 * - Middle mouse drag     → pan
 * - Pinch (trackpad)      → zoom in/out
 *
 * The entire <body> content is wrapped in a transform container.
 * Overlays (toolbar, panels, selection) use position:fixed so they
 * stay in viewport space regardless of canvas transform.
 */
export function getCanvasNavigationScript(): string {
  return `<script>
(function() {
  'use strict';

  // --- Wrap body content in a canvas container ---
  var canvas = document.createElement('div');
  canvas.id = '__ck_canvas';

  // Move all body children (except our overlay/UI elements) into the canvas
  var children = Array.from(document.body.childNodes);
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.nodeType === 1) {
      var id = child.id || '';
      // Keep overlay/UI elements outside the canvas
      if (id.indexOf('__ck_') === 0) continue;
    }
    canvas.appendChild(child);
  }
  // Insert canvas as the first child of body
  document.body.insertBefore(canvas, document.body.firstChild);

  // --- Viewport wrapper for clipping ---
  // body itself serves as the viewport
  document.body.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.height = '100vh';
  document.body.style.position = 'relative';

  // --- Canvas initial styling ---
  canvas.style.cssText =
    'transform-origin:0 0;position:absolute;left:0;top:0;' +
    'will-change:transform;min-width:max-content;';

  // --- State ---
  var scale = 1;
  var panX = 0;
  var panY = 0;
  var MIN_ZOOM = 0.05;
  var MAX_ZOOM = 32;
  var isPanning = false;
  var spaceDown = false;
  var panStartX = 0;
  var panStartY = 0;
  var panStartPanX = 0;
  var panStartPanY = 0;

  // --- Restore saved view state (survives page reload) ---
  var STORAGE_KEY = '__ck_canvas_state';
  try {
    var saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      var st = JSON.parse(saved);
      if (typeof st.scale === 'number') scale = st.scale;
      if (typeof st.panX === 'number') panX = st.panX;
      if (typeof st.panY === 'number') panY = st.panY;
    }
  } catch(e) {}

  // Save view state before unload
  window.addEventListener('beforeunload', function() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ scale: scale, panX: panX, panY: panY }));
    } catch(e) {}
  });

  function applyTransform() {
    canvas.style.transform =
      'translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
    updateZoomIndicator();
    // Dispatch event so overlays can recalculate
    window.dispatchEvent(new CustomEvent('__ck_transform'));
  }

  function clampScale(s) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));
  }

  // --- Zoom (cursor-centered) ---
  function zoomAtPoint(newScale, clientX, clientY) {
    newScale = clampScale(newScale);
    // Transform client point to canvas space before zoom
    var beforeX = (clientX - panX) / scale;
    var beforeY = (clientY - panY) / scale;
    scale = newScale;
    // Adjust pan so the same canvas point stays under the cursor
    panX = clientX - beforeX * scale;
    panY = clientY - beforeY * scale;
    applyTransform();
  }

  function zoomToCenter(newScale) {
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    zoomAtPoint(newScale, cx, cy);
  }

  function resetView() {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  function zoomToFit() {
    var rect = canvas.getBoundingClientRect();
    // Get content bounds (first child with data-node-id or fallback to canvas scroll size)
    var cw = canvas.scrollWidth;
    var ch = canvas.scrollHeight;
    if (cw === 0 || ch === 0) { resetView(); return; }

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var padding = 40; // px padding around content
    var fitScale = Math.min(
      (vw - padding * 2) / cw,
      (vh - padding * 2) / ch,
      2 // max 200% for zoom-to-fit
    );
    fitScale = clampScale(fitScale);
    scale = fitScale;
    panX = (vw - cw * scale) / 2;
    panY = (vh - ch * scale) / 2;
    applyTransform();
  }

  // --- Zoom indicator ---
  var zoomIndicator = document.createElement('div');
  zoomIndicator.id = '__ck_zoom';
  zoomIndicator.style.cssText =
    'position:fixed;bottom:12px;left:12px;z-index:100000;' +
    'display:flex;align-items:center;gap:4px;' +
    'background:#1e1e2e;color:#cdd6f4;border-radius:6px;' +
    'font:12px/1 system-ui,sans-serif;padding:0;user-select:none;' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.3);overflow:hidden;';
  document.body.appendChild(zoomIndicator);

  function createZoomBtn(text, title, onClick) {
    var btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText =
      'border:none;background:transparent;color:#cdd6f4;padding:6px 8px;' +
      'cursor:pointer;font:13px/1 system-ui,sans-serif;';
    btn.addEventListener('mouseenter', function() { btn.style.background = '#313244'; });
    btn.addEventListener('mouseleave', function() { btn.style.background = 'transparent'; });
    btn.addEventListener('click', function(e) { e.stopPropagation(); onClick(); });
    return btn;
  }

  var zoomOutBtn = createZoomBtn('−', 'Zoom Out (Ctrl+-)', function() {
    zoomToCenter(scale / 1.25);
  });
  var zoomLabel = document.createElement('span');
  zoomLabel.style.cssText = 'min-width:42px;text-align:center;padding:6px 2px;cursor:pointer;';
  zoomLabel.title = 'Reset Zoom (Ctrl+0)';
  zoomLabel.addEventListener('click', resetView);
  var zoomInBtn = createZoomBtn('+', 'Zoom In (Ctrl+=)', function() {
    zoomToCenter(scale * 1.25);
  });

  zoomIndicator.appendChild(zoomOutBtn);
  zoomIndicator.appendChild(zoomLabel);
  zoomIndicator.appendChild(zoomInBtn);

  function updateZoomIndicator() {
    zoomLabel.textContent = Math.round(scale * 100) + '%';
  }
  updateZoomIndicator();

  // --- Mouse wheel ---
  document.addEventListener('wheel', function(e) {
    // Ctrl/Cmd + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      var factor = e.deltaY > 0 ? 0.92 : 1.08;
      // For precise trackpad pinch, use smaller steps
      if (Math.abs(e.deltaY) < 10) {
        factor = 1 - e.deltaY * 0.01;
      }
      zoomAtPoint(scale * factor, e.clientX, e.clientY);
      return;
    }

    // Space held = pan with wheel
    if (spaceDown) {
      e.preventDefault();
      panX -= e.deltaX;
      panY -= e.deltaY;
      applyTransform();
      return;
    }

    // Shift + wheel = horizontal scroll
    if (e.shiftKey) {
      e.preventDefault();
      panX -= e.deltaY;
      applyTransform();
      return;
    }

    // Normal scroll → pan
    e.preventDefault();
    panX -= e.deltaX;
    panY -= e.deltaY;
    applyTransform();
  }, { passive: false });

  // --- Space + drag (hand tool) ---
  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && !e.repeat) {
      // Don't capture when editing inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      spaceDown = true;
      if (window.__ck_nav) window.__ck_nav._spaceDown = true;
      document.body.style.cursor = 'grab';
    }
    // Keyboard zoom shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '0') {
        e.preventDefault();
        resetView();
      } else if (e.key === '1') {
        e.preventDefault();
        zoomToFit();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomToCenter(scale * 1.25);
      } else if (e.key === '-') {
        e.preventDefault();
        zoomToCenter(scale / 1.25);
      }
    }
  });

  document.addEventListener('keyup', function(e) {
    if (e.code === 'Space') {
      spaceDown = false;
      if (window.__ck_nav) window.__ck_nav._spaceDown = false;
      if (!isPanning) {
        document.body.style.cursor = '';
      }
    }
  });

  // --- Middle mouse / Space+Left drag for panning ---
  document.addEventListener('mousedown', function(e) {
    // Check if click is on UI elements
    var t = e.target;
    while (t) {
      if (t.id && t.id.indexOf('__ck_') === 0 && t.id !== '__ck_canvas') return;
      if (t.className === '__ck_resize_handle') return;
      t = t.parentElement;
    }

    var isMiddle = e.button === 1;
    var isSpaceDrag = e.button === 0 && spaceDown;

    if (isMiddle || isSpaceDrag) {
      e.preventDefault();
      isPanning = true;
      if (window.__ck_nav) window.__ck_nav._isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panStartPanX = panX;
      panStartPanY = panY;
      document.body.style.cursor = 'grabbing';
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (!isPanning) return;
    panX = panStartPanX + (e.clientX - panStartX);
    panY = panStartPanY + (e.clientY - panStartY);
    applyTransform();
  });

  document.addEventListener('mouseup', function(e) {
    if (isPanning) {
      isPanning = false;
      if (window.__ck_nav) window.__ck_nav._isPanning = false;
      document.body.style.cursor = spaceDown ? 'grab' : '';
      // Signal to selection overlay to ignore the click that ends panning
      if (window.__ck_nav) window.__ck_nav._wasPanning = true;
      // Clear after a tick so the click handler can read it
      setTimeout(function() {
        if (window.__ck_nav) window.__ck_nav._wasPanning = false;
      }, 0);
    }
  });

  // Prevent middle-click auto-scroll
  document.addEventListener('auxclick', function(e) {
    if (e.button === 1) e.preventDefault();
  });

  // --- Expose API for other scripts ---
  window.__ck_nav = {
    _isPanning: false,
    _spaceDown: false,
    _wasPanning: false,
    getScale: function() { return scale; },
    getPan: function() { return { x: panX, y: panY }; },
    zoomAtPoint: zoomAtPoint,
    zoomToCenter: zoomToCenter,
    zoomToFit: zoomToFit,
    resetView: resetView,
    // Convert client (viewport) coordinates to canvas coordinates
    clientToCanvas: function(cx, cy) {
      return {
        x: (cx - panX) / scale,
        y: (cy - panY) / scale
      };
    },
    // Convert canvas coordinates to client (viewport) coordinates
    canvasToClient: function(canvasX, canvasY) {
      return {
        x: canvasX * scale + panX,
        y: canvasY * scale + panY
      };
    }
  };

  applyTransform();
})();
</script>`;
}
