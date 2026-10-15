import api from './client';

export const listPurchaseOrders = (params) => api.get('/purchases', { params }).then((r) => r.data.data);
export const getPurchaseOrder = (id) => api.get(`/purchases/${id}`).then((r) => r.data.data.purchaseOrder);
export const createPurchaseOrder = (data) => api.post('/purchases', data).then((r) => r.data.data.purchaseOrder);
export const updatePurchaseOrder = (id, data) => api.put(`/purchases/${id}`, data).then((r) => r.data.data.purchaseOrder);
