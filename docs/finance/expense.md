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

# 开支计划

## 概述

开支计划用于管理定期发生的开支，如生活费、房租等。每个开支计划可以有一个子计划，子计划用于更细粒度的预算管理。

## 数据结构

### 开支计划

```typescript
interface ExpensePlan {
  id: number;              // 计划ID
  name: string;           // 计划名称
  amount: number;         // 预算额度（分）
  period: PeriodType;     // 周期类型
  parent_id: number | null; // 父计划ID，null表示顶级计划
  budget_allocation: 'NONE' | 'AVERAGE'; // 预算分配方式
}
```

### 周期类型

```typescript
type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
```

## 功能说明

### 创建开支计划

1. 创建顶级计划：
   - 设置计划名称
   - 设置预算额度
   - 选择周期类型（周/月/季/年）
   - 顶级计划的预算分配方式固定为"NONE"

2. 创建子计划：
   - 选择父计划
   - 设置子计划名称
   - 选择子计划周期（必须比父计划周期更短）
   - 设置预算分配方式：
     - NONE：不分配，子计划使用父计划的全部额度
     - AVERAGE：平均分配，将父计划的额度平均分配到子计划的每个周期

### 预算分配方式

- NONE：不进行分配，子计划使用父计划的全部额度
- AVERAGE：平均分配，将父计划的额度平均分配到子计划的每个周期
  - 例如：父计划是年计划，额度为12000元，子计划是月计划，选择平均分配，则每月额度为1000元

### 周期关系

子计划的周期必须比父计划更短：
- 年计划可以创建季/月/周子计划
- 季计划可以创建月/周子计划
- 月计划可以创建周子计划
- 周计划不能创建子计划

## 使用示例

1. 创建年计划：
   ```
   名称：生活费
   额度：12000元
   周期：年
   ```

2. 创建月计划（子计划）：
   ```
   名称：月度生活费
   父计划：生活费
   周期：月
   预算分配：平均分配
   ```
   系统会自动计算每月额度：12000元 ÷ 12 = 1000元/月

## 注意事项

1. 每个开支计划只能有一个子计划
2. 子计划的预算分配方式决定了如何分配父计划的预算
3. 顶级计划的预算分配方式固定为"NONE"
4. 删除父计划前需要先删除子计划 