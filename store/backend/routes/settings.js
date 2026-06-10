import { Router } from 'express';
import db from '../db.js';

const router = Router();

const PUBLIC_KEYS = ['storeName', 'primaryColor', 'buttonColor', 'tagline',
  'deliveryDays', 'returnDays', 'soldCount', 'rating', 'reviews', 'faq', 'benefits'];

// GET /api/settings — public settings for the storefront
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key IN (' +
    PUBLIC_KEYS.map(() => '?').join(',') + ')').all(...PUBLIC_KEYS);
  const settings = {};
  for (const { key, value } of rows) {
    try { settings[key] = JSON.parse(value); } catch { settings[key] = value; }
  }
  res.json(settings);
});

export default router;
