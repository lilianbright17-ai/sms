function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

function formatMoney(cents) {
  return '$' + (Number(cents) / 100).toFixed(2);
}

function getMarkupPercent(db) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('markup_percent');
  return row ? Number(row.value) : 50;
}

function applyMarkup(rawCostDollars, markupPercent) {
  const cents = toCents(rawCostDollars);
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

module.exports = { toCents, formatMoney, getMarkupPercent, applyMarkup, requireAuth, requireAdmin };
