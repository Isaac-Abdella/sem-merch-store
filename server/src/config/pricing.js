// All money is stored and calculated in integer cents to avoid floating-point errors.
module.exports = {
  currency: 'cad',
  taxRate: 0.13, // Ontario HST — confirm with your accountant for your products
  taxLabel: 'HST (ON)',
  shippingFlatCents: 999, // $9.99 local delivery
  freeShippingThresholdCents: 7500, // free delivery on orders $75+
};
