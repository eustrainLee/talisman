import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Card, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import ExpensePlanComponent from './ExpensePlan';
import { financeAPI, ExpenseRecord, ExpensePlan } from '../api/finance';

const { Option } = Select;

const periodTypes = [
  { value: 'YEAR', label: '年' },
  { value: 'QUARTER', label: '季' },
  { value: 'MONTH', label: '月' },
  { value: 'WEEK', label: '周' },
];

const Expense: React.FC = () => {
  const [periodType, setPeriodType] = useState('MONTH');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [plans, setPlans] = useState<ExpensePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (plans.length > 0) {
      fetchRecords();
    }
  }, [selectedPlanId, periodType, selectedDate, plans]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await financeAPI.getExpensePlans();
      setPlans(data);
    } catch (error) {
      console.error('获取开支计划失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let allRecords: ExpenseRecord[] = [];
      
      if (selectedPlanId) {
        // 如果选择了特定计划，只获取该计划的记录
        const data = await financeAPI.getExpenseRecords(selectedPlanId);
        allRecords = data;
      } else {
        // 如果没有选择计划，获取所有计划的记录
        for (const plan of plans) {
          const data = await financeAPI.getExpenseRecords(plan.id);
          allRecords = [...allRecords, ...data];
        }
      }
      
      // 根据日期筛选记录
      const filteredRecords = allRecords.filter(record => {
        const recordDate = dayjs(record.date);
        switch (periodType) {
          case 'YEAR':
            return recordDate.year() === selectedDate.year();
          case 'QUARTER':
            return recordDate.year() === selectedDate.year() && 
                   Math.floor(recordDate.month() / 3) === Math.floor(selectedDate.month() / 3);
          case 'MONTH':
            return recordDate.year() === selectedDate.year() && 
                   recordDate.month() === selectedDate.month();
          case 'WEEK':
            return recordDate.year() === selectedDate.year() && 
                   Math.floor(recordDate.diff(selectedDate.startOf('year'), 'day') / 7) === 
                   Math.floor(selectedDate.diff(selectedDate.startOf('year'), 'day') / 7);
          default:
            return true;
        }
      });
      
      setRecords(filteredRecords);
    } catch (error) {
      console.error('获取开支记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ExpenseRecord> = [
    {
      title: '名称',
      dataIndex: 'plan_id',
      key: 'plan_id',
      render: (planId: number) => {
        const plan = plans.find(p => p.id === planId);
        return plan ? plan.name : '未知计划';
      },
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
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
  ];

  return (
    <div>
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab="开支记录" key="1">
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Select
                value={selectedPlanId}
                onChange={setSelectedPlanId}
                style={{ width: 200 }}
                placeholder="选择开支计划（可选）"
                allowClear
              >
                {plans.map(plan => (
                  <Option key={plan.id} value={plan.id}>{plan.name}</Option>
                ))}
              </Select>
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
            dataSource={records}
            loading={loading}
            pagination={false}
            rowKey="id"
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab="开支计划" key="2">
          <ExpensePlanComponent onRecordCreated={fetchRecords} />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default Expense; 