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

## 界面设计

### 筛选区域

#### 1. 名称搜索
- 输入框支持模糊搜索
- 实时搜索（输入时自动触发）

#### 2. 状态筛选
- 多选框：owned、borrowed、pending、disposed
- 默认选中 "owned"
- 状态之间是"或"的关系（并集）

#### 3. 时间范围筛选
- 创建时间范围
  - 开始日期选择器
  - 结束日期选择器
  - 支持快速选择（最近一周、最近一月等）
- 更新时间范围
  - 开始日期选择器
  - 结束日期选择器
  - 支持快速选择（最近一周、最近一月等）

#### 4. 标签筛选
- 标签选择区
  - 显示所有可用标签
  - 标签按使用频率排序
  - 支持多选
  - 标签之间是"与"的关系（交集）
- 已选标签区
  - 显示当前选中的标签
  - 支持快速删除
  - 标签可以拖拽排序

#### 5. 操作按钮
- 重置筛选：清空所有筛选条件
- 应用筛选：应用当前筛选条件

### 列表区域

#### 1. 列表头部
- 显示列：名称、状态、位置、获得日期、获得成本、标签、操作
- 支持点击列头排序
- 支持调整列宽
- 支持自定义显示列

#### 2. 列表内容
- 每行显示一个物件的基本信息
- 操作列包含：
  - 详情按钮：查看物件详细信息
  - 编辑按钮：修改物件信息

#### 3. 分页控制
- 每页显示数量选择
- 页码导航
- 总条数显示

### 其他功能

#### 1. 视图切换
- 支持列表视图和网格视图切换
- 网格视图适合展示带图片的物件

#### 2. 批量操作
- 支持选择多个物件
- 支持批量修改状态
- 支持批量添加/删除标签

#### 3. 数据导出
- 支持导出当前筛选结果
- 支持选择导出字段
- 支持多种导出格式（CSV、Excel等）

### 交互说明

#### 1. 筛选条件
- 所有筛选条件可以组合使用
- 筛选条件变化时自动更新列表
- 支持保存常用的筛选条件组合

#### 2. 列表操作
- 支持键盘快捷键
- 支持拖拽排序
- 支持右键菜单

#### 3. 响应式设计
- 适配不同屏幕尺寸
- 在移动设备上优化显示
- 支持触摸操作