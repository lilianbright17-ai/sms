const express = require('express');
const db = require('../src/db');
const heroSms = require('../src/herosms');
const { formatMoney, toCents, requireAuth, requireAdmin } = require('../src/helpers');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/admin', async (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  const orders = db
    .prepare(
      `SELECT orders.*, users.email FROM orders
       JOIN users ON users.id = orders.user_id
       ORDER BY orders.created_at DESC LIMIT 30`
    )
    .all();
  const markupRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('markup_percent');
  let heroBalance = null;
  try {
    heroBalance = (await heroSms.getBalance()).balance;
  } catch {
    heroBalance = null;
  }
  res.render('admin', {
    user: db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId),
    users,
    orders,
    formatMoney,
    markupPercent: markupRow.value,
    heroBalance,
    mock: heroSms.isMock(),
  });
});

router.post('/admin/markup', (req, res) => {
  const percent = Number(req.body.markup_percent);
  if (Number.isFinite(percent) && percent >= 0) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(percent), 'markup_percent');
  }
  res.redirect('/admin');
});

router.post('/admin/credit', (req, res) => {
  const { userId, amount } = req.body;
  const cents = toCents(amount);
  if (!userId || !cents) return res.redirect('/admin');

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(cents, userId);
    db.prepare(
      'INSERT INTO wallet_transactions (user_id, amount_cents, reason) VALUES (?, ?, ?)'
    ).run(userId, cents, 'Admin credit adjustment');
  });
  tx();
  res.redirect('/admin');
});

module.exports = router;
