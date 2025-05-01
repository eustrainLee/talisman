import React, { useState } from 'react';
import { Table, Select, DatePicker, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Option } = Select;

interface ExpenseRecord {
  key: string;
  name: string;
  budget_amount: number;
  actual_amount: number;
  balance: number;
  opening_cumulative_balance: number;
  closing_cumulative_balance: number;
  opening_cumulative_expense: number;
  closing_cumulative_expense: number;
  update_time: string;
}

const periodTypes = [
  { value: 'YEAR', label: '年' },
  { value: 'QUARTER', label: '季' },
  { value: 'MONTH', label: '月' },
  { value: 'WEEK', label: '周' },
];

const Expense: React.FC = () => {
  const [periodType, setPeriodType] = useState('MONTH');
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const columns: ColumnsType<ExpenseRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '预算额度',
      dataIndex: 'budget_amount',
      key: 'budget_amount',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '实际开销',
      dataIndex: 'actual_amount',
      key: 'actual_amount',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '结余',
      dataIndex: 'balance',
      key: 'balance',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '期初累计结余',
      dataIndex: 'opening_cumulative_balance',
      key: 'opening_cumulative_balance',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '期末累计结余',
      dataIndex: 'closing_cumulative_balance',
      key: 'closing_cumulative_balance',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '期初累计开支',
      dataIndex: 'opening_cumulative_expense',
      key: 'opening_cumulative_expense',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '期末累计开支',
      dataIndex: 'closing_cumulative_expense',
      key: 'closing_cumulative_expense',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '更新时间',
      dataIndex: 'update_time',
      key: 'update_time',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Select
            value={periodType}
            onChange={setPeriodType}
            style={{ width: 120 }}
          >
            {periodTypes.map(type => (
              <Option key={type.value} value={type.value}>{type.label}</Option>
            ))}
          </Select>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            picker={periodType.toLowerCase() as any}
            style={{ width: 200 }}
          />
        </div>
      </Card>

      <Table<ExpenseRecord>
        columns={columns}
        // 数据将从数据库获取
        dataSource={[]}
        pagination={false}
      />
    </div>
  );
};

export default Expense; 