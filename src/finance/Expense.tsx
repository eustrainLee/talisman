import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Card, Tabs, Button, Space, Modal, Form, Input, message } from 'antd';
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
  const [periodType, setPeriodType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [plans, setPlans] = useState<ExpensePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExpenseRecord | null>(null);
  const [editForm] = Form.useForm();

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
      
      // 根据日期和周期筛选记录
      const filteredRecords = allRecords.filter(record => {
        const recordDate = dayjs(record.date);
        const plan = plans.find(p => p.id === record.plan_id);
        
        // 如果选择了周期类型，只显示匹配周期的记录
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
                     Math.floor(recordDate.diff(selectedDate.startOf('year'), 'day') / 7) === 
                     Math.floor(selectedDate.diff(selectedDate.startOf('year'), 'day') / 7);
            default:
              return true;
          }
        }
        
        return true;
      }).sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      
      setRecords(filteredRecords);
    } catch (error) {
      console.error('获取开支记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: ExpenseRecord) => {
    setSelectedRecord(record);
    const plan = plans.find(p => p.id === record.plan_id);
    if (!plan) return;

    editForm.setFieldsValue({
      date: dayjs(record.date),
      budget_amount: plan.amount / 100, // 转换为元
      actual_amount: record.actual_amount / 100, // 转换为元
      balance: record.balance / 100, // 转换为元
      opening_cumulative_balance: record.opening_cumulative_balance / 100, // 转换为元
      closing_cumulative_balance: record.closing_cumulative_balance / 100, // 转换为元
      opening_cumulative_expense: record.opening_cumulative_expense / 100, // 转换为元
      closing_cumulative_expense: record.closing_cumulative_expense / 100, // 转换为元
    });
    setIsEditModalVisible(true);
  };

  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    // 使用预算额度输入框的值（元）
    const budgetAmount = Number(allValues.budget_amount || 0);
    
    if (budgetAmount > 0) {
      if ('actual_amount' in changedValues) {
        // 如果实际开销被修改，重新计算结余
        const actualAmount = Number(changedValues.actual_amount);
        const balance = budgetAmount - actualAmount;
        editForm.setFieldsValue({ balance });
        // 更新期末累计结余
        const openingCumulativeBalance = Number(allValues.opening_cumulative_balance || 0);
        const closingCumulativeBalance = openingCumulativeBalance + balance;
        editForm.setFieldsValue({ closing_cumulative_balance: closingCumulativeBalance });
      } else if ('balance' in changedValues) {
        // 如果结余被修改，重新计算实际开销
        const balance = Number(changedValues.balance);
        const actualAmount = budgetAmount - balance;
        editForm.setFieldsValue({ actual_amount: actualAmount });
        // 更新期末累计结余
        const openingCumulativeBalance = Number(allValues.opening_cumulative_balance || 0);
        const closingCumulativeBalance = openingCumulativeBalance + balance;
        editForm.setFieldsValue({ closing_cumulative_balance: closingCumulativeBalance });
      }
    }

    // 计算累计值
    if ('opening_cumulative_balance' in changedValues || 'balance' in changedValues) {
      const openingCumulativeBalance = Number(allValues.opening_cumulative_balance || 0);
      const balance = Number(allValues.balance || 0);
      const closingCumulativeBalance = openingCumulativeBalance + balance;
      editForm.setFieldsValue({ closing_cumulative_balance: closingCumulativeBalance });
    }

    if ('opening_cumulative_expense' in changedValues || 'actual_amount' in changedValues) {
      const openingCumulativeExpense = Number(allValues.opening_cumulative_expense || 0);
      const actualAmount = Number(allValues.actual_amount || 0);
      const closingCumulativeExpense = openingCumulativeExpense + actualAmount;
      editForm.setFieldsValue({ closing_cumulative_expense: closingCumulativeExpense });
    }
  };

  const handleDelete = (record: ExpenseRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条开支记录吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await financeAPI.deleteExpenseRecord(record.id);
          message.success('删除成功');
          fetchRecords();
        } catch (error) {
          console.error('删除失败:', error);
          message.error(error instanceof Error ? error.message : '删除失败');
        }
      },
    });
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedRecord) {
        const plan = plans.find(p => p.id === selectedRecord.plan_id);
        if (!plan) return;

        await financeAPI.updateExpenseRecord(selectedRecord.id, {
          ...values,
          date: values.date.format('YYYY-MM-DD'),
          budget_amount: values.budget_amount * 100, // 转换为分
          actual_amount: values.actual_amount * 100, // 转换为分
          balance: values.balance * 100, // 转换为分
          opening_cumulative_balance: values.opening_cumulative_balance * 100, // 转换为分
          closing_cumulative_balance: values.closing_cumulative_balance * 100, // 转换为分
          opening_cumulative_expense: values.opening_cumulative_expense * 100, // 转换为分
          closing_cumulative_expense: values.closing_cumulative_expense * 100, // 转换为分
        });
        message.success('更新成功');
        setIsEditModalVisible(false);
        fetchRecords();
      }
    } catch (error) {
      message.error('更新失败');
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
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
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
                onChange={(value) => {
                  setPeriodType(value);
                  setSelectedDate(null);
                }}
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

          <Table<ExpenseRecord>
            columns={columns}
            dataSource={records}
            loading={loading}
            pagination={false}
            rowKey="id"
          />

          <Modal
            title="编辑开支记录"
            open={isEditModalVisible}
            onOk={handleEditSubmit}
            onCancel={() => setIsEditModalVisible(false)}
            width={600}
          >
            <Form
              form={editForm}
              layout="vertical"
              onValuesChange={handleFormValuesChange}
            >
              <Form.Item
                name="date"
                label="时间"
                rules={[{ required: true, message: '请选择时间' }]}
              >
                <DatePicker
                  picker={periodType?.toLowerCase() as any}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item
                name="budget_amount"
                label="预算额度"
                rules={[{ required: true, message: '请输入预算额度' }]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="actual_amount"
                label="实际开销"
                rules={[{ required: true, message: '请输入实际开销' }]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="balance"
                label="结余"
                rules={[{ required: true, message: '请输入结余' }]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="opening_cumulative_balance"
                label="期初累计结余"
                rules={[{ required: true, message: '请输入期初累计结余' }]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="closing_cumulative_balance"
                label="期末累计结余"
                rules={[{ required: true, message: '请输入期末累计结余' }]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="opening_cumulative_expense"
                label="期初累计开支"
                rules={[{ required: true, message: '请输入期初累计开支' }]}
              >
                <Input type="number" />
              </Form.Item>
              <Form.Item
                name="closing_cumulative_expense"
                label="期末累计开支"
                rules={[{ required: true, message: '请输入期末累计开支' }]}
              >
                <Input type="number" />
              </Form.Item>
            </Form>
          </Modal>
        </Tabs.TabPane>
        <Tabs.TabPane tab="开支计划" key="2">
          <ExpensePlanComponent onRecordCreated={fetchRecords} />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default Expense; 