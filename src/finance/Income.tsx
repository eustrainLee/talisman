import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Card, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import IncomePlan from './IncomePlan';
import { financeAPI, IncomeRecord, IncomePlan as IncomePlanType } from '../api/finance';

const { Option } = Select;

const periodTypes = [
  { value: 'YEAR', label: '年' },
  { value: 'QUARTER', label: '季' },
  { value: 'MONTH', label: '月' },
  { value: 'WEEK', label: '周' },
];

const Income: React.FC = () => {
  const [periodType, setPeriodType] = useState('MONTH');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [plans, setPlans] = useState<IncomePlanType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (plans.length > 0) {
      fetchRecords();
    }
  }, [selectedDate, periodType, plans]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await financeAPI.getIncomePlans();
      setPlans(data);
    } catch (error) {
      console.error('获取收入计划失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let allRecords: IncomeRecord[] = [];
      
      // 获取所有计划的记录
      for (const plan of plans) {
        const data = await financeAPI.getIncomeRecords(plan.id);
        allRecords = [...allRecords, ...data];
      }
      
      // 根据日期和周期筛选记录
      const filteredRecords = allRecords.filter(record => {
        const recordDate = dayjs(record.date);
        
        // 如果选择了周期类型，只显示匹配周期的记录
        const plan = plans.find(p => p.id === record.plan_id);
        if (periodType && plan?.period !== periodType) {
          return false;
        }
        
        // 如果选择了日期，进行日期筛选
        if (selectedDate) {
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
                     recordDate.week() === selectedDate.week();
            default:
              return true;
          }
        }
        
        return true;
      });

      // 对记录进行排序
      filteredRecords.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      setRecords(filteredRecords);
    } catch (error) {
      console.error('获取收入记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<IncomeRecord> = [
    {
      title: '名称',
      dataIndex: 'plan_id',
      key: 'plan_id',
      render: (planId: number) => {
        const plan = plans.find(p => p.id === planId);
        return plan ? (plan.parent_id ? `- ${plan.name}` : plan.name) : '未知';
      },
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
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
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab="收入记录" key="1">
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
            dataSource={records}
            loading={loading}
            pagination={false}
            size="small"
            style={{ fontSize: '12px' }}
            rowKey="id"
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab="收入计划" key="2">
          <IncomePlan onRecordCreated={fetchRecords} />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default Income; 