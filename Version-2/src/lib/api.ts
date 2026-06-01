import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API endpoints
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const restaurantApi = {
  getAll: () => api.get('/restaurants'),
  getById: (id: string) => api.get(`/restaurants/${id}`),
  create: (data: any) => api.post('/restaurants', data),
  update: (id: string, data: any) => api.put(`/restaurants/${id}`, data),
  delete: (id: string) => api.delete(`/restaurants/${id}`),
  grantAccess: (restaurantId: string, userId: string) =>
    api.post(`/restaurants/${restaurantId}/access`, { userId }),
  revokeAccess: (restaurantId: string, userId: string) =>
    api.delete(`/restaurants/${restaurantId}/access/${userId}`),
  getUsers: (restaurantId: string) => api.get(`/restaurants/${restaurantId}/users`),
};

export const planningApi = {
  getByRestaurant: (restaurantId: string) =>
    api.get(`/plannings/restaurant/${restaurantId}`),
  getById: (id: string) => api.get(`/plannings/${id}`),
  create: (data: any) => api.post('/plannings', data),
  update: (id: string, data: any) => api.put(`/plannings/${id}`, data),
  delete: (id: string) => api.delete(`/plannings/${id}`),
  bulkCreate: (restaurantId: string, plannings: any[]) =>
    api.post(`/plannings/restaurant/${restaurantId}/bulk`, plannings),
};

export const scenarioApi = {
  getAll: (params?: any) => api.get('/scenarios', { params }),
  getById: (id: string) => api.get(`/scenarios/${id}`),
  create: (data: any) => api.post('/scenarios', data),
  getStats: (params?: any) => api.get('/scenarios/stats/summary', { params }),
};

export const userApi = {
  getAll: () => api.get('/users'),
  getById: (id: string) => api.get(`/users/${id}`),
  updateRole: (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
  delete: (id: string) => api.delete(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  updateRestaurantAccess: (id: string, restaurants: any[]) => 
    api.post(`/users/${id}/restaurants`, { restaurants }),
};

export const configApi = {
  get: (restaurantId: string) => api.get(`/restaurant-configs/${restaurantId}`),
  update: (restaurantId: string, data: any) => api.put(`/restaurant-configs/${restaurantId}`, data),
  reset: (restaurantId: string) => api.post(`/restaurant-configs/${restaurantId}/reset`),
  getHistory: (restaurantId: string) => api.get(`/restaurant-configs/${restaurantId}/history`),
};
