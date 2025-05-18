import React from 'react';
import { Card, Space, Tabs } from 'antd';
import Overview from './finance/Overview';
import Income from './finance/Income';
import Expense from './finance/Expense';
import Summary from './finance/Summary';
import Assets from './finance/Assets';
import styles from './finance/index.module.css';

const Finance: React.FC = () => {
  const items = [
    {
      key: 'overview',
      label: '概览',
      children: <Overview />,
    },
    {
      key: 'income',
      label: '收入',
      children: <Income />,
    },
    {
      key: 'expense',
      label: '支出',
      children: <Expense />,
    },
    {
      key: 'summary',
      label: '汇总',
      children: <Summary />,
    },
    {
      key: 'assets',
      label: '资产',
      children: <Assets />,
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card className={styles.container}>
        <Tabs defaultActiveKey="overview" type="card" className={styles.tabs} items={items} />
      </Card>
    </Space>
  );
};

export default Finance; 