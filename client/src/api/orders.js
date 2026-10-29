import api from './axios';

export const getMyOrders = () => api.get('/orders/mine').then((r) => r.data.orders);
export const getOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data.order);

// Admin
export const getAllOrders = (params = {}) => api.get('/orders', { params }).then((r) => r.data.orders);
export const updateOrderStatus = (id, status, note) =>
  api.patch(`/orders/${id}/status`, { status, note }).then((r) => r.data.order);
export const setCarrierTracking = (id, carrier, trackingNumber) =>
  api.patch(`/orders/${id}/carrier`, { carrier, trackingNumber }).then((r) => r.data);
export const assignDriver = (id, driverEmail) =>
  api.patch(`/orders/${id}/assign-driver`, { driverEmail }).then((r) => r.data);
