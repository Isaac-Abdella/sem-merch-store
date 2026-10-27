import api from './axios';

export const getServiceArea = () => api.get('/service-area').then((r) => r.data);
export const checkAddress = (address) => api.post('/service-area/check', { address }).then((r) => r.data);
