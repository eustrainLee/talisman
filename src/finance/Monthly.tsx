import React from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface MonthlyRecord {
  key: string;
  month: string;
  income: number;
  expense: number;
  balance: number;
}

const Monthly: React.FC = () => {
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
    <Table<MonthlyRecord>
      columns={columns}
      // 数据将从数据库获取
      dataSource={[]}
      pagination={false}
    />
  );
};

export default Monthly; 