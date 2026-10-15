import api from './client';

export const listGoodsReceipts = (params) => api.get('/receipts', { params }).then((r) => r.data.data);
export const getGoodsReceipt = (id) => api.get(`/receipts/${id}`).then((r) => r.data.data.receipt);
export const createGoodsReceipt = (data) => api.post('/receipts', data).then((r) => r.data.data.receipt);
