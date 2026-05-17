/**
 * Provider registry. Single platform-wide merchant-of-record model:
 * which providers are active is determined by env vars at boot, not per-creator config.
 */

const providers = new Map();

function registerProvider(name, instance) {
  providers.set(name, instance);
}

function getProvider(name) {
  const p = providers.get(name);
  if (!p) throw new Error(`Payment provider not registered: ${name}`);
  return p;
}

function listProviders() {
  return Array.from(providers.keys());
}

function hasProvider(name) {
  return providers.has(name);
}

module.exports = { registerProvider, getProvider, listProviders, hasProvider };
