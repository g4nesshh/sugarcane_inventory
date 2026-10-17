import axios from 'axios';

const api = axios.create({
  baseURL: 'https://sugarcane-inventory.onrender.com/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export const errorMessage = (error) => {
  const data = error.response?.data;

  if (data?.details?.length) {
    return data.details.map((item) => item.message).join('. ');
  }

  if (data?.message) {
    return data.message;
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Cannot reach the server. Check your connection.';
  }

  return 'Something went wrong. Please try again.';
};

export default api;