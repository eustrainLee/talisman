// 封装数据库操作

import { getDatabase } from '../db';
import type { ExpensePlan, ExpenseRecord, IncomePlan, IncomeRecord } from './def';
import { daysOfMonth } from './helper';

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
export async function createExpensePlan(plan: Omit<ExpensePlan, 'id' | 'created_at' | 'updated_at'>): Promise<ExpensePlan> {
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
export async function updateIncomeRecord(data: {
  id: number;
  date?: string;
  amount?: number;
  opening_cumulative?: number;
  closing_cumulative?: number;
}): Promise<IncomeRecord> {
  const db = getDatabase();
  const record = db.prepare('SELECT * FROM income_records WHERE id = ?').get(data.id) as IncomeRecord | undefined;
  if (!record) {
    throw new Error('record not found');
  }

  if (record.is_sub_record && data.date && data.date !== record.date) {
    const overlappingRecord = db.prepare(`
      SELECT * FROM income_records 
      WHERE plan_id = ? AND is_sub_record = 1 AND date = ? AND id != ?
    `).get(record.plan_id, data.date, data.id) as IncomeRecord | undefined;
    if (overlappingRecord) {
      throw new Error('sub record already exists');
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
    data.id
  );

  if (record.is_sub_record && record.parent_record_id) {
    updateParentIncomeRecordSummary(record.parent_record_id);
  }

  const updatedRecord = db.prepare('SELECT * FROM income_records WHERE id = ?').get(data.id) as IncomeRecord;
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
    throw new Error('please delete sub records first');
  }
  
  const stmt = db.prepare('DELETE FROM expense_records WHERE id = ?');
  const result = stmt.run(recordId) as { changes: number };
  
  if (result.changes === 0) {
    throw new Error('record not found');
  }
}

// 删除收入记录
export async function deleteIncomeRecord(recordId: number): Promise<void> {
  const db = getDatabase();
  
  const hasSubRecords = db.prepare('SELECT COUNT(*) as count FROM income_records WHERE parent_record_id = ?').get(recordId) as { count: number };
  if (hasSubRecords.count > 0) {
    throw new Error('please delete sub records first');
  }
  
  const stmt = db.prepare('DELETE FROM income_records WHERE id = ?');
  const result = stmt.run(recordId) as { changes: number };
  
  if (result.changes === 0) {
    throw new Error('record not found');
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

// 更新开支计划
export async function updateExpensePlan(plan: Partial<ExpensePlan>): Promise<ExpensePlan> {
  const db = getDatabase();
  const existingPlan = db.prepare('SELECT * FROM expense_plans WHERE id = ?').get(plan.id) as ExpensePlan | undefined;
  if (!existingPlan) {
    throw new Error('计划不存在');
  }

  // 如果修改了父计划，检查是否已存在子计划
  if (plan.parent_id && plan.parent_id !== existingPlan.parent_id) {
    const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM expense_plans WHERE parent_id = ?').get(plan.parent_id) as { count: number };
    if (hasSubPlans.count > 0) {
      throw new Error('sub plan already exists');
    }
  }

  db.prepare(`
    UPDATE expense_plans 
    SET name = ?,
        amount = ?,
        period = ?,
        parent_id = ?,
        sub_period = ?,
        budget_allocation = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    plan.name || existingPlan.name,
    plan.amount || existingPlan.amount,
    plan.period || existingPlan.period,
    plan.parent_id || existingPlan.parent_id,
    plan.sub_period || existingPlan.sub_period,
    plan.budget_allocation || existingPlan.budget_allocation,
    plan.id
  );

  const updatedPlan = db.prepare('SELECT * FROM expense_plans WHERE id = ?').get(plan.id) as ExpensePlan;
  return updatedPlan;
}

export async function getIncomeRecordWithID(recordId: number): Promise<IncomeRecord> {
  const db = getDatabase();
  const record = db.prepare('SELECT * FROM income_records WHERE id = ?').get(recordId) as IncomeRecord | undefined;
  if (!record) {
    throw new Error('record not found');
  }
  return record;
}

export async function getIncomeRecordsWithPlanID(planId: number): Promise<IncomeRecord[]> {
  const db = getDatabase();
  const records = db.prepare('SELECT * FROM income_records WHERE plan_id = ?').all(planId) as IncomeRecord[];
  return records;
}

// 更新收入计划
export async function updateIncomePlan(plan: Partial<IncomePlan>): Promise<IncomePlan> {
  const db = getDatabase();
  const existingPlan = db.prepare('SELECT * FROM income_plans WHERE id = ?').get(plan.id) as IncomePlan | undefined;
  if (!existingPlan) {
    throw new Error('计划不存在');
  }

  // 如果修改了父计划，检查是否已存在子计划
  if (plan.parent_id && plan.parent_id !== existingPlan.parent_id) {
    const hasSubPlans = db.prepare('SELECT COUNT(*) as count FROM income_plans WHERE parent_id = ?').get(plan.parent_id) as { count: number };
    if (hasSubPlans.count > 0) {
      throw new Error('已存在子计划，不能重复创建');
    }
  }

  db.prepare(`
    UPDATE income_plans 
    SET name = ?,
        period = ?,
        parent_id = ?,
        sub_period = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    plan.name || existingPlan.name,
    plan.period || existingPlan.period,
    plan.parent_id || existingPlan.parent_id,
    plan.sub_period || existingPlan.sub_period,
    plan.id
  );

  const updatedPlan = db.prepare('SELECT * FROM income_plans WHERE id = ?').get(plan.id) as IncomePlan;
  return updatedPlan;
}

// 获取指定时间范围内的收入记录
export async function getIncomeRecordsInRange(startDate: string, endDate: string): Promise<IncomeRecord[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM income_records 
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `);
  return stmt.all(startDate, endDate) as IncomeRecord[];
}

// 获取指定时间范围内的支出记录
export async function getExpenseRecordsInRange(startDate: string, endDate: string): Promise<ExpenseRecord[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM expense_records 
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `);
  return stmt.all(startDate, endDate) as ExpenseRecord[];
}

// 获取年度汇总数据
export async function getYearlySummary(year: number): Promise<{
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
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // 获取年度收入记录
  const incomeRecords = await getIncomeRecordsInRange(startDate, endDate);
  // 找出所有有子记录的父记录ID
  const parentIncomeRecordIds = new Set(
    incomeRecords
      .filter(record => record.is_sub_record && record.parent_record_id)
      .map(record => record.parent_record_id)
  );
  // 过滤掉父记录
  const filteredIncomeRecords = incomeRecords.filter(record => !parentIncomeRecordIds.has(record.id));
  const totalIncome = filteredIncomeRecords.reduce((sum, record) => sum + record.amount, 0);

  // 获取年度支出记录
  const expenseRecords = await getExpenseRecordsInRange(startDate, endDate);
  // 找出所有有子记录的父记录ID
  const parentExpenseRecordIds = new Set(
    expenseRecords
      .filter(record => record.is_sub_record && record.parent_record_id)
      .map(record => record.parent_record_id)
  );
  // 过滤掉父记录
  const filteredExpenseRecords = expenseRecords.filter(record => !parentExpenseRecordIds.has(record.id));
  const totalExpense = filteredExpenseRecords.reduce((sum, record) => sum + record.actual_amount, 0);

  // 计算季度数据
  const quarters = [1, 2, 3, 4].map(quarter => {
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = quarter * 3;
    const quarterStart = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const quarterEnd = `${year}-${String(endMonth).padStart(2, '0')}-${daysOfMonth(endMonth, year)}`;

    const quarterIncomeRecords = filteredIncomeRecords.filter(record => 
      record.date >= quarterStart && record.date <= quarterEnd
    );
    const quarterExpenseRecords = filteredExpenseRecords.filter(record => 
      record.date >= quarterStart && record.date <= quarterEnd
    );

    const income = quarterIncomeRecords.reduce((sum, record) => sum + record.amount, 0);
    const expense = quarterExpenseRecords.reduce((sum, record) => sum + record.actual_amount, 0);

    return {
      quarter,
      income,
      expense,
      netIncome: income - expense
    };
  });

  // 计算月度数据
  const months = Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysOfMonth(month, year)}`;

    const monthIncomeRecords = filteredIncomeRecords.filter(record => 
      record.date >= monthStart && record.date <= monthEnd
    );
    const monthExpenseRecords = filteredExpenseRecords.filter(record => 
      record.date >= monthStart && record.date <= monthEnd
    );

    const income = monthIncomeRecords.reduce((sum, record) => sum + record.amount, 0);
    const expense = monthExpenseRecords.reduce((sum, record) => sum + record.actual_amount, 0);

    return {
      month,
      income,
      expense,
      netIncome: income - expense
    };
  });

  return {
    totalIncome,
    totalExpense,
    netIncome: totalIncome - totalExpense,
    quarters,
    months
  };
}

// 获取季度汇总数据
export async function getQuarterlySummary(year: number, quarter: number): Promise<{
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
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${daysOfMonth(endMonth, year)}`;

  // 获取季度收入记录
  const incomeRecords = await getIncomeRecordsInRange(startDate, endDate);
  // 找出所有有子记录的父记录ID
  const parentIncomeRecordIds = new Set(
    incomeRecords
      .filter(record => record.is_sub_record && record.parent_record_id)
      .map(record => record.parent_record_id)
  );
  // 过滤掉父记录
  const filteredIncomeRecords = incomeRecords.filter(record => !parentIncomeRecordIds.has(record.id));
  const totalIncome = filteredIncomeRecords.reduce((sum, record) => sum + record.amount, 0);

  // 获取季度支出记录
  const expenseRecords = await getExpenseRecordsInRange(startDate, endDate);
  // 找出所有有子记录的父记录ID
  const parentExpenseRecordIds = new Set(
    expenseRecords
      .filter(record => record.is_sub_record && record.parent_record_id)
      .map(record => record.parent_record_id)
  );
  // 过滤掉父记录
  const filteredExpenseRecords = expenseRecords.filter(record => !parentExpenseRecordIds.has(record.id));
  const totalExpense = filteredExpenseRecords.reduce((sum, record) => sum + record.actual_amount, 0);

  // 计算月度数据
  const months = Array.from({ length: 3 }, (_, i) => startMonth + i).map(month => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${daysOfMonth(month, year)}`;

    const monthIncomeRecords = filteredIncomeRecords.filter(record => 
      record.date >= monthStart && record.date <= monthEnd
    );
    const monthExpenseRecords = filteredExpenseRecords.filter(record => 
      record.date >= monthStart && record.date <= monthEnd
    );

    const income = monthIncomeRecords.reduce((sum, record) => sum + record.amount, 0);
    const expense = monthExpenseRecords.filter(record => 
      record.date >= monthStart && record.date <= monthEnd
    ).reduce((sum, record) => sum + record.actual_amount, 0);

    return {
      month,
      income,
      expense,
      netIncome: income - expense
    };
  });

  return {
    totalIncome,
    totalExpense,
    netIncome: totalIncome - totalExpense,
    months
  };
}

// 获取月度汇总数据
export async function getMonthlySummary(year: number, month: number): Promise<{
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
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${daysOfMonth(month, year)}`;

  // 获取月度收入记录
  const incomeRecords = await getIncomeRecordsInRange(startDate, endDate);
  // 找出所有有子记录的父记录ID
  const parentIncomeRecordIds = new Set(
    incomeRecords
      .filter(record => record.is_sub_record && record.parent_record_id)
      .map(record => record.parent_record_id)
  );
  // 过滤掉父记录
  const filteredIncomeRecords = incomeRecords.filter(record => !parentIncomeRecordIds.has(record.id));
  const totalIncome = filteredIncomeRecords.reduce((sum, record) => sum + record.amount, 0);

  // 获取月度支出记录
  const expenseRecords = await getExpenseRecordsInRange(startDate, endDate);
  // 找出所有有子记录的父记录ID
  const parentExpenseRecordIds = new Set(
    expenseRecords
      .filter(record => record.is_sub_record && record.parent_record_id)
      .map(record => record.parent_record_id)
  );
  // 过滤掉父记录
  const filteredExpenseRecords = expenseRecords.filter(record => !parentExpenseRecordIds.has(record.id));
  const totalExpense = filteredExpenseRecords.reduce((sum, record) => sum + record.actual_amount, 0);

  // 获取所有计划
  const incomePlans = await getIncomePlans();
  const expensePlans = await getExpensePlans();

  // 按计划汇总数据
  const plans = [
    ...incomePlans.map(plan => ({
      planId: plan.id,
      planName: plan.name,
      type: 'income' as const,
      amount: filteredIncomeRecords
        .filter(record => record.plan_id === plan.id)
        .reduce((sum, record) => sum + record.amount, 0)
    })),
    ...expensePlans.map(plan => ({
      planId: plan.id,
      planName: plan.name,
      type: 'expense' as const,
      amount: filteredExpenseRecords
        .filter(record => record.plan_id === plan.id)
        .reduce((sum, record) => sum + record.actual_amount, 0)
    }))
  ];

  return {
    totalIncome,
    totalExpense,
    netIncome: totalIncome - totalExpense,
    plans
  };
}
  