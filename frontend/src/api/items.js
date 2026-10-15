import api from './client';

export const listItems = (params) => api.get('/items', { params }).then((r) => r.data.data);
export const createItem = (data) => api.post('/items', data).then((r) => r.data.data.item);
export const updateItem = (id, data) => api.put(`/items/${id}`, data).then((r) => r.data.data.item);
export const deactivateItem = (id) => api.delete(`/items/${id}`).then((r) => r.data.data.item);
