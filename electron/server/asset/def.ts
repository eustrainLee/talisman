// 资产管理相关类型定义

export type AssetStatus = 'pending' | 'owned' | 'borrowed' | 'disposed';
export type BorrowStatus = 'borrowed' | 'returned' | 'overdue';

export interface Asset {
  id: number;                // 唯一标识
  name: string;              // 物件名称
  description: string;       // 物件描述
  location: string;          // 物件位置
  status: AssetStatus;       // 物件状态
  current_borrow_id: number | null; // 当前借出记录ID
  tags: Tag[];               // 物件标签
  
  // 生命周期信息
  acquisition_date: string;      // 获得日期
  acquisition_source: string;    // 获得来源
  acquisition_cost: number;      // 获得成本（分）
  acquisition_note: string;      // 获得备注
  planned_disposal_date: string; // 计划处置日期
  actual_disposal_date: string;  // 实际处置日期
  disposal_method: string;       // 处置方式
  disposal_note: string;         // 处置备注
  
  created_at: string;        // 创建时间
  updated_at: string;        // 更新时间
}

export interface Tag {
  id: number;                // 标签ID
  key: string;               // 标签键名
  value: string;             // 标签值
  created_at: string;        // 创建时间
  updated_at: string;        // 更新时间
}

export interface AssetTag {
  id: number;                // 关联ID
  asset_id: number;          // 物件ID
  tag_id: number;            // 标签ID
  created_at: string;        // 创建时间
}

export interface BorrowRecord {
  id: number;                // 借出记录ID
  asset_id: number;          // 关联的物件ID
  borrower: string;          // 借出人
  borrow_date: string;       // 借出日期
  expected_return_date: string;  // 预期归还日期
  actual_return_date: string;    // 实际归还日期
  status: BorrowStatus;      // 借出状态
  note: string;              // 借出备注
  created_at: string;        // 记录创建时间
  updated_at: string;        // 记录更新时间
}

export interface MaintenanceRecord {
  id: number;                // 维护记录ID
  asset_id: number;          // 关联的物件ID
  date: string;             // 维护日期
  type: string;             // 维护类型
  cost: number;             // 维护成本（分）
  description: string;      // 维护描述
  maintainer: string;       // 维护人
  next_maintenance_date: string;  // 下次维护日期
  created_at: string;       // 记录创建时间
  updated_at: string;       // 记录更新时间
}

// 用于创建新物件时的类型
export type CreateAsset = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;

// 用于更新物件时的类型
export type UpdateAsset = Partial<Omit<Asset, 'id' | 'created_at' | 'updated_at'>>;

// 用于创建新标签时的类型
export type CreateTag = Omit<Tag, 'id' | 'created_at' | 'updated_at'>;

// 用于创建新借出记录时的类型
export type CreateBorrowRecord = Omit<BorrowRecord, 'id' | 'created_at' | 'updated_at'>;

// 用于更新借出记录时的类型
export type UpdateBorrowRecord = Partial<Omit<BorrowRecord, 'id' | 'created_at' | 'updated_at'>>;

// 用于创建新维护记录时的类型
export type CreateMaintenanceRecord = Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>;

// 用于更新维护记录时的类型
export type UpdateMaintenanceRecord = Partial<Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>>; 