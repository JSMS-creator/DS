import { Router } from 'express';
import db from '../db.js';
import { searchProducts, getProduct, getProductVariants, getCategories } from '../cj.js';

const router = Router();

// Simple token auth for admin routes
router.use((req, res, next) => {
  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// List all orders
router.get('/orders', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  res.json(orders);
});

// Update order status manually
router.patch('/orders/:id', (req, res) => {
  const { status, tracking_number, tracking_url } = req.body;
  db.prepare('UPDATE orders SET status = COALESCE(?, status), tracking_number = COALESCE(?, tracking_number), tracking_url = COALESCE(?, tracking_url), updated_at = datetime("now") WHERE id = ?')
    .run(status || null, tracking_number || null, tracking_url || null, req.params.id);
  res.json({ ok: true });
});

// Get CJ categories
router.get('/cj/categories', async (req, res, next) => {
  try {
    const result = await getCategories();
    res.json(result);
  } catch (err) { next(err); }
});

// Search CJ products
router.get('/cj/search', async (req, res, next) => {
  try {
    const { q, page, categoryId } = req.query;
    if (!q && !categoryId) return res.json({ data: { list: [] } });
    const result = await searchProducts(q || '', page || 1, 20, categoryId);
    res.json(result);
  } catch (err) { next(err); }
});

// Get CJ product details
router.get('/cj/product/:pid', async (req, res, next) => {
  try {
    const [product, variants] = await Promise.all([
      getProduct(req.params.pid),
      getProductVariants(req.params.pid)
    ]);
    res.json({ product: product.data, variants: variants.data });
  } catch (err) { next(err); }
});

// Add/update product in store
router.post('/products', (req, res) => {
  const { cj_product_id, name, description, variants, images, buy_price_usd, sell_price_nok, shipping_price_nok } = req.body;
  db.prepare(`
    INSERT INTO products (cj_product_id, name, description, variants, images, buy_price_usd, sell_price_nok, shipping_price_nok)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cj_product_id) DO UPDATE SET
      name = excluded.name, description = excluded.description,
      variants = excluded.variants, images = excluded.images,
      buy_price_usd = excluded.buy_price_usd, sell_price_nok = excluded.sell_price_nok,
      shipping_price_nok = excluded.shipping_price_nok, updated_at = datetime('now')
  `).run(cj_product_id, name, description, JSON.stringify(variants || []), JSON.stringify(images || []), buy_price_usd, sell_price_nok, shipping_price_nok || 0);
  res.json({ ok: true });
});

// Toggle product active
router.patch('/products/:id/toggle', (req, res) => {
  db.prepare('UPDATE products SET active = 1 - active WHERE cj_product_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Dashboard stats
router.get('/stats', (req, res, next) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_nok), 0) as s FROM orders WHERE status != 'cancelled'").get().s;
    const pending = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").get().c;
    const processing = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'processing'").get().c;
    res.json({ totalOrders, totalRevenue, pending, processing });
  } catch (err) { next(err); }
});

export default router;
