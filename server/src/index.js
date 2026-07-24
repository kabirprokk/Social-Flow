import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { encryptJson, signState, verifyState } from './crypto.js';
import { exchangeGoogleCode, getYouTubeChannel, youtubeAuthorizationUrl } from './google.js';
import { uploadThumbnail, uploadVideoResumable, validAccessToken, waitForVideoProcessing } from './youtube-upload.js';

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
const uploadJobs = new Map();
const upload = multer({
  dest: path.join(os.tmpdir(), 'social-flow-uploads'),
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 2 }
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

app.get('/', (_req, res) => res.json({
  ok: true,
  service: 'social-flow-api',
  message: 'Social Flow API is running. Open the frontend application to use Social Flow.'
}));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'social-flow-api' }));

app.get('/api/connections', requireUser, async (req, res) => {
  const { data, error } = await supabase
    .from('platform_connections')
    .select('id, platform, platform_account_id, account_name, avatar_url, created_at, updated_at')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: 'Unable to load connected accounts' });
  res.json({ connections: data });
});

async function removeUploadFiles(files) {
  const paths = Object.values(files || {}).flat().map(file => file.path);
  await Promise.all(paths.map(filePath => fs.unlink(filePath).catch(() => {})));
}

async function processYouTubeUpload(job, connection, files, fields) {
  try {
    job.state = 'preparing';
    job.message = 'Preparing secure YouTube upload';
    const accessToken = await validAccessToken(supabase, connection);
    job.state = 'uploading';
    job.message = 'Uploading to YouTube';
    const video = await uploadVideoResumable({
      accessToken,
      file: files.video[0],
      metadata: {
        title: fields.title,
        description: fields.description || '',
        tags: String(fields.tags || '').split(/[,\s#]+/).filter(Boolean).slice(0, 30),
        privacy: ['public', 'private', 'unlisted'].includes(fields.privacy) ? fields.privacy : 'private'
      },
      onProgress: progress => { job.progress = progress; }
    });
    job.videoId = video.id;
    job.url = `https://www.youtube.com/watch?v=${video.id}`;
    if (files.thumbnail?.[0]) {
      job.state = 'processing';
      job.message = 'Setting custom thumbnail';
      try {
        await uploadThumbnail(accessToken, video.id, files.thumbnail[0]);
      } catch (error) {
        console.warn('YouTube thumbnail skipped:', error.message);
        job.warning = `Video published, but YouTube rejected the custom thumbnail: ${error.message}`;
      }
    }
    job.state = 'processing';
    job.progress = 99;
    job.message = 'Processing on YouTube';
    const processing = await waitForVideoProcessing(accessToken, video.id, status => {
      job.state = 'processing';
      job.progress = status.percent ?? 99;
      job.message = status.percent
        ? `Processing on YouTube (${status.percent}%)`
        : 'Processing on YouTube';
    });
    if (!processing.processed) {
      job.warning = [job.warning, 'YouTube is still processing this video. Check YouTube Studio for final status.']
        .filter(Boolean).join(' ');
    }
    job.state = 'completed';
    job.progress = 100;
    job.message = job.warning || 'Published to YouTube';
    job.completedAt = Date.now();
  } catch (error) {
    console.error('YouTube upload failed:', error.message);
    job.state = 'failed';
    job.message = error.message;
    job.completedAt = Date.now();
  } finally {
    await removeUploadFiles(files);
  }
}

app.post('/api/youtube/uploads', requireUser, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
  const video = req.files?.video?.[0];
  if (!video) return res.status(400).json({ error: 'A video file is required' });
  if (!video.mimetype.startsWith('video/')) {
    await removeUploadFiles(req.files);
    return res.status(400).json({ error: 'YouTube publishing currently requires a video file' });
  }
  if (!String(req.body.title || '').trim()) {
    await removeUploadFiles(req.files);
    return res.status(400).json({ error: 'A YouTube title is required' });
  }
  const thumbnail = req.files?.thumbnail?.[0];
  if (thumbnail && (!thumbnail.mimetype.startsWith('image/') || thumbnail.size > 2 * 1024 * 1024)) {
    await removeUploadFiles(req.files);
    return res.status(400).json({ error: 'Thumbnail must be an image no larger than 2 MB' });
  }

  const { data: connection, error } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('platform', 'youtube')
    .limit(1)
    .maybeSingle();
  if (error || !connection) {
    await removeUploadFiles(req.files);
    return res.status(409).json({ error: 'Connect a YouTube channel before publishing' });
  }

  const id = crypto.randomUUID();
  const job = {
    id, userId: req.user.id, platform: 'youtube',
    state: 'queued', progress: 0, message: 'Upload queued', createdAt: Date.now()
  };
  uploadJobs.set(id, job);
  res.status(202).json({ job });
  void processYouTubeUpload(job, connection, req.files, req.body);
});

app.get('/api/youtube/uploads/:id', requireUser, (req, res) => {
  const job = uploadJobs.get(req.params.id);
  if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Upload job not found' });
  res.json({ job });
});

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of uploadJobs) {
    if (job.completedAt && job.completedAt < cutoff) uploadJobs.delete(id);
  }
}, 10 * 60 * 1000).unref();

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
