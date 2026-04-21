import { Router } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const router = Router();

function getRedirectUri(req: import('express').Request) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/api/auth/google/callback`;
}

function getClientOrigin(req: import('express').Request) {
  if (config.nodeEnv === 'production') return '';
  return config.clientUrl;
}

// Redirect to Google consent screen
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const redirectUri = getRedirectUri(req);
  const client = new OAuth2Client(config.googleClientId, config.googleClientSecret, redirectUri);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    hd: 'appcharge.com',
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const clientOrigin = getClientOrigin(req);
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code) {
    res.redirect(`${clientOrigin}/?error=missing_code`);
    return;
  }

  if (!state || state !== req.session.oauthState) {
    res.redirect(`${clientOrigin}/?error=invalid_state`);
    return;
  }
  delete req.session.oauthState;

  try {
    const redirectUri = getRedirectUri(req);
    const client = new OAuth2Client(config.googleClientId, config.googleClientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.redirect(`${clientOrigin}/?error=invalid_token`);
      return;
    }

    // Enforce @appcharge.com domain
    if (payload.hd !== 'appcharge.com') {
      res.redirect(`${clientOrigin}/?error=unauthorized_domain`);
      return;
    }

    req.session.user = {
      email: payload.email!,
      name: payload.name || payload.email!,
      picture: payload.picture || '',
    };

    res.redirect(`${clientOrigin}/`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${clientOrigin}/?error=auth_failed`);
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json(req.session.user);
});

export default router;
