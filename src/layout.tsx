import './App.css'
import Home from './home'
import Account from './account'
import Doc from './doc'
import { Layout, Menu, MenuProps, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
const { Header, Content, Footer, Sider } = Layout;
import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const siderStyle: React.CSSProperties = {
  overflow: 'auto',
  height: '100vh',
  // width: '100vh',
  position: 'sticky',
  insetInlineStart: 0,
  backgroundColor: 'white',
  top: 0,
  bottom: 0,
  scrollbarWidth: 'thin',
  scrollbarGutter: 'stable',
};

const items: MenuProps['items'] = [
  {
    key: 'home',
    label: 'Home',
  },
  {
    key: 'account',
    label: 'Account',
  },
  {
    key: 'doc',
    label: '文档',
  }
];

const BaseLayout: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const navigate = useNavigate();

  const onClick: MenuProps['onClick'] = (e) => {
    navigate(`/${e.key}`);
  };
  
  return (
    <>
      <Layout hasSider>
        <Sider style={siderStyle}>
          <div>123</div>
          <Menu 
            theme='light' 
            mode='inline' 
            defaultSelectedKeys={['home']} 
            items={items} 
            onClick={onClick} 
          />
        </Sider>
        <Layout>
          <Header style={{padding: 0, background: colorBgContainer}} />
          <Content style= {{ margin: '24px 16px 0', overflow: 'initial'}}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />
              <Route path="/account" element={<Account />} />
              <Route path="/doc" element={<Doc />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </>
  )
}

export default BaseLayout
