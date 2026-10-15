import api from './client';

export const getInventoryReport = (params) => api.get('/reports/inventory', { params }).then((r) => r.data.data);
export const getPurchaseReport = (params) => api.get('/reports/purchases', { params }).then((r) => r.data.data);
export const getConsumptionReport = (params) => api.get('/reports/consumption', { params }).then((r) => r.data.data);
export const getStockMovementReport = (params) => api.get('/reports/stock-movement', { params }).then((r) => r.data.data);

// Reports are plain Bearer-token-authenticated GETs, so a plain <a href> or
// window.open to the API URL won't carry the Authorization header and would
// 401. Fetch the CSV as a blob through the authenticated client instead, then
// trigger the download client-side via a temporary object URL.
export async function downloadReportCsv(reportPath, params, filename) {
  try {
    const res = await api.get(`/reports/${reportPath}`, { params: { ...params, format: 'csv' }, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // With responseType 'blob', an ERROR response body is also deserialized as a
    // Blob rather than parsed JSON, so the shared errorMessage() helper can't read
    // err.response.data.message off it. Read it back out here so the caller still
    // sees the server's actual message instead of a generic fallback.
    const data = err.response?.data;
    if (data instanceof Blob && data.type.includes('json')) {
      const parsed = await data.text().then(JSON.parse).catch(() => null);
      if (parsed?.message) {
        const readable = new Error(parsed.message);
        readable.isReadableReportError = true; // lets callers skip errorMessage() and use .message directly
        throw readable;
      }
    }
    throw err;
  }
}
