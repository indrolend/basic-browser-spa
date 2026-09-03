const STORAGE_KEY = 'indrolend:economy:v1';
const EVENT_NAME = 'indrolend:economy-change';
const MAX_TRANSACTIONS = 500;

function emptyLedger() {
  return { version: 1, balance: 0, transactions: [] };
}

function readLedger() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value?.version !== 1 || !Number.isFinite(value.balance) || !Array.isArray(value.transactions)) return emptyLedger();
    return value;
  } catch (_) {
    return emptyLedger();
  }
}

function snapshot(ledger = readLedger()) {
  return Object.freeze({ version: ledger.version, balance: ledger.balance });
}

function commit(ledger) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: snapshot(ledger) }));
}

function record({ id, amount, source, reason }) {
  if (typeof id !== 'string' || !id || !Number.isSafeInteger(amount) || amount === 0) return false;
  const ledger = readLedger();
  if (ledger.transactions.some((entry) => entry.id === id) || ledger.balance + amount < 0) return false;
  ledger.balance += amount;
  ledger.transactions.push({ id, amount, source, reason, at: Date.now() });
  if (ledger.transactions.length > MAX_TRANSACTIONS) ledger.transactions.splice(0, ledger.transactions.length - MAX_TRANSACTIONS);
  commit(ledger);
  return true;
}

export const IndrolendEconomy = Object.freeze({
  getSnapshot: () => snapshot(),
  award: ({ id, amount = 1, source = 'spa', reason = 'discovery' }) => amount > 0 && record({ id, amount, source, reason }),
  spend: ({ id, amount, source = 'spa', reason = 'unlock' }) => amount > 0 && record({ id, amount: -amount, source, reason }),
  subscribe(listener) {
    const handler = (event) => listener(event.detail);
    window.addEventListener(EVENT_NAME, handler);
    listener(snapshot());
    return () => window.removeEventListener(EVENT_NAME, handler);
  }
});

window.IndrolendEconomy = IndrolendEconomy;

export function awardDiscovery(sectionId, itemId) {
  return IndrolendEconomy.award({ id: `discover:${sectionId}:${itemId}`, source: 'spa', reason: `Discovered ${sectionId}/${itemId}` });
}

export function mountEconomyHud(element) {
  if (!element) return () => {};
  return IndrolendEconomy.subscribe(({ balance }) => {
    element.textContent = `${balance} signal`;
    element.setAttribute('aria-label', `${balance} Signal available`);
  });
}
