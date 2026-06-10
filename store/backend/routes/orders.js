import { Router } from 'express';
import Stripe from 'stripe';
import { createOrder as cjCreateOrder, getOrderStatus } from '../cj.js';
import db from '../db.js';
import { sendOrderConfirmation, sendTrackingEmail } from '../email.js';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Stripe payment intent
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { productId, variantId, quantity = 1, customerInfo } = req.body;
    const product = db.prepare('SELECT * FROM products WHERE cj_product_id = ? AND active = 1').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const subtotal = product.sell_price_nok * quantity;
    const shipping = product.shipping_price_nok;
    const vat = Math.round((subtotal + shipping) * 0.25 * 100) / 100;
    const total = Math.round((subtotal + shipping + vat) * 100) / 100;

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'nok',
      metadata: { productId, variantId: variantId || '', quantity: String(quantity) },
      receipt_email: customerInfo?.email
    });

    res.json({
      clientSecret: intent.client_secret,
      breakdown: { subtotal, shipping, vat, total }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook — fires when payment succeeds
router.post('/webhook', express_raw_body, async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('Webhook error');
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    await fulfillOrder(intent);
  }
  res.json({ received: true });
});

async function fulfillOrder(intent) {
  const existing = db.prepare('SELECT id FROM orders WHERE stripe_payment_intent = ?').get(intent.id);
  if (existing) return;

  const { productId, variantId, quantity } = intent.metadata;
  const product = db.prepare('SELECT * FROM products WHERE cj_product_id = ?').get(productId);
  const customer = intent.shipping || {};

  const subtotal = product.sell_price_nok * Number(quantity);
  const shipping = product.shipping_price_nok;
  const vat = Math.round((subtotal + shipping) * 0.25 * 100) / 100;
  const total = subtotal + shipping + vat;

  const addressParts = customer.address || {};
  const addressStr = JSON.stringify({
    name: customer.name,
    line1: addressParts.line1,
    line2: addressParts.line2,
    city: addressParts.city,
    postal_code: addressParts.postal_code,
    country: addressParts.country
  });

  // Place order with CJ Dropshipping
  let cjOrderId = null;
  try {
    const cjRes = await cjCreateOrder({
      orderNumber: intent.id,
      shippingZip: addressParts.postal_code,
      shippingCountryCode: 'NO',
      shippingCountry: 'Norway',
      shippingCity: addressParts.city,
      shippingAddress: addressParts.line1,
      shippingCustomerName: customer.name,
      shippingPhone: intent.shipping?.phone || '00000000',
      remark: '',
      products: [{
        vid: variantId || '',
        pid: productId,
        quantity: Number(quantity),
        shippingName: 'CJPacket_Registered',
        fromCountryCode: 'CN'
      }]
    });
    if (cjRes.result) cjOrderId = cjRes.data.orderId;
  } catch (e) {
    console.error('CJ order failed:', e.message);
  }

  db.prepare(`
    INSERT INTO orders (stripe_payment_intent, cj_order_id, status, customer_name, customer_email,
      customer_address, product_id, product_name, variant, quantity,
      unit_price_nok, shipping_nok, vat_nok, total_nok)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    intent.id, cjOrderId, cjOrderId ? 'processing' : 'pending_fulfillment',
    customer.name, intent.receipt_email,
    addressStr, productId, product.name,
    variantId || null, Number(quantity),
    product.sell_price_nok, shipping, vat, total
  );

  if (intent.receipt_email) {
    await sendOrderConfirmation({
      to: intent.receipt_email,
      name: customer.name,
      product: product.name,
      quantity: Number(quantity),
      total
    });
  }
}

// Demo checkout — simulates full order flow without Stripe
router.post('/demo-checkout', async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1, name, email, address, postal, city } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Navn og e-post er påkrevd' });

    const product = db.prepare('SELECT * FROM products WHERE cj_product_id = ? AND active = 1').get(productId);
    if (!product) return res.status(404).json({ error: 'Produkt ikke funnet' });

    const variants = JSON.parse(product.variants || '[]');
    const variant = variants.find(v => v.variantSku === variantId || v.variantNameEn === variantId) || variants[0];
    const unitPrice = variant?.variantSellPrice || product.sell_price_nok;
    const subtotal = unitPrice * Number(quantity);
    const shipping = product.shipping_price_nok || 0;
    const vat = Math.round((subtotal + shipping) * 0.25 * 100) / 100;
    const total = subtotal + shipping + vat;

    const demoIntentId = 'demo_' + Date.now();
    const addressStr = JSON.stringify({ name, line1: address, city, postal_code: postal, country: 'NO' });

    // Try CJ order
    let cjOrderId = null;
    let cjError = null;
    try {
      const cjRes = await cjCreateOrder({
        orderNumber: demoIntentId,
        shippingZip: postal || '',
        shippingCountryCode: 'NO',
        shippingCountry: 'Norway',
        shippingCity: city || '',
        shippingAddress: address || '',
        shippingCustomerName: name,
        shippingPhone: '00000000',
        remark: 'DEMO ORDER',
        products: [{
          vid: variantId || '',
          pid: productId,
          quantity: Number(quantity),
          shippingName: 'CJPacket_Registered',
        fromCountryCode: 'CN'
        }]
      });
      if (cjRes.result) cjOrderId = cjRes.data?.orderId || null;
      else cjError = cjRes.message || JSON.stringify(cjRes);
    } catch (e) {
      cjError = e.message;
      console.error('Demo CJ order failed:', e.message);
    }

    db.prepare(`
      INSERT INTO orders (stripe_payment_intent, cj_order_id, status, customer_name, customer_email,
        customer_address, product_id, product_name, variant, quantity,
        unit_price_nok, shipping_nok, vat_nok, total_nok)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      demoIntentId, cjOrderId, cjOrderId ? 'processing' : 'pending_fulfillment',
      name, email, addressStr, productId, product.name,
      variantId || null, Number(quantity),
      unitPrice, shipping, vat, total
    );

    let emailError = null;
    try {
      await sendOrderConfirmation({ to: email, name, product: product.name, quantity: Number(quantity), total });
      console.log('[demo-checkout] Confirmation email sent to', email);
    } catch (e) {
      emailError = e.message;
      console.error('[demo-checkout] Email failed:', e.message);
    }

    res.json({ ok: true, orderId: demoIntentId, cjOrderId, cjError, emailError, total });
  } catch (err) { next(err); }
});

// Get tracking info for an order
router.get('/track/:paymentIntent', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE stripe_payment_intent = ?').get(req.params.paymentIntent);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.cj_order_id && !order.tracking_number) {
    try {
      const status = await getOrderStatus(order.cj_order_id);
      if (status.result && status.data?.trackingNumber) {
        db.prepare('UPDATE orders SET tracking_number = ?, tracking_url = ?, updated_at = datetime("now") WHERE id = ?')
          .run(status.data.trackingNumber, status.data.trackingUrl || null, order.id);
        order.tracking_number = status.data.trackingNumber;
        order.tracking_url = status.data.trackingUrl;
        await sendTrackingEmail({ to: order.customer_email, name: order.customer_name, tracking: status.data.trackingNumber, trackingUrl: status.data.trackingUrl });
      }
    } catch {}
  }
  res.json({ status: order.status, tracking: order.tracking_number, trackingUrl: order.tracking_url });
});

function express_raw_body(req, res, next) {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => data += chunk);
  req.on('end', () => { req.rawBody = data; next(); });
}

export default router;
