import { USE_IPC } from '../config';
import dayjs from 'dayjs';

export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ExpensePlan {
  id: number;
  name: string;
  amount: number;
  period: string;
  parent_id: number | null;
  sub_period: string | null;
  budget_allocation: 'NONE' | 'AVERAGE';
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

  async createExpensePlan(plan: {
    name: string;
    amount: number;
    period: PeriodType;
    parent_id?: number | null;
    sub_period?: string | null;
    budget_allocation?: 'NONE' | 'AVERAGE';
  }): Promise<ExpensePlan> {
    if (USE_IPC) {
      return window.electronAPI.createExpensePlan(plan);
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

// 自省函数：更新结余和累计值
export const introspectionExpenseRecord = (record: ExpenseRecord) => {
  // 计算结余
  const balance = record.budget_amount - record.actual_amount;
  
  // 计算期末累计值
  const closingCumulativeBalance = record.opening_cumulative_balance + balance;
  const closingCumulativeExpense = record.opening_cumulative_expense + record.actual_amount;

  return {
    ...record,
    balance,
    closing_cumulative_balance: closingCumulativeBalance,
    closing_cumulative_expense: closingCumulativeExpense,
  };
};

// 更新函数：处理记录及其子记录
export const updateExpenseRecord = async (record: ExpenseRecord, plans: ExpensePlan[]) => {
  // 获取记录对应的计划
  const plan = plans.find(p => p.id === record.plan_id);
  if (!plan) return record;

  // 检查是否有子计划
  const subPlan = plans.find(p => p.parent_id === plan.id);
  if (!subPlan) {
    // 如果没有子计划，直接自省
    return introspectionExpenseRecord(record);
  }

  // 获取所有子记录
  const subRecords = await financeAPI.getExpenseRecords(subPlan.id);
  
  // 筛选出与当前记录在同一时间段的子记录，并按时间升序排序
  const matchingSubRecords = subRecords
    .filter(subRecord => {
      const recordDate = dayjs(record.date);
      const subRecordDate = dayjs(subRecord.date);
      
      switch (plan.period) {
        case 'YEAR':
          return subRecordDate.year() === recordDate.year();
        case 'QUARTER':
          return subRecordDate.year() === recordDate.year() && 
                 Math.floor(subRecordDate.month() / 3) === Math.floor(recordDate.month() / 3);
        case 'MONTH':
          return subRecordDate.year() === recordDate.year() && 
                 subRecordDate.month() === recordDate.month();
        case 'WEEK':
          return subRecordDate.year() === recordDate.year() && 
                 subRecordDate.week() === recordDate.week();
        default:
          return false;
      }
    })
    .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

  let totalExpense = 0;
  let totalBalance = 0;

  if (subPlan.budget_allocation === 'AVERAGE') {
    // 平均分配策略
    const subPeriodCount = getSubPeriodCount(plan.period, subPlan.period);
    const averageBudget = record.budget_amount / subPeriodCount;

    // 更新每个子记录
    for (const subRecord of matchingSubRecords) {
      // 更新子记录的预算和期初累计值
      const updatedSubRecord = {
        ...subRecord,
        budget_amount: averageBudget,
        opening_cumulative_expense: record.opening_cumulative_expense + totalExpense,
        opening_cumulative_balance: record.opening_cumulative_balance + totalBalance,
      };

      // 递归更新子记录
      const introspectedSubRecord = await updateExpenseRecord(updatedSubRecord, plans);
      
      // 更新子记录
      await financeAPI.updateExpenseRecord(subRecord.id, introspectedSubRecord);

      // 累加实际开销和结余
      totalExpense += introspectedSubRecord.actual_amount;
      totalBalance += introspectedSubRecord.balance;
    }
  } else {
    // 不分配策略
    let remainingBudget = record.budget_amount;

    // 更新每个子记录
    for (const subRecord of matchingSubRecords) {
      // 更新子记录的预算和期初累计值
      const updatedSubRecord = {
        ...subRecord,
        budget_amount: remainingBudget,
        opening_cumulative_expense: totalExpense,
        opening_cumulative_balance: record.opening_cumulative_balance + remainingBudget,
      };

      // 递归更新子记录
      const introspectedSubRecord = await updateExpenseRecord(updatedSubRecord, plans);
      
      // 更新子记录
      await financeAPI.updateExpenseRecord(subRecord.id, introspectedSubRecord);

      // 累加实际开销和结余
      totalExpense += introspectedSubRecord.actual_amount;
      totalBalance += introspectedSubRecord.balance;
      remainingBudget = introspectedSubRecord.balance;
    }
  }

  // 更新当前记录的实际开销
  const updatedRecord = {
    ...record,
    actual_amount: totalExpense,
  };

  // 自省当前记录
  return introspectionExpenseRecord(updatedRecord);
};

// 获取子周期数量
const getSubPeriodCount = (parentPeriod: string, subPeriod: string): number => {
  switch (parentPeriod) {
    case 'YEAR':
      switch (subPeriod) {
        case 'QUARTER': return 4;
        case 'MONTH': return 12;
        case 'WEEK': return 52;
        default: return 1;
      }
    case 'QUARTER':
      switch (subPeriod) {
        case 'MONTH': return 3;
        case 'WEEK': return 13;
        default: return 1;
      }
    case 'MONTH':
      switch (subPeriod) {
        case 'WEEK': return 4;
        default: return 1;
      }
    default:
      return 1;
  }
}; 