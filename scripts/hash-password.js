const crypto = require('node:crypto');

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run hash-password -- "a-password-with-at-least-12-characters"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
crypto.scrypt(password, salt, 64, (error, derivedKey) => {
  if (error) throw error;
  console.log(`scrypt$${salt}$${derivedKey.toString('hex')}`);
});
