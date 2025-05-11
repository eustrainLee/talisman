// 财务相关类型定义

export interface ExpensePlan {
  id: number; // 唯一标识符
  name: string; // 名称
  amount: number; // 预设额度
  period: string; // 周期
  parent_id?: number; // 父级计划ID
  sub_period?: string; // 子级周期
  budget_allocation: 'NONE' | 'AVERAGE'; // 预算分配方式（NONE: 不分配, AVERAGE: 平均分配），仅对于子计划
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

export interface ExpenseRecord {
  id: number; // 唯一标识符
  plan_id: number; // 所属计划ID
  parent_record_id?: number; // 父级记录ID
  date: string; // 记录日期
  budget_amount: number; // 预算金额，可能和计划中的值不同，以此处的值为准，一经创建，不应自动更新（可以手动更新）。
  actual_amount: number; // 实际金额，来自用户填写
  balance: number; // 余额，计算得出（在 UI 上也可以自动推导出实际金额）
  opening_cumulative_balance: number; // 期初累计余额，计算得出
  closing_cumulative_balance: number; // 期末累计余额，计算得出
  opening_cumulative_expense: number; // 期初累计支出，计算得出
  closing_cumulative_expense: number; // 期末累计支出，计算得出
  is_sub_record: boolean; // 是否为子记录
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

export interface IncomePlan {
  id: number; // 唯一标识符
  name: string; // 名称
  period: string; // 周期
  parent_id: number | null; // 父级计划ID
  sub_period: string | null; // 子级周期
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

export interface IncomeRecord {
  id: number; // 唯一标识符
  plan_id: number; // 所属计划ID
  parent_record_id: number | null; // 父级记录ID
  date: string; // 记录日期
  amount: number; // 金额
  opening_cumulative: number; // 期初累计金额
  closing_cumulative: number; // 期末累计金额
  is_sub_record: boolean; // 是否为子记录
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}
