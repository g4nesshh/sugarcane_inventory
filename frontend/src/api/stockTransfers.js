import api from './client';

export const listStockTransfers = (params) => api.get('/transfers', { params }).then((r) => r.data.data);
export const getStockTransfer = (id) => api.get(`/transfers/${id}`).then((r) => r.data.data.transfer);
export const createStockTransfer = (data) => api.post('/transfers', data).then((r) => r.data.data.transfer);
export const approveStockTransfer = (id) => api.put(`/transfers/${id}/approve`).then((r) => r.data.data.transfer);
export const rejectStockTransfer = (id) => api.put(`/transfers/${id}/reject`).then((r) => r.data.data.transfer);
