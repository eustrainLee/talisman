# 资产管理

## 数据结构

### 物件基本信息
- `id`: 唯一标识
- `name`: 物件名称
- `description`: 物件描述（可选）
- `location`: 物件位置（简单描述，可选）
- `created_at`: 创建时间
- `updated_at`: 更新时间

### 标签系统
使用 key-value 结构存储标签，例如：
```json
{
  "类别": "电子产品",
  "品牌": "Apple",
  "型号": "iPhone 14",
  "颜色": "黑色",
  "购买渠道": "官网"
}
```

### 借出状态
- `is_borrowed`: 是否借出
- `borrower`: 借出人
- `borrow_date`: 借出日期
- `expected_return_date`: 预期归还日期
- `actual_return_date`: 实际归还日期（可选）
- `borrow_note`: 借出备注（可选）

### 借出记录历史
```typescript
borrow_history: {
  id: number;
  borrower: string;          // 借出人
  borrow_date: string;       // 借出日期
  expected_return_date: string;  // 预期归还日期
  actual_return_date: string;    // 实际归还日期
  status: 'borrowed' | 'returned' | 'overdue';  // 借出状态
  note: string;              // 借出备注
  created_at: string;        // 记录创建时间
}[]
```

### 生命周期
- `acquisition_date`: 获得日期
- `acquisition_source`: 获得来源
- `acquisition_cost`: 获得成本（金额）
- `acquisition_note`: 获得备注（可选）
- `planned_disposal_date`: 计划处置日期（可选）
- `actual_disposal_date`: 实际处置日期（可选）
- `disposal_method`: 处置方式（例如：出售、捐赠、报废等）
- `disposal_note`: 处置备注（可选）

### 维护记录
```typescript
maintenance_history: {
  id: number;
  date: string;             // 维护日期
  type: string;             // 维护类型（清洁、维修、保养等）
  cost: number;             // 维护成本（可选）
  description: string;      // 维护描述
  maintainer: string;       // 维护人（自己/维修人员）
  next_maintenance_date: string;  // 下次维护日期（可选）
  created_at: string;       // 记录创建时间
}[]
```

## 功能设计

### 检索功能
- 按名称搜索
- 按标签筛选
- 按借出状态筛选
- 按生命周期状态筛选（在役、已处置、即将处置等）
- 按位置筛选

### 标签管理
- 支持自定义标签键值对
- 常用标签快速选择
- 标签组合筛选

### 借出管理
- 借出登记
- 归还登记
- 借出历史查询
- 逾期提醒

### 维护管理
- 维护记录登记
- 维护计划提醒
- 维护历史查询

### 生命周期管理
- 获得登记
- 处置登记
- 生命周期状态追踪