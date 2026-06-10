import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import settingsRoutes from './routes/settings.js';
import { getOrderStatus } from './cj.js';
import { sendTrackingEmail } from './email.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' })); // Tillat alle origins (inkl. GitHub Pages)

// Raw body for Stripe webhook
app.use('/api/orders/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/health', (_, res) => res.json({ ok: true }));

// Global error handler — ensures CORS headers are always present
app.use((err, req, res, next) => {
  console.error(err.message);
  res.header('Access-Control-Allow-Origin', '*');
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  startTrackingPoller();
});

// ── CJ tracking poller ────────────────────────────────────────
// Runs every 2 hours. For all orders with a CJ order ID but no tracking
// number yet, fetches status from CJ and saves tracking + sends email.
async function startTrackingPoller() {
  const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const poll = async () => {
    try {
      const db = (await import('./db.js')).default;
      const orders = db.prepare(
        "SELECT * FROM orders WHERE cj_order_id IS NOT NULL AND tracking_number IS NULL AND status NOT IN ('cancelled','delivered')"
      ).all();
      if (!orders.length) return;
      console.log(`[poller] Checking ${orders.length} order(s) for tracking updates`);
      for (const order of orders) {
        try {
          const res = await getOrderStatus(order.cj_order_id);
          if (!res.result) continue;
          const d = res.data;

          // Map CJ status to our status
          const cjStatus = d?.orderStatus || d?.status || '';
          const statusMap = { CREATED: 'processing', IN_TRANSIT: 'processing', SHIPPED: 'shipped', COMPLETED: 'delivered', CANCEL: 'cancelled' };
          const newStatus = statusMap[cjStatus] || null;

          const tracking = d?.trackingNumber || d?.logisticOrderList?.[0]?.trackingNumber || null;
          const trackingUrl = d?.trackingUrl || d?.logisticOrderList?.[0]?.trackingUrl || null;

          if (tracking || newStatus) {
            db.prepare(`UPDATE orders SET
              tracking_number = COALESCE(?, tracking_number),
              tracking_url    = COALESCE(?, tracking_url),
              status          = COALESCE(?, status),
              updated_at      = datetime('now')
              WHERE id = ?`
            ).run(tracking || null, trackingUrl || null, newStatus || null, order.id);
            console.log(`[poller] Order #${order.id}: status=${newStatus} tracking=${tracking}`);
          }

          // Send tracking email the first time we get a tracking number
          if (tracking && order.customer_email) {
            await sendTrackingEmail({ to: order.customer_email, name: order.customer_name, tracking, trackingUrl });
            console.log(`[poller] Tracking email sent to ${order.customer_email}`);
          }
        } catch (e) {
          console.error(`[poller] Order #${order.id} error:`, e.message);
        }
      }
    } catch (e) {
      console.error('[poller] Fatal error:', e.message);
    }
  };

  // Run once on startup (after 1 min delay), then every 2 hours
  setTimeout(() => { poll(); setInterval(poll, INTERVAL_MS); }, 60_000);
  console.log('[poller] CJ tracking poller started (every 2h)');
}
