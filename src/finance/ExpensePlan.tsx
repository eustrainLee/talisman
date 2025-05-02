import React, { useState, useEffect } from 'react';
import { Table, Form, Input, Select, Button, Card, Space, message, Modal, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { financeAPI, ExpensePlan, ExpenseRecord } from '../api/finance';
import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

// 添加周数和季度插件
dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);

const { Option } = Select;

const periodTypes = [
  { value: 'WEEK', label: '周' },
  { value: 'MONTH', label: '月' },
  { value: 'QUARTER', label: '季' },
  { value: 'YEAR', label: '年' },
];

interface ExpensePlanComponentProps {
  onRecordCreated?: () => void;
}

const ExpensePlanComponent: React.FC<ExpensePlanComponentProps> = ({ onRecordCreated }) => {
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [plans, setPlans] = useState<ExpensePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ExpensePlan | null>(null);
  const [existingRecord, setExistingRecord] = useState<ExpenseRecord | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await financeAPI.getExpensePlans();
      setPlans(data);
    } catch (error) {
      message.error('获取开支计划失败');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ExpensePlan> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '额度',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
      render: (value: string) => periodTypes.find(type => type.value === value)?.label,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleCreate(record)}>
            创建
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await financeAPI.createExpensePlan(
        values.name,
        values.amount * 100, // 转换为分
        values.period
      );
      message.success('添加成功');
      form.resetFields();
      fetchPlans();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条开支计划吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await financeAPI.deleteExpensePlan(id);
          message.success('删除成功');
          fetchPlans();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  // 检查指定时间是否已存在记录，并获取最近周期的期末累计值
  const checkExistingRecord = async (planId: number, date: dayjs.Dayjs) => {
    try {
      const records = await financeAPI.getExpenseRecords(planId);
      const period = selectedPlan?.period;
      
      // 检查当前周期是否存在记录
      const existing = records.find(record => {
        const recordDate = dayjs(record.date);
        switch (period) {
          case 'WEEK':
            return recordDate.year() === date.year() && 
                   recordDate.week() === date.week();
          case 'MONTH':
            return recordDate.year() === date.year() && 
                   recordDate.month() === date.month();
          case 'QUARTER':
            return recordDate.year() === date.year() && 
                   Math.floor(recordDate.month() / 3) === Math.floor(date.month() / 3);
          case 'YEAR':
            return recordDate.year() === date.year();
          default:
            return false;
        }
      });
      setExistingRecord(existing || null);

      // 查找最近周期的记录
      const sortedRecords = records.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
      const previousRecord = sortedRecords.find(record => {
        const recordDate = dayjs(record.date);
        return recordDate.isBefore(date);
      });

      // 如果找到最近周期的记录，更新期初累计值
      if (previousRecord) {
        const openingCumulativeBalance = previousRecord.closing_cumulative_balance / 100;
        const openingCumulativeExpense = previousRecord.closing_cumulative_expense / 100;
        const budgetAmount = createForm.getFieldValue('budget_amount') || 0;
        const actualAmount = createForm.getFieldValue('actual_amount') || 0;
        const balance = budgetAmount - actualAmount;

        createForm.setFieldsValue({
          opening_cumulative_balance: openingCumulativeBalance,
          opening_cumulative_expense: openingCumulativeExpense,
          closing_cumulative_balance: openingCumulativeBalance + balance,
          closing_cumulative_expense: openingCumulativeExpense + actualAmount,
        });
      } else {
        // 如果没有找到，重置为0
        const budgetAmount = createForm.getFieldValue('budget_amount') || 0;
        const actualAmount = createForm.getFieldValue('actual_amount') || 0;
        const balance = budgetAmount - actualAmount;

        createForm.setFieldsValue({
          opening_cumulative_balance: 0,
          opening_cumulative_expense: 0,
          closing_cumulative_balance: balance,
          closing_cumulative_expense: actualAmount,
        });
      }

      return !!existing;
    } catch (error) {
      console.error('检查记录失败:', error);
      return false;
    }
  };

  // 设置周期起始时间
  const setPeriodStartDate = (date: dayjs.Dayjs) => {
    if (!selectedPlan) return date;
    
    switch (selectedPlan.period) {
      case 'WEEK':
        return date.startOf('week');
      case 'MONTH':
        return date.startOf('month');
      case 'QUARTER':
        return date.startOf('quarter');
      case 'YEAR':
        return date.startOf('year');
      default:
        return date;
    }
  };

  const handleCreate = (plan: ExpensePlan) => {
    setSelectedPlan(plan);
    const today = dayjs();
    const startDate = setPeriodStartDate(today);
    
    createForm.setFieldsValue({
      date: startDate,
      budget_amount: plan.amount / 100,
      actual_amount: 0,
      balance: plan.amount / 100,
      opening_cumulative_balance: 0,
      closing_cumulative_balance: plan.amount / 100,
      opening_cumulative_expense: 0,
      closing_cumulative_expense: 0,
    });
    setIsCreateModalVisible(true);
  };

  // 添加 useEffect 来监听弹窗状态
  useEffect(() => {
    if (isCreateModalVisible && selectedPlan) {
      const date = createForm.getFieldValue('date');
      if (date) {
        checkExistingRecord(selectedPlan.id, date);
      }
    }
  }, [isCreateModalVisible, selectedPlan]);

  const handleDateChange = async (date: dayjs.Dayjs | null) => {
    if (!date || !selectedPlan) return;
    
    const startDate = setPeriodStartDate(date);
    createForm.setFieldsValue({ date: startDate });
    
    // 在日期变化时检查是否存在记录并更新期初累计值
    const hasExisting = await checkExistingRecord(selectedPlan.id, startDate);
    if (hasExisting) {
      message.error('该周期已存在记录');
    }
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      if (!selectedPlan) return;

      // 提交前再次检查是否已存在记录
      const hasExisting = await checkExistingRecord(selectedPlan.id, values.date);
      if (hasExisting) {
        message.error('该周期已存在记录');
        return;
      }

      await financeAPI.createExpenseRecord(
        selectedPlan.id,
        values.date.format('YYYY-MM-DD'),
        values.budget_amount * 100,
        values.actual_amount * 100,
        values.balance * 100,
        values.opening_cumulative_balance * 100,
        values.closing_cumulative_balance * 100,
        values.opening_cumulative_expense * 100,
        values.closing_cumulative_expense * 100,
      );
      message.success('创建成功');
      setIsCreateModalVisible(false);
      onRecordCreated?.();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleCreateFormValuesChange = (changedValues: any, allValues: any) => {
    // 使用预算额度输入框的值（元）
    const budgetAmount = Number(allValues.budget_amount || 0);
    
    if (budgetAmount > 0) {
      if ('actual_amount' in changedValues) {
        // 如果实际开销被修改，重新计算结余
        const actualAmount = Number(changedValues.actual_amount);
        const balance = budgetAmount - actualAmount;
        createForm.setFieldsValue({ balance });
        // 更新期末累计结余
        const openingCumulativeBalance = Number(allValues.opening_cumulative_balance || 0);
        const closingCumulativeBalance = openingCumulativeBalance + balance;
        createForm.setFieldsValue({ closing_cumulative_balance: closingCumulativeBalance });
      } else if ('balance' in changedValues) {
        // 如果结余被修改，重新计算实际开销
        const balance = Number(changedValues.balance);
        const actualAmount = budgetAmount - balance;
        createForm.setFieldsValue({ actual_amount: actualAmount });
        // 更新期末累计结余
        const openingCumulativeBalance = Number(allValues.opening_cumulative_balance || 0);
        const closingCumulativeBalance = openingCumulativeBalance + balance;
        createForm.setFieldsValue({ closing_cumulative_balance: closingCumulativeBalance });
      }
    }

    // 计算累计值
    if ('opening_cumulative_balance' in changedValues || 'balance' in changedValues) {
      const openingCumulativeBalance = Number(allValues.opening_cumulative_balance || 0);
      const balance = Number(allValues.balance || 0);
      const closingCumulativeBalance = openingCumulativeBalance + balance;
      createForm.setFieldsValue({ closing_cumulative_balance: closingCumulativeBalance });
    }

    if ('opening_cumulative_expense' in changedValues || 'actual_amount' in changedValues) {
      const openingCumulativeExpense = Number(allValues.opening_cumulative_expense || 0);
      const actualAmount = Number(allValues.actual_amount || 0);
      const closingCumulativeExpense = openingCumulativeExpense + actualAmount;
      createForm.setFieldsValue({ closing_cumulative_expense: closingCumulativeExpense });
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="额度"
            rules={[{ required: true, message: '请输入额度' }]}
          >
            <Input type="number" placeholder="请输入额度" />
          </Form.Item>
          <Form.Item
            name="period"
            label="周期"
            rules={[{ required: true, message: '请选择周期' }]}
          >
            <Select style={{ width: 120 }}>
              {periodTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAdd}>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Table<ExpensePlan>
        columns={columns}
        dataSource={plans}
        loading={loading}
        pagination={false}
        rowKey="id"
      />

      <Modal
        title="创建开支记录"
        open={isCreateModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setIsCreateModalVisible(false)}
        width={600}
        okButtonProps={{ disabled: !!existingRecord }}
      >
        <Form
          form={createForm}
          layout="vertical"
          onValuesChange={handleCreateFormValuesChange}
        >
          <Form.Item
            name="date"
            label="时间"
            rules={[{ required: true, message: '请选择时间' }]}
            extra={existingRecord && (
              <span style={{ color: 'red' }}>
                该周期已存在记录，创建日期为 {dayjs(existingRecord.date).format('YYYY-MM-DD')}
              </span>
            )}
          >
            <DatePicker
              picker={selectedPlan?.period.toLowerCase() as any}
              style={{ width: '100%' }}
              onChange={handleDateChange}
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
    </div>
  );
};

export default ExpensePlanComponent;