import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import log from 'electron-log'

let db: Database.Database | null = null

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
        id TEXT PRIMARY KEY,                -- 唯一标识符
        name TEXT NOT NULL,                 -- 名称
        acquisition_date DATE NOT NULL,     -- 获得时间
        disposal_date DATE,                 -- 失去时间（可以为空）
        acquisition_method TEXT NOT NULL,   -- 获得方式
        purchase_price INTEGER NOT NULL,    -- 购入价格（分）
        source TEXT NOT NULL,               -- 来源
        description TEXT,                   -- 描述
        notes TEXT,                         -- 备注
        planned_disposal_date DATE,         -- 计划失去时间
        is_lent BOOLEAN NOT NULL DEFAULT 0, -- 是否已被借出
        lending_date DATE,                  -- 借出时间
        planned_return_date DATE,           -- 计划收回时间
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- 更新时间
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