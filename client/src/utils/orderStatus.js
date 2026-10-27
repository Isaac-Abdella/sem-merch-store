export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

export const STATUS_LABELS = {
  pending: 'Awaiting payment',
  processing: 'Preparing your order',
  shipped: 'Handed to driver',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Steps shown in the tracking timeline (cancelled is shown separately)
export const TRACKING_STEPS = ['processing', 'shipped', 'out_for_delivery', 'delivered'];

export const shortId = (id = '') => `#${id.slice(-6).toUpperCase()}`;
