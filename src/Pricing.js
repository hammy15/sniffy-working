import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const Pricing = () => {
  const handleSubscribe = async () => {
    const stripe = await stripePromise;
    const res = await fetch('/api/create-checkout-session', { method: 'POST' });
    const { id } = await res.json();
    await stripe.redirectToCheckout({ sessionId: id });
  };

  return (
    <div style={{ padding: 40, maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <h2>✨ Unlock Sniffy Pro</h2>
      <p>Get full access to State Regulations, Unlimited POCs, and PDF Exports.</p>
      <h3>$15 / month</h3>
      <button onClick={handleSubscribe} style={{ padding: '10px 20px', marginTop: 20 }}>
        Subscribe with Stripe
      </button>
    </div>
  );
};

export default Pricing;

