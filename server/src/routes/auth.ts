import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';

const router = Router();

const REDIRECT_URI = `http://localhost:${config.port}/api/auth/google/callback`;
const CLIENT_ORIGIN = config.nodeEnv === 'production' ? '' : config.clientUrl;

function getOAuthClient() {
  return new OAuth2Client(config.googleClientId, config.googleClientSecret, REDIRECT_URI);
}

// Redirect to Google consent screen
router.get('/google', (_req, res) => {
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    hd: 'appcharge.com',
    prompt: 'select_account',
  });
  res.redirect(url);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${CLIENT_ORIGIN}/?error=missing_code`);
    return;
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.redirect(`${CLIENT_ORIGIN}/?error=invalid_token`);
      return;
    }

    // Enforce @appcharge.com domain
    if (payload.hd !== 'appcharge.com') {
      res.redirect(`${CLIENT_ORIGIN}/?error=unauthorized_domain`);
      return;
    }

    req.session.user = {
      email: payload.email!,
      name: payload.name || payload.email!,
      picture: payload.picture || '',
    };

    res.redirect(`${CLIENT_ORIGIN}/`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${CLIENT_ORIGIN}/?error=auth_failed`);
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
