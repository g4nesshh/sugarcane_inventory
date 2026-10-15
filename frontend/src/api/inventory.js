import api from './client';

export const listInventory = (params) => api.get('/inventory', { params }).then((r) => r.data.data);
export const getItemInventory = (itemId) => api.get(`/inventory/${itemId}`).then((r) => r.data.data);
