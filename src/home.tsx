import React from 'react';
import { Card, Row, Col, Statistic, Space, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, UserOutlined, ShoppingCartOutlined, DollarOutlined } from '@ant-design/icons';

function Home() {
    // 模拟的表格数据
    const tableData = [
        {
            key: '1',
            name: '项目 A',
            status: '进行中',
            progress: 32,
            owner: '张三',
        },
        {
            key: '2',
            name: '项目 B',
            status: '已完成',
            progress: 100,
            owner: '李四',
        },
        {
            key: '3',
            name: '项目 C',
            status: '待开始',
            progress: 0,
            owner: '王五',
        },
    ];

    const columns = [
        {
            title: '项目名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                let color = status === '进行中' ? 'blue' : status === '已完成' ? 'green' : 'orange';
                return <Tag color={color}>{status}</Tag>;
            },
        },
        {
            title: '进度',
            dataIndex: 'progress',
            key: 'progress',
            render: (progress: number) => `${progress}%`,
        },
        {
            title: '负责人',
            dataIndex: 'owner',
            key: 'owner',
        },
    ];

    return (
        <Space direction="vertical" style={{ width: '100%', padding: '24px' }}>
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="活跃用户"
                            value={11234}
                            prefix={<UserOutlined />}
                            valueStyle={{ color: '#3f8600' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="销售额"
                            value={93843}
                            prefix={<DollarOutlined />}
                            precision={2}
                            valueStyle={{ color: '#cf1322' }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="订单数"
                            value={2341}
                            prefix={<ShoppingCartOutlined />}
                            valueStyle={{ color: '#1677ff' }}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
                <Col span={24}>
                    <Card title="项目概览">
                        <Table 
                            columns={columns} 
                            dataSource={tableData} 
                            pagination={false}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
                <Col span={12}>
                    <Card title="最近活动">
                        <ul>
                            <li>张三 刚刚完成了项目 B 的验收</li>
                            <li>李四 在 2 小时前更新了项目 A 的进度</li>
                            <li>系统 在 4 小时前进行了例行维护</li>
                            <li>王五 在昨天创建了新项目 C</li>
                        </ul>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card title="待办事项">
                        <ul>
                            <li>项目 A 周报需要在今天提交</li>
                            <li>下周一例会准备材料</li>
                            <li>项目 C 启动会议筹备</li>
                            <li>更新第三季度工作计划</li>
                        </ul>
                    </Card>
                </Col>
            </Row>
        </Space>
    );
}

export default Home;