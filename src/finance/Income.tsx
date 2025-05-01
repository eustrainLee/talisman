import React, { useState } from 'react';
import { Table, Select, DatePicker, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Option } = Select;

interface IncomeRecord {
  key: string;
  name: string;
  amount: number;
  opening_cumulative: number;
  closing_cumulative: number;
  update_time: string;
}

const periodTypes = [
  { value: 'YEAR', label: '年' },
  { value: 'QUARTER', label: '季' },
  { value: 'MONTH', label: '月' },
  { value: 'WEEK', label: '周' },
];

const Income: React.FC = () => {
  const [periodType, setPeriodType] = useState('MONTH');
  const [selectedDate, setSelectedDate] = useState(dayjs());

  const columns: ColumnsType<IncomeRecord> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '收入',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '期初累计',
      dataIndex: 'opening_cumulative',
      key: 'opening_cumulative',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '期末累计',
      dataIndex: 'closing_cumulative',
      key: 'closing_cumulative',
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

      <Table<IncomeRecord>
        columns={columns}
        // 数据将从数据库获取
        dataSource={[]}
        pagination={false}
      />
    </div>
  );
};

export default Income; 