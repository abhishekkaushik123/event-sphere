const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Verifies the Bearer JWT and attaches the user to req.
exports.protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401);
    throw new Error('Not authorized: token missing');
  }
  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error('Not authorized: token invalid or expired');
  }
  const user = await User.findById(decoded.id);
  if (!user || !user.isVerified) {
    res.status(401);
    throw new Error('Not authorized: user no longer exists or is not verified');
  }
  req.user = user;
  next();
});

// Role-based access control: authorize('admin')
exports.authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Forbidden: you do not have permission for this action');
    }
    next();
  };
