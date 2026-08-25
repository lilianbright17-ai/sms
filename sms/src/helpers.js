function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

function formatMoney(cents) {
  return '₦' + (Number(cents) / 100).toFixed(2);
}

function getMarkupPercent(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('markup_percent');
  return row ? Number(row.value) : 50;
}

function getExchangeRate(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('exchange_rate_ngn');
  return row ? Number(row.value) : 1500;
}

// rawCostDollars: what HeroSMS charges you, in USD.
// exchangeRate: how many Naira per $1 (set in Admin).
// markupPercent: your profit margin on top.
function applyMarkup(rawCostDollars, markupPercent, exchangeRate) {
  const nairaCost = Number(rawCostDollars) * Number(exchangeRate);
  const cents = toCents(nairaCost);
  return Math.ceil(cents * (1 + markupPercent / 100));
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).send('Admin access only.');
  next();
}

module.exports = { toCents, formatMoney, getMarkupPercent, getExchangeRate, applyMarkup, requireAuth, requireAdmin };