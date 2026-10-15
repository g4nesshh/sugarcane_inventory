import api from './client';

export const listProductionBatches = (params) => api.get('/production/batches', { params }).then((r) => r.data.data);
export const getProductionBatch = (id) => api.get(`/production/batches/${id}`).then((r) => r.data.data.batch);
export const createProductionBatch = (data) => api.post('/production/batches', data).then((r) => r.data.data.batch);
export const updateProductionBatch = (id, data) => api.put(`/production/batches/${id}`, data).then((r) => r.data.data.batch);

export const listProductionConsumption = (params) => api.get('/production/consumption', { params }).then((r) => r.data.data);
// Returns an array — one created consumption record per submitted line.
export const createProductionConsumption = (data) => api.post('/production/consumption', data).then((r) => r.data.data.consumptions);
