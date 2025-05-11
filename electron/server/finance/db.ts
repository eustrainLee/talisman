// 封装数据库操作

import { getDatabase } from '../db';
import type { ExpensePlan, ExpenseRecord, IncomePlan, IncomeRecord } from './def';

// 获取开支计划列表
export async function getExpensePlans(): Promise<ExpensePlan[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM expense_plans 
    ORDER BY parent_id IS NULL DESC, created_at DESC
  `);
  return stmt.all() as ExpensePlan[];
}

// 获取收入计划列表
export async function getIncomePlans(): Promise<IncomePlan[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM income_plans 
    ORDER BY parent_id IS NULL DESC, created_at DESC
  `);
  return stmt.all() as IncomePlan[];
}

// 创建开支计划
export async function createExpensePlan(plan: { 
  name: string; 
  amount: number; 
  period: string;
  parent_id?: number;
  sub_period?: string;
  budget_allocation?: "NONE" | "AVERAGE";
}): Promise<ExpensePlan> {
  const db = getDatabase();
  
  // 如果是子计划，检查父计划是否已存在子计划
  if (plan.parent_id) {
    const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM expense_plans WHERE parent_id = ?').get(plan.parent_id) as { count: number };
    if (hasSubPlans.count > 0) {
      throw new Error('已存在子计划，不能重复创建');
    }
  }
  
  const stmt = db.prepare(`
    INSERT INTO expense_plans (
      name, amount, period, parent_id, sub_period, budget_allocation
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    plan.name,
    plan.amount,
    plan.period,
    plan.parent_id || null,
    plan.sub_period || null,
    plan.budget_allocation || "NONE"
  );
  
  const newPlan = db.prepare('SELECT * FROM expense_plans WHERE id = ?').get(result.lastInsertRowid) as ExpensePlan;
  return newPlan;
}

// 创建收入计划
export async function createIncomePlan(plan: Omit<IncomePlan, 'id' | 'created_at' | 'updated_at'>): Promise<IncomePlan> {
  const db = getDatabase();
  
  const result = db.prepare(`
    INSERT INTO income_plans (name, period, parent_id, sub_period)
    VALUES (?, ?, ?, ?)
  `).run(plan.name, plan.period, plan.parent_id, plan.sub_period);

  const newPlan = db.prepare('SELECT * FROM income_plans WHERE id = ?').get(result.lastInsertRowid) as IncomePlan;
  return newPlan;
}

// 删除开支计划
export async function deleteExpensePlan(id: number): Promise<void> {
  const db = getDatabase();
  
  const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM expense_plans WHERE parent_id = ?').get(id) as { count: number };
  if (hasSubPlans.count > 0) {
    throw new Error('请先删除子计划');
  }
  
  const hasRecords = db.prepare('SELECT COUNT(*) as count FROM expense_records WHERE plan_id = ?').get(id) as { count: number };
  if (hasRecords.count > 0) {
    throw new Error('请先删除相关记录');
  }
  
  const stmt = db.prepare('DELETE FROM expense_plans WHERE id = ?');
  stmt.run(id);
}

// 删除收入计划
export async function deleteIncomePlan(id: number): Promise<void> {
  const db = getDatabase();
  
  const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM income_plans WHERE parent_id = ?').get(id) as { count: number };
  if (hasSubPlans.count > 0) {
    throw new Error('请先删除子计划');
  }
  
  const hasRecords = db.prepare('SELECT COUNT(*) as count FROM income_records WHERE plan_id = ?').get(id) as { count: number };
  if (hasRecords.count > 0) {
    throw new Error('请先删除相关记录');
  }
  
  const stmt = db.prepare('DELETE FROM income_plans WHERE id = ?');
  stmt.run(id);
}

// 基于 planId 获取开支记录列表
export async function getExpenseRecordsWithPlanID(planId: number): Promise<ExpenseRecord[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM expense_records 
    WHERE plan_id = ? 
    ORDER BY is_sub_record ASC, date DESC
  `);
  const records = stmt.all(planId) as ExpenseRecord[];
  return records.map(record => ({
    ...record,
    is_sub_record: Boolean(record.is_sub_record)
  }));
}

// 基于开支记录 ID 获取开支记录
export async function getExpenseRecordWithID(recordId: number): Promise<ExpenseRecord> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM expense_records 
    WHERE id = ?
  `);
  const record = stmt.get(recordId) as ExpenseRecord;
  return record;
}

// 获取收入记录列表
export async function getIncomeRecords(planId: number): Promise<IncomeRecord[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM income_records 
    WHERE plan_id = ? 
    ORDER BY is_sub_record ASC, date DESC
  `);
  const records = stmt.all(planId) as IncomeRecord[];
  return records.map(record => ({
    ...record,
    is_sub_record: Boolean(record.is_sub_record)
  }));
}

// 创建开支记录
export async function createExpenseRecord(record: {
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
}): Promise<ExpenseRecord> {
  const db = getDatabase();
  
  if (record.is_sub_record && record.parent_record_id) {
    const parentRecord = db.prepare('SELECT * FROM expense_records WHERE id = ?').get(record.parent_record_id) as ExpenseRecord | undefined;
    if (!parentRecord) {
      throw new Error('父记录不存在');
    }
  }
  
  if (record.is_sub_record) {
    const overlappingRecord = db.prepare(`
      SELECT * FROM expense_records 
      WHERE plan_id = ? AND is_sub_record = 1 AND date = ?
    `).get(record.plan_id, record.date) as ExpenseRecord | undefined;
    if (overlappingRecord) {
      throw new Error('该时间已存在子记录');
    }
  }
  
  const stmt = db.prepare(`
    INSERT INTO expense_records (
      plan_id,
      parent_record_id,
      date,
      budget_amount,
      actual_amount,
      balance,
      opening_cumulative_balance,
      closing_cumulative_balance,
      opening_cumulative_expense,
      closing_cumulative_expense,
      is_sub_record
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    record.plan_id,
    record.parent_record_id || null,
    record.date,
    record.budget_amount,
    record.actual_amount,
    record.balance,
    record.opening_cumulative_balance,
    record.closing_cumulative_balance,
    record.opening_cumulative_expense,
    record.closing_cumulative_expense,
    record.is_sub_record ? 1 : 0
  );
  
  if (record.is_sub_record && record.parent_record_id) {
    updateParentRecordSummary(record.parent_record_id);
  }
  
  const newRecord = db.prepare('SELECT * FROM expense_records WHERE id = ?').get(result.lastInsertRowid) as ExpenseRecord;
  return {
    ...newRecord,
    is_sub_record: Boolean(newRecord.is_sub_record)
  };
}

// 创建收入记录
export async function createIncomeRecord(record: {
  plan_id: number;
  parent_record_id: number | null;
  date: string;
  amount: number;
  opening_cumulative: number;
  closing_cumulative: number;
  is_sub_record: boolean;
}): Promise<IncomeRecord> {
  const db = getDatabase();
  
  if (record.is_sub_record && record.parent_record_id) {
    const parentRecord = db.prepare('SELECT * FROM income_records WHERE id = ?').get(record.parent_record_id) as IncomeRecord | undefined;
    if (!parentRecord) {
      throw new Error('父记录不存在');
    }
  }
  
  if (record.is_sub_record) {
    const overlappingRecord = db.prepare(`
      SELECT * FROM income_records 
      WHERE plan_id = ? AND is_sub_record = 1 AND date = ?
    `).get(record.plan_id, record.date) as IncomeRecord | undefined;
    if (overlappingRecord) {
      throw new Error('该时间已存在子记录');
    }
  }
  
  const stmt = db.prepare(`
    INSERT INTO income_records (
      plan_id,
      parent_record_id,
      date,
      amount,
      opening_cumulative,
      closing_cumulative,
      is_sub_record
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    record.plan_id,
    record.parent_record_id,
    record.date,
    record.amount,
    record.opening_cumulative,
    record.closing_cumulative,
    record.is_sub_record ? 1 : 0
  );
  
  if (record.is_sub_record && record.parent_record_id) {
    updateParentIncomeRecordSummary(record.parent_record_id);
  }
  
  const newRecord = db.prepare('SELECT * FROM income_records WHERE id = ?').get(result.lastInsertRowid) as IncomeRecord;
  return {
    ...newRecord,
    is_sub_record: Boolean(newRecord.is_sub_record)
  };
}

// 更新开支记录
export async function updateExpenseRecord(recordId: number, data: Partial<ExpenseRecord>): Promise<ExpenseRecord> {
  const db = getDatabase();
  const record = db.prepare('SELECT * FROM expense_records WHERE id = ?').get(recordId) as ExpenseRecord | undefined;
  if (!record) {
    throw new Error('记录不存在');
  }

  if (record.is_sub_record && data.date && data.date !== record.date) {
    const overlappingRecord = db.prepare(`
      SELECT * FROM expense_records 
      WHERE plan_id = ? AND is_sub_record = 1 AND date = ? AND id != ?
    `).get(record.plan_id, data.date, recordId) as ExpenseRecord | undefined;
    if (overlappingRecord) {
      throw new Error('该时间已存在子记录');
    }
  }

  db.prepare(`
    UPDATE expense_records 
    SET date = ?, 
        budget_amount = ?, 
        actual_amount = ?, 
        balance = ?,
        opening_cumulative_balance = ?,
        closing_cumulative_balance = ?,
        opening_cumulative_expense = ?,
        closing_cumulative_expense = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.date || record.date,
    data.budget_amount || record.budget_amount,
    data.actual_amount || record.actual_amount,
    data.balance || record.balance,
    data.opening_cumulative_balance || record.opening_cumulative_balance,
    data.closing_cumulative_balance || record.closing_cumulative_balance,
    data.opening_cumulative_expense || record.opening_cumulative_expense,
    data.closing_cumulative_expense || record.closing_cumulative_expense,
    recordId
  );

  if (record.is_sub_record && record.parent_record_id) {
    updateParentRecordSummary(record.parent_record_id);
  }

  const updatedRecord = db.prepare('SELECT * FROM expense_records WHERE id = ?').get(recordId) as ExpenseRecord;
  return {
    ...updatedRecord,
    is_sub_record: Boolean(updatedRecord.is_sub_record)
  };
}

// 更新收入记录
export async function updateIncomeRecord(recordId: number, data: {
  date?: string;
  amount?: number;
  opening_cumulative?: number;
  closing_cumulative?: number;
}): Promise<IncomeRecord> {
  const db = getDatabase();
  const record = db.prepare('SELECT * FROM income_records WHERE id = ?').get(recordId) as IncomeRecord | undefined;
  if (!record) {
    throw new Error('记录不存在');
  }

  if (record.is_sub_record && data.date && data.date !== record.date) {
    const overlappingRecord = db.prepare(`
      SELECT * FROM income_records 
      WHERE plan_id = ? AND is_sub_record = 1 AND date = ? AND id != ?
    `).get(record.plan_id, data.date, recordId) as IncomeRecord | undefined;
    if (overlappingRecord) {
      throw new Error('该时间已存在子记录');
    }
  }

  db.prepare(`
    UPDATE income_records 
    SET date = ?, 
        amount = ?, 
        opening_cumulative = ?,
        closing_cumulative = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.date || record.date,
    data.amount || record.amount,
    data.opening_cumulative || record.opening_cumulative,
    data.closing_cumulative || record.closing_cumulative,
    recordId
  );

  if (record.is_sub_record && record.parent_record_id) {
    updateParentIncomeRecordSummary(record.parent_record_id);
  }

  const updatedRecord = db.prepare('SELECT * FROM income_records WHERE id = ?').get(recordId) as IncomeRecord;
  return {
    ...updatedRecord,
    is_sub_record: Boolean(updatedRecord.is_sub_record)
  };
}

// 删除开支记录
export async function deleteExpenseRecord(recordId: number): Promise<void> {
  const db = getDatabase();
  
  const hasSubRecords = db.prepare('SELECT COUNT(*) as count FROM expense_records WHERE parent_record_id = ?').get(recordId) as { count: number };
  if (hasSubRecords.count > 0) {
    throw new Error('请先删除子记录');
  }
  
  const stmt = db.prepare('DELETE FROM expense_records WHERE id = ?');
  const result = stmt.run(recordId) as { changes: number };
  
  if (result.changes === 0) {
    throw new Error('记录不存在');
  }
}

// 删除收入记录
export async function deleteIncomeRecord(recordId: number): Promise<void> {
  const db = getDatabase();
  
  const hasSubRecords = db.prepare('SELECT COUNT(*) as count FROM income_records WHERE parent_record_id = ?').get(recordId) as { count: number };
  if (hasSubRecords.count > 0) {
    throw new Error('请先删除子记录');
  }
  
  const stmt = db.prepare('DELETE FROM income_records WHERE id = ?');
  const result = stmt.run(recordId) as { changes: number };
  
  if (result.changes === 0) {
    throw new Error('记录不存在');
  }
}

// 更新父记录汇总数据
export async function updateParentRecordSummary(parentRecordId: number): Promise<void> {
  const db = getDatabase();
  const subRecords = db.prepare(`
    SELECT * FROM expense_records 
    WHERE parent_record_id = ? 
    ORDER BY date ASC
  `).all(parentRecordId) as ExpenseRecord[];
  
  if (subRecords.length > 0) {
    const firstRecord = subRecords[0];
    const lastRecord = subRecords[subRecords.length - 1];
    
    db.prepare(`
      UPDATE expense_records 
      SET opening_cumulative_balance = ?,
          closing_cumulative_balance = ?,
          opening_cumulative_expense = ?,
          closing_cumulative_expense = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      firstRecord.opening_cumulative_balance,
      lastRecord.closing_cumulative_balance,
      firstRecord.opening_cumulative_expense,
      lastRecord.closing_cumulative_expense,
      parentRecordId
    );
  }
}

// 更新父收入记录汇总数据
export async function updateParentIncomeRecordSummary(parentRecordId: number): Promise<void> {
  const db = getDatabase();
  const subRecords = db.prepare(`
    SELECT * FROM income_records 
    WHERE parent_record_id = ? 
    ORDER BY date ASC
  `).all(parentRecordId) as IncomeRecord[];
  
  if (subRecords.length > 0) {
    const firstRecord = subRecords[0];
    const lastRecord = subRecords[subRecords.length - 1];
    
    db.prepare(`
      UPDATE income_records 
      SET opening_cumulative = ?,
          closing_cumulative = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      firstRecord.opening_cumulative,
      lastRecord.closing_cumulative,
      parentRecordId
    );
  }
} 