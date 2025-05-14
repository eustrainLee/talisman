import { USE_IPC } from '../config';
import { ExpensePlan, ExpenseRecord, IncomePlan, IncomeRecord } from '../../electron/server/finance/def';

export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

class FinanceAPI {
  async getExpensePlans(): Promise<ExpensePlan[]> {
    if (USE_IPC) {
      return window.electronAPI.getExpensePlans();
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async getExpensePlan(planId: number): Promise<ExpensePlan | null> {
    if (USE_IPC) {
      const plans = await window.electronAPI.getExpensePlans();
      return plans.find(plan => plan.id === planId) || null;
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async createExpensePlan(plan: Omit<ExpensePlan, 'id' | 'created_at' | 'updated_at'>): Promise<ExpensePlan> {
    if (USE_IPC) {
      // 如果是子计划，自动使用父计划的名称
      if (plan.parent_id) {
        const parentPlan = await this.getExpensePlan(plan.parent_id);
        if (parentPlan) {
          plan.name = parentPlan.name;
        }
      }
      return window.electronAPI.createExpensePlan(plan);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async updateExpensePlan(plan: Partial<ExpensePlan>): Promise<ExpensePlan> {
    if (USE_IPC) {
      return window.electronAPI.updateExpensePlan(plan);
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

  async getExpenseRecordsWithPlanID(planId: number): Promise<ExpenseRecord[]> {
    if (USE_IPC) {
      const records = await window.electronAPI.getExpenseRecordsWithPlanID(planId);
      return records.map(record => ({
        ...record,
        is_sub_record: record.is_sub_record || false,
      }));
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async createExpenseRecord(record: Omit<ExpenseRecord, 'id' | 'created_at' | 'updated_at'>): Promise<ExpenseRecord> {
    if (USE_IPC) {
      return window.electronAPI.createExpenseRecord({
        ...record,
        is_sub_record: record.is_sub_record || false,
      });
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async updateExpenseRecord(recordId: number, data: Partial<ExpenseRecord>): Promise<void> {
    if (USE_IPC) {
      await window.electronAPI.updateExpenseRecord(recordId, {
        ...data,
        is_sub_record: data.is_sub_record || false,
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

  // 收入计划相关 API
  async getIncomePlans(): Promise<IncomePlan[]> {
    return window.electronAPI.getIncomePlans();
  }

  async getIncomePlan(planId: number): Promise<IncomePlan | null> {
    const plans = await this.getIncomePlans();
    return plans.find(plan => plan.id === planId) || null;
  }

  async createIncomePlan(plan: Omit<IncomePlan, 'id' | 'created_at' | 'updated_at'>): Promise<IncomePlan> {
    if (USE_IPC) {
      return window.electronAPI.createIncomePlan({
        name: plan.name,
        period: plan.period,
        parent_id: plan.parent_id,
        sub_period: plan.sub_period
      });
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async updateIncomePlan(plan: Partial<IncomePlan>): Promise<IncomePlan> {
    if (USE_IPC) {
      return window.electronAPI.updateIncomePlan(plan);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async deleteIncomePlan(id: number): Promise<void> {
    return window.electronAPI.deleteIncomePlan(id);
  }

  // 收入记录相关 API
  async getIncomeRecords(planId: number): Promise<IncomeRecord[]> {
    return window.electronAPI.getIncomeRecords(planId);
  }

  async createIncomeRecord(record: Omit<IncomeRecord, 'id' | 'created_at' | 'updated_at'>): Promise<IncomeRecord> {
    return window.electronAPI.createIncomeRecord(record);
  }

  async updateIncomeRecord(data: Partial<IncomeRecord>): Promise<void> {
    return window.electronAPI.updateIncomeRecord(data);
  }

  async deleteIncomeRecord(recordId: number): Promise<void> {
    return window.electronAPI.deleteIncomeRecord(recordId);
  }

  // 汇总相关 API
  async getYearlySummary(year: number): Promise<{
    totalIncome: number;
    totalExpense: number;
    netIncome: number;
    quarters: {
      quarter: number;
      income: number;
      expense: number;
      netIncome: number;
    }[];
    months: {
      month: number;
      income: number;
      expense: number;
      netIncome: number;
    }[];
  }> {
    if (USE_IPC) {
      return window.electronAPI.getYearlySummary(year);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async getQuarterlySummary(year: number, quarter: number): Promise<{
    totalIncome: number;
    totalExpense: number;
    netIncome: number;
    months: {
      month: number;
      income: number;
      expense: number;
      netIncome: number;
    }[];
  }> {
    if (USE_IPC) {
      return window.electronAPI.getQuarterlySummary(year, quarter);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }

  async getMonthlySummary(year: number, month: number): Promise<{
    totalIncome: number;
    totalExpense: number;
    netIncome: number;
    plans: {
      planId: number;
      planName: string;
      type: 'income' | 'expense';
      amount: number;
    }[];
  }> {
    if (USE_IPC) {
      return window.electronAPI.getMonthlySummary(year, month);
    }
    throw new Error('非 Electron 环境不支持财务功能');
  }
}

export const financeAPI = new FinanceAPI();

