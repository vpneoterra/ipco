/**
 * Patentify — Environment Configuration
 *
 * This module manages the Claude API key, backend URL, and prompt caching.
 *
 * API key resolution order:
 *   1. window.PATENTIFY_CONFIG.ANTHROPIC_API_KEY  (set in env.local.js)
 *   2. localStorage.getItem('patentify_api_key')  (set via Settings UI)
 *   3. null  → AI features disabled, UI shows setup prompt
 *
 * PROMPT CACHING:
 *   When options.useCache is true, the system prompt is sent as a
 *   structured content block with cache_control: {type: "ephemeral"}.
 *   This enables Anthropic prompt caching — the system prompt is
 *   processed once and cached for 5 minutes, reducing costs by up
 *   to 90% on subsequent calls with the same prefix.
 *
 *   The USPTO Patent Skill (~4,500 tokens) is stored in
 *   PATENTIFY_USPTO_SKILL and injected as a cacheable system block
 *   for all patent-related workflow steps (WF1 Steps 1-7).
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
    ENABLE_PROMPT_CACHE: true,        // Enable Anthropic prompt caching (reduces cost ~90% on cache hits)
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
   * Build a system prompt array with prompt caching support.
   *
   * When useCache is true:
   *   - The system prompt is wrapped in a content block array
   *   - The last block gets cache_control: {type: "ephemeral"}
   *   - This tells Anthropic to cache the entire system prefix
   *
   * When useCache is false:
   *   - Falls back to plain string system prompt (legacy behavior)
   *
   * @param {string|Array} system - System prompt string or pre-built array
   * @param {boolean} useCache - Whether to enable prompt caching
   * @returns {string|Array} - Formatted system prompt
   */
  function buildSystemPrompt(system, useCache) {
    if (!system) return undefined;

    // If already an array (pre-built), return as-is
    if (Array.isArray(system)) return system;

    // If caching disabled, return plain string
    if (!useCache || !config.ENABLE_PROMPT_CACHE) return system;

    // Wrap in a cacheable content block
    return [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  /**
   * Make an authenticated request to the Anthropic API.
   * Supports prompt caching via options.useCache.
   *
   * @param {Object} options
   * @param {string} options.model - Claude model ID
   * @param {number} options.max_tokens - Max response tokens
   * @param {Array} options.messages - Conversation messages
   * @param {string|Array} options.system - System prompt (string or pre-built array)
   * @param {boolean} options.useCache - Enable prompt caching (default: false)
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

    var useCache = options.useCache && config.ENABLE_PROMPT_CACHE;

    var body = {
      model: options.model || config.DEFAULT_MODEL,
      max_tokens: options.max_tokens || config.MAX_TOKENS,
      messages: options.messages || []
    };

    // Build system prompt with optional caching
    var systemPrompt = buildSystemPrompt(options.system, useCache);
    if (systemPrompt) body.system = systemPrompt;

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

    var data = await resp.json();

    // Log cache performance metrics (dev mode)
    if (useCache && data.usage) {
      var cacheRead = data.usage.cache_read_input_tokens || 0;
      var cacheCreate = data.usage.cache_creation_input_tokens || 0;
      var uncached = data.usage.input_tokens || 0;
      if (cacheRead > 0 || cacheCreate > 0) {
        console.log('[Patentify Cache] Read: ' + cacheRead + ' tokens | Created: ' + cacheCreate + ' tokens | Uncached: ' + uncached + ' tokens');
      }
    }

    return data;
  }

  // Public API
  return {
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    clearApiKey: clearApiKey,
    hasApiKey: hasApiKey,
    getApiBase: getApiBase,
    claudeRequest: claudeRequest,
    buildSystemPrompt: buildSystemPrompt,
    config: config
  };
})();


// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM CONTEXT — CACHED SYSTEM PROMPT (Block 1)
// This block gives Claude full awareness of the project: what it is, the
// portfolio taxonomy, workflow chain, scoring systems, and output rules.
// Sent as the first cached block on every API call (~1,800 tokens).
// Combined with the USPTO skill (~4,500 tokens), the total cached prefix
// is ~6,300 tokens — still well within Anthropic's cache-friendly range.
// After the first call, subsequent calls within 5 min pay ~90% less.
// ═══════════════════════════════════════════════════════════════════════════════

window.PLATFORM_CONTEXT = {
  version: '1.0',
  lastUpdated: '2026-03-07',

  /**
   * The platform identity and project context, condensed for prompt caching.
   * This is the "who you are / what you're working on" block that every
   * API call should include so Claude understands the full project.
   *
   * IMPORTANT: No company names, product names, or organization identifiers
   * appear in this block. All references are generic/functional.
   */
  systemPrompt:
    '=== PLATFORM IDENTITY ===\n' +
    'You are the AI engine of a deep-tech IP strategy platform. This platform manages an end-to-end patent portfolio pipeline: from whitespace discovery through patent drafting, FTO analysis, CII scoring, filing strategy, and portfolio optimization.\n\n' +

    '=== PORTFOLIO TAXONOMY ===\n' +
    'The active portfolio spans 15 technology whitespace domains and 105 patentable invention concepts (7 per whitespace). Each whitespace has a canonical ID (WS-1 through WS-15) and belongs to a macro-domain cluster and competition zone.\n\n' +

    'Whitespace domains (wsId: shortName | patentabilityScore | ciisMean | TAM):\n' +
    'WS-1: SSE Interface | 9.2 | 0.626 | $180M-$350M\n' +
    'WS-2: Circular Materials | 9.0 | 0.631 | $200M-$400M\n' +
    'WS-3: Neuromorphic | 8.8 | 0.685 | $150M-$300M\n' +
    'WS-4: Cell-Free Biomanuf. | 8.6 | 0.657 | $120M-$250M\n' +
    'WS-5: Universal TIMs | 8.5 | 0.649 | $100M-$220M\n' +
    'WS-6: QEC Hardware | 8.4 | 0.666 | $130M-$280M\n' +
    'WS-7: Multi-Mat. AM | 8.3 | 0.687 | $110M-$240M\n' +
    'WS-8: Federated Edge AI | 8.1 | 0.701 | $100M-$200M\n' +
    'WS-9: Cryo Control | 8.0 | 0.659 | $90M-$190M\n' +
    'WS-10: Neural Interfaces | 7.9 | 0.654 | $80M-$180M\n' +
    'WS-11: Safety Verification | 7.8 | 0.685 | $70M-$160M\n' +
    'WS-12: WBG Packaging | 7.7 | 0.599 | $75M-$170M\n' +
    'WS-13: SynBio Materials | 7.6 | 0.638 | $65M-$150M\n' +
    'WS-14: Photonic Interconnect | 7.5 | 0.638 | $85M-$190M\n' +
    'WS-15: PQC Hardware | 7.4 | 0.665 | $60M-$140M\n\n' +

    'Each invention concept (Idea 1-105) maps to exactly one whitespace: Ideas 1-7 → WS-1, Ideas 8-14 → WS-2, ..., Ideas 99-105 → WS-15.\n\n' +

    '=== SCORING SYSTEMS ===\n' +
    '1. Patentability Score (0-10): Measures novelty, non-obviousness, enablement, and prior art distance. Source: Patent Lab analysis engine. Higher = stronger filing candidate.\n' +
    '2. Composite Innovation Index (CII, 0-1): Measures network centrality, economic value, legal feasibility, and strategic fit. Source: CII scoring engine. Higher = greater strategic value.\n' +
    'Both scores are pre-computed for all 15 whitespaces and 105 ideas.\n\n' +

    '=== WORKFLOW CHAIN ===\n' +
    'The platform operates four sequential AI-assisted workflow pipelines:\n' +
    'WF1 — Patent Pipeline: Idea disclosure → FTO analysis → claim drafting → figure generation → USPTO specification drafting → lawyer review → admin approval → filing → examination → award. Each step uses AI with domain-specific prompts.\n' +
    'WF2 — Whitespace Discovery: Domain scoping → patent landscape scan → whitespace identification & scoring → solution architecture → FTO deep dive → filing strategy → competitive intelligence → strategic review → record finalization → dashboard update.\n' +
    'WF3 — CII Scoring: Automated scoring of patent ideas on the Composite Innovation Index using multi-factor analysis.\n' +
    'WF4 — CII Training: Calibration and training pipeline for the CII scoring model using labeled examples.\n\n' +

    'Workflow chain execution order: WF1 → WF2 → WF3 → WF4. Each workflow can also run independently.\n\n' +

    '=== ROLE-BASED ACCESS ===\n' +
    'Platform roles: admin, patent-engineer, patent-lawyer, ip-strategist, ip-analyst, inventor. Each workflow step has a roleGate that determines who can execute or approve it.\n\n' +

    '=== OUTPUT CONVENTIONS (all AI-generated content must follow) ===\n' +
    '1. NEVER include any company names, organization names, or product brand names in generated patent text. Use generic functional descriptions only.\n' +
    '2. All patent-related output follows USPTO standards (37 CFR, MPEP). See the USPTO Patent Skill for detailed rules.\n' +
    '3. Maintain strictly clinical, objective, neutral-technical tone in all patent documents. No advocacy, marketing, or emotive language.\n' +
    '4. When referencing whitespace domains or ideas, use the canonical IDs (WS-1, Idea 42, etc.) for consistency across all modules.\n' +
    '5. Cost awareness: use the most efficient model for each task. Simple classification → Haiku. Standard drafting → Sonnet. Complex legal analysis → Opus.\n' +
    '6. All generated content should be self-contained and production-ready — no placeholders, no TODO markers, no incomplete sections.',

  /**
   * Helper: Build the full 3-block cached system prompt.
   *
   * Architecture:
   *   Block 1: PLATFORM_CONTEXT (cached) — project identity, taxonomy, workflows
   *   Block 2: USPTO_SKILL (cached)      — drafting rules, claim standards, figures
   *   Block 3: stepRole (uncached)        — per-call step instructions
   *
   * Blocks 1+2 are marked cache_control: "ephemeral" so Anthropic caches
   * the entire ~6,300-token prefix. Block 3 changes per call and is uncached.
   *
   * @param {string} [stepRole] - Step-specific instruction (optional)
   * @param {Object} [opts] - Options
   * @param {boolean} [opts.includeUSPTO=true] - Include USPTO skill block
   * @returns {Array} - System prompt content block array
   */
  buildFullSystem: function(stepRole, opts) {
    opts = opts || {};
    var includeUSPTO = opts.includeUSPTO !== false;

    var blocks = [
      {
        type: 'text',
        text: this.systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ];

    // Add USPTO skill as second cached block (for patent-related steps)
    if (includeUSPTO && window.PATENTIFY_USPTO_SKILL) {
      blocks.push({
        type: 'text',
        text: window.PATENTIFY_USPTO_SKILL.systemPrompt,
        cache_control: { type: 'ephemeral' }
      });
    }

    // Add step-specific role (uncached — changes per call)
    if (stepRole) {
      blocks.push({ type: 'text', text: stepRole });
    }

    return blocks;
  }
};


// ═══════════════════════════════════════════════════════════════════════════════
// USPTO PATENT SKILL — CACHED SYSTEM PROMPT (Block 2)
// Source: uspto-patents.skill (SKILL.md + 3 reference docs)
// This content is sent as a cached system prompt for all WF1 steps.
// On the first call, Anthropic caches it (~4,500 tokens). Subsequent
// calls within 5 min hit the cache, paying ~90% less for input tokens.
// ═══════════════════════════════════════════════════════════════════════════════

window.PATENTIFY_USPTO_SKILL = {
  version: '1.0',
  source: 'uspto-patents.skill',
  lastUpdated: '2026-03-07',

  /**
   * The full USPTO patent skill condensed into a single system prompt.
   * This combines SKILL.md + drafting-guidelines.md + language-guide.md +
   * figures-guide.md into one optimized block for prompt caching.
   *
   * Usage in claudeRequest:
   *   system: PATENTIFY_USPTO_SKILL.systemPrompt,
   *   useCache: true
   *
   * Cost savings model:
   *   - Without caching: ~4,500 input tokens × $3/MTok = $0.0135/call
   *   - Cache write (1st call): ~4,500 tokens × $3.75/MTok = $0.0169
   *   - Cache read (2nd+ call): ~4,500 tokens × $0.30/MTok = $0.00135/call
   *   - Savings per cached call: ~90%
   *   - Full WF1 pipeline (7 AI calls): saves ~$0.08 per invention
   *   - 105 inventions: saves ~$8.40 per full portfolio run
   */
  systemPrompt:
    'You are the USPTO Patent Drafting Engine for this IP strategy platform. You produce USPTO-compliant utility patent application documents following 37 CFR Part 1 and the Manual of Patent Examining Procedure (MPEP). You cover specification drafting, claim construction, figure guidance, FTO analysis, and patent-native language conventions.\n\n' +

    '=== NON-NEGOTIABLE RULES ===\n' +
    '1. SPECIFICATION ≠ STRATEGY: Filing draft contains only physical structure, manufacturing methods, usage, embodiments, process parameters, material alternatives, operating ranges, experimental examples, and definitions. Strategy goes in the Attorney Memo (separate deliverable).\n' +
    '2. NO PATENT PROFANITY: Never use absolute, restrictive, or categorical language. See PROHIBITED TERMS below.\n' +
    '3. NO ARGUMENTATIVE PRIOR ART: Never attack prior art with "fails," "fundamentally limited," or "no prior art exists." Use neutral characterizations: "existing approaches have not addressed," "the art does not disclose." Never name competitors in Background.\n' +
    '4. SINGLE REGISTER: Strictly clinical, objective, neutral-technical tone. No advocacy, marketing, pedagogy, metaphors, colloquialisms, emotive descriptors.\n' +
    '5. PROPHETIC ≠ WORKING: Working examples = past tense ("was milled"). Prophetic = present tense ("is formed," "is expected to exhibit"). Include uncertainty bounds for prophetic predictions.\n' +
    '6. CLAIMS: ONE SENTENCE EACH ending in period. Use "a/an" to introduce new elements; "the/said" to refer back. Sequential numbering only (1,2,3…).\n' +
    '7. NO PLACEHOLDERS: Never output [FIGURE PLACEHOLDER], [ATTORNEY DOCKET], etc. Draft seamless text.\n' +
    '8. PROPER SCIENTIFIC NOTATION: Use standard Unicode (e.g., 10⁵ A/cm², μ₀H_c2(0)).\n\n' +

    '=== PROHIBITED TERMS (replace immediately) ===\n' +
    'critical → important/significant (whitelist scientific uses like "critical temperature") | only → in at least one embodiment | requires → may employ | must → may/is configured to | best/optimal → preferred/advantageous | the invention is → the present disclosure relates to | superior → improved/enhanced | essential → advantageous | exclusively → preferentially | necessary → beneficial | impossible → not readily achievable | uniquely → in certain embodiments | solely → primarily | never/always → qualified conditional | ideal/perfect → preferred/substantially matched | no prior art exists → existing approaches have not addressed | the prior art fails → the art does not disclose\n\n' +

    '=== APPROVED PATENT PHRASES (prioritize) ===\n' +
    'approximately | wherein | at least | comprising | about | preferably | having | without | selected from the group consisting of | may be | in a preferred embodiment | substantially | further comprising | in the range of | is configured to | at least one of | optionally | one or more of | in certain embodiments | without limitation | illustrative/non-limiting | as used herein | referring now to FIG. | free of/substantially free of | in the absence of\n\n' +

    '=== SPECIFICATION STRUCTURE (37 CFR § 1.77) ===\n' +
    'Section order (headings UPPERCASE, no bold/underline):\n' +
    '1. TITLE OF THE INVENTION (≤500 chars)\n' +
    '2. CROSS-REFERENCE TO RELATED APPLICATIONS\n' +
    '3. STATEMENT REGARDING FEDERALLY SPONSORED RESEARCH\n' +
    '4. INCORPORATION-BY-REFERENCE (if applicable)\n' +
    '5. BACKGROUND OF THE INVENTION (3-4 paras: field → problem → incomplete approaches → transition)\n' +
    '6. BRIEF SUMMARY OF THE INVENTION\n' +
    '7. BRIEF DESCRIPTION OF THE DRAWINGS\n' +
    '8. DETAILED DESCRIPTION (continuous prose, [0001] numbering, enable PHOSITA, best mode)\n' +
    '9. CLAIM(S) (separate sheet)\n' +
    '10. ABSTRACT OF THE DISCLOSURE (separate sheet, ≤150 words, no merits/comparisons)\n\n' +

    '=== DOCUMENT FORMAT (37 CFR § 1.52) ===\n' +
    'US Letter or A4, portrait only. Margins: top ≥3/4", left ≥1", right ≥3/4", bottom ≥3/4". Font: 12pt Arial/Times/Courier, black on white. Spacing: 1.5 or double. Pages numbered consecutively from 1. Paragraphs: [0001], [0002], etc.\n\n' +

    '=== CLAIM DRAFTING RULES (37 CFR § 1.75) ===\n' +
    'Default to "comprising" (open-ended). Dependent: "The [category] of claim [X], wherein [additional limitation]." Claims must differ substantially. Antecedent basis: introduce with "a/an", refer back with "the/said". Multi-element claims: indent each element. Three ladders: commercially broad, examiner-resistant, data-supported fallback. Markush: "selected from the group consisting of". No alphanumeric suffixes (17A, 17B). Each claim term maps to exactly one specification term.\n\n' +

    '=== QUANTITATIVE LANGUAGE PATTERNS ===\n' +
    'Lower bound: "at least [value]" | Approximation: "approximately [value]" | Range: "in the range of [X] to [Y]" | Hedged range: "from about [X] to about [Y]" | Define "approximately" in spec (e.g., "within ±10% of stated value").\n\n' +

    '=== NEGATIVE LIMITATIONS ===\n' +
    'without [element] | without requiring | free of | substantially free of | absent | does not require | in the absence of | excluding | other than | without the need for\n\n' +

    '=== DRAWING STANDARDS (37 CFR § 1.84) ===\n' +
    'Black-and-white line art only. Figure labels: "FIG. X" consecutive Arabic numerals. Reference characters ≥0.32 cm height, plain, no enclosures. Same part = same character across all figures. Lead lines present, not crossing. Margins: top ≥1", left ≥1", right ≥5/8", bottom ≥3/8". Shading: thin spaced lines preferred, light from upper-left 45°. Scale: details visible at 2/3 reduction. One view suitable for published front page.\n\n' +

    '=== FOUR DELIVERABLES (never combine) ===\n' +
    'A. FILING DRAFT: Clean patent specification only. Zero strategy/notes.\n' +
    'B. ATTORNEY MEMO: Novelty anchors, §103/§112 risks, prosecution strategy, competitive analysis, design-around vulnerabilities.\n' +
    'C. PRIOR-ART TABLE: Peer references, overlapping elements, true distinctions, evidentiary support.\n' +
    'D. CLAIM SUPPORT MATRIX: Each claim term → spec paragraph(s), experimental vs. prophetic classification.\n\n' +

    '=== PRE-FILING CHECKLIST ===\n' +
    '□ Blocklist scan: all prohibited terms replaced (context-aware for scientific terms)\n' +
    '□ Single neutral-technical register throughout\n' +
    '□ Antecedent basis: all claim terms introduced with "a/an", referenced with "the/said"\n' +
    '□ Prophetic language uses conditional tense with uncertainty bounds\n' +
    '□ No placeholders, no unresolved dates, no empty sections\n' +
    '□ Background: no competitor names, no specific citations, 3-4 paragraphs max\n' +
    '□ Section headings UPPERCASE, no bold/underline\n' +
    '□ Title ≤500 characters\n' +
    '□ Abstract on separate page, ≤150 words, no merits/comparisons\n' +
    '□ Claims on separate page, consecutively numbered\n' +
    '□ Each claim: capital letter start, period end\n' +
    '□ Drawing references consistent between description and figures\n' +
    '□ All reference numerals in text appear in drawings and vice versa\n' +
    '□ Content separation: no strategy in specification, no specification in memo',

  /**
   * Helper: Build a system prompt array combining the cached USPTO skill
   * with a step-specific role instruction. The USPTO skill is the cached
   * block; the step role is a small uncached addition.
   *
   * @param {string} stepRole - Short step-specific role instruction
   * @returns {Array} - System prompt array for claudeRequest
   */
  buildCachedSystem: function(stepRole) {
    var blocks = [
      {
        type: 'text',
        text: this.systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ];
    if (stepRole) {
      blocks.push({ type: 'text', text: stepRole });
    }
    return blocks;
  }
};


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
