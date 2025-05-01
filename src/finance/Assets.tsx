import React from 'react';
import { Table, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';

const { Search } = Input;

interface Asset {
  key: string;
  id: string;
  name: string;
  acquisitionDate: string;
  purchasePrice: number;
  source: string;
  isLent: boolean;
}

const Assets: React.FC = () => {
  const columns: ColumnsType<Asset> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '获得时间',
      dataIndex: 'acquisitionDate',
      key: 'acquisitionDate',
      sorter: (a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate),
    },
    {
      title: '购入价格',
      dataIndex: 'purchasePrice',
      key: 'purchasePrice',
      render: (value: number) => (value / 100).toFixed(2),
      sorter: (a, b) => a.purchasePrice - b.purchasePrice,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      sorter: (a, b) => a.source.localeCompare(b.source),
    },
    {
      title: '状态',
      dataIndex: 'isLent',
      key: 'isLent',
      render: (value: boolean) => value ? '已借出' : '在库',
      sorter: (a, b) => (a.isLent === b.isLent ? 0 : a.isLent ? 1 : -1),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Search
          placeholder="搜索资产名称"
          allowClear
          style={{ width: 200 }}
        />
      </div>

      <Table<Asset>
        columns={columns}
        // 数据将从数据库获取
        dataSource={[]}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
    </div>
  );
};

export default Assets; 