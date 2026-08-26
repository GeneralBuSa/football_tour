import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../db.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { validateObjectBody } from '../middleware/security.js';

const router = express.Router();
const authenticate = createAuthMiddleware();
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

router.get('/coin-packs', async (_req, res) => {
  const { data, error } = await supabase
    .from('coin_pack_catalog')
    .select('pack_key, coins, amount_usd_cents')
    .eq('is_active', true)
    .order('amount_usd_cents');
  if (error) return res.status(500).json({ error: 'Coin catalog unavailable' });
  res.json(data.map(pack => ({
    key: pack.pack_key,
    coins: pack.coins,
    amountUsdCents: pack.amount_usd_cents
  })));
});

router.post('/coin-packs/checkout', authenticate, validateObjectBody, async (req, res) => {
  const stripe = getStripe();
  const { data: pack, error: packError } = await supabase
    .from('coin_pack_catalog')
    .select('pack_key, coins, amount_usd_cents')
    .eq('pack_key', req.body.pack_key)
    .eq('is_active', true)
    .maybeSingle();
  if (packError) return res.status(500).json({ error: 'Coin catalog unavailable' });
  if (!pack) return res.status(400).json({ error: 'Invalid coin pack' });
  if (!stripe) return res.status(503).json({ error: 'Payment provider is not configured' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `${pack.coins} FT26 coin` },
        unit_amount: pack.amount_usd_cents
      },
      quantity: 1
    }],
    metadata: { user_id: req.user.id, pack_key: pack.pack_key, coins: String(pack.coins) },
    success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/store?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/store?payment=cancelled`
  });

  await supabase.from('coin_orders').insert({
    user_id: req.user.id,
    pack_key: pack.pack_key,
    coins: pack.coins,
    amount_usd_cents: pack.amount_usd_cents,
    provider_session_id: session.id
  });
  res.json({ checkout_url: session.url, session_id: session.id });
});

router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET || !req.rawBody) return res.status(503).send('Webhook is not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).send('Invalid webhook signature');
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    if (session.payment_status === 'paid' || event.type.endsWith('succeeded')) {
      const { error } = await supabase.rpc('credit_coin_purchase', {
        p_session_id: session.id,
        p_user_id: session.metadata?.user_id,
        p_pack_key: session.metadata?.pack_key,
        p_coins: Number(session.metadata?.coins),
        p_amount_usd_cents: session.amount_total
      });
      if (error) return res.status(500).send('Fulfillment failed');
    }
  }
  res.json({ received: true });
});

export default router;
