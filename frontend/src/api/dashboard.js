import api from './client';

export const getDashboardSummary = () => api.get('/dashboard/summary').then((r) => r.data.data);

export const getStockMovementSeries = (days = 30) =>
  api.get('/dashboard/stock-movement', { params: { days } }).then((r) => r.data.data.series);

export const getLowStock = (params = {}) => api.get('/dashboard/low-stock', { params }).then((r) => r.data.data);
