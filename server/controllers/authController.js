const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const sendEmail = require('../utils/sendEmail');
const { generateOtp, hashOtp, safeEqual } = require('../utils/otp');

const OTP_EXPIRY_MIN = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const OTP_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60;

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

// Generates + stores (hashed) + emails a fresh OTP.
async function issueOtp(user) {
  const otp = generateOtp();
  user.otpHash = hashOtp(otp, user.email);
  user.otpExpires = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);
  user.otpAttempts = 0;
  user.otpLastSent = new Date();
  await user.save();
  await sendEmail({
    to: user.email,
    subject: 'Your Event Sphere verification code',
    text: `Hi ${user.name},\n\nYour verification code is ${otp}.\nIt expires in ${OTP_EXPIRY_MIN} minutes. If you did not sign up, ignore this email.`,
  });
}

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email and password are required');
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  let user = await User.findOne({ email: email.toLowerCase() }).select('+otpLastSent');
  if (user && user.isVerified) {
    res.status(409);
    throw new Error('An account with this email already exists');
  }
  if (user) {
    // Abandoned, unverified sign-up: let the person retry with new details.
    user.name = name;
    user.password = password;
  } else {
    user = new User({ name, email, password }); // role always defaults to "user"
  }
  await issueOtp(user);
  res.status(201).json({ message: 'Account created. We emailed you a 6-digit verification code.', email: user.email });
});

// POST /api/auth/verify-otp
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+otpHash +otpExpires +otpAttempts');
  if (!user) {
    res.status(404);
    throw new Error('No account found for this email');
  }
  if (user.isVerified) {
    res.status(400);
    throw new Error('Email is already verified. Please log in.');
  }
  if (!user.otpHash || !user.otpExpires || user.otpExpires < new Date()) {
    res.status(400);
    throw new Error('Code expired. Please request a new one.');
  }
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    res.status(429);
    throw new Error('Too many wrong attempts. Please request a new code.');
  }
  if (!safeEqual(user.otpHash, hashOtp(String(otp || ''), user.email))) {
    user.otpAttempts += 1;
    await user.save();
    res.status(400);
    throw new Error(`Incorrect code. ${Math.max(0, OTP_MAX_ATTEMPTS - user.otpAttempts)} attempts left.`);
  }

  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  await user.save();
  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/resend-otp
exports.resendOtp = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() }).select('+otpLastSent');
  if (!user || user.isVerified) {
    // Same response either way so the endpoint cannot be used to discover registered emails.
    return res.json({ message: 'If this email needs verification, a new code has been sent.' });
  }
  const wait = user.otpLastSent ? OTP_COOLDOWN_SEC - (Date.now() - user.otpLastSent.getTime()) / 1000 : 0;
  if (wait > 0) {
    res.status(429);
    throw new Error(`Please wait ${Math.ceil(wait)}s before requesting another code.`);
  }
  await issueOtp(user);
  res.json({ message: 'If this email needs verification, a new code has been sent.' });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password +otpLastSent');
  if (!user || !(await user.matchPassword(password || ''))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }
  if (!user.isVerified) {
    res.status(403);
    // The frontend uses this flag to send the person to the OTP screen.
    return res.json({ message: 'Please verify your email first.', needsVerification: true, email: user.email });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});
