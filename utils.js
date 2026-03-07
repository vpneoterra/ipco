/* ═══════════════════════════════════════════════
   Patentify — Shared Utilities (utils.js)
   Extracted from duplicated code across modules.
   Import via <script src="./utils.js"></script>
   or <script src="../utils.js"></script>
   ═══════════════════════════════════════════════ */

'use strict';

const Patentify = window.Patentify || {};

/* ── HTML Sanitization ──
   Strips dangerous tags/attributes to prevent XSS.
   Use sanitizeHtml(str) for any innerHTML assignment
   that may contain untrusted data.
   ──────────────────────────────────────────────── */
Patentify.ALLOWED_TAGS = new Set([
  'b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div', 'a',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre',
  'blockquote', 'hr', 'img', 'svg', 'path', 'circle', 'rect',
  'line', 'text', 'g', 'polygon', 'polyline', 'defs',
  'linearGradient', 'stop', 'clipPath'
]);

Patentify.ALLOWED_ATTRS = new Set([
  'class', 'id', 'style', 'href', 'target', 'rel', 'title', 'alt',
  'src', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'opacity', 'd', 'cx', 'cy', 'r',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'rx', 'ry', 'transform',
  'text-anchor', 'dominant-baseline', 'font-size', 'font-weight',
  'font-family', 'points', 'xmlns', 'offset', 'stop-color', 'stop-opacity',
  'data-tab', 'data-step-id', 'data-step-idx', 'data-step-type',
  'data-step-tpl', 'data-view', 'data-msg', 'draggable', 'colspan',
  'aria-label', 'aria-pressed', 'role', 'type', 'value', 'placeholder'
]);

Patentify.sanitizeHtml = function(html) {
  if (!html || typeof html !== 'string') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = function(node) {
    const children = Array.from(node.childNodes);
    children.forEach(function(child) {
      if (child.nodeType === 3) return; // text node OK
      if (child.nodeType === 8) { child.remove(); return; } // remove comments
      if (child.nodeType !== 1) { child.remove(); return; }
      const tag = child.tagName.toLowerCase();
      // Remove script, iframe, object, embed, form, input, textarea, select, link, meta
      if (!Patentify.ALLOWED_TAGS.has(tag)) {
        // Keep text content, remove the element
        while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
        child.remove();
        return;
      }
      // Strip dangerous attributes
      Array.from(child.attributes).forEach(function(attr) {
        const name = attr.name.toLowerCase();
        if (name.startsWith('on')) { child.removeAttribute(attr.name); return; }
        if (!Patentify.ALLOWED_ATTRS.has(name) && !name.startsWith('data-')) {
          child.removeAttribute(attr.name);
          return;
        }
        // Sanitize href/src for javascript: protocol
        if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) {
          child.removeAttribute(attr.name);
        }
      });
      walk(child);
    });
  };
  walk(doc.body);
  return doc.body.innerHTML;
};

/* ── Escape HTML (plain text safe) ──
   Converts all HTML special chars to entities.
   Use for inserting user-provided text into HTML.
   ──────────────────────────────────────────────── */
Patentify.escapeHtml = function(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

/* ── Relative Time ── */
Patentify.relativeTime = function(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
};

/* ── Toast Notification ── */
Patentify.toast = function(message, type) {
  type = type || 'info';
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(function() { el.remove(); }, 4000);
};

/* ── Badge Class Helpers ── */
Patentify.statusBadgeClass = function(status) {
  const map = {
    'running': 'badge-running', 'completed': 'badge-green', 'failed': 'badge-red',
    'paused': 'badge-amber', 'hypothesis': 'badge-blue', 'approved': 'badge-green',
    'filed': 'badge-violet', 'granted': 'badge-teal', 'rejected': 'badge-red'
  };
  return map[status] || 'badge-muted';
};

Patentify.typeBadgeClass = function(type) {
  const map = {
    'landscape_scan': 'badge-teal', 'invention_generation': 'badge-blue',
    'filing_preparation': 'badge-violet', 'patent_generation': 'badge-violet',
    'monitoring': 'badge-amber'
  };
  return map[type] || 'badge-muted';
};

Patentify.categoryBadgeClass = function(cat) {
  const map = {
    'landscape_scan': 'badge-teal', 'invention': 'badge-blue',
    'prior_art': 'badge-violet', 'competitor': 'badge-amber',
    'fto_analysis': 'badge-red', 'alert': 'badge-amber'
  };
  return map[cat] || 'badge-muted';
};

/* ── Number Formatting ── */
Patentify.numFmt = new Intl.NumberFormat('en-US');

/* ── Cron to Human Readable ── */
Patentify.cronToHuman = function(cron) {
  if (!cron) return 'Manual';
  const parts = cron.split(' ');
  if (parts.length < 5) return cron;
  const min = parts[0], hour = parts[1], dom = parts[2], mon = parts[3], dow = parts[4];
  if (dom === '*' && mon === '*' && dow === '*') {
    if (hour === '*') return 'Every minute';
    return 'Daily at ' + hour + ':' + (min === '0' ? '00' : min);
  }
  if (dow !== '*' && dom === '*') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dayNames = dow.split(',').map(function(d) { return days[parseInt(d)] || d; }).join(', ');
    return dayNames + ' at ' + hour + ':' + (min === '0' ? '00' : min);
  }
  return cron;
};

/* ── Secure Random ID ── */
Patentify.secureId = function(prefix) {
  prefix = prefix || 'id';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return prefix + '-' + Array.from(arr).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
};

/* ── API Fetch Wrapper ── */
Patentify.API_BASE = (function() {
  // Configurable: check for global override, meta tag, or default
  if (window.PATENTIFY_API_BASE) return window.PATENTIFY_API_BASE;
  const meta = document.querySelector('meta[name="api-base"]');
  if (meta) return meta.getAttribute('content');
  return 'http://localhost:8000';
})();

Patentify.apiFetch = async function(path, options) {
  try {
    const resp = await fetch(Patentify.API_BASE + path, options);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.json();
  } catch (e) {
    Patentify.toast('API Error: ' + e.message, 'error');
    throw e;
  }
};

window.Patentify = Patentify;
