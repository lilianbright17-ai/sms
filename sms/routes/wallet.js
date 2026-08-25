const express = require('express');
const db = require('../src/db');
const { formatMoney, requireAuth } = require('../src/helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/wallet', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const txs = db
    .prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(user.id);
  res.render('wallet', { user, txs, formatMoney });
});

module.exports = router;