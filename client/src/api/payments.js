import api from './axios';

export const getPaymentConfig = () => api.get('/payments/config').then((r) => r.data);

/** items: [{ productId, quantity, size? }] — only ids and quantities; the server sets prices. */
export const createPaymentIntent = (items, shippingAddress) =>
  api.post('/payments/create-intent', { items, shippingAddress }).then((r) => r.data);

// Development only: completes a mock payment (no Stripe keys needed)
export const confirmMockPayment = (orderId) =>
  api.post(`/payments/mock/${orderId}/confirm`).then((r) => r.data.order);
