// Login helpers: create the login cookie, and protect API routes.
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const COOKIE_NAME = 'token';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function setLoginCookie(res, user) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript in the browser cannot read this cookie.
    sameSite: 'lax', // Other websites cannot send it with form submissions.
    secure: process.env.NODE_ENV === 'production', // HTTPS only when live.
    maxAge: ONE_DAY_MS,
  });
}

export function clearLoginCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

export async function requireLogin(req, res, next) {
  try {
    const { userId } = jwt.verify(req.cookies[COOKIE_NAME], process.env.JWT_SECRET);
    req.user = await User.findById(userId);
  } catch {
    req.user = null;
  }
  if (!req.user) return res.status(401).json({ message: 'Please log in.' });
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ message: 'Access denied.' });
    next();
  };
}
