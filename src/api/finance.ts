import { USE_IPC } from '../config';

export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ExpensePlan {
  id: number;
  name: string;
  amount: number;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRecord {
  id: number;
  plan_id: number;
  parent_record_id?: number;
  date: string;
  budget_amount: number;
  actual_amount: number;
  balance: number;
  opening_cumulative_balance: number;
  closing_cumulative_balance: number;
  opening_cumulative_expense: number;
  closing_cumulative_expense: number;
  is_sub_record: boolean;
  sub_period_index?: number;
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

  async updateExpensePlan(id: number, plan: { name?: string; amount?: number; period?: PeriodType }): Promise<ExpensePlan> {
    if (USE_IPC) {
      return window.electronAPI.updateExpensePlan(id, plan);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async deleteExpensePlan(id: number): Promise<void> {
    if (USE_IPC) {
      await window.electronAPI.deleteExpensePlan(id);
      return;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async getExpenseRecords(planId: number): Promise<ExpenseRecord[]> {
    if (USE_IPC) {
      const records = await window.electronAPI.getExpenseRecords(planId);
      return records.map(record => ({
        ...record,
        is_sub_record: record.is_sub_record || false,
        sub_period_index: record.sub_period_index || 0,
      }));
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async createExpenseRecord(record: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ExpenseRecord> {
    if (USE_IPC) {
      return window.electronAPI.createExpenseRecord({
        ...record,
        is_sub_record: record.is_sub_record || false,
        sub_period_index: record.sub_period_index || 0,
      });
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async updateExpenseRecord(recordId: number, data: Partial<ExpenseRecord>): Promise<void> {
    if (USE_IPC) {
      await window.electronAPI.updateExpenseRecord(recordId, {
        ...data,
        is_sub_record: data.is_sub_record || false,
        sub_period_index: data.sub_period_index || 0,
      });
      return;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async deleteExpenseRecord(recordId: number): Promise<void> {
    if (USE_IPC) {
      await window.electronAPI.deleteExpenseRecord(recordId);
      return;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }
}

export const financeAPI = new FinanceAPI(); 