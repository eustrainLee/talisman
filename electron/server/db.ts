import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import log from 'electron-log'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initializeDatabase() {
  try {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'finance.db')
    
    db = new Database(dbPath)
    
    // Create monthly expenses table
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_expenses (
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        budget_amount INTEGER NOT NULL,      -- 预算额度（分）
        actual_amount INTEGER NOT NULL,      -- 实际开销（分）
        balance INTEGER NOT NULL,            -- 结余（分）
        opening_cumulative_balance INTEGER NOT NULL,  -- 期初累计结余（分）
        closing_cumulative_balance INTEGER NOT NULL,  -- 期末累计结余（分）
        opening_cumulative_expense INTEGER NOT NULL,  -- 期初累计开支（分）
        closing_cumulative_expense INTEGER NOT NULL,  -- 期末累计开支（分）
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
        PRIMARY KEY (name, year, month)
      )
    `)

    // Create monthly income table
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_income (
        name TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        amount INTEGER NOT NULL,             -- 收入（分）
        opening_cumulative INTEGER NOT NULL, -- 期初累计（分）
        closing_cumulative INTEGER NOT NULL, -- 期末累计（分）
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
        PRIMARY KEY (name, year, month)
      )
    `)

    // Create assets table
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,                 -- 物件名称
        description TEXT,                   -- 物件描述
        location TEXT,                      -- 物件位置
        status TEXT NOT NULL,               -- 物件状态：pending/owned/borrowed/disposed
        current_borrow_id INTEGER,          -- 当前借出记录ID
        
        -- 生命周期信息
        acquisition_date TEXT NOT NULL,     -- 获得日期
        acquisition_source TEXT NOT NULL,   -- 获得来源
        acquisition_cost INTEGER NOT NULL,  -- 获得成本（分）
        acquisition_note TEXT,              -- 获得备注
        planned_disposal_date TEXT,         -- 计划处置日期
        actual_disposal_date TEXT,          -- 实际处置日期
        disposal_method TEXT,               -- 处置方式
        disposal_note TEXT,                 -- 处置备注
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (current_borrow_id) REFERENCES borrow_records (id)
      )
    `)

    // Create annual settlement table
    db.exec(`
      CREATE TABLE IF NOT EXISTS annual_settlement (
        year INTEGER PRIMARY KEY,           -- 年份
        opening_cumulative_income INTEGER NOT NULL,  -- 期初累计收入（分）
        closing_cumulative_income INTEGER NOT NULL,  -- 期末累计收入（分）
        opening_cumulative_expense INTEGER NOT NULL, -- 期初累计支出（分）
        closing_cumulative_expense INTEGER NOT NULL, -- 期末累计支出（分）
        total_income INTEGER NOT NULL,      -- 总收入（分）
        total_expense INTEGER NOT NULL,     -- 总支出（分）
        net_income INTEGER NOT NULL,        -- 净收入（分，可以为负数）
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- 更新时间
      )
    `)

    // Create periodic expenses table
    db.exec(`
      CREATE TABLE IF NOT EXISTS periodic_expenses (
        name TEXT NOT NULL,
        period_type TEXT NOT NULL,          -- 周期类型：DAY/WEEK/MONTH/QUARTER/YEAR
        period_start_date DATE NOT NULL,    -- 周期开始日期
        period_end_date DATE NOT NULL,      -- 周期结束日期
        budget_amount INTEGER NOT NULL,      -- 预算额度（分）
        actual_amount INTEGER NOT NULL,      -- 实际开销（分）
        balance INTEGER NOT NULL,            -- 结余（分）
        opening_cumulative_balance INTEGER NOT NULL,  -- 期初累计结余（分）
        closing_cumulative_balance INTEGER NOT NULL,  -- 期末累计结余（分）
        opening_cumulative_expense INTEGER NOT NULL,  -- 期初累计开支（分）
        closing_cumulative_expense INTEGER NOT NULL,  -- 期末累计开支（分）
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
        PRIMARY KEY (name, period_type, period_start_date, period_end_date)
      )
    `)

    // Create periodic income table
    db.exec(`
      CREATE TABLE IF NOT EXISTS periodic_income (
        name TEXT NOT NULL,
        period_type TEXT NOT NULL,          -- 周期类型：DAY/WEEK/MONTH/QUARTER/YEAR
        period_start_date DATE NOT NULL,    -- 周期开始日期
        period_end_date DATE NOT NULL,      -- 周期结束日期
        amount INTEGER NOT NULL,             -- 收入（分）
        opening_cumulative INTEGER NOT NULL, -- 期初累计（分）
        closing_cumulative INTEGER NOT NULL, -- 期末累计（分）
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
        PRIMARY KEY (name, period_type, period_start_date, period_end_date)
      )
    `)

    // Create expense plans table
    db.exec(`
      CREATE TABLE IF NOT EXISTS expense_plans (
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
      )
    `)

    // Create expense records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS expense_records (
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES expense_plans (id),
        FOREIGN KEY (parent_record_id) REFERENCES expense_records (id)
      )
    `)

    // Create income plans table
    db.exec(`
      CREATE TABLE IF NOT EXISTS income_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        period TEXT NOT NULL,     -- 周期类型：WEEK/MONTH/QUARTER/YEAR
        parent_id INTEGER,        -- 父计划ID
        sub_period TEXT,          -- 子周期类型（如果是一级计划）
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES income_plans (id)
      )
    `)

    // Create income records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS income_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        parent_record_id INTEGER,  -- 父记录ID
        date TEXT NOT NULL,        -- 记录日期
        amount INTEGER NOT NULL,   -- 收入金额（分）
        opening_cumulative INTEGER NOT NULL,  -- 期初累计（分）
        closing_cumulative INTEGER NOT NULL,  -- 期末累计（分）
        is_sub_record BOOLEAN NOT NULL DEFAULT 0,  -- 是否是子记录
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES income_plans (id),
        FOREIGN KEY (parent_record_id) REFERENCES income_records (id)
      )
    `)

    // Create tags table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,                  -- 标签键名
        value TEXT NOT NULL,                -- 标签值
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(key, value)                  -- 确保标签键值对唯一
      )
    `)

    // Create asset_tags table
    db.exec(`
      CREATE TABLE IF NOT EXISTS asset_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,          -- 物件ID
        tag_id INTEGER NOT NULL,            -- 标签ID
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE,
        UNIQUE(asset_id, tag_id)            -- 确保物件-标签关联唯一
      )
    `)

    // Create borrow_records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS borrow_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,          -- 关联的物件ID
        borrower TEXT NOT NULL,             -- 借出人
        borrow_date TEXT NOT NULL,          -- 借出日期
        expected_return_date TEXT NOT NULL, -- 预期归还日期
        actual_return_date TEXT,            -- 实际归还日期
        status TEXT NOT NULL,               -- 借出状态：borrowed/returned/overdue
        note TEXT,                          -- 借出备注
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
      )
    `)

    // Create maintenance_records table
    db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,          -- 关联的物件ID
        date TEXT NOT NULL,                 -- 维护日期
        type TEXT NOT NULL,                 -- 维护类型
        cost INTEGER,                       -- 维护成本（分）
        description TEXT NOT NULL,          -- 维护描述
        maintainer TEXT NOT NULL,           -- 维护人
        next_maintenance_date TEXT,         -- 下次维护日期
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
      )
    `)
  
    log.info('Database tables created successfully')
  } catch (error) {
    log.error('Failed to create database tables:', error)
    throw error
  }
}

export function getMonthlyRecord(year: number, month: number) {
  if (!db) throw new Error('Database not initialized')
  
  const stmt = db.prepare('SELECT * FROM monthly_records WHERE year = ? AND month = ?')
  return stmt.get(year, month)
}

export function insertOrUpdateRecord(year: number, month: number, data: string) {
  if (!db) throw new Error('Database not initialized')
  
  const stmt = db.prepare(`
    INSERT INTO monthly_records (year, month, data, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(year, month) DO UPDATE SET
    data = excluded.data,
    updated_at = CURRENT_TIMESTAMP
  `)
  
  return stmt.run(year, month, data)
}

export function deleteRecord(year: number, month: number) {
  if (!db) throw new Error('Database not initialized')
  
  const stmt = db.prepare('DELETE FROM monthly_records WHERE year = ? AND month = ?')
  return stmt.run(year, month)
}

export function getPeriodicRecord(periodType: string, periodStartDate: string, periodEndDate: string) {
  if (!db) throw new Error('Database not initialized')
  
  const stmt = db.prepare('SELECT * FROM periodic_records WHERE period_type = ? AND period_start_date = ? AND period_end_date = ?')
  return stmt.get(periodType, periodStartDate, periodEndDate)
}

export function insertOrUpdatePeriodicRecord(periodType: string, periodStartDate: string, periodEndDate: string, data: string) {
  if (!db) throw new Error('Database not initialized')
  
  const stmt = db.prepare(`
    INSERT INTO periodic_records (period_type, period_start_date, period_end_date, data, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(period_type, period_start_date, period_end_date) DO UPDATE SET
    data = excluded.data,
    updated_at = CURRENT_TIMESTAMP
  `)
  
  return stmt.run(periodType, periodStartDate, periodEndDate, data)
}

export function deletePeriodicRecord(periodType: string, periodStartDate: string, periodEndDate: string) {
  if (!db) throw new Error('Database not initialized')
  
  const stmt = db.prepare('DELETE FROM periodic_records WHERE period_type = ? AND period_start_date = ? AND period_end_date = ?')
  return stmt.run(periodType, periodStartDate, periodEndDate)
} 