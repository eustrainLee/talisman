import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Card, Tabs, Button, Modal, message, Form, Input, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import IncomePlanComponent from './IncomePlan';
import { IncomeRecord, IncomePlan } from '../../electron/server/finance/def';
import { formatDate, getPeriodStartDate } from '../../electron/server/finance/helper';
import { financeAPI } from '../api/finance';

const { Option } = Select;

const periodTypes = [
  { value: 'YEAR', label: '年' },
  { value: 'QUARTER', label: '季' },
  { value: 'MONTH', label: '月' },
  { value: 'WEEK', label: '周' },
];

const Income: React.FC = () => {
  const [periodType, setPeriodType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [plans, setPlans] = useState<IncomePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<IncomeRecord | null>(null);
  const [editForm] = Form.useForm();

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
      // 获取所有非子记录和子记录
      const nonSubRecords = filteredRecords.filter(record => !record.is_sub_record);
      const subRecords = filteredRecords.filter(record => record.is_sub_record);
      // 对记录按照时间递减的关系排序
      nonSubRecords.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      subRecords.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      // 生成一个新的列表，所有子记录都位于其基于 ID 对应的非子记录的后面
      const sortedRecords = [];
      for (const nonSubRecord of nonSubRecords) {
        sortedRecords.push(nonSubRecord);
        const matchedSubRecords = subRecords
          .filter(record => record.parent_record_id === nonSubRecord.id)
          .filter(record => {
            const parentRecord = filteredRecords.find(r => r.id === record.parent_record_id);
            if (!parentRecord) return false;
            const parentPlan = plans.find(p => p.id === parentRecord.plan_id);
            if (!parentPlan) return false;
            const startDate = getPeriodStartDate(dayjs(record.date), parentPlan.period);
            const parentStartDate = getPeriodStartDate(dayjs(parentRecord.date), parentPlan.period);
            return startDate.isSame(parentStartDate, 'day');
          });
        if (matchedSubRecords.length > 0) {
          sortedRecords.push(...matchedSubRecords);
        }
      }
      // 对于子记录，如果父记录没有被筛选得到，那么这条子记录也应该展示出来
      for (const record of subRecords) {
        if (!sortedRecords.find(r => r.id === record.id)) {
          sortedRecords.push(record);
        }
      }
      setRecords(sortedRecords);
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
      render: (_: dayjs.Dayjs, record: IncomeRecord) => {
        const plan = plans.find(p => p.id === record.plan_id);
        return plan ? formatDate(dayjs(record.date), plan.period) : dayjs(record.date).format('YYYY-MM-DD');
      },
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
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleDelete = async (recordId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条收入记录吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await financeAPI.deleteIncomeRecord(recordId);
          message.success('删除成功');
          fetchRecords();
        } catch (error) {
          console.error('删除收入记录失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const handleEdit = (record: IncomeRecord) => {
    setSelectedRecord(record);
    const plan = plans.find(p => p.id === record.plan_id);
    if (plan) {
      editForm.setFieldsValue({
        date: dayjs(record.date),
        amount: record.amount / 100,
        opening_cumulative: record.opening_cumulative / 100,
        closing_cumulative: record.closing_cumulative / 100,
      });
    }
    setIsEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!selectedRecord) return;

      await financeAPI.updateIncomeRecord({
        id: selectedRecord.id,
        date: values.date.format('YYYY-MM-DD'),
        amount: values.amount * 100,
        opening_cumulative: values.opening_cumulative * 100,
        closing_cumulative: values.closing_cumulative * 100,
      });

      message.success('更新成功');
      setIsEditModalVisible(false);
      fetchRecords();
    } catch (error) {
      console.error('更新收入记录失败:', error);
      message.error('更新失败');
    }
  };

  const handleEditFormValuesChange = (_: any, allValues: any) => {
    // 计算期末累计值
    const amount = Number(allValues.amount || 0);
    const openingCumulative = Number(allValues.opening_cumulative || 0);
    const closingCumulative = openingCumulative + amount;
    editForm.setFieldsValue({ closing_cumulative: closingCumulative });
  };

  const items = [
    {
      key: '1',
      label: '收入记录',
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Select
                value={periodType}
                onChange={setPeriodType}
                style={{ width: 120 }}
                placeholder="选择周期（可选）"
                allowClear
              >
                {periodTypes.map(type => (
                  <Option key={type.value} value={type.value}>{type.label}</Option>
                ))}
              </Select>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                picker={periodType?.toLowerCase() as any}
                style={{ width: 200 }}
                disabled={!periodType}
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
        </>
      ),
    },
    {
      key: '2',
      label: '收入计划',
      children: <IncomePlanComponent onRecordCreated={fetchRecords} />,
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="1" items={items} />

      <Modal
        title="编辑收入记录"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setIsEditModalVisible(false);
          editForm.resetFields();
        }}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onValuesChange={handleEditFormValuesChange}
        >
          <Form.Item
            name="date"
            label="时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <DatePicker
              picker={selectedRecord ? plans.find(p => p.id === selectedRecord.plan_id)?.period.toLowerCase() as any : 'month'}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="收入金额"
            rules={[{ required: true, message: '请输入收入金额' }]}
          >
            <Input type="number" />
          </Form.Item>
          <Form.Item
            name="opening_cumulative"
            label="期初累计"
            rules={[{ required: true, message: '请输入期初累计' }]}
          >
            <Input type="number" />
          </Form.Item>
          <Form.Item
            name="closing_cumulative"
            label="期末累计"
            rules={[{ required: true, message: '请输入期末累计' }]}
          >
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Income; 