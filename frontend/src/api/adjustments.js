import api from './client';

export const listAdjustments = (params) => api.get('/adjustments', { params }).then((r) => r.data.data);
export const getAdjustment = (id) => api.get(`/adjustments/${id}`).then((r) => r.data.data.adjustment);
export const createAdjustment = (data) => api.post('/adjustments', data).then((r) => r.data.data.adjustment);
export const approveAdjustment = (id) => api.put(`/adjustments/${id}/approve`).then((r) => r.data.data.adjustment);
export const rejectAdjustment = (id) => api.put(`/adjustments/${id}/reject`).then((r) => r.data.data.adjustment);
