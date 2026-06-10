import { Router } from 'express';
import db from '../db.js';

const router = Router();

function parseImages(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return arr.map(u => u.replace(/[\[\]"]/g, '').trim()).filter(u => u.startsWith('http'));
  } catch {
    return (raw || '').replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(u => u.startsWith('http'));
  }
}

router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active = 1').all();
  res.json(products.map(p => ({
    ...p,
    variants: JSON.parse(p.variants || '[]'),
    images: parseImages(p.images)
  })));
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE cj_product_id = ? AND active = 1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ...p, variants: JSON.parse(p.variants || '[]'), images: parseImages(p.images) });
});

export default router;
