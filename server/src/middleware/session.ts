import session from 'express-session';
import { config } from '../config.js';

export const sessionMiddleware = session({
  secret: config.sessionSecret,
  name: 'sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  },
});
