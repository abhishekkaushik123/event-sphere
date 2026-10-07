const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Tighter limit on endpoints that can be brute-forced (OTP guessing, password guessing).
const strict = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { message: 'Too many attempts, try again later.' } });

router.post('/register', strict, c.register);
router.post('/verify-otp', strict, c.verifyOtp);
router.post('/resend-otp', strict, c.resendOtp);
router.post('/login', strict, c.login);
router.get('/me', protect, c.me);

module.exports = router;
