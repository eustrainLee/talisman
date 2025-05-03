# 开支计划系统设计

## 计划层级设计

### 计划类型
- 一级计划：定义总体预算和周期（如年度计划）
- 二级计划：子周期计划（如月度计划）

### 计划属性
- 一级计划：
  - 可以设置子周期类型（可选）
  - 如果设置了子周期类型，则只能创建该类型的二级计划
  - 如果已创建二级计划，则不允许修改子周期类型
  - 子周期类型一旦设置，不建议修改
- 二级计划：
  - 不能设置子周期类型
  - 必须属于某个一级计划

## 数据库设计

### 开支计划表
```sql
CREATE TABLE expense_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,  -- 总预算（分）
  period TEXT NOT NULL,     -- 周期类型：WEEK/MONTH/QUARTER/YEAR
  parent_id INTEGER,        -- 父计划ID
  sub_period TEXT,          -- 子周期类型（如果是一级计划）
  budget_allocation TEXT NOT NULL DEFAULT 'NONE',  -- 预算分配方式：NONE/AVERAGE
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES expense_plans (id)
);
```

### 开支记录表
```sql
CREATE TABLE expense_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  parent_record_id INTEGER,  -- 父记录ID
  date TEXT NOT NULL,        -- 记录日期
  budget_amount INTEGER NOT NULL,  -- 预算额度（分）
  actual_amount INTEGER NOT NULL,  -- 实际支出（分）
  balance INTEGER NOT NULL,        -- 结余（分）
  opening_cumulative_balance INTEGER NOT NULL,  -- 期初累计结余（分）
  closing_cumulative_balance INTEGER NOT NULL,  -- 期末累计结余（分）
  opening_cumulative_expense INTEGER NOT NULL,  -- 期初累计支出（分）
  closing_cumulative_expense INTEGER NOT NULL,  -- 期末累计支出（分）
  is_sub_record BOOLEAN NOT NULL DEFAULT 0,     -- 是否是子记录
  sub_period_index INTEGER,                     -- 子周期索引，从1开始递增，表示这是第几个子周期
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES expense_plans (id),
  FOREIGN KEY (parent_record_id) REFERENCES expense_records (id)
);
```

## 业务逻辑

### 计划管理
- 创建一级计划时可以设置子周期类型（可选）
- 一级计划可以创建二级计划（如果设置了子周期类型）
- 二级计划不能设置子周期类型
- 如果存在二级计划，一级计划不能修改子周期类型

### 记录管理
- 创建父记录时不需要立即创建子记录
- 父记录的预算额度和期初累计值可以设置
- 子记录的预算额度根据预算分配方式决定：
  - NONE：使用上一个子记录的结余（如果没有则使用父记录预算）
  - AVERAGE：平均分配父记录预算
- 子记录之间不允许时间重叠
- 子记录更新后自动更新父记录的汇总数据

## UI 设计

### 计划列表
- 一级计划显示主要信息
- 二级计划紧跟在对应一级计划下方，使用缩进或不同样式显示
- 一级计划的操作包括：编辑、删除、创建二级计划
- 二级计划的操作包括：编辑、删除

### 记录管理
- 父记录显示汇总数据
- 可以展开查看子记录
- 子记录显示详细数据
- 可以单独创建子记录

## 预算分配方式

### NONE
- 不预先分配预算
- 子记录使用上一个子记录的结余
- 如果没有上一个子记录，使用父记录预算

### AVERAGE
- 平均分配
- 根据子周期数量平均分配父记录预算

## 设计优点
1. 层级关系清晰，只有两级
2. 避免了时间重叠和空白的问题
3. 提供了灵活的预算分配方式
4. 保持了数据的完整性和一致性
5. 用户体验更加直观 