const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
  const { email, password, confirm } = req.body;
  if (!email || !password) {
    return res.render('register', { error: 'Enter an email and a password.' });
  }
  if (password !== confirm) {
    return res.render('register', { error: "Passwords don't match." });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.render('register', { error: 'An account with that email already exists.' });
  }
  const hash = await bcrypt.hash(password, 10);
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email.toLowerCase(), hash);

  req.session.userId = info.lastInsertRowid;
  req.session.isAdmin = false;
  res.redirect('/dashboard');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase());
  if (!user) return res.render('login', { error: 'No account matches that email.' });

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.render('login', { error: 'Wrong password.' });

  req.session.userId = user.id;
  req.session.isAdmin = !!user.is_admin;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
