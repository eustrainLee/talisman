import React from 'react';
import { Tabs } from 'antd';
import Overview from './Overview';
import Income from './Income';
import Expense from './Expense';
import Summary from './Summary';
import Assets from './Assets';
import styles from './index.module.css';

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
    <div className={styles.container}>
      <Tabs defaultActiveKey="overview" type="card" className={styles.tabs} items={items} />
    </div>
  );
};

export default Finance; 