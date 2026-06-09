# Dropship Store

One-page dropshipping nettside med CJ Dropshipping + Stripe.

## Oppsett

### 1. Backend
```bash
cd backend
cp .env.example .env
# Fyll inn dine nøkler i .env
npm install
npm run dev
```

### 2. Frontend
Åpne `frontend/index.html` i nettleser, eller server med:
```bash
npx serve frontend -p 3000
```

### 3. Admin-panel
Åpne `admin/index.html` — logg inn med `ADMIN_SECRET` fra .env

---

## Nøkler du trenger

| Nøkkel | Hvor du finner den |
|---|---|
| `CJ_EMAIL` + `CJ_PASSWORD` | Registrer gratis på cjdropshipping.com |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | Samme sted |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI: `stripe listen --forward-to localhost:3001/api/orders/webhook` |
| `SMTP_*` | Gmail: Innstillinger → Sikkerhet → App-passord |

---

## Legg til produkt (steg for steg)

1. Gå til **admin/index.html** → Søk CJ
2. Søk etter produktet ditt (f.eks. "dog car seat cover DE warehouse")
3. Klikk **Importer** — felter fylles automatisk
4. Juster salgspris (regel: kjøpspris × 3–4 + 25% MVA)
5. Lagre → produktet vises i nettbutikken umiddelbart

---

## Anbefalte produkter (top 5 for Norge)

| Produkt | Kjøpspris | Salgspris | Margin |
|---|---|---|---|
| Hundesetecover til bil | €8–12 | NOK 399–499 | ~68% |
| Holdningskorrekturer | €7–10 | NOK 349–449 | ~70% |
| Isolert turkflaske | €6–10 | NOK 299–399 | ~65% |
| Magnetisk bilholder (MagSafe) | €5–9 | NOK 299–349 | ~68% |
| Bambus kjøkkenorganisering | €8–14 | NOK 449–599 | ~64% |

Alle tilgjengelige fra CJ Dropshipping DE warehouse → 3–7 dager til Norge.
