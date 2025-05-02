import { USE_IPC } from '../config';

export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ExpensePlan {
  id: number;
  name: string;
  amount: number;
  period: PeriodType;
  created_at: string;
  updated_at: string;
}

class FinanceAPI {
  async getExpensePlans(): Promise<ExpensePlan[]> {
    if (USE_IPC) {
      return window.electronAPI.getExpensePlans();
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async createExpensePlan(name: string, amount: number, period: PeriodType): Promise<ExpensePlan> {
    if (USE_IPC) {
      return window.electronAPI.createExpensePlan({ name, amount, period });
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async deleteExpensePlan(id: number): Promise<void> {
    if (USE_IPC) {
      return window.electronAPI.deleteExpensePlan(id);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }
}

export const financeAPI = new FinanceAPI(); 