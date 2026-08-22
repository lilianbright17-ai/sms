const express = require('express');
const db = require('../src/db');
const { formatMoney, toCents, requireAuth } = require('../src/helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/wallet', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const txs = db
    .prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(user.id);
  res.render('wallet', { user, txs, formatMoney });
});

// DEMO top-up only — instantly credits the account with no real payment.
// Wire in a real processor (Stripe, a crypto gateway, etc.) before going live;
// see the README for notes on where this hook goes.
router.post('/wallet/demo-topup', (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0 || amount > 1000) {
    return res.redirect('/wallet');
  }
  const cents = toCents(amount);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(
      cents,
      req.session.userId
    );
    db.prepare(
      'INSERT INTO wallet_transactions (user_id, amount_cents, reason) VALUES (?, ?, ?)'
    ).run(req.session.userId, cents, 'Demo top-up');
  });
  tx();
  res.redirect('/wallet');
});

module.exports = router;
