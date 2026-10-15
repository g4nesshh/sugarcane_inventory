import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Turn any failure into a readable message instead of a raw server error.
export const errorMessage = (err) => {
  const data = err.response?.data;
  if (data?.details?.length) return data.details.map((d) => d.message).join('. ');
  if (data?.message) return data.message;
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
};

export default api;
