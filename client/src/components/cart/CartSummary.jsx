import { formatCurrency } from '../../utils/formatCurrency';

// Display-only estimate. Mirrors server/src/config/pricing.js — the server's numbers are final.
const ESTIMATE = { taxRate: 0.13, shippingFlatCents: 999, freeShippingThresholdCents: 7500 };

export function estimateTotals(subtotal) {
  const shipping = subtotal > 0 && subtotal < ESTIMATE.freeShippingThresholdCents ? ESTIMATE.shippingFlatCents : 0;
  const tax = Math.round((subtotal + shipping) * ESTIMATE.taxRate);
  return { subtotal, shipping, tax, total: subtotal + shipping + tax };
}

/** totals: either the server's totals (checkout) or an estimate (cart page). */
export default function CartSummary({ totals, estimated = false, children }) {
  return (
    <div className="summary">
      <h3>Order summary</h3>
      <dl>
        <dt>Subtotal</dt>
        <dd>{formatCurrency(totals.subtotal)}</dd>
        <dt>Delivery</dt>
        <dd>{totals.shipping === 0 ? 'Free' : formatCurrency(totals.shipping)}</dd>
        <dt>HST (13%)</dt>
        <dd>{formatCurrency(totals.tax)}</dd>
        <dt className="summary__total">{estimated ? 'Estimated total' : 'Total'}</dt>
        <dd className="summary__total">{formatCurrency(totals.total)}</dd>
      </dl>
      {totals.shipping > 0 && (
        <p className="muted small">
          Add {formatCurrency(ESTIMATE.freeShippingThresholdCents - totals.subtotal)} more for free delivery.
        </p>
      )}
      {children}
    </div>
  );
}
