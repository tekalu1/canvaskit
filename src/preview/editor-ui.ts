/**
 * Generates a `<script>` block for the Figma-like editor UI.
 *
 * Features:
 * - Floating toolbar: add text, add frame, delete, undo, redo
 * - Property panel: edit name, styles, layout of selected node
 * - Context menu: right-click operations
 * - Drag-to-move and resize handles
 *
 * All mutations go through the REST API at /__canvaskit_api/*
 */
export function getEditorUiScript(port: number): string {
  const apiBase = `http://127.0.0.1:${port}/__canvaskit_api`;

  return `<script>
(function() {
  'use strict';

  var API = '${apiBase}';
  var selectedNodeId = null;

  // --- API helpers ---
  function apiPost(endpoint, body) {
    return fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r) { return r.json(); });
  }

  function apiGet(endpoint) {
    return fetch(API + endpoint).then(function(r) { return r.json(); });
  }

  // --- Inline Modal Dialog (replaces alert/prompt for VSCode webview compatibility) ---
  var modalOverlay = document.createElement('div');
  modalOverlay.id = '__ck_modal_overlay';
  modalOverlay.style.cssText =
    'position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,0.5);' +
    'display:none;align-items:center;justify-content:center;';
  var modalBox = document.createElement('div');
  modalBox.id = '__ck_modal';
  modalBox.style.cssText =
    'background:#1e1e2e;border-radius:10px;padding:20px 24px;min-width:300px;max-width:400px;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.5);font:13px/1.5 system-ui,sans-serif;color:#cdd6f4;';
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  function showModal(opts) {
    // opts: { title, message, fields: [{label,placeholder,value}], onOk(values), onCancel? }
    modalBox.innerHTML = '';

    // Title
    if (opts.title) {
      var title = document.createElement('div');
      title.textContent = opts.title;
      title.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:8px;';
      modalBox.appendChild(title);
    }

    // Message
    if (opts.message) {
      var msg = document.createElement('div');
      msg.textContent = opts.message;
      msg.style.cssText = 'color:#a6adc8;margin-bottom:12px;font-size:12px;';
      modalBox.appendChild(msg);
    }

    // Input fields
    var inputs = [];
    if (opts.fields) {
      for (var i = 0; i < opts.fields.length; i++) {
        var field = opts.fields[i];
        var lbl = document.createElement('label');
        lbl.textContent = field.label;
        lbl.style.cssText = 'display:block;color:#a6adc8;font-size:11px;margin-bottom:2px;margin-top:6px;';
        modalBox.appendChild(lbl);

        var inp = document.createElement('input');
        inp.type = 'text';
        inp.placeholder = field.placeholder || '';
        inp.value = field.value || '';
        inp.style.cssText =
          'width:100%;box-sizing:border-box;background:#313244;border:1px solid #45475a;color:#cdd6f4;' +
          'padding:6px 8px;border-radius:5px;font:12px/1.4 system-ui,sans-serif;outline:none;margin-bottom:4px;';
        inp.addEventListener('focus', function() { this.style.borderColor = '#3b82f6'; });
        inp.addEventListener('blur', function() { this.style.borderColor = '#45475a'; });
        inp.addEventListener('keydown', function(e) { e.stopPropagation(); });
        modalBox.appendChild(inp);
        inputs.push(inp);
      }
    }

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:16px;';

    var btnStyle =
      'border:none;padding:6px 16px;border-radius:5px;cursor:pointer;font:12px/1 system-ui,sans-serif;';

    if (opts.fields) {
      // Cancel button (only for prompt-style dialogs)
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = btnStyle + 'background:#313244;color:#a6adc8;';
      cancelBtn.addEventListener('mouseenter', function() { cancelBtn.style.background = '#45475a'; });
      cancelBtn.addEventListener('mouseleave', function() { cancelBtn.style.background = '#313244'; });
      cancelBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        modalOverlay.style.display = 'none';
        if (opts.onCancel) opts.onCancel();
      });
      btnRow.appendChild(cancelBtn);
    }

    var okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = btnStyle + 'background:#3b82f6;color:#fff;';
    okBtn.addEventListener('mouseenter', function() { okBtn.style.background = '#2563eb'; });
    okBtn.addEventListener('mouseleave', function() { okBtn.style.background = '#3b82f6'; });
    okBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      modalOverlay.style.display = 'none';
      if (opts.onOk) {
        var values = [];
        for (var j = 0; j < inputs.length; j++) values.push(inputs[j].value);
        opts.onOk(values);
      }
    });
    btnRow.appendChild(okBtn);
    modalBox.appendChild(btnRow);

    modalOverlay.style.display = 'flex';

    // Focus first input, or OK button
    if (inputs.length > 0) {
      inputs[0].focus();
      // Enter key submits
      inputs[inputs.length - 1].addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); }
      });
    } else {
      okBtn.focus();
    }
  }

  // Convenience wrappers matching alert()/prompt() patterns
  function ckAlert(message) {
    showModal({ title: 'Notice', message: message, onOk: function() {} });
  }

  function ckPrompt(opts) {
    // opts: { title, fields: [{label, placeholder}], onOk(values) }
    showModal(opts);
  }

  // Close modal on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalOverlay.style.display !== 'none') {
      e.stopPropagation();
      modalOverlay.style.display = 'none';
    }
  }, true);

  // Close modal on backdrop click
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = 'none';
    }
  });

  // --- Listen for selection from overlay ---
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'canvaskit:nodeClicked') {
      selectedNodeId = msg.nodeId;
      showPropertyPanel(msg.nodeId);
    } else if (msg.type === 'canvaskit:selectionCleared') {
      selectedNodeId = null;
      hidePropertyPanel();
    }
  });

  // Also listen for direct clicks on node elements in the document
  // This catches selection changes even without postMessage relay
  document.addEventListener('click', function(e) {
    // Ignore clicks on UI elements
    var target = e.target;
    while (target) {
      if (target.id === '__ck_toolbar' || target.id === '__ck_props' ||
          target.id === '__ck_ctx' || target.id === '__ck_zoom') return;
      if (target.className === '__ck_resize_handle') return;
      target = target.parentElement;
    }
    // Find node element
    var el = e.target;
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.nodeId) {
        selectedNodeId = el.dataset.nodeId;
        showPropertyPanel(el.dataset.nodeId);
        return;
      }
      el = el.parentElement;
    }
    // Clicked on empty space — clear
    selectedNodeId = null;
    hidePropertyPanel();
  }, true);

  // --- Floating Toolbar ---
  var toolbar = document.createElement('div');
  toolbar.id = '__ck_toolbar';
  toolbar.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:100000;' +
    'display:flex;gap:4px;padding:6px 10px;background:#1e1e2e;border-radius:8px;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.3);font:12px/1 system-ui,sans-serif;color:#cdd6f4;' +
    'user-select:none;align-items:center;';

  function createBtn(label, title, onClick) {
    var btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText =
      'border:none;background:#313244;color:#cdd6f4;padding:6px 10px;border-radius:5px;' +
      'cursor:pointer;font:12px/1 system-ui,sans-serif;transition:background 0.15s;';
    btn.addEventListener('mouseenter', function() { btn.style.background = '#45475a'; });
    btn.addEventListener('mouseleave', function() { btn.style.background = '#313244'; });
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // Add Text button
  toolbar.appendChild(createBtn('T+', 'Add Text Node', function() {
    var parentId = selectedNodeId || 'root';
    apiPost('/node/add', {
      nodes: [{
        type: 'text',
        name: 'New Text',
        parentId: parentId,
        content: 'New Text',
        styles: { fontSize: '16px', color: '#1e1e2e' }
      }]
    }).then(function(r) {
      if (r.error) ckAlert('Error: ' + r.error);
    });
  }));

  // Add Frame button
  toolbar.appendChild(createBtn('F+', 'Add Frame', function() {
    var parentId = selectedNodeId || 'root';
    apiPost('/node/add', {
      nodes: [{
        type: 'frame',
        name: 'New Frame',
        parentId: parentId,
        layout: { direction: 'column', gap: '8px' },
        styles: { padding: '16px', backgroundColor: '#f5f5f5' }
      }]
    }).then(function(r) {
      if (r.error) ckAlert('Error: ' + r.error);
    });
  }));

  // Separator
  var sep1 = document.createElement('div');
  sep1.style.cssText = 'width:1px;height:20px;background:#45475a;';
  toolbar.appendChild(sep1);

  // Delete button
  toolbar.appendChild(createBtn('Del', 'Delete Selected', function() {
    if (!selectedNodeId) return;
    if (selectedNodeId === 'root') { ckAlert('Cannot delete root node'); return; }
    apiPost('/node/delete', { nodeId: selectedNodeId }).then(function(r) {
      if (r.error) ckAlert('Error: ' + r.error);
      else { selectedNodeId = null; hidePropertyPanel(); }
    });
  }));

  // Separator
  var sep2 = document.createElement('div');
  sep2.style.cssText = 'width:1px;height:20px;background:#45475a;';
  toolbar.appendChild(sep2);

  // Undo
  toolbar.appendChild(createBtn('Undo', 'Undo (Ctrl+Z)', function() {
    apiPost('/undo', {});
  }));

  // Redo
  toolbar.appendChild(createBtn('Redo', 'Redo (Ctrl+Shift+Z)', function() {
    apiPost('/redo', {});
  }));

  // Separator
  var sep3 = document.createElement('div');
  sep3.style.cssText = 'width:1px;height:20px;background:#45475a;';
  toolbar.appendChild(sep3);

  // Background / Canvas Settings button
  toolbar.appendChild(createBtn('BG', 'Canvas & Background Settings', function() {
    toggleBgPanel();
  }));

  document.body.appendChild(toolbar);

  // --- Background Settings Panel ---
  var BG_STORAGE_KEY = '__ck_viewport_bg';
  var GRID_STORAGE_KEY = '__ck_grid_visible';

  var bgPanel = document.createElement('div');
  bgPanel.id = '__ck_bg_panel';
  bgPanel.style.cssText =
    'position:fixed;top:48px;left:50%;transform:translateX(-50%);z-index:100001;' +
    'background:#1e1e2e;border-radius:8px;padding:12px 16px;min-width:280px;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.4);font:12px/1.4 system-ui,sans-serif;color:#cdd6f4;' +
    'display:none;user-select:none;';
  document.body.appendChild(bgPanel);

  function toggleBgPanel() {
    if (bgPanel.style.display === 'none') {
      renderBgPanel();
      bgPanel.style.display = 'block';
    } else {
      bgPanel.style.display = 'none';
    }
  }

  // Close bg panel on outside click
  document.addEventListener('mousedown', function(e) {
    if (bgPanel.style.display === 'none') return;
    var t = e.target;
    while (t) {
      if (t === bgPanel) return;
      // Don't close when clicking the BG button itself (toggle handles it)
      if (t.parentElement === toolbar && t.title === 'Canvas & Background Settings') return;
      t = t.parentElement;
    }
    bgPanel.style.display = 'none';
  });

  // --- Viewport background ---
  var viewportBg = '#2b2b3d';
  try {
    var savedBg = sessionStorage.getItem(BG_STORAGE_KEY);
    if (savedBg) viewportBg = savedBg;
  } catch(e) {}
  document.body.style.backgroundColor = viewportBg;

  function setViewportBg(color) {
    viewportBg = color;
    document.body.style.backgroundColor = color;
    try { sessionStorage.setItem(BG_STORAGE_KEY, color); } catch(e) {}
  }

  // --- Grid overlay ---
  var gridOverlay = document.createElement('div');
  gridOverlay.id = '__ck_grid';
  gridOverlay.style.cssText =
    'position:fixed;inset:0;z-index:1;pointer-events:none;display:none;' +
    'background-image:' +
      'linear-gradient(rgba(128,128,128,0.12) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(128,128,128,0.12) 1px, transparent 1px);' +
    'background-size:20px 20px;';
  document.body.appendChild(gridOverlay);

  var gridVisible = false;
  try {
    gridVisible = sessionStorage.getItem(GRID_STORAGE_KEY) === 'true';
    if (gridVisible) gridOverlay.style.display = 'block';
  } catch(e) {}

  // Update grid on zoom (scale the grid size)
  window.addEventListener('__ck_transform', function() {
    var s = (window.__ck_nav && window.__ck_nav.getScale) ? window.__ck_nav.getScale() : 1;
    var size = Math.max(5, Math.round(20 * s));
    gridOverlay.style.backgroundSize = size + 'px ' + size + 'px';
    // Offset grid to match canvas pan
    if (window.__ck_nav && window.__ck_nav.getPan) {
      var pan = window.__ck_nav.getPan();
      gridOverlay.style.backgroundPosition = pan.x + 'px ' + pan.y + 'px';
    }
  });

  function setGridVisible(visible) {
    gridVisible = visible;
    gridOverlay.style.display = visible ? 'block' : 'none';
    try { sessionStorage.setItem(GRID_STORAGE_KEY, String(visible)); } catch(e) {}
  }

  // --- Render background settings panel ---
  function renderBgPanel() {
    bgPanel.innerHTML = '';

    // --- Section: Viewport Background ---
    var vpTitle = document.createElement('div');
    vpTitle.textContent = 'Viewport Background';
    vpTitle.style.cssText = 'font-weight:600;font-size:11px;color:#a6adc8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    bgPanel.appendChild(vpTitle);

    // Preset swatches
    var presets = [
      { color: '#1a1a2e', label: 'Dark' },
      { color: '#2b2b3d', label: 'Default' },
      { color: '#3c3c4e', label: 'Gray' },
      { color: '#e5e5e5', label: 'Light' },
      { color: '#ffffff', label: 'White' },
      { color: 'transparent', label: 'None' }
    ];

    var swatchRow = document.createElement('div');
    swatchRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;';
    for (var pi = 0; pi < presets.length; pi++) {
      (function(preset) {
        var sw = document.createElement('div');
        sw.title = preset.label;
        var isTransparent = preset.color === 'transparent';
        var bgStyle = isTransparent
          ? 'background:repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50%/10px 10px;'
          : 'background:' + preset.color + ';';
        var border = (viewportBg === preset.color) ? 'border:2px solid #3b82f6;' : 'border:2px solid #45475a;';
        sw.style.cssText =
          'width:32px;height:32px;border-radius:6px;cursor:pointer;' + bgStyle + border +
          'transition:border-color 0.15s;box-sizing:border-box;';
        sw.addEventListener('click', function() {
          setViewportBg(preset.color);
          renderBgPanel(); // refresh active state
        });
        sw.addEventListener('mouseenter', function() { if (viewportBg !== preset.color) sw.style.borderColor = '#6c7086'; });
        sw.addEventListener('mouseleave', function() { sw.style.borderColor = (viewportBg === preset.color) ? '#3b82f6' : '#45475a'; });
        swatchRow.appendChild(sw);
      })(presets[pi]);
    }
    bgPanel.appendChild(swatchRow);

    // Custom color input
    var vpColorRow = document.createElement('div');
    vpColorRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:14px;';

    var vpColorPicker = document.createElement('input');
    vpColorPicker.type = 'color';
    vpColorPicker.value = viewportBg.startsWith('#') ? viewportBg : '#2b2b3d';
    vpColorPicker.style.cssText =
      'width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;' +
      'background:transparent;-webkit-appearance:none;';
    vpColorPicker.addEventListener('input', function() {
      setViewportBg(vpColorPicker.value);
      renderBgPanel();
    });
    vpColorRow.appendChild(vpColorPicker);

    var vpColorInput = document.createElement('input');
    vpColorInput.type = 'text';
    vpColorInput.value = viewportBg;
    vpColorInput.placeholder = '#hex or color name';
    vpColorInput.style.cssText =
      'flex:1;background:#313244;border:1px solid transparent;color:#cdd6f4;' +
      'padding:4px 8px;border-radius:4px;font:11px/1.2 system-ui,sans-serif;outline:none;';
    vpColorInput.addEventListener('focus', function() { vpColorInput.style.borderColor = '#3b82f6'; });
    vpColorInput.addEventListener('blur', function() {
      vpColorInput.style.borderColor = 'transparent';
      if (vpColorInput.value && vpColorInput.value !== viewportBg) {
        setViewportBg(vpColorInput.value);
        renderBgPanel();
      }
    });
    vpColorInput.addEventListener('keydown', function(e) {
      e.stopPropagation();
      if (e.key === 'Enter') { vpColorInput.blur(); }
    });
    vpColorRow.appendChild(vpColorInput);
    bgPanel.appendChild(vpColorRow);

    // --- Section: Page Background ---
    var pageTitle = document.createElement('div');
    pageTitle.textContent = 'Page Background';
    pageTitle.style.cssText = 'font-weight:600;font-size:11px;color:#a6adc8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    bgPanel.appendChild(pageTitle);

    var pageBgRow = document.createElement('div');
    pageBgRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:14px;';

    // Fetch current root node's backgroundColor
    var pageBgValue = '';
    var rootEl = document.querySelector('[data-node-id="root"]');
    if (rootEl) {
      pageBgValue = rootEl.style.backgroundColor || '';
    }

    var pageBgPicker = document.createElement('input');
    pageBgPicker.type = 'color';
    pageBgPicker.value = pageBgValue || '#ffffff';
    pageBgPicker.style.cssText =
      'width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;' +
      'background:transparent;-webkit-appearance:none;';
    pageBgPicker.addEventListener('input', function() {
      pageBgInput.value = pageBgPicker.value;
    });
    pageBgPicker.addEventListener('change', function() {
      applyPageBg(pageBgPicker.value);
    });
    pageBgRow.appendChild(pageBgPicker);

    var pageBgInput = document.createElement('input');
    pageBgInput.type = 'text';
    pageBgInput.value = pageBgValue;
    pageBgInput.placeholder = '#hex (root backgroundColor)';
    pageBgInput.style.cssText =
      'flex:1;background:#313244;border:1px solid transparent;color:#cdd6f4;' +
      'padding:4px 8px;border-radius:4px;font:11px/1.2 system-ui,sans-serif;outline:none;';
    pageBgInput.addEventListener('focus', function() { pageBgInput.style.borderColor = '#3b82f6'; });
    pageBgInput.addEventListener('blur', function() {
      pageBgInput.style.borderColor = 'transparent';
      if (pageBgInput.value) applyPageBg(pageBgInput.value);
    });
    pageBgInput.addEventListener('keydown', function(e) {
      e.stopPropagation();
      if (e.key === 'Enter') { pageBgInput.blur(); }
    });
    pageBgRow.appendChild(pageBgInput);

    // Clear page background button
    var clearPageBgBtn = document.createElement('button');
    clearPageBgBtn.textContent = 'Clear';
    clearPageBgBtn.title = 'Remove page background color';
    clearPageBgBtn.style.cssText =
      'border:none;background:#313244;color:#a6adc8;padding:4px 8px;border-radius:4px;' +
      'cursor:pointer;font:11px/1 system-ui,sans-serif;';
    clearPageBgBtn.addEventListener('click', function() {
      apiPost('/node/update', { updates: [{ id: 'root', styles: { backgroundColor: '' } }] });
    });
    pageBgRow.appendChild(clearPageBgBtn);
    bgPanel.appendChild(pageBgRow);

    // --- Section: Grid ---
    var gridTitle = document.createElement('div');
    gridTitle.textContent = 'Grid';
    gridTitle.style.cssText = 'font-weight:600;font-size:11px;color:#a6adc8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    bgPanel.appendChild(gridTitle);

    var gridRow = document.createElement('div');
    gridRow.style.cssText = 'display:flex;align-items:center;gap:8px;';

    var gridToggle = document.createElement('button');
    gridToggle.textContent = gridVisible ? 'Grid: ON' : 'Grid: OFF';
    gridToggle.style.cssText =
      'border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font:12px/1 system-ui,sans-serif;' +
      (gridVisible
        ? 'background:#3b82f6;color:#fff;'
        : 'background:#313244;color:#a6adc8;');
    gridToggle.addEventListener('click', function() {
      setGridVisible(!gridVisible);
      renderBgPanel();
    });
    gridRow.appendChild(gridToggle);

    var gridNote = document.createElement('span');
    gridNote.textContent = '20px grid (scales with zoom)';
    gridNote.style.cssText = 'color:#6c7086;font-size:10px;';
    gridRow.appendChild(gridNote);
    bgPanel.appendChild(gridRow);
  }

  function applyPageBg(color) {
    apiPost('/node/update', { updates: [{ id: 'root', styles: { backgroundColor: color } }] });
  }

  // --- Keyboard shortcuts ---
  document.addEventListener('keydown', function(e) {
    // Don't capture when editing inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        apiPost('/undo', {});
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        apiPost('/redo', {});
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNodeId && selectedNodeId !== 'root') {
        e.preventDefault();
        apiPost('/node/delete', { nodeId: selectedNodeId }).then(function(r) {
          if (!r.error) { selectedNodeId = null; hidePropertyPanel(); }
        });
      }
    }
  });

  // --- Property Panel ---
  var propsPanel = document.createElement('div');
  propsPanel.id = '__ck_props';
  propsPanel.style.cssText =
    'position:fixed;right:8px;top:50px;width:240px;max-height:calc(100vh - 70px);' +
    'overflow-y:auto;z-index:100000;background:#1e1e2e;border-radius:8px;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.3);font:12px/1.4 system-ui,sans-serif;color:#cdd6f4;' +
    'display:none;user-select:none;';
  document.body.appendChild(propsPanel);

  function hidePropertyPanel() {
    propsPanel.style.display = 'none';
    propsPanel.innerHTML = '';
  }

  function showPropertyPanel(nodeId) {
    apiGet('/node/' + encodeURIComponent(nodeId)).then(function(data) {
      if (!data.ok || !data.node) { hidePropertyPanel(); return; }
      renderPropertyPanel(nodeId, data.node);
    });
  }

  function renderPropertyPanel(nodeId, node) {
    propsPanel.innerHTML = '';
    propsPanel.style.display = 'block';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'padding:10px 12px;border-bottom:1px solid #313244;display:flex;align-items:center;justify-content:space-between;';
    header.innerHTML = '<span style="font-weight:600;">' + escHtml(node.name || nodeId) +
      '</span><span style="color:#6c7086;font-size:11px;">[' + escHtml(node.type) + ']</span>';
    propsPanel.appendChild(header);

    // Name field
    addPropField('Name', node.name || '', function(val) {
      apiPost('/node/update', { updates: [{ id: nodeId, name: val }] });
    });

    // Content (text nodes)
    if (node.type === 'text') {
      addPropField('Content', node.content || '', function(val) {
        apiPost('/node/update', { updates: [{ id: nodeId, content: val }] });
      });
    }

    // Styles section
    var styles = node.styles || {};
    addSectionHeader('Styles');

    var styleProps = ['backgroundColor', 'color', 'fontSize', 'fontWeight', 'padding',
      'margin', 'borderRadius', 'width', 'height', 'opacity'];
    for (var i = 0; i < styleProps.length; i++) {
      (function(prop) {
        var val = styles[prop];
        if (val !== undefined) {
          addPropField(prop, String(val), function(newVal) {
            var update = {};
            update[prop] = newVal;
            apiPost('/node/update', { updates: [{ id: nodeId, styles: update }] });
          });
        }
      })(styleProps[i]);
    }

    // Add style button
    var addStyleBtn = document.createElement('button');
    addStyleBtn.textContent = '+ Add Style';
    addStyleBtn.style.cssText =
      'display:block;margin:6px 12px;padding:4px 8px;border:1px dashed #45475a;' +
      'background:transparent;color:#6c7086;border-radius:4px;cursor:pointer;font-size:11px;width:calc(100% - 24px);';
    addStyleBtn.addEventListener('click', function() {
      ckPrompt({
        title: 'Add Style Property',
        fields: [
          { label: 'Property', placeholder: 'e.g. backgroundColor' },
          { label: 'Value', placeholder: 'e.g. #ff0000' }
        ],
        onOk: function(values) {
          var prop = values[0];
          var val = values[1];
          if (!prop) return;
          var update = {};
          update[prop] = val;
          apiPost('/node/update', { updates: [{ id: nodeId, styles: update }] }).then(function() {
            showPropertyPanel(nodeId);
          });
        }
      });
    });
    propsPanel.appendChild(addStyleBtn);

    // Layout section (for frames)
    if (node.type === 'frame' && node.layout) {
      addSectionHeader('Layout');
      var layoutProps = ['direction', 'gap', 'align', 'justify', 'wrap'];
      for (var j = 0; j < layoutProps.length; j++) {
        (function(prop) {
          var val = node.layout[prop];
          if (val !== undefined) {
            addPropField(prop, String(val), function(newVal) {
              var update = {};
              update[prop] = newVal === 'true' ? true : newVal === 'false' ? false : newVal;
              apiPost('/node/update', { updates: [{ id: nodeId, layout: update }] });
            });
          }
        })(layoutProps[j]);
      }
    }
  }

  function addSectionHeader(title) {
    var h = document.createElement('div');
    h.style.cssText = 'padding:8px 12px 4px;font-weight:600;font-size:11px;color:#a6adc8;text-transform:uppercase;letter-spacing:0.5px;';
    h.textContent = title;
    propsPanel.appendChild(h);
  }

  function addPropField(label, value, onChange) {
    var row = document.createElement('div');
    row.style.cssText = 'padding:3px 12px;display:flex;align-items:center;gap:6px;';

    var lbl = document.createElement('label');
    lbl.style.cssText = 'width:85px;flex-shrink:0;color:#a6adc8;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    lbl.textContent = label;
    lbl.title = label;

    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value;
    inp.style.cssText =
      'flex:1;min-width:0;background:#313244;border:1px solid transparent;color:#cdd6f4;' +
      'padding:4px 6px;border-radius:4px;font:11px/1.2 system-ui,sans-serif;outline:none;';
    inp.addEventListener('focus', function() { inp.style.borderColor = '#3b82f6'; });
    inp.addEventListener('blur', function() {
      inp.style.borderColor = 'transparent';
      if (inp.value !== value) {
        onChange(inp.value);
        value = inp.value;
      }
    });
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { inp.blur(); }
      e.stopPropagation(); // Prevent keyboard shortcuts while editing
    });

    row.appendChild(lbl);
    row.appendChild(inp);
    propsPanel.appendChild(row);
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // --- Context Menu ---
  var ctxMenu = document.createElement('div');
  ctxMenu.id = '__ck_ctx';
  ctxMenu.style.cssText =
    'position:fixed;z-index:100001;background:#1e1e2e;border-radius:6px;' +
    'box-shadow:0 4px 20px rgba(0,0,0,0.4);font:12px/1 system-ui,sans-serif;color:#cdd6f4;' +
    'display:none;min-width:160px;padding:4px 0;user-select:none;';
  document.body.appendChild(ctxMenu);

  function showContextMenu(x, y, nodeId) {
    ctxMenu.innerHTML = '';
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.style.display = 'block';

    addMenuItem('Add Text Child', function() {
      apiPost('/node/add', {
        nodes: [{ type: 'text', name: 'Text', parentId: nodeId, content: 'Text' }]
      });
    });
    addMenuItem('Add Frame Child', function() {
      apiPost('/node/add', {
        nodes: [{ type: 'frame', name: 'Frame', parentId: nodeId, layout: { direction: 'column' } }]
      });
    });

    if (nodeId !== 'root') {
      addMenuSep();
      addMenuItem('Delete', function() {
        apiPost('/node/delete', { nodeId: nodeId });
      });
    }
  }

  function addMenuItem(label, onClick) {
    var item = document.createElement('div');
    item.textContent = label;
    item.style.cssText = 'padding:6px 14px;cursor:pointer;transition:background 0.1s;';
    item.addEventListener('mouseenter', function() { item.style.background = '#313244'; });
    item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      ctxMenu.style.display = 'none';
      onClick();
    });
    ctxMenu.appendChild(item);
  }

  function addMenuSep() {
    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:#313244;margin:4px 0;';
    ctxMenu.appendChild(sep);
  }

  // Track whether context menu was just shown (to prevent immediate close)
  var ctxJustShown = false;

  // Right-click handler
  document.addEventListener('contextmenu', function(e) {
    // Close any currently open context menu first
    ctxMenu.style.display = 'none';
    ctxJustShown = false;

    // Find closest node
    var el = e.target;
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.nodeId) break;
      el = el.parentElement;
    }
    if (el && el.dataset && el.dataset.nodeId) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, el.dataset.nodeId);
      ctxJustShown = true;
      // Reset flag after current event cycle completes
      setTimeout(function() { ctxJustShown = false; }, 0);
    }
  });

  // Close context menu on any click outside (capture phase)
  document.addEventListener('click', function(e) {
    if (ctxMenu.style.display === 'none') return;
    // Don't close if clicking inside the context menu itself
    var t = e.target;
    while (t) {
      if (t === ctxMenu) return;
      t = t.parentElement;
    }
    ctxMenu.style.display = 'none';
  }, true);

  // Close on mousedown outside (handles cases where click doesn't fire, e.g. drag)
  document.addEventListener('mousedown', function(e) {
    if (ctxMenu.style.display === 'none') return;
    if (ctxJustShown) return;
    var t = e.target;
    while (t) {
      if (t === ctxMenu) return;
      t = t.parentElement;
    }
    ctxMenu.style.display = 'none';
  });

  // --- Phase 4C: Drag & Resize ---

  var dragState = null;
  var resizeState = null;
  var resizeHandles = [];

  // Create 8 resize handles (corners + edges)
  var handlePositions = ['nw','n','ne','e','se','s','sw','w'];
  var handleCursors = ['nw-resize','n-resize','ne-resize','e-resize','se-resize','s-resize','sw-resize','w-resize'];

  for (var h = 0; h < 8; h++) {
    (function(idx) {
      var handle = document.createElement('div');
      handle.className = '__ck_resize_handle';
      handle.style.cssText =
        'position:fixed;width:8px;height:8px;background:#3b82f6;border:1px solid #fff;' +
        'border-radius:2px;z-index:100000;display:none;cursor:' + handleCursors[idx] + ';box-sizing:border-box;';
      handle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedNodeId) return;
        var el = document.querySelector('[data-node-id="' + CSS.escape(selectedNodeId) + '"]');
        if (!el) return;
        var rect = el.getBoundingClientRect();
        resizeState = {
          nodeId: selectedNodeId,
          handle: handlePositions[idx],
          startX: e.clientX,
          startY: e.clientY,
          origRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
        };
      });
      document.body.appendChild(handle);
      resizeHandles.push(handle);
    })(h);
  }

  function positionResizeHandles(rect) {
    if (!rect) {
      for (var i = 0; i < resizeHandles.length; i++) resizeHandles[i].style.display = 'none';
      return;
    }
    var positions = [
      [rect.left - 4, rect.top - 4],
      [rect.left + rect.width / 2 - 4, rect.top - 4],
      [rect.left + rect.width - 4, rect.top - 4],
      [rect.left + rect.width - 4, rect.top + rect.height / 2 - 4],
      [rect.left + rect.width - 4, rect.top + rect.height - 4],
      [rect.left + rect.width / 2 - 4, rect.top + rect.height - 4],
      [rect.left - 4, rect.top + rect.height - 4],
      [rect.left - 4, rect.top + rect.height / 2 - 4]
    ];
    for (var i = 0; i < resizeHandles.length; i++) {
      resizeHandles[i].style.left = positions[i][0] + 'px';
      resizeHandles[i].style.top = positions[i][1] + 'px';
      resizeHandles[i].style.display = 'block';
    }
  }

  // Update resize handles when selection changes
  var origUpdateOverlays = null;
  // We hook into the selection overlay's updates via a MutationObserver on the select overlay
  var selectOverlay = document.getElementById('__ck_select');
  if (selectOverlay) {
    var obs = new MutationObserver(function() {
      if (selectOverlay.style.display === 'none') {
        positionResizeHandles(null);
      } else {
        positionResizeHandles({
          left: parseFloat(selectOverlay.style.left),
          top: parseFloat(selectOverlay.style.top),
          width: parseFloat(selectOverlay.style.width),
          height: parseFloat(selectOverlay.style.height)
        });
      }
    });
    obs.observe(selectOverlay, { attributes: true, attributeFilter: ['style'] });
  }

  // Drag: start on mousedown on selected element
  // Use capture phase so we get the event before canvas navigation
  document.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    // Don't start drag when panning (space held)
    if (window.__ck_nav && window.__ck_nav._spaceDown) return;
    // Don't start drag on toolbar/panel/resize handles
    var target = e.target;
    while (target) {
      if (target.id === '__ck_toolbar' || target.id === '__ck_props' || target.id === '__ck_ctx' ||
          target.id === '__ck_zoom') return;
      if (target.className === '__ck_resize_handle') return;
      target = target.parentElement;
    }

    if (!selectedNodeId || selectedNodeId === 'root') return;
    var el = document.querySelector('[data-node-id="' + CSS.escape(selectedNodeId) + '"]');
    if (!el) return;

    // Check if click is within the selected element
    var rect = el.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      dragState = {
        nodeId: selectedNodeId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false
      };
    }
  }, true);

  // Helper: get current canvas scale for coordinate compensation
  function getCanvasScale() {
    return (window.__ck_nav && typeof window.__ck_nav.getScale === 'function')
      ? window.__ck_nav.getScale() : 1;
  }

  document.addEventListener('mousemove', function(e) {
    if (dragState) {
      var dx = e.clientX - dragState.startX;
      var dy = e.clientY - dragState.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragState.moved = true;
        // Visual feedback: move the element
        // Compensate for canvas scale — element is inside scaled container
        var s = getCanvasScale();
        var el = document.querySelector('[data-node-id="' + CSS.escape(dragState.nodeId) + '"]');
        if (el) {
          el.style.transform = 'translate(' + (dx / s) + 'px,' + (dy / s) + 'px)';
          el.style.opacity = '0.7';
          el.style.position = 'relative';
          el.style.zIndex = '99990';
        }
      }
    }

    if (resizeState) {
      // Visual feedback during resize — compensate for canvas scale
      var el = document.querySelector('[data-node-id="' + CSS.escape(resizeState.nodeId) + '"]');
      if (!el) return;
      var s = getCanvasScale();
      var dx = (e.clientX - resizeState.startX) / s;
      var dy = (e.clientY - resizeState.startY) / s;
      var h = resizeState.handle;
      var newW = resizeState.origRect.width / s;
      var newH = resizeState.origRect.height / s;

      if (h.indexOf('e') >= 0) newW += dx;
      if (h.indexOf('w') >= 0) newW -= dx;
      if (h.indexOf('s') >= 0) newH += dy;
      if (h.indexOf('n') >= 0) newH -= dy;

      if (newW > 10) el.style.width = Math.round(newW) + 'px';
      if (newH > 10) el.style.height = Math.round(newH) + 'px';
    }
  });

  document.addEventListener('mouseup', function(e) {
    if (dragState && dragState.moved) {
      // Find drop target
      var el = document.querySelector('[data-node-id="' + CSS.escape(dragState.nodeId) + '"]');
      if (el) {
        el.style.transform = '';
        el.style.opacity = '';
        el.style.position = '';
        el.style.zIndex = '';
      }

      // Find what element is at the drop position
      if (el) el.style.pointerEvents = 'none';
      var dropEl = document.elementFromPoint(e.clientX, e.clientY);
      if (el) el.style.pointerEvents = '';

      // Find closest frame node as drop target
      var targetEl = dropEl;
      while (targetEl && targetEl !== document.body) {
        if (targetEl.dataset && targetEl.dataset.nodeId && targetEl.dataset.nodeId !== dragState.nodeId) {
          break;
        }
        targetEl = targetEl.parentElement;
      }

      if (targetEl && targetEl.dataset && targetEl.dataset.nodeId) {
        apiPost('/node/move', {
          nodeId: dragState.nodeId,
          newParentId: targetEl.dataset.nodeId
        });
      }
    }
    dragState = null;

    if (resizeState) {
      // Apply resize via API — read computed width/height from element style
      var el = document.querySelector('[data-node-id="' + CSS.escape(resizeState.nodeId) + '"]');
      if (el) {
        var newWidth = el.style.width;
        var newHeight = el.style.height;
        var styles = {};
        if (newWidth) styles.width = newWidth;
        if (newHeight) styles.height = newHeight;
        if (Object.keys(styles).length > 0) {
          apiPost('/node/update', {
            updates: [{ id: resizeState.nodeId, styles: styles }]
          });
        }
        // Reset inline styles that we set during resize preview
        el.style.width = '';
        el.style.height = '';
      }
      resizeState = null;
    }
  });

  // Handle scroll/resize/canvas-transform to update resize handles
  function syncResizeHandles() {
    if (selectedNodeId && selectOverlay && selectOverlay.style.display !== 'none') {
      positionResizeHandles({
        left: parseFloat(selectOverlay.style.left),
        top: parseFloat(selectOverlay.style.top),
        width: parseFloat(selectOverlay.style.width),
        height: parseFloat(selectOverlay.style.height)
      });
    } else {
      positionResizeHandles(null);
    }
  }
  window.addEventListener('scroll', syncResizeHandles, true);
  window.addEventListener('resize', syncResizeHandles);
  window.addEventListener('__ck_transform', syncResizeHandles);

})();
</script>`;
}
