// 对外提供接口
import { ExpenseRecord, ExpensePlan, IncomeRecord, IncomePlan } from './def';
import * as db from './db';
import dayjs from 'dayjs';
import { getSubPeriodCount, calculateExpense } from './helper';

// 开支计划相关操作
export const getExpensePlans = () => db.getExpensePlans();
export const createExpensePlan = (plan: Omit<ExpensePlan, 'id' | 'created_at' | 'updated_at'>) => db.createExpensePlan(plan);
export const updateExpensePlan = (plan: Partial<ExpensePlan>) => db.updateExpensePlan(plan);
export const deleteExpensePlan = (id: number) => db.deleteExpensePlan(id);

// 收入计划相关操作
export const getIncomePlans = () => db.getIncomePlans();
export const createIncomePlan = (plan: Parameters<typeof db.createIncomePlan>[0]) => db.createIncomePlan(plan);
export const updateIncomePlan = (plan: Partial<IncomePlan>) => db.updateIncomePlan(plan);
export const deleteIncomePlan = (id: number) => db.deleteIncomePlan(id);

// 开支记录相关操作
export const getExpenseRecordsWithPlanID = (planId: number) => db.getExpenseRecordsWithPlanID(planId);
export const getExpenseRecordWithID = (recordId: number) => db.getExpenseRecordWithID(recordId);

export const createExpenseRecord = async (record: Parameters<typeof db.createExpenseRecord>[0]) => {
  const createdRecord = await db.createExpenseRecord(record);
  const reconciledRecord = await reconcileExpenseRecord(createdRecord, await getExpensePlans());
  await db.updateExpenseRecord(reconciledRecord.id, reconciledRecord);
  return reconciledRecord;
};

export const updateExpenseRecord = async (recordId: number, data: Parameters<typeof db.updateExpenseRecord>[1]) => {
  const updatedRecord = await db.updateExpenseRecord(recordId, data);
  if (updatedRecord) {
    const reconciledRecord = await reconcileExpenseRecord(updatedRecord, await getExpensePlans());
    console.log(`Reconciled record ${JSON.stringify(reconciledRecord)}`);
    await db.updateExpenseRecord(reconciledRecord.id, reconciledRecord);
  }
};

export const deleteExpenseRecord = async (recordId: number) => {
  const record = await db.getExpenseRecordsWithPlanID(0).then(records =>
    records.find(r => r.id === recordId)
  );
  if (record) {
    const reconciledRecord = await reconcileExpenseRecord(record, await getExpensePlans());
    await db.updateExpenseRecord(reconciledRecord.id, reconciledRecord);
  }
  await db.deleteExpenseRecord(recordId);
};

// 收入记录相关操作
export const getIncomeRecords = (planId: number) => db.getIncomeRecords(planId);
export const createIncomeRecord = async (record: Parameters<typeof db.createIncomeRecord>[0]) => {
  const createdRecord = await db.createIncomeRecord(record);
  const reconciledRecord = await reconcileIncomeRecord(createdRecord, await getIncomePlans());
  await db.updateIncomeRecord(reconciledRecord);
  return reconciledRecord;
};

export const updateIncomeRecord = async (data: Parameters<typeof db.updateIncomeRecord>[0]) => {
  const updatedRecord = await db.updateIncomeRecord(data);
  if (updatedRecord) {
    const reconciledRecord = await reconcileIncomeRecord(updatedRecord, await getIncomePlans());
    console.log(`Reconciled record ${JSON.stringify(reconciledRecord)}`);
    await db.updateIncomeRecord(reconciledRecord);
  }
};

export const deleteIncomeRecord = async (recordId: number) => {
  const record = await db.getIncomeRecordsWithPlanID(0).then(records =>
    records.find(r => r.id === recordId)
  );
  if (record) {
    const reconciledRecord = await reconcileIncomeRecord(record, await getIncomePlans());
    await db.updateIncomeRecord(reconciledRecord);
  }
  await db.deleteIncomeRecord(recordId);
};

export const getIncomeRecordWithID = (recordId: number) => db.getIncomeRecordWithID(recordId);
export const getIncomeRecordsWithPlanID = (planId: number) => db.getIncomeRecordsWithPlanID(planId);

// 自省函数：更新结余和累计值
export const introspectionExpenseRecord = (record: ExpenseRecord, plans: ExpensePlan[]) => {
  const plan = plans.find(p => p.id === record.plan_id);
  if (!plan) return record;

  const result = calculateExpense(
    record.is_sub_record,
    plan.budget_allocation,
    record.budget_amount,
    record.actual_amount,
    record.opening_cumulative_balance,
    record.opening_cumulative_expense
  );

  return {
    ...record,
    balance: result.balance,
    closing_cumulative_balance: result.closing_cumulative_balance,
    closing_cumulative_expense: result.closing_cumulative_expense,
  };
};

const getReconcileExpenseRecordStartPoint = async (record: ExpenseRecord) => {
  if (record.is_sub_record && record.parent_record_id) {
    const parentRecord = await db.getExpenseRecordWithID(record.parent_record_id);
    if (parentRecord) {
      console.log(`Parent record ${JSON.stringify(parentRecord)}`);
      return parentRecord;
    } else {
      // Error
      throw new Error(`Parent record ${record.parent_record_id} not found for record ${record.id}`);
    }
  }
  return record;
};

const reconcileExpenseRecord = async (record: ExpenseRecord, plans: ExpensePlan[]) => {
  const needReconciledRecord = await getReconcileExpenseRecordStartPoint(record);
  console.log(`Need reconciling expense record ${JSON.stringify(needReconciledRecord)}`);
  const updatedRecord = await doReconcileExpenseRecord(needReconciledRecord, plans);
  return updatedRecord;
};

// 更新函数：处理记录及其子记录
const doReconcileExpenseRecord = async (record: ExpenseRecord, plans: ExpensePlan[]) => {
  // 日志记录
  console.log(`Reconciling expense record ${JSON.stringify(record)}`);
  // 获取记录对应的计划
  const plan = plans.find(p => p.id === record.plan_id);
  if (!plan) return record;

  // 检查是否有子计划
  const subPlan = plans.find(p => p.parent_id === plan.id);
  if (!subPlan) {
    console.log(`No sub plan found for record ${JSON.stringify(record)}`);
    // 如果没有子计划，直接自省
    return introspectionExpenseRecord(record, plans);
  }

  // 获取所有子记录
  const subRecords = await getExpenseRecordsWithPlanID(subPlan.id);

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
    console.log(`Sub plan ${JSON.stringify(subPlan)} is using average budget allocation strategy`);
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
      const introspectedSubRecord = await doReconcileExpenseRecord(updatedSubRecord, plans);

      // 更新子记录
      await db.updateExpenseRecord(subRecord.id, introspectedSubRecord);

      // 累加实际开销和结余
      totalExpense += introspectedSubRecord.actual_amount;
      totalBalance += introspectedSubRecord.balance;
    }
  } else {
    console.log(`Sub plan ${JSON.stringify(subPlan)} is using no allocation strategy`);
    // 不分配策略
    let remainingBudget = record.budget_amount;

    // 更新每个子记录
    for (const subRecord of matchingSubRecords) {
      // 更新子记录的预算和期初累计值
      const updatedSubRecord = {
        ...subRecord,
        budget_amount: remainingBudget,
        opening_cumulative_expense: totalExpense,
        opening_cumulative_balance: remainingBudget,
      };

      // 递归更新子记录
      const introspectedSubRecord = await doReconcileExpenseRecord(updatedSubRecord, plans);

      // 更新子记录
      await db.updateExpenseRecord(subRecord.id, introspectedSubRecord);

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

  console.log(`Updated record ${JSON.stringify(updatedRecord)} to introspect`);

  // 自省当前记录
  return introspectionExpenseRecord(updatedRecord, plans);
};

const introspectionIncomeRecord = (record: IncomeRecord) => {
  record.closing_cumulative = record.opening_cumulative + record.amount;
  return record;
};

// 更新函数：处理记录及其子记录
// 收入记录的更新与开支记录的更新类似，只是累加的是实际收入
// 更新子记录（或无子记录的记录）的期初收入、期末收入（基于函数 introspectionIncomeRecord）
// 更新父记录的收入（子记录收入的累加值）、期末收入（基于函数 introspectionIncomeRecord）
const doReconcileIncomeRecord = async (record: IncomeRecord, plans: IncomePlan[]) => {
  const plan = plans.find(p => p.id === record.plan_id);
  if (!plan) return record;

  // 检查是否有子计划
  const subPlan = plans.find(p => p.parent_id === plan.id);
  if (!subPlan) {
    console.log(`No sub plan found for record ${JSON.stringify(record)}`);
    // 如果没有子计划，直接自省
    return introspectionIncomeRecord(record);
  }

  // 获取所有子记录
  const subRecords = await getIncomeRecords(subPlan.id);

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

  let totalIncome = 0;

  // 更新每个子记录
  for (const subRecord of matchingSubRecords) {
    // 更新子记录的预算和期初累计值
    const updatedSubRecord = {
      ...subRecord,
      opening_cumulative: record.opening_cumulative + totalIncome,
    };

    // 递归更新子记录
    const introspectedSubRecord = await doReconcileIncomeRecord(updatedSubRecord, plans);

    // 更新子记录
    await db.updateIncomeRecord(introspectedSubRecord);

    // 累加实际收入
    totalIncome += introspectedSubRecord.amount;
  }

  console.log(`Total income: ${totalIncome}`);
  // 更新当前记录的实际收入
  const updatedRecord = {
    ...record,
    amount: totalIncome,
  };

  // 自省当前记录
  return introspectionIncomeRecord(updatedRecord);
};

const getReconcileIncomeRecordStartPoint = async (record: IncomeRecord) => {
  if (record.is_sub_record && record.parent_record_id) {
    const parentRecord = await db.getIncomeRecordWithID(record.parent_record_id); // FIXME: 实现这个函数
    if (parentRecord) {
      console.log(`Parent record ${JSON.stringify(parentRecord)}`);
      return parentRecord;
    } else {
      // Error
      throw new Error(`Parent record ${record.parent_record_id} not found for record ${record.id}`);
    }
  }
  return record;
};

const reconcileIncomeRecord = async (record: IncomeRecord, plans: IncomePlan[]) => {
  const needReconciledRecord = await getReconcileIncomeRecordStartPoint(record);
  console.log(`Need reconciling income record ${JSON.stringify(needReconciledRecord)}`);
  const updatedRecord = await doReconcileIncomeRecord(needReconciledRecord, plans);
  return updatedRecord;
};

