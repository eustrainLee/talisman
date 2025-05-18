// 对外提供接口
import { Asset, BorrowRecord, MaintenanceRecord, CreateAsset, UpdateAsset, CreateBorrowRecord, UpdateBorrowRecord, CreateMaintenanceRecord, UpdateMaintenanceRecord } from './def';
import * as db from './db';

// 物件相关操作
export const getAssets = () => db.getAssets();
export const getAsset = (id: number) => db.getAsset(id);
export const createAsset = (asset: CreateAsset) => db.createAsset(asset);
export const updateAsset = (id: number, data: UpdateAsset) => db.updateAsset(id, data);
export const deleteAsset = (id: number) => db.deleteAsset(id);
export const getAssetTags = (assetId: number) => db.getAssetTags(assetId);

// 借出记录相关操作
export const getBorrowRecords = (assetId: number) => db.getBorrowRecords(assetId);
export const createBorrowRecord = (record: CreateBorrowRecord) => db.createBorrowRecord(record);
export const updateBorrowRecord = (id: number, data: UpdateBorrowRecord) => db.updateBorrowRecord(id, data);

// 维护记录相关操作
export const getMaintenanceRecords = (assetId: number) => db.getMaintenanceRecords(assetId);
export const createMaintenanceRecord = (record: CreateMaintenanceRecord) => db.createMaintenanceRecord(record);
export const updateMaintenanceRecord = (id: number, data: UpdateMaintenanceRecord) => db.updateMaintenanceRecord(id, data);

// 获取物件状态统计
export const getAssetStatusSummary = async () => {
  const assets = await getAssets();
  const summary = {
    total: assets.length,
    pending: 0,
    owned: 0,
    borrowed: 0,
    disposed: 0
  };
  
  assets.forEach(asset => {
    summary[asset.status]++;
  });
  
  return summary;
};

// 获取即将到期的借出记录
export const getUpcomingBorrowRecords = async (days: number = 7) => {
  const assets = await getAssets();
  const today = new Date();
  const upcomingDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  
  const upcomingRecords: (BorrowRecord & { asset: Asset })[] = [];
  
  for (const asset of assets) {
    if (asset.current_borrow_id) {
      const records = await getBorrowRecords(asset.id);
      const currentRecord = records.find(r => r.id === asset.current_borrow_id);
      
      if (currentRecord && currentRecord.status === 'borrowed') {
        const expectedReturnDate = new Date(currentRecord.expected_return_date);
        if (expectedReturnDate <= upcomingDate && expectedReturnDate >= today) {
          upcomingRecords.push({
            ...currentRecord,
            asset
          });
        }
      }
    }
  }
  
  return upcomingRecords.sort((a, b) => 
    new Date(a.expected_return_date).getTime() - new Date(b.expected_return_date).getTime()
  );
};

// 获取即将需要维护的物件
export const getUpcomingMaintenanceAssets = async (days: number = 30) => {
  const assets = await getAssets();
  const today = new Date();
  const upcomingDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  
  const upcomingMaintenance: (Asset & { next_maintenance_date: string })[] = [];
  
  for (const asset of assets) {
    if (asset.status !== 'disposed') {
      const records = await getMaintenanceRecords(asset.id);
      if (records.length > 0) {
        const lastRecord = records[0];
        if (lastRecord.next_maintenance_date) {
          const nextMaintenanceDate = new Date(lastRecord.next_maintenance_date);
          if (nextMaintenanceDate <= upcomingDate && nextMaintenanceDate >= today) {
            upcomingMaintenance.push({
              ...asset,
              next_maintenance_date: lastRecord.next_maintenance_date
            });
          }
        }
      }
    }
  }
  
  return upcomingMaintenance.sort((a, b) => 
    new Date(a.next_maintenance_date).getTime() - new Date(b.next_maintenance_date).getTime()
  );
};

// 获取物件价值统计
export const getAssetValueSummary = async () => {
  const assets = await getAssets();
  const summary = {
    total_value: 0,
    by_status: {
      pending: 0,
      owned: 0,
      borrowed: 0,
      disposed: 0
    }
  };
  
  assets.forEach(asset => {
    summary.total_value += asset.acquisition_cost;
    summary.by_status[asset.status] += asset.acquisition_cost;
  });
  
  return summary;
}; 