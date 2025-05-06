import React, { useState, useEffect } from 'react';
import { Table, Form, Input, Select, Button, Card, Space, message, Modal, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { financeAPI, IncomePlan, IncomeRecord, PeriodType } from '../api/finance';
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

interface IncomePlanComponentProps {
  onRecordCreated?: () => void;
}

// 组件 收入计划
const IncomePlanComponent: React.FC<IncomePlanComponentProps> = ({ onRecordCreated }) => {
  const [createPlanForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [createSubPlanForm] = Form.useForm();
  const [plans, setPlans] = useState<IncomePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isCreatePlanModalVisible, setIsCreatePlanModalVisible] = useState(false);
  const [isCreateSubPlanModalVisible, setIsCreateSubPlanModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<IncomePlan | null>(null);
  const [existingRecord, setExistingRecord] = useState<IncomeRecord | null>(null);
  const [isFormDisabled, setIsFormDisabled] = useState(false);
  const [parentRecordError, setParentRecordError] = useState<string | null>(null);
  const [subRecordError, setSubRecordError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const data = await financeAPI.getIncomePlans();
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch income plans:', error);
      message.error('获取收入计划失败');
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<IncomePlan> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: IncomePlan) => {
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
      content: '确定要删除这条收入计划吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await financeAPI.deleteIncomePlan(id);
          message.success('删除成功');
          fetchPlans();
        } catch (error) {
          console.error('Failed to delete income plan:', error);
          message.error('删除失败');
        }
      }
    });
  };

  // 检查指定时间是否已存在记录，并获取最近周期的期末累计值
  const checkExistingRecord = async (planId: number, date: dayjs.Dayjs) => {
    try {
      const records = await financeAPI.getIncomeRecords(planId);
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
        const openingCumulative = previousRecord.closing_cumulative / 100;
        createForm.setFieldsValue({
          opening_cumulative: openingCumulative,
          closing_cumulative: openingCumulative,
        });
      } else {
        // 如果没有找到，重置为0
        createForm.setFieldsValue({
          opening_cumulative: 0,
          closing_cumulative: 0,
        });
      }

      return !!existing;
    } catch (error) {
      console.error('Failed to check existing record:', error);
      return false;
    }
  };

  // 设置周期起始时间
  const getPeriodStartDate = (date: dayjs.Dayjs, period: string) => {
    switch (period) {
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

  // 创建收入记录
  const handleCreate = (plan: IncomePlan) => {
    setSelectedPlan(plan);

    // 设置时间字段为这个周期的开始时间
    const today = dayjs();
    const startDate = getPeriodStartDate(today, plan.period);

    // 重置错误状态
    setParentRecordError(null);
    setSubRecordError(null);
    
    createForm.setFieldsValue({
      date: startDate,
      amount: 0,
      opening_cumulative: 0,
      closing_cumulative: 0,
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
            financeAPI.getIncomePlans()
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
          financeAPI.getIncomeRecords(parentPlan.id).then(parentRecords => {
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
            financeAPI.getIncomeRecords(selectedPlan.id).then(subRecords => {
              const hasOverlappingRecord = subRecords.some(r => r.date === dayjs(date).format('YYYY-MM-DD'));
              if (hasOverlappingRecord) {
                setSubRecordError('该时间已存在子记录');
                return;
              }

              // 获取当前日期之前的所有子记录，按日期排序
              const previousSubRecords = subRecords
                .filter(r => dayjs(r.date).isBefore(dayjs(date)))
                .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

              // 计算期初累计值
              let openingCumulative = 0;

              if (previousSubRecords.length > 0) {
                // 如果有之前的子记录，使用最后一个子记录的期末累计值
                const lastRecord = previousSubRecords[0];
                openingCumulative = lastRecord.closing_cumulative;
              } else {
                // 如果没有之前的子记录，使用父记录的期初累计值
                openingCumulative = parentRecord.opening_cumulative;
              }

              // 更新表单值
              createForm.setFieldsValue({
                opening_cumulative: openingCumulative / 100,
                closing_cumulative: openingCumulative / 100,
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
          const allPlans = await financeAPI.getIncomePlans();
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
      const parentRecords = await financeAPI.getIncomeRecords(parentPlan.id);
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
      const subRecords = await financeAPI.getIncomeRecords(selectedPlan.id);
      const hasOverlappingRecord = subRecords.some(r => r.date === startDate.format('YYYY-MM-DD'));
      if (hasOverlappingRecord) {
        setSubRecordError('该时间已存在子记录');
        return;
      }

      // 获取当前日期之前的所有子记录，按日期排序
      const previousSubRecords = subRecords
        .filter(r => dayjs(r.date).isBefore(startDate))
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

      // 计算期初累计值
      let openingCumulative = 0;

      if (previousSubRecords.length > 0) {
        // 如果有之前的子记录，使用最后一个子记录的期末累计值
        const lastRecord = previousSubRecords[0];
        openingCumulative = lastRecord.closing_cumulative;
      } else {
        // 如果没有之前的子记录，使用父记录的期初累计值
        openingCumulative = parentRecord.opening_cumulative;
      }

      // 更新表单值
      createForm.setFieldsValue({
        opening_cumulative: openingCumulative / 100,
        closing_cumulative: openingCumulative / 100,
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
            const allPlans = await financeAPI.getIncomePlans();
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
        const parentRecords = await financeAPI.getIncomeRecords(parentPlan.id);
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
        const subRecords = await financeAPI.getIncomeRecords(selectedPlan.id);
        const hasOverlappingRecord = subRecords.some(r => r.date === values.date.format('YYYY-MM-DD'));
        if (hasOverlappingRecord) {
          message.error('该时间已存在子记录');
          return;
        }

        // 创建子记录
        await financeAPI.createIncomeRecord({
          plan_id: selectedPlan.id,
          date: values.date.format('YYYY-MM-DD'),
          amount: values.amount * 100,
          opening_cumulative: values.opening_cumulative * 100,
          closing_cumulative: values.closing_cumulative * 100,
          is_sub_record: true,
          parent_record_id: parentRecord.id,
        });

        // 更新父记录
        const updatedParentRecord = {
          ...parentRecord,
          closing_cumulative: parentRecord.closing_cumulative + values.amount * 100,
        };
        await financeAPI.updateIncomeRecord(parentRecord.id, updatedParentRecord);

      } else {
        await financeAPI.createIncomeRecord({
          plan_id: selectedPlan.id,
          date: values.date.format('YYYY-MM-DD'),
          amount: values.amount * 100,
          opening_cumulative: values.opening_cumulative * 100,
          closing_cumulative: values.closing_cumulative * 100,
          is_sub_record: false,
        });
      }

      message.success('创建成功');
      setIsCreateModalVisible(false);
      
      // 更新 plans 状态
      const updatedPlans = await financeAPI.getIncomePlans();
      setPlans(updatedPlans);
      
      // 调用回调
      onRecordCreated?.();
    } catch (error) {
      console.error('Failed to create income record:', error);
      message.error('创建失败');
    }
  };

  const handleCreateFormValuesChange = (changedValues: any, allValues: any) => {
    // 计算期末累计值
    const amount = Number(allValues.amount || 0);
    const openingCumulative = Number(allValues.opening_cumulative || 0);
    const closingCumulative = openingCumulative + amount;
    createForm.setFieldsValue({ closing_cumulative: closingCumulative });
  };

  const handleCreateSubPlan = (plan: IncomePlan) => {
    setSelectedPlan(plan);
    createSubPlanForm.resetFields();
    setIsCreateSubPlanModalVisible(true);
    
    // 设置默认值
    const defaultPeriod = getAvailablePeriods(plan.period)[0];
    createSubPlanForm.setFieldsValue({
      period: defaultPeriod,
    });
  };

  const handleCreateSubPlanSubmit = async () => {
    try {
      const values = await createSubPlanForm.validateFields();
      await financeAPI.createIncomePlan({
        name: values.name,
        period: values.period as PeriodType,
        parent_id: selectedPlan!.id,
        sub_period: values.period,
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
      await financeAPI.createIncomePlan({
        name: values.name,
        period: values.period as PeriodType,
        parent_id: null,
        sub_period: null,
      });
      message.success('创建成功');
      setIsCreatePlanModalVisible(false);
      fetchPlans();
    } catch (error) {
      console.error('Failed to create income plan:', error);
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
    
    createSubPlanForm.setFieldsValue({
      period: value,
    });
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
    const result: IncomePlan[] = [];
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

      <Table<IncomePlan>
        columns={columns}
        dataSource={sortedPlans}
        loading={loading}
        pagination={false}
        rowKey="id"
        size="small"
        style={{ fontSize: '12px' }}
      />

      <Modal
        title="创建收入记录"
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
            name="amount"
            label="收入金额"
            rules={[{ required: true, message: '请输入收入金额' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="opening_cumulative"
            label="期初累计"
            rules={[{ required: true, message: '请输入期初累计' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
          <Form.Item
            name="closing_cumulative"
            label="期末累计"
            rules={[{ required: true, message: '请输入期末累计' }]}
          >
            <Input type="number" disabled={isFormDisabled} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建收入计划"
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
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入名称" />
          </Form.Item>
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
        </Form>
      </Modal>
    </div>
  );
};

export default IncomePlanComponent; 