import 'dotenv/config';
import db from './db.js';

db.prepare(`
  INSERT OR REPLACE INTO products
    (cj_product_id, name, description, variants, images, buy_price_usd, sell_price_nok, shipping_price_nok, active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`).run(
  'DEMO-DOG-COVER-001',
  'PawGuard Bilseteovertrukk for Hund',
  `<ul>
    <li>🐾 Vanntett Oxford-stoff — beskytter mot smuss, hår og vann</li>
    <li>🔒 Hengekøye-design — holder hunden trygg og rolig under kjøring</li>
    <li>🚗 Universell passform — passer alle biler, SUV-er og varebiler</li>
    <li>🧺 Maskinvaskbar — enkelt å holde ren</li>
    <li>⚡ Enkel montering — festestropper på hodestøtter, ingen verktøy nødvendig</li>
    <li>🌿 Slitesterk og langvarig — spar penger på rengjøring av bilsetet</li>
  </ul>
  <p>Perfekt for turer til hytta, skogstur eller daglig kjøring med hunden. Norges hundeiere setter pris på et rent bilsete!</p>`,
  JSON.stringify([
    { vid: 'v1', name: 'Svart — Standard', variantNameEn: 'Svart — Standard', variantSellPrice: 319 },
    { vid: 'v2', name: 'Grå — Standard', variantNameEn: 'Grå — Standard', variantSellPrice: 319 },
    { vid: 'v3', name: 'Svart — XL (SUV)', variantNameEn: 'Svart — XL (SUV)', variantSellPrice: 359 }
  ]),
  JSON.stringify([
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80',
    'https://images.unsplash.com/photo-1452378174528-3090a4bba7b2?w=800&q=80'
  ]),
  9.50,
  319,
  0
);

console.log('✓ Demo-produkt lagt til i databasen');
