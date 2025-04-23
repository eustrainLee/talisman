import React, { useState } from 'react'
import { Layout, Menu } from 'antd'
import { useNavigate } from 'react-router-dom'
import { HomeOutlined, FileOutlined, AccountBookOutlined } from '@ant-design/icons'
import { Route, Routes } from 'react-router-dom'
import Home from './home'
import Doc from './doc'
import Finance from './finance'

const { Content, Sider } = Layout;

const siderStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  bottom: 0,
  zIndex: 1000,
  backgroundColor: 'white',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
};

const items = [
  {
    key: 'home',
    icon: <HomeOutlined />,
    label: '首页',
  },
  {
    key: 'docs',
    icon: <FileOutlined />,
    label: '文档',
  },
  {
    key: 'finance',
    icon: <AccountBookOutlined />,
    label: '财务',
  },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);

  const onClick = (e: any) => {
    navigate(`/${e.key}`);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={siderStyle}
        theme="light"
      >
        <div style={{ 
          height: 32, 
          margin: 16, 
          background: '#001529',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: collapsed ? '14px' : '16px',
          fontWeight: 'bold',
          overflow: 'hidden'
        }}>
          {collapsed ? 'T' : 'Talisman'}
        </div>
        <Menu
          theme="light"
          defaultSelectedKeys={['home']}
          mode="inline"
          items={items}
          onClick={onClick}
        />
      </Sider>
      <Layout style={{ 
        marginLeft: collapsed ? '80px' : '200px',
        transition: 'margin-left 0.2s'
      }}>
        <Content>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/docs" element={<Doc menuCollapsed={collapsed} />} />
            <Route path="/finance" element={<Finance />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
