require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./src/db');

const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shop');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);

// Make the logged-in user available to every view without passing it manually.
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

app.get('/', (req, res) => res.redirect(req.session.userId ? '/dashboard' : '/login'));

app.use(authRoutes);
app.use(shopRoutes);
app.use(walletRoutes);
app.use(adminRoutes);

app.use((req, res) => res.status(404).render('404'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OTP shop running at http://localhost:${PORT}`);
  console.log(`Mock mode: ${require('./src/herosms').isMock() ? 'ON (no real HeroSMS calls)' : 'OFF (live)'}`);
});
