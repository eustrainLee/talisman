import React from 'react';
import { Card, Space, Tabs } from 'antd';
import Overview from './finance/Overview';
import Income from './finance/Income';
import Expense from './finance/Expense';
import Summary from './finance/Summary';
import Assets from './finance/Assets';
import styles from './finance/index.module.css';

const { TabPane } = Tabs;

const Finance: React.FC = () => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card className={styles.container}>
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
          <TabPane tab="汇总" key="summary">
            <Summary />
          </TabPane>
          <TabPane tab="资产" key="assets">
            <Assets />
          </TabPane>
        </Tabs>
      </Card>
    </Space>
  );
};

export default Finance; 