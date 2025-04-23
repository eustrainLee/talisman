import React, { useState } from 'react';
import { Tabs } from 'antd';
import Overview from './Overview';
import Monthly from './Monthly';
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
    </div>
  );
};

export default Finance; 