const pricing = require('../config/pricing');

/**
 * Calculates order totals from DB-sourced prices.
 * @param {{price:number, quantity:number}[]} lines prices in cents
 */
function calculateTotals(lines, config = pricing) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  let shipping = 0;
  if (subtotal > 0 && subtotal < config.freeShippingThresholdCents) shipping = config.shippingFlatCents;
  // In Ontario, HST generally applies to delivery charges as well as the goods.
  const tax = Math.round((subtotal + shipping) * config.taxRate);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax, currency: config.currency };
}

module.exports = { calculateTotals };
