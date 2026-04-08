const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Settlement = require('../models/Settlement');
const Group = require('../models/Group');

// Create a Stripe Checkout session for a payment from current user to another member
const createCheckoutSession = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { toUserId, amount } = req.body; // amount in dollars

    if (!toUserId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment data' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // both must be members
    if (!group.members.includes(req.userId) || !group.members.includes(toUserId)) {
      return res.status(403).json({ message: 'Both users must be members of the group' });
    }

    const amountCents = Math.round(parseFloat(amount) * 100);

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/group/${groupId}?payment_success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/group/${groupId}?payment_cancel=1`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: process.env.STRIPE_CURRENCY || 'usd',
            product_data: {
              name: `Payment to ${toUserId} for group ${group.name}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        groupId: groupId,
        toUserId: toUserId,
        amount: String(amountCents),
        fromUserId: req.userId,
      },
    });

    res.status(200).json({ url: session.url, id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: 'Error creating checkout session', error: error.message });
  }
};

// Confirm payment by verifying the Checkout session and recording a Settlement
const confirmPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'Missing sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    const metadata = session.metadata || {};
    const groupId = metadata.groupId;
    const toUserId = metadata.toUserId;
    const amountCents = parseInt(metadata.amount || '0', 10);
    const amount = parseFloat((amountCents / 100).toFixed(2));

    if (!groupId || !toUserId || !amount) {
      return res.status(400).json({ message: 'Invalid session metadata' });
    }

    // avoid duplicate: check if settlement with this session already exists (by note)
    const existing = await Settlement.findOne({ note: { $regex: sessionId } });
    if (existing) {
      const pop = await Settlement.findById(existing._id).populate('from', '-password').populate('to', '-password').populate('recordedBy', '-password');
      return res.status(200).json({ message: 'Payment already recorded', settlement: pop });
    }

    // create settlement record: from = current user
    const settlement = new Settlement({
      group: groupId,
      from: req.userId,
      to: toUserId,
      amount: amount,
      note: `Payment via Stripe (session ${sessionId})`,
      recordedBy: req.userId,
    });

    await settlement.save();

    const populated = await Settlement.findById(settlement._id)
      .populate('from', '-password')
      .populate('to', '-password')
      .populate('recordedBy', '-password');

    res.status(201).json({ message: 'Payment confirmed and settlement recorded', settlement: populated });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ message: 'Error confirming payment', error: error.message });
  }
};

// Stripe webhook to auto-record settlements on checkout.session.completed
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata || {};
      const groupId = metadata.groupId;
      const toUserId = metadata.toUserId;
      const fromUserId = metadata.fromUserId;
      const amountCents = parseInt(metadata.amount || '0', 10);
      const amount = parseFloat((amountCents / 100).toFixed(2));

      if (groupId && toUserId && fromUserId && amount > 0) {
        // avoid duplicate
        const sessionId = session.id;
        const existing = await Settlement.findOne({ note: { $regex: sessionId } });
        if (!existing) {
          const settlement = new Settlement({
            group: groupId,
            from: fromUserId,
            to: toUserId,
            amount: amount,
            note: `Payment via Stripe (session ${sessionId})`,
            recordedBy: fromUserId,
          });
          await settlement.save();
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
};

module.exports = {
  createCheckoutSession,
  confirmPayment,
  handleWebhook,
};
