import api from './client';

export const listStockMovements = (params) => api.get('/stock-movements', { params }).then((r) => r.data.data);
