import React, { useState } from 'react';
import { Select, Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface MonthlyRecord {
  key: string;
  month: string;
  income: number;
  expense: number;
  balance: number;
}

const Summary: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const columns: ColumnsType<MonthlyRecord> = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
    },
    {
      title: '收入',
      dataIndex: 'income',
      key: 'income',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '支出',
      dataIndex: 'expense',
      key: 'expense',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '结余',
      dataIndex: 'balance',
      key: 'balance',
      render: (value: number) => (value / 100).toFixed(2),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Select
          value={selectedYear}
          onChange={setSelectedYear}
          style={{ width: 120 }}
          options={[
            { value: 2024, label: '2024年' },
            { value: 2023, label: '2023年' },
          ]}
        />
      </div>

      <Card title="年度汇总" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div>
            <div>总收入</div>
            <div>¥0.00</div>
          </div>
          <div>
            <div>总支出</div>
            <div>¥0.00</div>
          </div>
          <div>
            <div>净收入</div>
            <div>¥0.00</div>
          </div>
        </div>
      </Card>

      <Table<MonthlyRecord>
        columns={columns}
        // 数据将从数据库获取
        dataSource={[]}
        pagination={false}
        size="small"
        style={{ fontSize: '12px' }}
      />
    </div>
  );
};

export default Summary; 