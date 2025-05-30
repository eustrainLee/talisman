import React, { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Card, Tabs, Button, Space, Modal, Form, Input, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import ExpensePlanComponent from './ExpensePlan';
import { ExpenseRecord, ExpensePlan } from '../../electron/server/finance/def';
import { financeAPI } from '../api/finance';
import { getPeriodStartDate, formatDate } from '../../electron/server/finance/helper';

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
  const [existingRecord, setExistingRecord] = useState<ExpenseRecord | null>(null);
  const [isFormDisabled, setIsFormDisabled] = useState(false);

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
        // 如果选择了特定计划，只获取该计划的记录。
        // 如果这是一个父计划，另外获取其子计划的记录。
        const data = await financeAPI.getExpenseRecordsWithPlanID(selectedPlanId);
        allRecords = data;
        
        const plans = await financeAPI.getExpensePlans();
        const plan = plans.find(p => p.id === selectedPlanId);
        if (plan) {
          const childrenPlans = plans.filter(p => p.parent_id === plan.id);
          for (const childPlan of childrenPlans) {
            const childData = await financeAPI.getExpenseRecordsWithPlanID(childPlan.id);
            allRecords = [...allRecords, ...childData];
          }
        }
      } else {
        // 如果没有选择计划，获取所有计划的记录
        for (const plan of plans) {
          const data = await financeAPI.getExpenseRecordsWithPlanID(plan.id);
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
      console.error('获取开支记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 检查指定时间是否已存在记录
  const checkExistingRecord = async (recordId: number, planId: number, date: dayjs.Dayjs) => {
    try {
      const records = await financeAPI.getExpenseRecordsWithPlanID(planId);
      const plan = plans.find(p => p.id === planId);
      if (!plan) return false;
      
      // 检查当前周期是否存在其他记录
      const existing = records.find(record => {
        if (record.id === recordId) return false; // 排除当前正在编辑的记录
        const recordDate = dayjs(record.date);
        switch (plan.period) {
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
      setIsFormDisabled(!!existing);
      return !!existing;
    } catch (error) {
      console.error('检查记录失败:', error);
      return false;
    }
  };

  const handleEdit = (record: ExpenseRecord) => {
    setSelectedRecord(record);
    const plan = plans.find(p => p.id === record.plan_id);
    if (!plan) return;

    const recordDate = dayjs(record.date);
    const startDate = getPeriodStartDate(recordDate, plan.period);

    editForm.setFieldsValue({
      date: startDate,
      budget_amount: plan.amount / 100,
      actual_amount: record.actual_amount / 100,
      balance: record.balance / 100,
      opening_cumulative_balance: record.opening_cumulative_balance / 100,
      closing_cumulative_balance: record.closing_cumulative_balance / 100,
      opening_cumulative_expense: record.opening_cumulative_expense / 100,
      closing_cumulative_expense: record.closing_cumulative_expense / 100,
    });
    setIsEditModalVisible(true);
    setIsFormDisabled(false);
    checkExistingRecord(record.id, record.plan_id, startDate);
  };

  const handleDateChange = async (date: dayjs.Dayjs | null) => {
    if (!date || !selectedRecord) return;
    const plan = plans.find(p => p.id === selectedRecord.plan_id);
    if (!plan) return;
    const startDate = getPeriodStartDate(date, plan.period);
    editForm.setFieldsValue({ date: startDate });
    
    // 在日期变化时检查是否存在记录
    const hasExisting = await checkExistingRecord(selectedRecord.id, selectedRecord.plan_id, startDate);
    if (hasExisting) {
      message.error('该周期已存在记录');
    }
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

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (selectedRecord) {
        const plan = plans.find(p => p.id === selectedRecord.plan_id);
        if (!plan) return;

        // 如果是子记录，需要更新父记录
        if (selectedRecord.is_sub_record) {
          // 找到父记录对应的计划
          const parentPlan = plans.find(p => p.id === selectedRecord.plan_id)?.parent_id;
          if (!parentPlan) {
            message.error('找不到父计划');
            return;
          }

          // 获取父计划的所有记录
          const parentRecords = await financeAPI.getExpenseRecordsWithPlanID(parentPlan);
          
          // 找到与子记录时间匹配的父记录
          const parentRecord = parentRecords.find(r => {
            const recordDate = dayjs(selectedRecord.date);
            const parentDate = dayjs(r.date);
            const plan = plans.find(p => p.id === parentPlan);
            
            if (!plan) return false;
            
            switch (plan.period) {
              case 'YEAR':
                return parentDate.year() === recordDate.year();
              case 'QUARTER':
                return parentDate.year() === recordDate.year() && 
                       Math.floor(parentDate.month() / 3) === Math.floor(recordDate.month() / 3);
              case 'MONTH':
                return parentDate.year() === recordDate.year() && 
                       parentDate.month() === recordDate.month();
              case 'WEEK':
                return parentDate.year() === recordDate.year() && 
                       parentDate.week() === recordDate.week();
              default:
                return false;
            }
          });

          if (!parentRecord) {
            message.error('找不到父记录');
            return;
          }

          // 更新子记录
          await financeAPI.updateExpenseRecord(selectedRecord.id, {
            ...values,
            date: values.date.format('YYYY-MM-DD'),
            budget_amount: values.budget_amount * 100,
            actual_amount: values.actual_amount * 100,
            balance: values.balance * 100,
            opening_cumulative_balance: values.opening_cumulative_balance * 100,
            closing_cumulative_balance: values.closing_cumulative_balance * 100,
            opening_cumulative_expense: values.opening_cumulative_expense * 100,
            closing_cumulative_expense: values.closing_cumulative_expense * 100,
          });
          
          // TODO: 移到后端
          // // 更新父记录
          // const updatedParentRecord = await reconcileExpenseRecord(parentRecord, plans);
          // await financeAPI.updateExpenseRecord(parentRecord.id, updatedParentRecord);

        } else {
          await financeAPI.updateExpenseRecord(selectedRecord.id, {
            ...values,
            date: values.date.format('YYYY-MM-DD'),
            budget_amount: values.budget_amount * 100,
            actual_amount: values.actual_amount * 100,
            balance: values.balance * 100,
            opening_cumulative_balance: values.opening_cumulative_balance * 100,
            closing_cumulative_balance: values.closing_cumulative_balance * 100,
            opening_cumulative_expense: values.opening_cumulative_expense * 100,
            closing_cumulative_expense: values.closing_cumulative_expense * 100,
          });
        }
        message.success('更新成功');
        setIsEditModalVisible(false);
        fetchRecords();
      }
    } catch (error) {
      message.error('更新失败');
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
          // 如果是子记录，需要更新父记录
          if (record.is_sub_record) {
            // 找到父记录对应的计划
            const parentPlan = plans.find(p => p.id === record.plan_id)?.parent_id;
            if (!parentPlan) {
              message.error('找不到父计划');
              return;
            }

            // 获取父计划的所有记录
            const parentRecords = await financeAPI.getExpenseRecordsWithPlanID(parentPlan);
            
            // 找到与子记录时间匹配的父记录
            const parentRecord = parentRecords.find(r => {
              const recordDate = dayjs(record.date);
              const parentDate = dayjs(r.date);
              const plan = plans.find(p => p.id === parentPlan);
              
              if (!plan) return false;
              
              switch (plan.period) {
                case 'YEAR':
                  return parentDate.year() === recordDate.year();
                case 'QUARTER':
                  return parentDate.year() === recordDate.year() && 
                         Math.floor(parentDate.month() / 3) === Math.floor(recordDate.month() / 3);
                case 'MONTH':
                  return parentDate.year() === recordDate.year() && 
                         parentDate.month() === recordDate.month();
                case 'WEEK':
                  return parentDate.year() === recordDate.year() && 
                         parentDate.week() === recordDate.week();
                default:
                  return false;
              }
            });

            if (!parentRecord) {
              message.error('找不到父记录');
              return;
            }

            // 删除子记录
            await financeAPI.deleteExpenseRecord(record.id);
            
            // TODO: 移到后端
            // // 更新父记录
            // const updatedParentRecord = await reconcileExpenseRecord(parentRecord, plans);
            // await financeAPI.updateExpenseRecord(parentRecord.id, updatedParentRecord);
          } else {
            await financeAPI.deleteExpenseRecord(record.id);
          }
          message.success('删除成功');
          fetchRecords();
        } catch (error) {
          console.error('删除失败:', error);
          message.error(error instanceof Error ? error.message : '删除失败');
        }
      },
    });
  };

  // 根据周期筛选可用的开支计划
  const filteredPlans = periodType
    ? plans.filter(plan => plan.period === periodType)
    : plans;

  // 当周期改变时，检查并可能取消选中的开支计划
  const handlePeriodTypeChange = (value: string | null) => {
    setPeriodType(value);
    setSelectedDate(null);
    
    // 只有在选择了周期且当前选中的开支计划不匹配该周期时，才取消选中
    if (value && selectedPlanId) {
      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      if (selectedPlan && selectedPlan.period !== value) {
        setSelectedPlanId(null);
      }
    }
  };

  const columns: ColumnsType<ExpenseRecord> = [
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
      render: (_: dayjs.Dayjs, record: ExpenseRecord) => {
        const plan = plans.find(p => p.id === record.plan_id);
        return plan ? formatDate(dayjs(record.date), plan.period) : dayjs(record.date).format('YYYY-MM-DD');
      },
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

  const items = [
    {
      key: '1',
      label: '开支记录',
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <Select
                value={periodType}
                onChange={handlePeriodTypeChange}
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
              <Select
                value={selectedPlanId}
                onChange={setSelectedPlanId}
                style={{ width: 200 }}
                placeholder="选择开支计划（可选）"
                allowClear
              >
                {filteredPlans.filter(plan => !plan.parent_id).map(plan => (
                  <Option key={plan.id} value={plan.id}>{plan.name}</Option>
                ))}
              </Select>
            </div>
          </Card>

          <Table<ExpenseRecord>
            columns={columns}
            dataSource={records}
            loading={loading}
            pagination={false}
            rowKey="id"
            size="small"
            style={{ fontSize: '12px' }}
          />
        </>
      ),
    },
    {
      key: '2',
      label: '开支计划',
      children: <ExpensePlanComponent onRecordCreated={fetchRecords} />,
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="1" items={items} />

      <Modal
        title="编辑开支记录"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setIsEditModalVisible(false)}
        width={600}
        okButtonProps={{ disabled: !!existingRecord }}
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
            extra={existingRecord && (
              <span style={{ color: 'red' }}>
                该周期已存在记录
              </span>
            )}
          >
            <DatePicker
              picker={selectedRecord ? plans.find(p => p.id === selectedRecord.plan_id)?.period.toLowerCase() as any : undefined}
              style={{ width: '100%' }}
              onChange={handleDateChange}
            />
          </Form.Item>
          <Form.Item
            name="budget_amount"
            label="预算额度"
            rules={[{ required: true, message: '请输入预算额度' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="actual_amount"
            label="实际开销"
            rules={[{ required: true, message: '请输入实际开销' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="balance"
            label="结余"
            rules={[{ required: true, message: '请输入结余' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="opening_cumulative_balance"
            label="期初累计结余"
            rules={[{ required: true, message: '请输入期初累计结余' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="closing_cumulative_balance"
            label="期末累计结余"
            rules={[{ required: true, message: '请输入期末累计结余' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="opening_cumulative_expense"
            label="期初累计开支"
            rules={[{ required: true, message: '请输入期初累计开支' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="closing_cumulative_expense"
            label="期末累计开支"
            rules={[{ required: true, message: '请输入期末累计开支' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Expense; 