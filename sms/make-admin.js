// Usage: node make-admin.js you@example.com
// Promotes an existing account to admin so you can see the /admin panel.
require('dotenv').config();
const db = require('./src/db');

const email = process.argv[2];
if (!email) {
  console.log('Usage: node make-admin.js you@example.com');
  process.exit(1);
}

const result = db
  .prepare('UPDATE users SET is_admin = 1 WHERE email = ?')
  .run(email.toLowerCase());

if (result.changes === 0) {
  console.log(`No user found with email ${email}. Register that account first, then re-run this.`);
} else {
  console.log(`${email} is now an admin. Log out and back in for it to take effect.`);
}
