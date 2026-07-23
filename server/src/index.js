import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';
import { encryptJson, signState, verifyState } from './crypto.js';
import { exchangeGoogleCode, getYouTubeChannel, youtubeAuthorizationUrl } from './google.js';

const required = [
  'FRONTEND_URL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY',
  'TOKEN_ENCRYPTION_KEY', 'STATE_SIGNING_SECRET'
];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

const app = express();
const port = Number(process.env.PORT || 10000);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: false }));
app.use(express.json({ limit: '1mb' }));

async function requireUser(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user = data.user;
  next();
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'social-flow-api' }));

app.get('/api/connections', requireUser, async (req, res) => {
  const { data, error } = await supabase
    .from('platform_connections')
    .select('id, platform, platform_account_id, account_name, avatar_url, created_at, updated_at')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: 'Unable to load connected accounts' });
  res.json({ connections: data });
});

app.post('/api/oauth/youtube/start', requireUser, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return res.status(503).json({ error: 'YouTube OAuth is not configured yet' });
  }
  const state = signState({
    userId: req.user.id,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000
  });
  res.json({ url: youtubeAuthorizationUrl(state) });
});

app.get('/api/oauth/youtube/callback', async (req, res) => {
  const returnUrl = new URL(process.env.FRONTEND_URL);
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('YouTube OAuth is not configured yet');
    }
    if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
    const state = verifyState(req.query.state);
    const tokens = await exchangeGoogleCode(String(req.query.code || ''));
    const channel = await getYouTubeChannel(tokens.access_token);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    const { error } = await supabase.from('platform_connections').upsert({
      user_id: state.userId,
      platform: 'youtube',
      platform_account_id: channel.id,
      account_name: channel.name,
      avatar_url: channel.avatar_url,
      encrypted_tokens: encryptJson({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        scope: tokens.scope
      }),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,platform,platform_account_id' });
    if (error) throw error;
    returnUrl.searchParams.set('connected', 'youtube');
  } catch (error) {
    console.error('YouTube OAuth callback failed:', error.message);
    returnUrl.searchParams.set('oauth_error', error.message);
  }
  res.redirect(returnUrl.toString());
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Social Flow API listening on port ${port}`);
});
