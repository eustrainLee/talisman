import React from 'react';
import { Tabs } from 'antd';
import Overview from './Overview';
import Income from './Income';
import Expense from './Expense';
import Annual from './Annual';
import Assets from './Assets';
import styles from './index.module.css';

const { TabPane } = Tabs;

const Finance: React.FC = () => {
  return (
    <div className={styles.container}>
      <Tabs defaultActiveKey="overview" type="card" className={styles.tabs}>
        <TabPane tab="概览" key="overview">
          <Overview />
        </TabPane>
        <TabPane tab="收入" key="income">
          <Income />
        </TabPane>
        <TabPane tab="支出" key="expense">
          <Expense />
        </TabPane>
        <TabPane tab="年度" key="annual">
          <Annual />
        </TabPane>
        <TabPane tab="资产" key="assets">
          <Assets />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Finance; 