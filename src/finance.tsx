import React from 'react';
import { Card, Space, Tabs } from 'antd';
import Overview from './finance/Overview';
import Monthly from './finance/Monthly';
import Annual from './finance/Annual';
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
          <TabPane tab="月度" key="monthly">
            <Monthly />
          </TabPane>
          <TabPane tab="年度" key="annual">
            <Annual />
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