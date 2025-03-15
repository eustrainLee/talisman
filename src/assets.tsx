import React from 'react';
import { Card, Space, Table, Tag, Button, Input } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';

const { Search } = Input;

const Assets: React.FC = () => {
  const columns = [
    {
      title: '资产名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === '图片' ? 'blue' : type === '文档' ? 'green' : 'orange'}>
          {type}
        </Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '上传时间',
      dataIndex: 'uploadTime',
      key: 'uploadTime',
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space size="middle">
          <a>下载</a>
          <a>删除</a>
        </Space>
      ),
    },
  ];

  const data = [
    {
      key: '1',
      name: 'example.jpg',
      type: '图片',
      size: '2.5MB',
      uploadTime: '2024-03-15 10:30',
    },
    {
      key: '2',
      name: 'document.pdf',
      type: '文档',
      size: '1.2MB',
      uploadTime: '2024-03-14 15:45',
    },
    {
      key: '3',
      name: 'video.mp4',
      type: '视频',
      size: '15.8MB',
      uploadTime: '2024-03-13 09:20',
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Search
            placeholder="搜索资产"
            allowClear
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Button type="primary" icon={<PlusOutlined />}>
            上传资产
          </Button>
        </Space>
        <Table columns={columns} dataSource={data} />
      </Card>
    </Space>
  );
};

export default Assets; 