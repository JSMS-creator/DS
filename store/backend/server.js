import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' })); // Tillat alle origins (inkl. GitHub Pages)

// Raw body for Stripe webhook
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  // Auto-seed demo product in production if no products exist
  if (process.env.NODE_ENV === 'production') {
    const db = (await import('./db.js')).default;
    const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
    if (count === 0) {
      const { execSync } = await import('child_process');
      try { execSync('node seed.js', { cwd: import.meta.dirname }); console.log('Demo product seeded'); } catch {}
    }
  }
});
