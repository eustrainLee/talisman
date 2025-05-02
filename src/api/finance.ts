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

export interface ExpenseRecord {
  id: number;
  plan_id: number;
  date: string;
  budget_amount: number;
  actual_amount: number;
  balance: number;
  opening_cumulative_balance: number;
  closing_cumulative_balance: number;
  opening_cumulative_expense: number;
  closing_cumulative_expense: number;
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
      await window.electronAPI.deleteExpensePlan(id);
      return;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async getExpenseRecords(planId: number): Promise<ExpenseRecord[]> {
    if (USE_IPC) {
      return window.electronAPI.getExpenseRecords(planId);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async createExpenseRecord(
    planId: number,
    date: string,
    budgetAmount: number,
    actualAmount: number,
    balance: number,
    openingCumulativeBalance: number,
    closingCumulativeBalance: number,
    openingCumulativeExpense: number,
    closingCumulativeExpense: number
  ): Promise<ExpenseRecord> {
    if (USE_IPC) {
      return window.electronAPI.createExpenseRecord({
        plan_id: planId,
        date,
        budget_amount: budgetAmount * 100,
        actual_amount: actualAmount * 100,
        balance: balance * 100,
        opening_cumulative_balance: openingCumulativeBalance * 100,
        closing_cumulative_balance: closingCumulativeBalance * 100,
        opening_cumulative_expense: openingCumulativeExpense * 100,
        closing_cumulative_expense: closingCumulativeExpense * 100,
      });
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async updateExpenseRecord(recordId: number, data: Partial<ExpenseRecord>): Promise<void> {
    if (USE_IPC) {
      await window.electronAPI.invoke('finance:update-expense-record', recordId, data);
      return;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async deleteExpenseRecord(recordId: number): Promise<void> {
    if (USE_IPC) {
      await window.electronAPI.invoke('finance:delete-expense-record', recordId);
      return;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }
}

export const financeAPI = new FinanceAPI(); 