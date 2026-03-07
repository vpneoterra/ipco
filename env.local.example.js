/**
 * Patentify — Local Environment Overrides
 *
 * Copy this file to env.local.js and fill in your values.
 * env.local.js is .gitignored and will NOT be committed.
 *
 * Alternatively, you can set your API key via the UI:
 *   Command Center → Settings → Claude API Key
 */

window.PATENTIFY_CONFIG = {
  // Your Anthropic API key (starts with "sk-ant-...")
  // Get one at: https://console.anthropic.com/settings/keys
  ANTHROPIC_API_KEY: '',

  // Backend proxy URL (leave empty for direct browser→Anthropic calls)
  // If you run the optional backend: API_BASE: 'http://localhost:8000'
  API_BASE: '',

  // Default model for AI features
  DEFAULT_MODEL: 'claude-sonnet-4-20250514',
};
