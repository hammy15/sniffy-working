// pages/api/webhook.js
import Stripe from 'stripe';
import { buffer } from 'micro';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    if (uid) {
      try {
        await admin.firestore().collection('users').doc(uid).set({ pro: true }, { merge: true });
        console.log(`✅ Upgraded user ${uid} to PRO`);
      } catch (e) {
        console.error('❌ Firestore update failed:', e);
      }
    }
  }

  res.status(200).json({ received: true });
}
