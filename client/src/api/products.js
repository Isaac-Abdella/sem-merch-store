import api from './axios';

export const listProducts = (params = {}) => api.get('/products', { params }).then((r) => r.data);
export const listCategories = () => api.get('/products/categories').then((r) => r.data.categories);
export const getProduct = (idOrSlug) => api.get(`/products/${idOrSlug}`).then((r) => r.data.product);

// Admin
export const listAllProducts = () => api.get('/products/admin/all').then((r) => r.data.products);
export const createProduct = (data) => api.post('/products', data).then((r) => r.data.product);
export const updateProduct = (id, data) => api.patch(`/products/${id}`, data).then((r) => r.data.product);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);
export const deleteProductPermanently = (id) => api.delete(`/products/${id}/permanent`).then((r) => r.data);
