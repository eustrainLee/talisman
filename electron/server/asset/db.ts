// 封装数据库操作
import { getDatabase } from '../db';
import type { Asset, BorrowRecord, MaintenanceRecord, CreateAsset, UpdateAsset, CreateBorrowRecord, UpdateBorrowRecord, CreateMaintenanceRecord, UpdateMaintenanceRecord, Tag, CreateTag } from './def';

// 获取所有物件
export async function getAssets(): Promise<Asset[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM assets 
    ORDER BY created_at DESC
  `);
  return stmt.all() as Asset[];
}

// 获取单个物件
export async function getAsset(id: number): Promise<Asset> {
  const stmt = getDatabase().prepare('SELECT * FROM assets WHERE id = ?');
  const asset = stmt.get(id) as Asset | undefined;
  if (!asset) {
    throw new Error('物件不存在');
  }
  return asset;
}

// 创建物件
export async function createAsset(asset: CreateAsset): Promise<Asset> {
  const db = getDatabase();
  
  // 开始事务
  db.exec('BEGIN TRANSACTION');
  
  try {
    // 插入资产记录
    const stmt = db.prepare(`
      INSERT INTO assets (
        name, description, location, status, current_borrow_id,
        acquisition_date, acquisition_source, acquisition_cost, acquisition_note,
        planned_disposal_date, actual_disposal_date, disposal_method, disposal_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      asset.name,
      asset.description,
      asset.location,
      asset.status,
      asset.current_borrow_id || null,
      asset.acquisition_date,
      asset.acquisition_source,
      asset.acquisition_cost,
      asset.acquisition_note,
      asset.planned_disposal_date,
      asset.actual_disposal_date,
      asset.disposal_method,
      asset.disposal_note
    );
    
    const assetId = result.lastInsertRowid as number;
    
    // 处理标签
    if (asset.tags && asset.tags.length > 0) {
      const tagStmt = db.prepare(`
        INSERT INTO asset_tags (asset_id, tag_id)
        VALUES (?, ?)
      `);
      
      for (const tag of asset.tags) {
        tagStmt.run(assetId, tag.id);
      }
    }
    
    // 提交事务
    db.exec('COMMIT');
    
    return getAsset(assetId);
  } catch (error) {
    // 回滚事务
    db.exec('ROLLBACK');
    throw error;
  }
}

// 更新物件
export async function updateAsset(id: number, data: UpdateAsset): Promise<Asset> {
  const db = getDatabase();
  const asset = await getAsset(id);
  
  const stmt = db.prepare(`
    UPDATE assets 
    SET name = ?,
        description = ?,
        location = ?,
        status = ?,
        current_borrow_id = ?,
        acquisition_date = ?,
        acquisition_source = ?,
        acquisition_cost = ?,
        acquisition_note = ?,
        planned_disposal_date = ?,
        actual_disposal_date = ?,
        disposal_method = ?,
        disposal_note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  stmt.run(
    data.name || asset.name,
    data.description || asset.description,
    data.location || asset.location,
    data.status || asset.status,
    data.current_borrow_id || asset.current_borrow_id,
    data.acquisition_date || asset.acquisition_date,
    data.acquisition_source || asset.acquisition_source,
    data.acquisition_cost || asset.acquisition_cost,
    data.acquisition_note || asset.acquisition_note,
    data.planned_disposal_date || asset.planned_disposal_date,
    data.actual_disposal_date || asset.actual_disposal_date,
    data.disposal_method || asset.disposal_method,
    data.disposal_note || asset.disposal_note,
    id
  );
  
  return getAsset(id);
}

// 删除物件
export async function deleteAsset(id: number): Promise<void> {
  const db = getDatabase();
  
  // 检查是否有借出记录
  const hasBorrowRecords = db.prepare('SELECT COUNT(*) as count FROM borrow_records WHERE asset_id = ?').get(id) as { count: number };
  if (hasBorrowRecords.count > 0) {
    throw new Error('请先删除相关借出记录');
  }
  
  // 检查是否有维护记录
  const hasMaintenanceRecords = db.prepare('SELECT COUNT(*) as count FROM maintenance_records WHERE asset_id = ?').get(id) as { count: number };
  if (hasMaintenanceRecords.count > 0) {
    throw new Error('请先删除相关维护记录');
  }
  
  const stmt = db.prepare('DELETE FROM assets WHERE id = ?');
  const result = stmt.run(id) as { changes: number };
  
  if (result.changes === 0) {
    throw new Error('物件不存在');
  }
}

// 获取物件的借出记录
export async function getBorrowRecords(assetId: number): Promise<BorrowRecord[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM borrow_records 
    WHERE asset_id = ? 
    ORDER BY borrow_date DESC
  `);
  return stmt.all(assetId) as BorrowRecord[];
}

// 创建借出记录
export async function createBorrowRecord(record: CreateBorrowRecord): Promise<BorrowRecord> {
  const db = getDatabase();
  
  // 检查物件是否存在
  const asset = await getAsset(record.asset_id);
  
  // 如果物件当前状态不是 borrowed，更新状态
  if (asset.status !== 'borrowed') {
    await updateAsset(asset.id, { status: 'borrowed' });
  }
  
  const stmt = db.prepare(`
    INSERT INTO borrow_records (
      asset_id, borrower, borrow_date, expected_return_date,
      actual_return_date, status, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    record.asset_id,
    record.borrower,
    record.borrow_date,
    record.expected_return_date,
    record.actual_return_date,
    record.status,
    record.note
  );
  
  const newRecord = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(result.lastInsertRowid) as BorrowRecord;
  
  // 更新物件的当前借出记录ID
  await updateAsset(asset.id, { current_borrow_id: newRecord.id });
  
  return newRecord;
}

// 更新借出记录
export async function updateBorrowRecord(id: number, data: UpdateBorrowRecord): Promise<BorrowRecord> {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM borrow_records WHERE id = ?');
  const record = stmt.get(id) as BorrowRecord | undefined;
  
  if (!record) {
    throw new Error('借出记录不存在');
  }
  
  const updateStmt = db.prepare(`
    UPDATE borrow_records 
    SET borrower = ?,
        borrow_date = ?,
        expected_return_date = ?,
        actual_return_date = ?,
        status = ?,
        note = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  updateStmt.run(
    data.borrower || record.borrower,
    data.borrow_date || record.borrow_date,
    data.expected_return_date || record.expected_return_date,
    data.actual_return_date || record.actual_return_date,
    data.status || record.status,
    data.note || record.note,
    id
  );
  
  const updatedRecord = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(id) as BorrowRecord;
  
  // 如果状态变为已归还，更新物件状态
  if (updatedRecord.status === 'returned' && record.status !== 'returned') {
    const asset = await getAsset(updatedRecord.asset_id);
    await updateAsset(asset.id, { 
      status: 'owned',
      current_borrow_id: null
    });
  }
  
  return updatedRecord;
}

// 获取物件的维护记录
export async function getMaintenanceRecords(assetId: number): Promise<MaintenanceRecord[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM maintenance_records 
    WHERE asset_id = ? 
    ORDER BY date DESC
  `);
  return stmt.all(assetId) as MaintenanceRecord[];
}

// 创建维护记录
export async function createMaintenanceRecord(record: CreateMaintenanceRecord): Promise<MaintenanceRecord> {
  const db = getDatabase();
  
  // 检查物件是否存在
  await getAsset(record.asset_id);
  
  const stmt = db.prepare(`
    INSERT INTO maintenance_records (
      asset_id, date, type, cost, description,
      maintainer, next_maintenance_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    record.asset_id,
    record.date,
    record.type,
    record.cost,
    record.description,
    record.maintainer,
    record.next_maintenance_date
  );
  
  return db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(result.lastInsertRowid) as MaintenanceRecord;
}

// 更新维护记录
export async function updateMaintenanceRecord(id: number, data: UpdateMaintenanceRecord): Promise<MaintenanceRecord> {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM maintenance_records WHERE id = ?');
  const record = stmt.get(id) as MaintenanceRecord | undefined;
  
  if (!record) {
    throw new Error('维护记录不存在');
  }
  
  const updateStmt = db.prepare(`
    UPDATE maintenance_records 
    SET date = ?,
        type = ?,
        cost = ?,
        description = ?,
        maintainer = ?,
        next_maintenance_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  updateStmt.run(
    data.date || record.date,
    data.type || record.type,
    data.cost || record.cost,
    data.description || record.description,
    data.maintainer || record.maintainer,
    data.next_maintenance_date || record.next_maintenance_date,
    id
  );
  
  return db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(id) as MaintenanceRecord;
}

// 获取物件的标签
export async function getAssetTags(assetId: number): Promise<Tag[]> {
  const stmt = getDatabase().prepare(`
    SELECT t.* FROM tags t
    INNER JOIN asset_tags at ON t.id = at.tag_id
    WHERE at.asset_id = ?
    ORDER BY t.key, t.value
  `);
  return stmt.all(assetId) as Tag[];
}

// 获取所有标签
export async function getAllTags(): Promise<Tag[]> {
  const stmt = getDatabase().prepare(`
    SELECT * FROM tags 
    ORDER BY key, value
  `);
  return stmt.all() as Tag[];
}

// 创建标签
export async function createTag(tag: CreateTag): Promise<Tag> {
  const db = getDatabase();
  
  // 检查标签是否已存在
  const existingTag = db.prepare('SELECT * FROM tags WHERE key = ? AND value = ?').get(tag.key, tag.value) as Tag | undefined;
  if (existingTag) {
    return existingTag;
  }
  
  const stmt = db.prepare(`
    INSERT INTO tags (key, value)
    VALUES (?, ?)
  `);
  
  const result = stmt.run(tag.key, tag.value);
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag;
}

// 更新标签
export async function updateTag(id: number, data: Partial<CreateTag>): Promise<Tag> {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM tags WHERE id = ?');
  const tag = stmt.get(id) as Tag | undefined;
  
  if (!tag) {
    throw new Error('标签不存在');
  }
  
  const updateStmt = db.prepare(`
    UPDATE tags 
    SET key = ?,
        value = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  updateStmt.run(
    data.key || tag.key,
    data.value || tag.value,
    id
  );
  
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag;
}

// 删除标签
export async function deleteTag(id: number): Promise<void> {
  const db = getDatabase();
  
  // 检查标签是否被使用
  const hasAssetTags = db.prepare('SELECT COUNT(*) as count FROM asset_tags WHERE tag_id = ?').get(id) as { count: number };
  if (hasAssetTags.count > 0) {
    throw new Error('标签正在被使用，无法删除');
  }
  
  const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
  const result = stmt.run(id) as { changes: number };
  
  if (result.changes === 0) {
    throw new Error('标签不存在');
  }
} 