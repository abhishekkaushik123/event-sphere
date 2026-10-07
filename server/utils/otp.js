const crypto = require('crypto');

// 6-digit numeric OTP from a cryptographically secure generator.
exports.generateOtp = () => String(crypto.randomInt(100000, 1000000));

// Keyed hash (HMAC) so a leaked database does not reveal usable OTPs.
exports.hashOtp = (otp, email) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${otp}`).digest('hex');

// Constant-time comparison to avoid timing attacks.
exports.safeEqual = (a, b) => {
  const ba = Buffer.from(a || '');
  const bb = Buffer.from(b || '');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};
