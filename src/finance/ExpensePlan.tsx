import React, { useState, useEffect } from 'react';
import { Table, Form, Input, Select, Button, Card, Space, message, Modal, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ExpensePlan, ExpenseRecord } from '../../electron/server/finance/def';
import { getPeriodStartDate, calculateExpense } from '../../electron/server/finance/helper';
import { financeAPI, PeriodType } from '../api/finance';
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

// 组件 开支计划
const ExpensePlanComponent: React.FC<ExpensePlanComponentProps> = ({ onRecordCreated }) => {
  const [createPlanForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [createSubPlanForm] = Form.useForm();
  const [plans, setPlans] = useState<ExpensePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreatePlanModalVisible, setIsCreatePlanModalVisible] = useState(false);
  const [isCreateSubPlanModalVisible, setIsCreateSubPlanModalVisible] = useState(false);
  const [isUpdatePlanModalVisible, setIsUpdatePlanModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ExpensePlan | null>(null);
  const [existingRecord, setExistingRecord] = useState<ExpenseRecord | null>(null);
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const [parentRecordError, setParentRecordError] = useState<string | null>(null);
  const [subRecordError, setSubRecordError] = useState<string | null>(null);
  const [updatePlanForm] = Form.useForm();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await financeAPI.getExpensePlans();
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch expense plans:', error);
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
      render: (text: string, record: ExpensePlan) => {
        if (record.parent_id) {
          const parentPlan = plans.find(p => p.id === record.parent_id);
          return parentPlan ? `- ${parentPlan.name}` : text;
        }
        return text;
      },
    },
    {
      title: '周期',
      dataIndex: 'period',
      key: 'period',
    },
    {
      title: '预算额度',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '预算分配',
      dataIndex: 'budget_allocation',
      key: 'budget_allocation',
      render: (value: string) => {
        switch (value) {
          case 'NONE':
            return '不分配';
          case 'AVERAGE':
            return '平均分配';
          default:
            return value;
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, plan) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleCreate(plan)}>
            创建记录
          </Button>
          {!plan.parent_id && (
            <Button type="link"
            onClick={() => handleCreateSubPlan(plan)}
            disabled={plans.some(p => p.parent_id === plan.id)}
            >
              创建子计划
            </Button>
          )}
          <Button type="link" onClick={() => handleUpdate(plan)}>
            编辑
          </Button>
          <Button type="link" danger onClick={() => handleDelete(plan.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

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
          console.error('Failed to delete expense plan:', error);
          message.error('删除失败');
        }
      }
    });
  };

  // 检查指定时间是否已存在记录，并获取最近周期的期末累计值
  const checkExistingRecord = async (planId: number, date: dayjs.Dayjs) => {
    try {
      const records = await financeAPI.getExpenseRecordsWithPlanID(planId);
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
      setIsFormDisabled(!!existing);

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
      console.error('Failed to check existing record:', error);
      return false;
    }
  };

  // 创建开支记录
  const handleCreate = (plan: ExpensePlan) => {
    setSelectedPlan(plan);

    // 设置时间字段为这个周期的开始时间
    const today = dayjs();
    const startDate = getPeriodStartDate(today, plan.period);
    // 设置期初累计值
    const openingCumulativeBalance = plan.amount / 100;
    const openingCumulativeExpense = 0;

    const expenseValue = calculateExpense(false, plan.budget_allocation, plan.amount / 100, 0, openingCumulativeBalance, openingCumulativeExpense);

    // 重置错误状态
    setParentRecordError(null);
    setSubRecordError(null);
    
    createForm.setFieldsValue({
      date: startDate,
      budget_amount: plan.amount / 100,
      actual_amount: 0,
      balance: expenseValue.balance,
      opening_cumulative_balance: openingCumulativeBalance,
      closing_cumulative_balance: expenseValue.closing_cumulative_balance,
      opening_cumulative_expense: openingCumulativeExpense,
      closing_cumulative_expense: expenseValue.closing_cumulative_expense,
    });
    setIsCreateModalVisible(true);
    setIsFormDisabled(false);
  };

  // 添加 useEffect 来监听弹窗状态
  useEffect(() => {
    if (isCreateModalVisible && selectedPlan) {
      const date = createForm.getFieldValue('date');
      if (date) {
        checkExistingRecord(selectedPlan.id, date);
        
        // 如果是子计划，检查父计划是否有对应时间段的记录
        if (selectedPlan.parent_id) {
          const parentPlan = plans.find(p => p.id === selectedPlan.parent_id);
          if (!parentPlan) {
            // 如果找不到父计划，尝试从API获取
            financeAPI.getExpensePlans()
              .then(allPlans => {
                const parentPlanData = allPlans.find(p => p.id === selectedPlan.parent_id);
                if (parentPlanData) {
                  setParentRecordError(`找不到计划 <strong>${parentPlanData.name}</strong>`);
                } else {
                  setParentRecordError(`找不到计划 <strong>${selectedPlan.parent_id}</strong>`);
                }
              })
              .catch(() => {
                setParentRecordError(`找不到计划 <strong>${selectedPlan.parent_id}</strong>`);
              });
            return;
          }

          // 获取父计划的记录
          financeAPI.getExpenseRecordsWithPlanID(parentPlan.id).then(parentRecords => {
            let parentRecord = null;

            // 根据父计划的周期类型查找对应的父记录
            switch (parentPlan.period) {
              case 'YEAR':
                parentRecord = parentRecords.find(r => dayjs(r.date).year() === dayjs(date).year());
                break;
              case 'QUARTER':
                parentRecord = parentRecords.find(r => 
                  dayjs(r.date).year() === dayjs(date).year() && 
                  Math.floor(dayjs(r.date).month() / 3) === Math.floor(dayjs(date).month() / 3)
                );
                break;
              case 'MONTH':
                parentRecord = parentRecords.find(r => 
                  dayjs(r.date).year() === dayjs(date).year() && 
                  dayjs(r.date).month() === dayjs(date).month()
                );
                break;
              case 'WEEK':
                parentRecord = parentRecords.find(r => 
                  dayjs(r.date).year() === dayjs(date).year() && 
                  dayjs(r.date).week() === dayjs(date).week()
                );
                break;
            }

            if (!parentRecord) {
              setParentRecordError(`计划 <strong>${parentPlan.name}</strong> 在该时间段没有记录，请先创建记录`);
              return;
            }

            // 检查是否有时间冲突的子记录
            financeAPI.getExpenseRecordsWithPlanID(selectedPlan.id).then(subRecords => {
              const hasOverlappingRecord = subRecords.some(r => r.date === dayjs(date).format('YYYY-MM-DD'));
              if (hasOverlappingRecord) {
                setSubRecordError('该时间已存在子记录');
                return;
              }

              // 获取当前日期之前的所有子记录，按日期排序
              const previousSubRecords = subRecords
                .filter(r => dayjs(r.date).isBefore(dayjs(date)))
                .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

              // 计算预算额度
              let budgetAmount = 0;
              if (selectedPlan.budget_allocation === 'AVERAGE') {
                const subPeriodCount = getSubPeriodCount(parentPlan.period, selectedPlan.period);
                budgetAmount = parentRecord.budget_amount / subPeriodCount;
              } else {
                budgetAmount = parentRecord.balance;
              }

              // 计算期初累计值
              let openingCumulativeBalance = 0;
              let openingCumulativeExpense = 0;

              if (previousSubRecords.length > 0) {
                // 如果有之前的子记录，使用最后一个子记录的期末累计值
                const lastRecord = previousSubRecords[0];
                openingCumulativeBalance = lastRecord.closing_cumulative_balance;
                openingCumulativeExpense = lastRecord.closing_cumulative_expense;
              } else {
                // 如果没有之前的子记录，使用父记录的期初累计值
                openingCumulativeBalance = parentRecord.opening_cumulative_balance;
                openingCumulativeExpense = parentRecord.opening_cumulative_expense;
              }

              // 更新表单值
              createForm.setFieldsValue({
                budget_amount: budgetAmount / 100,
                opening_cumulative_balance: openingCumulativeBalance / 100,
                opening_cumulative_expense: openingCumulativeExpense / 100,
                balance: budgetAmount / 100,
                closing_cumulative_balance: (openingCumulativeBalance + budgetAmount) / 100,
                closing_cumulative_expense: openingCumulativeExpense / 100,
              });

              // 清除错误信息
              setParentRecordError(null);
              setSubRecordError(null);
            });
          });
        }
      }
    }
  }, [isCreateModalVisible, selectedPlan]);

  const handleDateChange = async (date: dayjs.Dayjs | null) => {
    if (!date || !selectedPlan) return;
    
    const startDate = getPeriodStartDate(date, selectedPlan.period);
    createForm.setFieldsValue({ date: startDate });
    
    // 在日期变化时检查是否存在记录并更新期初累计值
    const hasExisting = await checkExistingRecord(selectedPlan.id, startDate);
    if (hasExisting) {
      message.error('该周期已存在记录');
      return;
    }

    // 如果是子计划，检查父计划是否有对应时间段的记录
    if (selectedPlan.parent_id) {
      const parentPlan = plans.find(p => p.id === selectedPlan.parent_id);
      if (!parentPlan) {
        // 如果找不到父计划，尝试从API获取
        try {
          const allPlans = await financeAPI.getExpensePlans();
          const parentPlanData = allPlans.find(p => p.id === selectedPlan.parent_id);
          if (parentPlanData) {
            setParentRecordError(`找不到计划 <strong>${parentPlanData.name}</strong>`);
          } else {
            setParentRecordError(`找不到计划 <strong>${selectedPlan.parent_id}</strong>`);
          }
        } catch (error) {
          setParentRecordError(`找不到计划 <strong>${selectedPlan.parent_id}</strong>`);
        }
        return;
      }

      // 获取父计划的记录
      const parentRecords = await financeAPI.getExpenseRecordsWithPlanID(parentPlan.id);
      let parentRecord = null;

      // 根据父计划的周期类型查找对应的父记录
      switch (parentPlan.period) {
        case 'YEAR':
          parentRecord = parentRecords.find(r => dayjs(r.date).year() === startDate.year());
          break;
        case 'QUARTER':
          parentRecord = parentRecords.find(r => 
            dayjs(r.date).year() === startDate.year() && 
            Math.floor(dayjs(r.date).month() / 3) === Math.floor(startDate.month() / 3)
          );
          break;
        case 'MONTH':
          parentRecord = parentRecords.find(r => 
            dayjs(r.date).year() === startDate.year() && 
            dayjs(r.date).month() === startDate.month()
          );
          break;
        case 'WEEK':
          parentRecord = parentRecords.find(r => 
            dayjs(r.date).year() === startDate.year() && 
            dayjs(r.date).week() === startDate.week()
          );
          break;
      }

      if (!parentRecord) {
        setParentRecordError(`计划 <strong>${parentPlan.name}</strong> 在该时间段没有记录，请先创建记录`);
        return;
      }

      // 检查是否有时间冲突的子记录
      const subRecords = await financeAPI.getExpenseRecordsWithPlanID(selectedPlan.id);
      const hasOverlappingRecord = subRecords.some(r => r.date === startDate.format('YYYY-MM-DD'));
      if (hasOverlappingRecord) {
        setSubRecordError('该时间已存在子记录');
        return;
      }

      // 获取当前日期之前的所有子记录，按日期排序
      const previousSubRecords = subRecords
        .filter(r => dayjs(r.date).isBefore(startDate))
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

      // 计算预算额度
      let budgetAmount = 0;
      if (selectedPlan.budget_allocation === 'AVERAGE') {
        const subPeriodCount = getSubPeriodCount(parentPlan.period, selectedPlan.period);
        budgetAmount = parentRecord.budget_amount / subPeriodCount;
      } else {
        budgetAmount = parentRecord.balance;
      }

      // 计算期初累计值
      let openingCumulativeBalance = 0;
      let openingCumulativeExpense = 0;

      if (previousSubRecords.length > 0) {
        // 如果有之前的子记录，使用最后一个子记录的期末累计值
        const lastRecord = previousSubRecords[0];
        openingCumulativeBalance = lastRecord.closing_cumulative_balance;
        openingCumulativeExpense = lastRecord.closing_cumulative_expense;
      } else {
        // 如果没有之前的子记录，使用父记录的期初累计值
        openingCumulativeBalance = parentRecord.opening_cumulative_balance;
        openingCumulativeExpense = parentRecord.opening_cumulative_expense;
      }

      // 更新表单值
      createForm.setFieldsValue({
        budget_amount: budgetAmount / 100,
        opening_cumulative_balance: openingCumulativeBalance / 100,
        opening_cumulative_expense: openingCumulativeExpense / 100,
        balance: budgetAmount / 100,
        closing_cumulative_balance: (openingCumulativeBalance + budgetAmount) / 100,
        closing_cumulative_expense: openingCumulativeExpense / 100,
      });

      // 清除错误信息
      setParentRecordError(null);
      setSubRecordError(null);
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

      // 如果是子计划，需要检查父计划是否有对应时间段的记录
      if (selectedPlan.parent_id) {
        const parentPlan = plans.find(p => p.id === selectedPlan.parent_id);
        if (!parentPlan) {
          // 如果找不到父计划，尝试从API获取
          try {
            const allPlans = await financeAPI.getExpensePlans();
            const parentPlanData = allPlans.find(p => p.id === selectedPlan.parent_id);
            if (parentPlanData) {
              message.error(`找不到计划 <strong>${parentPlanData.name}</strong>`);
            } else {
              message.error(`找不到计划 <strong>${selectedPlan.parent_id}</strong>`);
            }
          } catch (error) {
            message.error(`找不到计划 <strong>${selectedPlan.parent_id}</strong>`);
          }
          return;
        }

        // 获取父计划的记录
        const parentRecords = await financeAPI.getExpenseRecordsWithPlanID(parentPlan.id);
        const recordDate = dayjs(values.date);
        let parentRecord = null;

        // 根据父计划的周期类型查找对应的父记录
        switch (parentPlan.period) {
          case 'YEAR':
            parentRecord = parentRecords.find(r => dayjs(r.date).year() === recordDate.year());
            break;
          case 'QUARTER':
            parentRecord = parentRecords.find(r => 
              dayjs(r.date).year() === recordDate.year() && 
              Math.floor(dayjs(r.date).month() / 3) === Math.floor(recordDate.month() / 3)
            );
            break;
          case 'MONTH':
            parentRecord = parentRecords.find(r => 
              dayjs(r.date).year() === recordDate.year() && 
              dayjs(r.date).month() === recordDate.month()
            );
            break;
          case 'WEEK':
            parentRecord = parentRecords.find(r => 
              dayjs(r.date).year() === recordDate.year() && 
              dayjs(r.date).week() === recordDate.week()
            );
            break;
        }

        if (!parentRecord) {
          message.error(`计划 <strong>${parentPlan.name}</strong> 在该时间段没有记录，请先创建记录`);
          return;
        }

        // 检查是否有时间冲突的子记录
        const subRecords = await financeAPI.getExpenseRecordsWithPlanID(selectedPlan.id);
        const hasOverlappingRecord = subRecords.some(r => r.date === values.date.format('YYYY-MM-DD'));
        if (hasOverlappingRecord) {
          message.error('该时间已存在子记录');
          return;
        }

        // 创建子记录
        await financeAPI.createExpenseRecord({
          plan_id: selectedPlan.id,
          date: values.date.format('YYYY-MM-DD'),
          budget_amount: values.budget_amount * 100,
          actual_amount: values.actual_amount * 100,
          balance: values.balance * 100,
          opening_cumulative_balance: values.opening_cumulative_balance * 100,
          closing_cumulative_balance: values.closing_cumulative_balance * 100,
          opening_cumulative_expense: values.opening_cumulative_expense * 100,
          closing_cumulative_expense: values.closing_cumulative_expense * 100,
          is_sub_record: true,
          parent_record_id: parentRecord.id,
        });

        // TODO：移到后端
        // // 更新父记录
        // const updatedParentRecord = await reconcileExpenseRecord(parentRecord, plans);
        // await financeAPI.updateExpenseRecord(parentRecord.id, updatedParentRecord);

      } else {
        const record = await financeAPI.createExpenseRecord({
          plan_id: selectedPlan.id,
          date: values.date.format('YYYY-MM-DD'),
          budget_amount: values.budget_amount * 100,
          actual_amount: values.actual_amount * 100,
          balance: values.balance * 100,
          opening_cumulative_balance: values.opening_cumulative_balance * 100,
          closing_cumulative_balance: values.closing_cumulative_balance * 100,
          opening_cumulative_expense: values.opening_cumulative_expense * 100,
          closing_cumulative_expense: values.closing_cumulative_expense * 100,
          is_sub_record: false,
        });
        // TODO：移到后端
        // // 更新记录
        // const updatedRecord = await reconcileExpenseRecord(record, plans);
        // await financeAPI.updateExpenseRecord(record.id, updatedRecord);
        await financeAPI.updateExpenseRecord(record.id, record);
      }

      message.success('创建成功');
      setIsCreateModalVisible(false);
      
      // 更新 plans 状态
      const updatedPlans = await financeAPI.getExpensePlans();
      setPlans(updatedPlans);
      
      // 调用回调
      onRecordCreated?.();
    } catch (error) {
      console.error('Failed to create expense record:', error);
      message.error('创建失败');
    }
  };

  const handleCreateFormValuesChange = (changedValues: any, allValues: any) => {
    // 使用预算额度输入框的值（元）
    const budgetAmount = Number(allValues.budget_amount);
    const actualAmount = Number(allValues.actual_amount);
    const balance = Number(allValues.balance);
    const openingCumulativeBalance = Number(allValues.opening_cumulative_balance);
    const openingCumulativeExpense = Number(allValues.opening_cumulative_expense);
    if ('actual_amount' in changedValues) {
      // 如果实际开销被修改，重新计算结余
      const balance = budgetAmount - actualAmount;
      createForm.setFieldsValue({ balance });
    } else if ('balance' in changedValues) {
      // 如果结余被修改，重新计算实际开销
      const actualAmount = budgetAmount - balance;
      createForm.setFieldsValue({ actual_amount: actualAmount });
    }

    const expenseValue = calculateExpense(false, selectedPlan?.budget_allocation || 'NONE', budgetAmount, actualAmount, openingCumulativeBalance, openingCumulativeExpense);

    createForm.setFieldsValue({
      balance: expenseValue.balance,
      closing_cumulative_balance: expenseValue.closing_cumulative_balance,
      closing_cumulative_expense: expenseValue.closing_cumulative_expense,
    });
  };

  const handleCreateSubPlan = (plan: ExpensePlan) => {
    setSelectedPlan(plan);
    createSubPlanForm.resetFields();
    setIsCreateSubPlanModalVisible(true);
    
    // 设置默认值
    const defaultPeriod = getAvailablePeriods(plan.period)[0];
    const defaultAmount = plan.amount / 100; // 转换为元
    
    createSubPlanForm.setFieldsValue({
      period: defaultPeriod,
      budget_allocation: 'NONE',
      amount: defaultAmount,
    });
  };

  const handleCreateSubPlanSubmit = async () => {
    try {
      const values = await createSubPlanForm.validateFields();
      await financeAPI.createExpensePlan({
        name: values.name,
        amount: values.amount * 100,
        period: values.period as PeriodType,
        parent_id: selectedPlan!.id,
        sub_period: values.period,
        budget_allocation: values.budget_allocation as 'NONE' | 'AVERAGE',
      });
      message.success('创建成功');
      setIsCreateSubPlanModalVisible(false);
      fetchPlans();
      onRecordCreated?.();
    } catch (error) {
      console.error('Failed to create sub-plan:', error);
      message.error('创建失败');
    }
  };

  const handleBudgetAllocationChange = (value: string) => {
    if (!selectedPlan) return;
    
    const period = createSubPlanForm.getFieldValue('period');
    const amount = value === 'AVERAGE' 
      ? selectedPlan.amount / getSubPeriodCount(selectedPlan.period, period)
      : selectedPlan.amount;
    
    createSubPlanForm.setFieldsValue({
      amount: amount / 100, // 转换为元
    });
  };

  const getSubPeriodCount = (parentPeriod: string, subPeriod: string): number => {
    switch (parentPeriod) {
      case 'YEAR':
        switch (subPeriod) {
          case 'QUARTER': return 4;
          case 'MONTH': return 12;
          case 'WEEK': return 52;
          default: return 1;
        }
      case 'QUARTER':
        switch (subPeriod) {
          case 'MONTH': return 3;
          case 'WEEK': return 13;
          default: return 1;
        }
      case 'MONTH':
        switch (subPeriod) {
          case 'WEEK': return 4;
          default: return 1;
        }
      default:
        return 1;
    }
  };

  const getAvailablePeriods = (parentPeriod: string): string[] => {
    switch (parentPeriod) {
      case 'YEAR':
        return ['QUARTER', 'MONTH', 'WEEK'];
      case 'QUARTER':
        return ['MONTH', 'WEEK'];
      case 'MONTH':
        return ['WEEK'];
      default:
        return [];
    }
  };

  const handleCreatePlanSubmit = async () => {
    try {
      const values = await createPlanForm.validateFields();
      await financeAPI.createExpensePlan({
        name: values.name,
        amount: values.amount * 100,
        period: values.period as PeriodType,
        budget_allocation: 'NONE' as const,
      });
      message.success('创建成功');
      setIsCreatePlanModalVisible(false);
      fetchPlans();
    } catch (error) {
      console.error('Failed to create expense plan:', error);
      message.error('创建失败');
    }
  };

  const handlePeriodChange = () => {
    if (!selectedPlan) return;
    
    // 重置额度
    createForm.setFieldsValue({
      amount: null,
    });
  };

  const handleSubPeriodChange = (value: string | null) => {
    if (!value || !selectedPlan) return;
    
    const budgetAllocation = createSubPlanForm.getFieldValue('budget_allocation');
    const amount = budgetAllocation === 'AVERAGE' 
      ? selectedPlan.amount / getSubPeriodCount(selectedPlan.period, value)
      : selectedPlan.amount;
    
    createSubPlanForm.setFieldsValue({
      amount: amount / 100, // 转换为元
    });
  };

  const handleUpdate = (plan: ExpensePlan) => {
    setSelectedPlan(plan);
    updatePlanForm.setFieldsValue({
      name: plan.name,
      amount: plan.amount / 100,
      period: plan.period,
      budget_allocation: plan.budget_allocation,
    });
    setIsUpdatePlanModalVisible(true);
  };

  // 获取可用的周期选项
  const getAvailablePeriodsForUpdate = (plan: ExpensePlan): PeriodType[] => {
    const allPeriods: PeriodType[] = ['WEEK', 'MONTH', 'QUARTER', 'YEAR'];
    const periodOrder: Record<PeriodType, number> = { 'WEEK': 1, 'MONTH': 2, 'QUARTER': 3, 'YEAR': 4 };
    
    // 如果有子计划，获取子计划的最小周期
    const subPlans = plans.filter(p => p.parent_id === plan.id);
    if (subPlans.length > 0) {
      const minSubPeriod = subPlans.reduce((min, p) => 
        periodOrder[p.period as PeriodType] < periodOrder[min.period as PeriodType] ? p : min
      ).period as PeriodType;
      // 只返回比最小子周期大的周期
      return allPeriods.filter(p => periodOrder[p] > periodOrder[minSubPeriod]);
    }

    // 如果有父计划，获取父计划的周期
    if (plan.parent_id) {
      const parentPlan = plans.find(p => p.id === plan.parent_id);
      if (parentPlan) {
        // 只返回比父周期小的周期
        return allPeriods.filter(p => periodOrder[p] < periodOrder[parentPlan.period as PeriodType]);
      }
    }

    // 如果没有子计划和父计划，返回所有周期
    return allPeriods;
  };

  const handleUpdateSubmit = async () => {
    try {
      const values = await updatePlanForm.validateFields();
      if (!selectedPlan) return;

      // 检查周期是否合法
      const availablePeriods = getAvailablePeriodsForUpdate(selectedPlan);
      if (!availablePeriods.includes(values.period)) {
        message.error('所选周期不符合要求');
        return;
      }

      await financeAPI.updateExpensePlan({
        id: selectedPlan.id,
        name: values.name,
        amount: values.amount * 100,
        period: values.period,
        budget_allocation: values.budget_allocation,
      });
      message.success('更新成功');
      setIsUpdatePlanModalVisible(false);
      fetchPlans();
    } catch (error) {
      console.error('Failed to update expense plan:', error);
      message.error('更新失败');
    }
  };

  // 对数据进行排序，确保子计划紧跟在对应的父计划后面
  const sortedPlans = (() => {
    // 先获取所有父计划并按 ID 排序
    const parentPlans = plans
      .filter(plan => plan.parent_id === null)
      .sort((a, b) => a.id - b.id);
    
    // 获取所有子计划
    const subPlans = plans.filter(plan => plan.parent_id !== null);
    
    // 将子计划插入到对应的父计划后面
    const result: ExpensePlan[] = [];
    parentPlans.forEach(parent => {
      // 添加父计划
      result.push(parent);
      // 找到该父计划的所有子计划并按 ID 排序
      const children = subPlans
        .filter(plan => plan.parent_id === parent.id)
        .sort((a, b) => a.id - b.id);
      // 添加子计划
      result.push(...children);
    });
    
    return result;
  })();

  return (
    <div>
      <Card type='inner'>
        <Button type="primary" onClick={() => setIsCreatePlanModalVisible(true)}>
          创建计划
        </Button>
      </Card>

      <Table<ExpensePlan>
        columns={columns}
        dataSource={sortedPlans}
        loading={loading}
        pagination={false}
        rowKey="id"
        size="small"
        style={{ fontSize: '12px' }}
      />

      <Modal
        title="创建开支记录"
        open={isCreateModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => {
          setIsCreateModalVisible(false);
          // 关闭弹窗时清除错误信息
          setParentRecordError(null);
          setSubRecordError(null);
        }}
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
            extra={
              <div>
                {existingRecord && (
                  <span style={{ color: 'red' }}>
                    该周期已存在记录
                  </span>
                )}
                {parentRecordError && (
                  <span style={{ color: 'red' }} dangerouslySetInnerHTML={{ __html: parentRecordError }} />
                )}
                {subRecordError && (
                  <span style={{ color: 'red' }}>
                    {subRecordError}
                  </span>
                )}
              </div>
            }
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

      <Modal
        title="创建开支计划"
        open={isCreatePlanModalVisible}
        onOk={handleCreatePlanSubmit}
        onCancel={() => setIsCreatePlanModalVisible(false)}
        width={600}
      >
        <Form
          form={createPlanForm}
          layout="vertical"
        >
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
            <Select 
              style={{ width: '100%' }}
              onChange={handlePeriodChange}
            >
              {periodTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建子计划"
        open={isCreateSubPlanModalVisible}
        onOk={handleCreateSubPlanSubmit}
        onCancel={() => setIsCreateSubPlanModalVisible(false)}
        width={400}
      >
        <Form
          form={createSubPlanForm}
          layout="vertical"
        >
          <Form.Item
            name="period"
            label="周期"
            rules={[{ required: true, message: '请选择周期' }]}
          >
            <Select
              placeholder="请选择周期"
              onChange={handleSubPeriodChange}
            >
              {getAvailablePeriods(selectedPlan?.period || 'YEAR').map(period => (
                <Option key={period} value={period}>
                  {periodTypes.find(type => type.value === period)?.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="budget_allocation"
            label="预算分配"
            rules={[{ required: true, message: '请选择预算分配方式' }]}
          >
            <Select 
              placeholder="请选择预算分配方式"
              onChange={handleBudgetAllocationChange}
            >
              <Option value="NONE">不分配</Option>
              <Option value="AVERAGE">平均分配</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="额度"
            rules={[{ required: true, message: '请输入额度' }]}
          >
            <Input type="number" placeholder="请输入额度" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="更新开支计划"
        open={isUpdatePlanModalVisible}
        onOk={handleUpdateSubmit}
        onCancel={() => setIsUpdatePlanModalVisible(false)}
        width={600}
      >
        <Form
          form={updatePlanForm}
          layout="vertical"
        >
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
            <Select 
              style={{ width: '100%' }}
              onChange={handlePeriodChange}
            >
              {selectedPlan && getAvailablePeriodsForUpdate(selectedPlan).map(period => (
                <Option key={period} value={period}>
                  {periodTypes.find(type => type.value === period)?.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="budget_allocation"
            label="预算分配"
            rules={[{ required: true, message: '请选择预算分配方式' }]}
          >
            <Select 
              placeholder="请选择预算分配方式"
              onChange={handleBudgetAllocationChange}
            >
              <Option value="NONE">不分配</Option>
              <Option value="AVERAGE">平均分配</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpensePlanComponent;