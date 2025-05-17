# 资产管理

## 数据结构

### 物件基本信息
```typescript
assets: {
  id: number;                // 唯一标识
  name: string;              // 物件名称
  description: string;       // 物件描述（可选）
  location: string;          // 物件位置（简单描述）
  status: 'pending' | 'owned' | 'borrowed' | 'disposed';  // 物件状态
  current_borrow_id: number; // 当前借出记录ID（当status为borrowed时）
  
  // 生命周期信息
  acquisition_date: string;      // 获得日期
  acquisition_source: string;    // 获得来源
  acquisition_cost: number;      // 获得成本（金额）
  acquisition_note: string;      // 获得备注（可选）
  planned_disposal_date: string; // 计划处置日期（可选）
  actual_disposal_date: string;  // 实际处置日期（可选）
  disposal_method: string;       // 处置方式（例如：出售、捐赠、报废等）
  disposal_note: string;         // 处置备注（可选）
  
  created_at: string;        // 创建时间
  updated_at: string;        // 更新时间
}[]
```

### 标签系统
```typescript
// 标签定义表
tags: {
  id: number;                // 标签ID
  key: string;               // 标签键名
  value: string;             // 标签值
  created_at: string;        // 创建时间
  updated_at: string;        // 更新时间
}[]

// 物件-标签关联表
asset_tags: {
  id: number;                // 关联ID
  asset_id: number;          // 物件ID
  tag_id: number;            // 标签ID
  created_at: string;        // 创建时间
}[]
```

### 借出记录
```typescript
borrow_records: {
  id: number;                // 借出记录ID
  asset_id: number;          // 关联的物件ID
  borrower: string;          // 借出人
  borrow_date: string;       // 借出日期
  expected_return_date: string;  // 预期归还日期
  actual_return_date: string;    // 实际归还日期
  status: 'borrowed' | 'returned' | 'overdue';  // 借出状态
  note: string;              // 借出备注
  created_at: string;        // 记录创建时间
  updated_at: string;        // 记录更新时间
}[]
```

### 维护记录
```typescript
maintenance_records: {
  id: number;                // 维护记录ID
  asset_id: number;          // 关联的物件ID
  date: string;             // 维护日期
  type: string;             // 维护类型（清洁、维修、保养等）
  cost: number;             // 维护成本（可选）
  description: string;      // 维护描述
  maintainer: string;       // 维护人（自己/维修人员）
  next_maintenance_date: string;  // 下次维护日期（可选）
  created_at: string;       // 记录创建时间
  updated_at: string;       // 记录更新时间
}[]
```

## 功能设计

### 检索功能
- 按名称搜索
- 按标签筛选（支持多标签组合筛选）
- 按状态筛选（待获得、持有中、已借出、已处置）
- 按位置筛选

### 标签管理
- 标签的增删改查
- 常用标签快速选择
- 标签使用统计
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