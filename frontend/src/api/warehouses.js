import api from './client';

export const listWarehouses = (params) => api.get('/warehouses', { params }).then((r) => r.data.data);
export const createWarehouse = (data) => api.post('/warehouses', data).then((r) => r.data.data.warehouse);
export const updateWarehouse = (id, data) => api.put(`/warehouses/${id}`, data).then((r) => r.data.data.warehouse);
export const deactivateWarehouse = (id) => api.delete(`/warehouses/${id}`).then((r) => r.data.data.warehouse);
