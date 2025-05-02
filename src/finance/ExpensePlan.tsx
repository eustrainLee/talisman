import React, { useState, useEffect } from 'react';
import { Table, Form, Input, Select, Button, Card, Space, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { financeAPI, ExpensePlan, PeriodType } from '../api/finance';

const { Option } = Select;

const periodTypes = [
  { value: 'WEEK', label: '周' },
  { value: 'MONTH', label: '月' },
  { value: 'QUARTER', label: '季' },
  { value: 'YEAR', label: '年' },
];

const ExpensePlanComponent: React.FC = () => {
  const [form] = Form.useForm();
  const [plans, setPlans] = useState<ExpensePlan[]>([]);
  const [loading, setLoading] = useState(false);

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
    try {
      await financeAPI.deleteExpensePlan(id);
      message.success('删除成功');
      fetchPlans();
    } catch (error) {
      message.error('删除失败');
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
    </div>
  );
};

export default ExpensePlanComponent; 