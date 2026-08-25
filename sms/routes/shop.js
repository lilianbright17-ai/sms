const express = require('express');
const db = require('../src/db');
const heroSms = require('../src/herosms');
const { formatMoney, getMarkupPercent, getExchangeRate, applyMarkup, requireAuth } = require('../src/helpers');

const router = express.Router();
router.use(requireAuth);

function getUser(req) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
}

router.get('/dashboard', async (req, res) => {
  const user = getUser(req);
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 8')
    .all(user.id);
  res.render('dashboard', { user, orders, formatMoney, mock: heroSms.isMock() });
});

router.get('/buy', async (req, res) => {
  const user = getUser(req);
  const countries = await heroSms.getCountries();
  res.render('buy', { user, countries, formatMoney });
});

// JSON: services available for a chosen country
router.get('/api/services', async (req, res) => {
  const countryId = req.query.country;
  const services = await heroSms.getServicesList(countryId);
  res.json({ services });
});

// JSON: your price (with markup and exchange rate already applied) for a service+country
router.get('/api/price', async (req, res) => {
  const { service, country } = req.query;
  if (!service || country === undefined) return res.status(400).json({ error: 'Missing params' });
  const raw = await heroSms.getPrices(service, country);
  const markup = getMarkupPercent(db);
  const rate = getExchangeRate(db);
  const priceCents = applyMarkup(raw.cost, markup, rate);
  res.json({ priceCents, price: formatMoney(priceCents), available: raw.count });
});

router.post('/buy', async (req, res) => {
  const user = getUser(req);
  const { service, country, serviceName, countryName } = req.body;
  if (!service || country === undefined) {
    return res.redirect('/buy');
  }

  const raw = await heroSms.getPrices(service, country);
  const markup = getMarkupPercent(db);
  const rate = getExchangeRate(db);
  const priceCents = applyMarkup(raw.cost, markup, rate);

  if (user.balance_cents < priceCents) {
    const countries = await heroSms.getCountries();
    return res.render('buy', {
      user,
      countries,
      formatMoney,
      error: `Not enough balance. This number costs ${formatMoney(priceCents)}, you have ${formatMoney(user.balance_cents)}.`,
    });
  }

  let number;
  try {
    number = await heroSms.getNumber(service, country);
  } catch (err) {
    const countries = await heroSms.getCountries();
    return res.render('buy', {
      user,
      countries,
      formatMoney,
      error: `HeroSMS couldn't give us a number for that combination: ${err.message}`,
    });
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?').run(
      priceCents,
      user.id
    );
    db.prepare(
      'INSERT INTO wallet_transactions (user_id, amount_cents, reason) VALUES (?, ?, ?)'
    ).run(user.id, -priceCents, `Purchased ${serviceName || service} number`);

    const info = db
      .prepare(
        `INSERT INTO orders
          (user_id, activation_id, service_code, service_name, country_id, country_name, phone_number, cost_cents, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting')`
      )
      .run(
        user.id,
        String(number.activationId),
        service,
        serviceName || service,
        Number(country),
        countryName || String(country),
        number.phoneNumber,
        priceCents
      );
    return info.lastInsertRowid;
  });

  const orderId = tx();
  res.redirect(`/orders/${orderId}`);
});

router.get('/orders', (req, res) => {
  const user = getUser(req);
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);
  res.render('orders', { user, orders, formatMoney });
});

router.get('/orders/:id', (req, res) => {
  const user = getUser(req);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, user.id);
  if (!order) return res.status(404).send('Order not found.');
  res.render('order', { user, order, formatMoney });
});

// Polled by the order page's JS every few seconds.
router.get('/orders/:id/status', async (req, res) => {
  const user = getUser(req);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, user.id);
  if (!order) return res.status(404).json({ error: 'Not found' });

  if (order.status === 'completed' || order.status === 'canceled') {
    return res.json({ status: order.status, code: order.otp_code, text: order.otp_text });
  }

  const raw = await heroSms.getStatus(order.activation_id);
  const data = raw && raw.data;
  if (data && data.code) {
    db.prepare(
      "UPDATE orders SET status = 'received', otp_code = ?, otp_text = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(data.code, data.text || null, order.id);
    return res.json({ status: 'received', code: data.code, text: data.text });
  }

  res.json({ status: order.status, code: order.otp_code, text: order.otp_text });
});

router.post('/orders/:id/finish', async (req, res) => {
  const user = getUser(req);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, user.id);
  if (!order) return res.status(404).send('Order not found.');

  await heroSms.setStatus(order.activation_id, 6);
  db.prepare("UPDATE orders SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(
    order.id
  );
  res.redirect(`/orders/${order.id}`);
});

router.post('/orders/:id/cancel', async (req, res) => {
  const user = getUser(req);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(req.params.id, user.id);
  if (!order) return res.status(404).send('Order not found.');

  await heroSms.setStatus(order.activation_id, 8);

  const tx = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'canceled', updated_at = datetime('now') WHERE id = ?").run(
      order.id
    );
    db.prepare('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?').run(
      order.cost_cents,
      user.id
    );
    db.prepare(
      'INSERT INTO wallet_transactions (user_id, amount_cents, reason) VALUES (?, ?, ?)'
    ).run(user.id, order.cost_cents, `Refund: canceled order #${order.id}`);
  });
  tx();

  res.redirect(`/orders/${order.id}`);
});

module.exports = router;