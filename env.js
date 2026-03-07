/**
 * Patentify — Environment Configuration
 *
 * This module manages the Claude API key and backend URL.
 *
 * API key resolution order:
 *   1. window.PATENTIFY_CONFIG.ANTHROPIC_API_KEY  (set in env.local.js)
 *   2. localStorage.getItem('patentify_api_key')  (set via Settings UI)
 *   3. null  → AI features disabled, UI shows setup prompt
 *
 * SECURITY NOTE:
 *   Client-side API keys are visible in the browser. For production,
 *   route calls through a backend proxy (see /docs/backend-proxy.md).
 */

window.PATENTIFY_CONFIG = window.PATENTIFY_CONFIG || {};

var PatentifyEnv = (function() {
  'use strict';

  // Default config
  var defaults = {
    API_BASE: '',                     // Backend proxy URL (empty = no proxy, use direct Anthropic calls)
    ANTHROPIC_API_KEY: '',            // Set in env.local.js or via UI
    DEFAULT_MODEL: 'claude-sonnet-4-20250514',
    MAX_TOKENS: 4096,
  };

  // Merge with any values set before this script loaded
  var config = Object.assign({}, defaults, window.PATENTIFY_CONFIG);

  /**
   * Get the Anthropic API key from config or localStorage
   */
  function getApiKey() {
    // 1. Check runtime config (set in env.local.js)
    if (config.ANTHROPIC_API_KEY) return config.ANTHROPIC_API_KEY;
    // 2. Check localStorage (set via Settings UI)
    var stored = null;
    try { stored = localStorage.getItem('patentify_api_key'); } catch(e) {}
    if (stored) return stored;
    // 3. No key available
    return null;
  }

  /**
   * Save API key to localStorage
   */
  function setApiKey(key) {
    try { localStorage.setItem('patentify_api_key', key || ''); } catch(e) {}
    config.ANTHROPIC_API_KEY = key || '';
  }

  /**
   * Clear stored API key
   */
  function clearApiKey() {
    try { localStorage.removeItem('patentify_api_key'); } catch(e) {}
    config.ANTHROPIC_API_KEY = '';
  }

  /**
   * Check if API key is configured
   */
  function hasApiKey() {
    var key = getApiKey();
    return key && key.length > 10;
  }

  /**
   * Get the backend API base URL
   */
  function getApiBase() {
    // Check meta tag first (backwards compatible)
    var meta = document.querySelector('meta[name="api-base"]');
    if (meta && meta.getAttribute('content') && meta.getAttribute('content') !== 'http://localhost:8000') {
      return meta.getAttribute('content');
    }
    return config.API_BASE || '';
  }

  /**
   * Make an authenticated request to the Anthropic API
   * Falls back to backend proxy if API_BASE is set
   */
  async function claudeRequest(options) {
    var apiBase = getApiBase();

    // If backend proxy is configured, use it
    if (apiBase) {
      var resp = await fetch(apiBase + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      if (!resp.ok) throw new Error('Backend API error: HTTP ' + resp.status);
      return await resp.json();
    }

    // Direct Anthropic API call
    var key = getApiKey();
    if (!key) {
      throw new Error('No API key configured. Go to Command Center → Settings to add your Claude API key.');
    }

    var body = {
      model: options.model || config.DEFAULT_MODEL,
      max_tokens: options.max_tokens || config.MAX_TOKENS,
      messages: options.messages || []
    };
    if (options.system) body.system = options.system;

    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (resp.status === 401) {
      throw new Error('Invalid API key. Check your Claude API key in Settings.');
    }
    if (!resp.ok) {
      var errorData = await resp.json().catch(function() { return {}; });
      throw new Error('Anthropic API error: ' + (errorData.error?.message || 'HTTP ' + resp.status));
    }

    return await resp.json();
  }

  // Public API
  return {
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    clearApiKey: clearApiKey,
    hasApiKey: hasApiKey,
    getApiBase: getApiBase,
    claudeRequest: claudeRequest,
    config: config
  };
})();


// ═══════════════════════════════════════════════════════════════════════════════
// CANONICAL WHITESPACE DATA CONTRACT v1.0
// All modules MUST reference these canonical identifiers and names.
// Source of truth: Patent Lab (patent_data_normalized.json) + CIIS Engine
// ═══════════════════════════════════════════════════════════════════════════════

window.PATENTIFY_CANONICAL = {
  version: '1.0',
  lastUpdated: '2026-03-07',
  taxonomy: '15-domain-deep-tech',
  whitespaces: [
    { wsId: 1,  ideaRange: [1,7],   name: 'Universal Solid-State Electrolyte Interface Engineering',         shortName: 'SSE Interface',         ciisMean: 0.626, patScore: 9.2, tam: '$180M-$350M', cz: 'CZ-1', macroDomain: 'MD-1' },
    { wsId: 2,  ideaRange: [8,14],  name: 'Circular & Earth-Abundant Electronic Materials',                   shortName: 'Circular Materials',    ciisMean: 0.631, patScore: 9.0, tam: '$200M-$400M', cz: 'CZ-9', macroDomain: 'MD-1' },
    { wsId: 3,  ideaRange: [15,21], name: 'Neuromorphic Computing Substrate & Architecture IP',               shortName: 'Neuromorphic',          ciisMean: 0.685, patScore: 8.8, tam: '$150M-$300M', cz: 'CZ-3', macroDomain: 'MD-8' },
    { wsId: 4,  ideaRange: [22,28], name: 'Cell-Free Biomanufacturing Process Platforms',                     shortName: 'Cell-Free Biomanuf.',   ciisMean: 0.657, patScore: 8.6, tam: '$120M-$250M', cz: 'CZ-4', macroDomain: 'MD-3' },
    { wsId: 5,  ideaRange: [29,35], name: 'Universal Thermal Interface Materials',                            shortName: 'Universal TIMs',        ciisMean: 0.649, patScore: 8.5, tam: '$100M-$220M', cz: 'CZ-5', macroDomain: 'MD-5' },
    { wsId: 6,  ideaRange: [36,42], name: 'Quantum Error Correction Hardware Primitives',                     shortName: 'QEC Hardware',          ciisMean: 0.666, patScore: 8.4, tam: '$130M-$280M', cz: 'CZ-6', macroDomain: 'MD-6' },
    { wsId: 7,  ideaRange: [43,49], name: 'Multi-Material Additive Manufacturing Process Control',            shortName: 'Multi-Mat. AM',         ciisMean: 0.687, patScore: 8.3, tam: '$110M-$240M', cz: 'CZ-7', macroDomain: 'MD-7' },
    { wsId: 8,  ideaRange: [50,56], name: 'Federated Learning & Privacy-Preserving Edge AI',                  shortName: 'Federated Edge AI',     ciisMean: 0.701, patScore: 8.1, tam: '$100M-$200M', cz: 'CZ-3', macroDomain: 'MD-8' },
    { wsId: 9,  ideaRange: [57,63], name: 'Cryogenic Control Electronics for Quantum Processors',             shortName: 'Cryo Control',          ciisMean: 0.659, patScore: 8.0, tam: '$90M-$190M',  cz: 'CZ-6', macroDomain: 'MD-6' },
    { wsId: 10, ideaRange: [64,70], name: 'Bio-Electronic Neural Interfaces (Non-Implantable)',               shortName: 'Neural Interfaces',     ciisMean: 0.654, patScore: 7.9, tam: '$80M-$180M',  cz: 'CZ-8', macroDomain: 'MD-3' },
    { wsId: 11, ideaRange: [71,77], name: 'Autonomous System Safety Verification',                            shortName: 'Safety Verification',   ciisMean: 0.685, patScore: 7.8, tam: '$70M-$160M',  cz: 'CZ-7', macroDomain: 'MD-4' },
    { wsId: 12, ideaRange: [78,84], name: 'Wide-Bandgap Semiconductor Packaging',                             shortName: 'WBG Packaging',         ciisMean: 0.599, patScore: 7.7, tam: '$75M-$170M',  cz: 'CZ-5', macroDomain: 'MD-2' },
    { wsId: 13, ideaRange: [85,91], name: 'Synthetic Biology Materials Discovery Pipeline',                   shortName: 'SynBio Materials',      ciisMean: 0.638, patScore: 7.6, tam: '$65M-$150M',  cz: 'CZ-4', macroDomain: 'MD-3' },
    { wsId: 14, ideaRange: [92,98], name: 'Photonic Interconnect Standards & Interoperability',               shortName: 'Photonic Interconnect', ciisMean: 0.638, patScore: 7.5, tam: '$85M-$190M',  cz: 'CZ-2', macroDomain: 'MD-2' },
    { wsId: 15, ideaRange: [99,105],name: 'Quantum-Safe Cryptographic Hardware Accelerators',                 shortName: 'PQC Hardware',          ciisMean: 0.665, patScore: 7.4, tam: '$60M-$140M',  cz: 'CZ-6', macroDomain: 'MD-6' }
  ],
  totalIdeas: 105,
  ideasPerWhitespace: 7,
  scoringSystems: {
    patentability: { source: 'Patent Lab', scale: '0-10', measures: 'novelty, non-obviousness, enablement, prior art distance' },
    ciis: { source: 'CIIS Engine', scale: '0-1', measures: 'network centrality, economic value, legal feasibility, strategic fit' }
  },
  // Strategy Report paradigms are archived reference material, NOT part of the active platform taxonomy
  strategyReportParadigms: {
    status: 'ARCHIVED',
    note: 'These 5 AI-science paradigms from the IP Whitespace Dominance Strategy Report v2.0 are complementary research references. They are NOT active whitespace domains and have no linked patent ideas or CIIS scores.',
    paradigms: ['De Novo Protein Design', 'Post-Lithium Materials Discovery', 'Plasma Physics RL Control', 'Mathematically Verified Software', 'PINN Earth Sciences']
  }
};
