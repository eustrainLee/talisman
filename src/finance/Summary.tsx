import React, { useState, useEffect } from 'react';
import { Card, Select, DatePicker, Table, Row, Col, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { financeAPI } from '../api/finance';

const { Option } = Select;

interface YearlySummaryData {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  quarters: {
    quarter: number;
    income: number;
    expense: number;
    netIncome: number;
  }[];
  months: {
    month: number;
    income: number;
    expense: number;
    netIncome: number;
  }[];
}

interface QuarterlySummaryData {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  months: {
    month: number;
    income: number;
    expense: number;
    netIncome: number;
  }[];
}

interface MonthlySummaryData {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  plans: {
    planId: number;
    planName: string;
    type: 'income' | 'expense';
    amount: number;
  }[];
}

type SummaryData = YearlySummaryData | QuarterlySummaryData | MonthlySummaryData;

const Summary: React.FC = () => {
  const [timeDimension, setTimeDimension] = useState<'year' | 'quarter' | 'month'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.floor(dayjs().month() / 3) + 1);
  const [selectedMonth, setSelectedMonth] = useState<number>(dayjs().month() + 1);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSummaryData();
  }, [timeDimension, selectedYear, selectedQuarter, selectedMonth]);

  const fetchSummaryData = async () => {
    try {
      setLoading(true);
      let data;
      switch (timeDimension) {
        case 'year':
          data = await financeAPI.getYearlySummary(selectedYear);
          break;
        case 'quarter':
          data = await financeAPI.getQuarterlySummary(selectedYear, selectedQuarter);
          break;
        case 'month':
          data = await financeAPI.getMonthlySummary(selectedYear, selectedMonth);
          break;
      }
      setSummaryData(data);
    } catch (error) {
      console.error('获取汇总数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const quarterColumns: ColumnsType<any> = [
    {
      title: '季度',
      dataIndex: 'quarter',
      key: 'quarter',
      render: (quarter: number) => `第${quarter}季度`,
    },
    {
      title: '收入',
      dataIndex: 'income',
      key: 'income',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '支出',
      dataIndex: 'expense',
      key: 'expense',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '净收入',
      dataIndex: 'netIncome',
      key: 'netIncome',
      render: (value: number) => (value / 100).toFixed(2),
    },
  ];

  const monthColumns: ColumnsType<any> = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      render: (month: number) => `${month}月`,
    },
    {
      title: '收入',
      dataIndex: 'income',
      key: 'income',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '支出',
      dataIndex: 'expense',
      key: 'expense',
      render: (value: number) => (value / 100).toFixed(2),
    },
    {
      title: '净收入',
      dataIndex: 'netIncome',
      key: 'netIncome',
      render: (value: number) => (value / 100).toFixed(2),
    },
  ];

  return (
    <div>
      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col>
            <Select
              value={timeDimension}
              onChange={setTimeDimension}
              style={{ width: 120 }}
            >
              <Option value="year">年度</Option>
              <Option value="quarter">季度</Option>
              <Option value="month">月度</Option>
            </Select>
          </Col>
          <Col>
            <DatePicker
              picker={timeDimension}
              value={dayjs().year(selectedYear).quarter(selectedQuarter).month(selectedMonth - 1)}
              onChange={(date) => {
                if (date) {
                  setSelectedYear(date.year());
                  setSelectedQuarter(Math.floor(date.month() / 3) + 1);
                  setSelectedMonth(date.month() + 1);
                }
              }}
            />
          </Col>
        </Row>

        {timeDimension === 'year' && summaryData && 'quarters' in summaryData && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="年度总收入"
                    value={summaryData.totalIncome / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="年度总支出"
                    value={summaryData.totalExpense / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="年度净收入"
                    value={summaryData.netIncome / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="季度汇总" style={{ marginBottom: 24 }}>
              <Table
                columns={quarterColumns}
                dataSource={summaryData.quarters}
                pagination={false}
                loading={loading}
              />
            </Card>

            <Card title="月度汇总">
              <Table
                columns={monthColumns}
                dataSource={summaryData.months}
                pagination={false}
                loading={loading}
              />
            </Card>
          </>
        )}

        {timeDimension === 'quarter' && summaryData && 'months' in summaryData && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="季度总收入"
                    value={summaryData.totalIncome / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="季度总支出"
                    value={summaryData.totalExpense / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="季度净收入"
                    value={summaryData.netIncome / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="月度汇总">
              <Table
                columns={monthColumns}
                dataSource={summaryData.months}
                pagination={false}
                loading={loading}
              />
            </Card>
          </>
        )}

        {timeDimension === 'month' && summaryData && 'plans' in summaryData && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="月度总收入"
                    value={summaryData.totalIncome / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="月度总支出"
                    value={summaryData.totalExpense / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="月度净收入"
                    value={summaryData.netIncome / 100}
                    precision={2}
                    prefix="¥"
                  />
                </Card>
              </Col>
            </Row>

            <Card title="计划汇总">
              <Table
                columns={[
                  {
                    title: '计划名称',
                    dataIndex: 'planName',
                    key: 'planName',
                  },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    key: 'type',
                    render: (type: 'income' | 'expense') => type === 'income' ? '收入' : '支出',
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (value: number) => (value / 100).toFixed(2),
                  },
                ]}
                dataSource={summaryData.plans}
                pagination={false}
                loading={loading}
              />
            </Card>
          </>
        )}
      </Card>
    </div>
  );
};

export default Summary; 