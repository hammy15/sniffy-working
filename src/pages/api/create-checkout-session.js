// pages/api/create-checkout-session.js
import Stripe from 'stripe';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Optionally initialize Firebase Admin SDK if needed
if (!getAuth().app) {
  initializeApp({
    credential: applicationDefault(), // or use cert() if you're providing service account manually
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, uid } = req.body;

  if (!email || !uid) {
    return res.status(400).json({ error: 'Missing user metadata' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'SNIFFY POC Generator – Lifetime Access',
            },
            unit_amount: 500, // $5.00
          },
          quantity: 1,
        },
      ],
      metadata: {
        email,
        uid,
      },
      success_url: `${req.headers.origin}?success=true`,
      cancel_url: `${req.headers.origin}?canceled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

