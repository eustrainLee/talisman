import React, { useState, useEffect } from 'react';
import { Table, Input, Card, Space, Button, DatePicker, Select, Tag, Tabs, Modal, Form, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Asset, BorrowRecord, MaintenanceRecord, Tag as AssetTag } from '../../electron/server/asset/def';
import { financeAPI } from '../api/finance';

const { Search } = Input;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

dayjs.extend(isBetween);

const Assets: React.FC = () => {
  // 资产列表相关状态
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string[]>(['owned']);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedTags, setSelectedTags] = useState<AssetTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<AssetTag[]>([]);
  const [selectedTagKey, setSelectedTagKey] = useState<string>('');
  const [selectedTagValue, setSelectedTagValue] = useState<string>('');
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);

  // 借出记录相关状态
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>([]);
  const [isBorrowModalVisible, setIsBorrowModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [borrowForm] = Form.useForm();

  // 维护记录相关状态
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [isMaintenanceModalVisible, setIsMaintenanceModalVisible] = useState(false);
  const [maintenanceForm] = Form.useForm();

  // 标签相关状态
  const [tags, setTags] = useState<AssetTag[]>([]);
  const [isTagModalVisible, setIsTagModalVisible] = useState(false);
  const [tagForm] = Form.useForm();

  // 获取所有可用的标签
  useEffect(() => {
    const fetchTags = async () => {
      try {
        // 从API获取所有标签
        const allTags = await Promise.all(assets.map(async (asset) => {
          const tags = await financeAPI.getAssetTags(asset.id);
          return tags;
        }));
        const uniqueTags = Array.from(new Set(allTags.flat().map(tag => `${tag.key}:${tag.value}`)))
          .map(tagStr => {
            const [key, value] = (tagStr as string).split(':');
            return allTags.flat().find(tag => tag.key === key && tag.value === value);
          })
          .filter((tag): tag is AssetTag => tag !== undefined);
        setAvailableTags(uniqueTags);
      } catch (error) {
        console.error('获取标签失败:', error);
      }
    };

    if (assets.length > 0) {
      fetchTags();
    }
  }, [assets]);

  // 处理标签添加
  const handleAddTag = () => {
    if (selectedTagKey && selectedTagValue) {
      const tag = availableTags.find(t => t.key === selectedTagKey && t.value === selectedTagValue);
      if (tag && !selectedTags.some(t => t.id === tag.id)) {
        setSelectedTags([...selectedTags, tag]);
        // 清空选择
        setSelectedTagValue('');
      }
    }
  };

  // 处理标签移除
  const handleTagRemove = (tag: AssetTag) => {
    setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
  };

  // 获取特定键名的所有值
  const getTagValues = (key: string) => {
    return availableTags
      .filter(tag => tag.key === key)
      .map(tag => tag.value);
  };

  // 处理筛选
  const handleFilter = () => {
    const filtered = assets.filter(asset => {
      // 名称搜索
      if (searchText && !asset.name.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      // 状态筛选
      if (selectedStatus.length > 0 && !selectedStatus.includes(asset.status)) {
        return false;
      }
      // 日期范围筛选
      if (dateRange) {
        const assetDate = dayjs(asset.acquisition_date);
        if (!assetDate.isBetween(dateRange[0], dateRange[1], 'day', '[]')) {
          return false;
        }
      }
      // 标签筛选
      if (selectedTags.length > 0) {
        return selectedTags.every(selectedTag =>
          asset.tags.some(tag => tag.id === selectedTag.id)
        );
      }
      return true;
    });
    setFilteredAssets(filtered);
  };

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    setSelectedStatus(['owned']);
    setDateRange(null);
    setSelectedTags([]);
    setFilteredAssets(assets);
  };

  // 初始化时设置筛选后的资产列表
  useEffect(() => {
    setFilteredAssets(assets);
  }, [assets]);

  // 资产列表列定义
  const assetColumns: ColumnsType<Asset> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap = {
          pending: { text: '待获得', color: 'default' },
          owned: { text: '持有中', color: 'success' },
          borrowed: { text: '已借出', color: 'warning' },
          disposed: { text: '已处置', color: 'error' },
        };
        const { text, color } = statusMap[status as keyof typeof statusMap];
        return <Tag color={color}>{text}</Tag>;
      },
      filters: [
        { text: '待获得', value: 'pending' },
        { text: '持有中', value: 'owned' },
        { text: '已借出', value: 'borrowed' },
        { text: '已处置', value: 'disposed' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      sorter: (a, b) => a.location.localeCompare(b.location),
    },
    {
      title: '获得日期',
      dataIndex: 'acquisition_date',
      key: 'acquisition_date',
      sorter: (a, b) => a.acquisition_date.localeCompare(b.acquisition_date),
    },
    {
      title: '获得成本',
      dataIndex: 'acquisition_cost',
      key: 'acquisition_cost',
      render: (value: number) => `¥${(value / 100).toFixed(2)}`,
      sorter: (a, b) => a.acquisition_cost - b.acquisition_cost,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" size="small" onClick={() => handleBorrow(record)}>
            借出
          </Button>
          <Button type="link" size="small" onClick={() => handleMaintenance(record)}>
            维护
          </Button>
          <Button type="link" size="small">编辑</Button>
        </Space>
      ),
    },
  ];

  // 借出记录列定义
  const borrowColumns: ColumnsType<BorrowRecord> = [
    {
      title: '资产名称',
      dataIndex: 'asset_id',
      key: 'asset_id',
      render: (assetId: number) => {
        const asset = assets.find(a => a.id === assetId);
        return asset ? asset.name : '未知';
      },
    },
    {
      title: '借出人',
      dataIndex: 'borrower',
      key: 'borrower',
    },
    {
      title: '借出日期',
      dataIndex: 'borrow_date',
      key: 'borrow_date',
    },
    {
      title: '预期归还日期',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
    },
    {
      title: '实际归还日期',
      dataIndex: 'actual_return_date',
      key: 'actual_return_date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap = {
          borrowed: { text: '已借出', color: 'warning' },
          returned: { text: '已归还', color: 'success' },
          overdue: { text: '已逾期', color: 'error' },
        };
        const { text, color } = statusMap[status as keyof typeof statusMap];
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
    },
  ];

  // 维护记录列定义
  const maintenanceColumns: ColumnsType<MaintenanceRecord> = [
    {
      title: '资产名称',
      dataIndex: 'asset_id',
      key: 'asset_id',
      render: (assetId: number) => {
        const asset = assets.find(a => a.id === assetId);
        return asset ? asset.name : '未知';
      },
    },
    {
      title: '维护日期',
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: '维护类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '维护成本',
      dataIndex: 'cost',
      key: 'cost',
      render: (value: number) => `¥${(value / 100).toFixed(2)}`,
    },
    {
      title: '维护人',
      dataIndex: 'maintainer',
      key: 'maintainer',
    },
    {
      title: '下次维护日期',
      dataIndex: 'next_maintenance_date',
      key: 'next_maintenance_date',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  // 标签列定义
  const tagColumns: ColumnsType<AssetTag> = [
    {
      title: '标签键名',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: '标签值',
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" size="small">编辑</Button>
          <Button type="link" danger size="small">删除</Button>
        </Space>
      ),
    },
  ];

  // 处理借出
  const handleBorrow = (asset: Asset) => {
    setSelectedAsset(asset);
    borrowForm.resetFields();
    setIsBorrowModalVisible(true);
  };

  // 处理维护
  const handleMaintenance = (asset: Asset) => {
    setSelectedAsset(asset);
    maintenanceForm.resetFields();
    setIsMaintenanceModalVisible(true);
  };

  // 处理借出提交
  const handleBorrowSubmit = async () => {
    try {
      const values = await borrowForm.validateFields();
      // TODO: 调用API创建借出记录
      message.success('借出成功');
      setIsBorrowModalVisible(false);
    } catch (error) {
      message.error('借出失败');
    }
  };

  // 处理维护提交
  const handleMaintenanceSubmit = async () => {
    try {
      const values = await maintenanceForm.validateFields();
      // TODO: 调用API创建维护记录
      message.success('维护记录创建成功');
      setIsMaintenanceModalVisible(false);
    } catch (error) {
      message.error('维护记录创建失败');
    }
  };

  // 处理标签提交
  const handleTagSubmit = async () => {
    try {
      const values = await tagForm.validateFields();
      // TODO: 调用API创建标签
      message.success('标签创建成功');
      setIsTagModalVisible(false);
    } catch (error) {
      message.error('标签创建失败');
    }
  };

  return (
    <Tabs defaultActiveKey="assets">
      <TabPane tab="资产列表" key="assets">
        <Card style={{ marginBottom: '8px' }} styles={{ body: { padding: '12px' } }}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {/* 基本筛选条件 */}
            <Space wrap size="small">
              <Input
                placeholder="搜索资产名称"
                allowClear
                style={{ width: 200 }}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
              <Select
                mode="multiple"
                placeholder="选择状态"
                style={{ width: 200 }}
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={[
                  { label: '待获得', value: 'pending' },
                  { label: '持有中', value: 'owned' },
                  { label: '已借出', value: 'borrowed' },
                  { label: '已处置', value: 'disposed' },
                ]}
              />
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              />
            </Space>

            {/* 标签筛选 */}
            <Space wrap size="small">
              <Select
                placeholder="选择标签类型"
                style={{ width: 120 }}
                value={selectedTagKey}
                onChange={(value) => {
                  setSelectedTagKey(value);
                  setSelectedTagValue('');
                }}
                options={Array.from(new Set(availableTags.map(tag => tag.key))).map(key => ({
                  label: key,
                  value: key,
                }))}
                allowClear
              />
              <Select
                placeholder="选择标签值"
                style={{ width: 120 }}
                value={selectedTagValue}
                onChange={setSelectedTagValue}
                options={selectedTagKey ? getTagValues(selectedTagKey).map(value => ({
                  label: value,
                  value: value,
                })) : []}
                disabled={!selectedTagKey}
                allowClear
              />
              <Button
                type="primary"
                onClick={handleAddTag}
                disabled={!selectedTagKey || !selectedTagValue}
              >
                添加标签
              </Button>
            </Space>

            {/* 已选标签展示 */}
            <div style={{ marginTop: '4px' }}>
              {selectedTags.map(tag => (
                <Tag
                  key={tag.id}
                  closable
                  onClose={() => handleTagRemove(tag)}
                  style={{ marginBottom: '4px', marginRight: '4px' }}
                >
                  {tag.key}: {tag.value}
                </Tag>
              ))}
            </div>

            {/* 操作按钮 */}
            <Space size="small">
              <Button type="primary" onClick={handleFilter}>
                筛选
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置筛选
              </Button>
            </Space>
          </Space>
        </Card>

        <Table<Asset>
          columns={assetColumns}
          dataSource={filteredAssets}
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
          style={{ fontSize: '12px' }}
        />
      </TabPane>

      <TabPane tab="借出记录" key="borrow">
        <Table<BorrowRecord>
          columns={borrowColumns}
          dataSource={borrowRecords}
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
          style={{ fontSize: '12px' }}
        />
      </TabPane>

      <TabPane tab="维护记录" key="maintenance">
        <Table<MaintenanceRecord>
          columns={maintenanceColumns}
          dataSource={maintenanceRecords}
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
          style={{ fontSize: '12px' }}
        />
      </TabPane>
    </Tabs>
  );
};

export default Assets;