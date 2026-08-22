# SignalDesk — HeroSMS number resale site

A full working site for reselling virtual verification numbers, built on
HeroSMS's API (SMS-Activate compatible). Accounts, a wallet, browsing
countries/services, buying a number, watching the OTP arrive live, and an
admin panel for markup + manual balance credits.

## Stack

Plain Node.js + Express + EJS templates + SQLite (via `better-sqlite3`, a
single local file, no separate database server to install). No frontend
framework or build step — open it in VS Code and run it.

## 1. Install and configure

```bash
cd otp-shop
npm install
cp .env.example .env
```

Open `.env` and set:

- `SESSION_SECRET` — any long random string.
- `HEROSMS_API_KEY` — leave blank for now.
- `MOCK_MODE=true` — keep this while you don't have a key yet (see below).

## 2. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`. Register an account — you'll land on the
dashboard with a starting balance of $0.

To test buying a number without spending real money or having a HeroSMS
key yet, go to **Wallet** and use the demo top-up to add balance, then
**Buy a number**. In mock mode, a fake number and a fake OTP (arriving
after ~8 seconds) are generated so you can see the whole flow end to end.

## 3. Go live with HeroSMS

1. Create a HeroSMS account at hero-sms.com and request an API key.
2. Put the key in `.env` as `HEROSMS_API_KEY`.
3. Set `MOCK_MODE=false`.
4. Restart the server.

All calls (`getCountries`, `getServicesList`, `getPrices`, `getNumberV2`,
`getStatusV2`, `setStatus`) now hit HeroSMS's real
`stubs/handler_api.php` endpoint — see `src/herosms.js`, which is the only
file that talks to HeroSMS. Everything else in the app just calls the
functions it exports, so going live doesn't touch any other file.

### Webhooks (optional, recommended once you're live)

Right now the order page polls for the OTP every 3 seconds
(`GET /orders/:id/status`). HeroSMS also supports webhooks so you don't
have to poll — up to 3 HTTPS URLs configured in your HeroSMS account
settings, which they POST to instantly when an SMS arrives. If you want
that later, add a route like `POST /webhooks/herosms` that verifies the
request is really from HeroSMS's IPs (`84.32.223.53`, `185.138.88.87`)
and writes the code straight into the matching order — the polling
endpoint can stay as a fallback.

## 4. Make yourself an admin

```bash
node make-admin.js you@example.com
```

Log out and back in — you'll see an **Admin** link for setting the markup
percentage and crediting user balances by hand.

## 5. Add real payments

The wallet currently only has a **demo top-up** (`/wallet/demo-topup`)
that instantly credits the account — there's no real money involved yet.
Before you launch, replace that route in `routes/wallet.js` with a real
payment processor (Stripe, a crypto payment gateway, etc.) that credits
`balance_cents` only after a payment actually confirms. Everything else
(pricing, purchases, order tracking) is already wired to `balance_cents`
and won't need to change.

## Project layout

```
server.js            entry point
src/db.js             SQLite schema + connection
src/herosms.js         HeroSMS API client (mock + live)
src/helpers.js         money formatting, markup math, auth guards
routes/auth.js          register/login/logout
routes/shop.js          dashboard, buy, orders, OTP polling
routes/wallet.js         balance + demo top-up
routes/admin.js          markup setting, user credits, order overview
views/                    EJS templates
public/css/style.css       styling
make-admin.js              CLI: promote a user to admin
```

## Notes on legitimate use

Number-resale services like this are commonly used for testing, avoiding
spam on a personal number, and privacy — but they're also a target for
abuse (mass fake-account creation, fraud). If you run this publicly,
plan for basic anti-abuse measures (rate limits, ID/payment verification
for large top-ups, monitoring for abuse patterns) and check HeroSMS's own
terms of service for what they allow you to build on top of their API.
