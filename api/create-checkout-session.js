import Stripe from 'stripe';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (only once)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

try {
  initializeApp({
    credential: cert(serviceAccount),
  });
} catch (e) {
  // Avoid error on re-initialization in dev
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { uid, email } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: 'Missing UID or email' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 500,
            product_data: {
              name: 'Unlock SNIFFY POC Generator',
              description: 'One-time $5 payment to access the Plan of Correction tool',
            },
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: { uid },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/?canceled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
}
