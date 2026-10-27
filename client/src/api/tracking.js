import api from './axios';

export const getTracking = (orderId) => api.get(`/tracking/${orderId}`).then((r) => r.data);

// Driver
export const getAssignedDeliveries = () => api.get('/tracking/driver/assigned').then((r) => r.data.deliveries);
export const postLocation = (orderId, coords) => api.post(`/tracking/${orderId}/location`, coords).then((r) => r.data);
export const updateDeliveryStatus = (orderId, status, note) =>
  api.post(`/tracking/${orderId}/status`, { status, note }).then((r) => r.data);
