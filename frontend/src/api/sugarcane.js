import api from './client';

export const listSugarcaneReceipts = (params) => api.get('/sugarcane', { params }).then((r) => r.data.data);
export const getSugarcaneReceipt = (id) => api.get(`/sugarcane/${id}`).then((r) => r.data.data.receipt);
export const createSugarcaneReceipt = (data) => api.post('/sugarcane', data).then((r) => r.data.data.receipt);
export const crushSugarcaneReceipt = (id, data) => api.put(`/sugarcane/${id}/crush`, data).then((r) => r.data.data.receipt);
