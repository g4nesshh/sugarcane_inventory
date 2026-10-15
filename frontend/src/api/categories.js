import api from './client';

export const listCategories = (params) => api.get('/categories', { params }).then((r) => r.data.data);
export const createCategory = (data) => api.post('/categories', data).then((r) => r.data.data.category);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data).then((r) => r.data.data.category);
export const deactivateCategory = (id) => api.delete(`/categories/${id}`).then((r) => r.data.data.category);
