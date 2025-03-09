import './App.css'
import Home from './home'
import Assets from './assets'
import Doc from './doc'
import { Layout, Menu, MenuProps, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
const { Header, Content, Footer, Sider } = Layout;
import React, { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const siderStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  bottom: 0,
  zIndex: 100,
  backgroundColor: 'white',
};

const items: MenuProps['items'] = [
  {
    key: 'home',
    label: 'Home',
  },
  {
    key: 'assets',
    label: 'Assets',
  },
  {
    key: 'doc',
    label: '文档',
  }
];

const BaseLayout: React.FC = () => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);

  const onClick: MenuProps['onClick'] = (e) => {
    navigate(`/${e.key}`);
  };
  
  return (
    <Layout>
      <Sider 
        style={siderStyle}
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        trigger={null}
        width={160}
      >
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 16px',
          color: '#1677ff',
          fontSize: collapsed ? '14px' : '18px'
        }}>
          {collapsed ? 'T' : 'Talisman'}
          {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
            className: 'trigger',
            onClick: () => setCollapsed(!collapsed),
            style: { 
              fontSize: '16px', 
              cursor: 'pointer',
              padding: '8px',
              transition: 'all 0.3s'
            }
          })}
        </div>
        <Menu 
          theme='light' 
          mode='inline' 
          defaultSelectedKeys={['home']} 
          items={items} 
          onClick={onClick}
        />
      </Sider>
      <Layout style={{ 
        marginLeft: collapsed ? '80px' : '160px',
        transition: 'margin-left 0.2s'
      }}>
        <Content style={{ 
          overflow: 'initial',
          minHeight: '100vh'
        }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/doc" element={<Doc />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default BaseLayout
