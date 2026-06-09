import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active = 1').all();
  res.json(products.map(p => ({
    ...p,
    variants: JSON.parse(p.variants || '[]'),
    images: JSON.parse(p.images || '[]')
  })));
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE cj_product_id = ? AND active = 1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ...p, variants: JSON.parse(p.variants || '[]'), images: JSON.parse(p.images || '[]') });
});

export default router;
