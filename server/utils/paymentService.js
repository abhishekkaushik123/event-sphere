const crypto = require('crypto');

/**
 * Payment gateway abstraction.
 *
 * This project ships with a SIMULATED gateway so it runs without third-party accounts.
 * The rest of the app only depends on `charge()` and `refund()`, so swapping in Razorpay
 * or Stripe means re-implementing these two functions (and verifying the gateway's webhook
 * signature) without touching controllers or the frontend flow.
 */
const METHODS = ['card', 'upi', 'netbanking'];

exports.METHODS = METHODS;

exports.charge = async ({ amount, method }) => {
  if (!METHODS.includes(method)) {
    return { success: false, message: `Unsupported payment method. Use one of: ${METHODS.join(', ')}` };
  }
  const transactionId = `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return { success: true, transactionId, amount, method };
};

exports.refund = async ({ transactionId, amount }) => ({
  success: true,
  refundId: `RF${Date.now()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
  transactionId,
  amount,
});
