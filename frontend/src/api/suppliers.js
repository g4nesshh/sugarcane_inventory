import api from './client';

export const listSuppliers = (params) => api.get('/suppliers', { params }).then((r) => r.data.data);
export const createSupplier = (data) => api.post('/suppliers', data).then((r) => r.data.data.supplier);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data).then((r) => r.data.data.supplier);
export const deactivateSupplier = (id) => api.delete(`/suppliers/${id}`).then((r) => r.data.data.supplier);
