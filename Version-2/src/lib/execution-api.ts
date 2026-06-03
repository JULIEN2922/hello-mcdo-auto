import api from './api';

export interface ExecutionStatus {
  isRunning: boolean;
  restaurantId?: string;
  restaurant?: {
    code: string;
    name: string;
  };
  startedAt?: string;
  totalScenarios?: number;
  completed?: number;
  progress?: number;
}

export interface ExecutionStats {
  total: number;
  success: number;
  failed: number;
  successRate: string;
  avgDurationMs: number;
  byLocation: Array<{ location: string; count: number }>;
  byRating: Array<{ rating: number; count: number }>;
}

export interface RecentExecution {
  id: string;
  restaurantId: string;
  location: string;
  consumptionType: string;
  pickupLocation: string;
  rating: number;
  success: boolean;
  error?: string;
  durationMs?: number;
  executedAt: string;
  restaurant: {
    code: string;
    name: string;
  };
}

export const executionApi = {
  // Get current execution status
  getStatus: async (): Promise<ExecutionStatus> => {
    const response = await api.get('/execution/status');
    return response.data;
  },

  // Start manual execution
  startManual: async (restaurantId: string, count: number): Promise<void> => {
    await api.post('/execution/manual', { restaurantId, count });
  },

  // Get execution statistics
  getStats: async (
    restaurantId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ExecutionStats> => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/execution/stats?${params.toString()}`);
    return response.data;
  },

  // Get recent executions
  getRecent: async (restaurantId?: string, limit: number = 10): Promise<RecentExecution[]> => {
    const params = new URLSearchParams();
    if (restaurantId) params.append('restaurantId', restaurantId);
    params.append('limit', limit.toString());
    
    const response = await api.get(`/execution/recent?${params.toString()}`);
    return response.data;
  },
};
