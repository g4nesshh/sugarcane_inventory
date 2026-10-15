import api from './client';

export const listStockIssues = (params) => api.get('/issues', { params }).then((r) => r.data.data);
export const getStockIssue = (id) => api.get(`/issues/${id}`).then((r) => r.data.data.issue);
export const createStockIssue = (data) => api.post('/issues', data).then((r) => r.data.data.issue);
export const approveStockIssue = (id) => api.put(`/issues/${id}/approve`).then((r) => r.data.data.issue);
export const rejectStockIssue = (id, remarks) => api.put(`/issues/${id}/reject`, { remarks }).then((r) => r.data.data.issue);
