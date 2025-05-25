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
  const [tagLoading, setTagLoading] = useState(false);

  // 创建资产相关状态
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();

  // 编辑资产相关状态
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // 筛选对话框相关状态
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [filterForm] = Form.useForm();

  // 获取资产列表
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const data = await financeAPI.getAssets();
      setAssets(data);
      setFilteredAssets(data);
    } catch (error) {
      console.error('获取资产列表失败:', error);
      message.error('获取资产列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始化时获取资产列表
  useEffect(() => {
    fetchAssets();
  }, []);

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

  // 处理状态标签移除
  const handleStatusRemove = (status: string) => {
    setSelectedStatus(selectedStatus.filter(s => s !== status));
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

  // 打开搜索对话框时，将当前状态复制到表单
  const handleOpenFilterModal = () => {
    filterForm.setFieldsValue({
      name: searchText,
      status: selectedStatus,
      dateRange: dateRange,
      tags: selectedTags,
      tagKey: selectedTagKey,
      tagValue: selectedTagValue,
    });
    setIsFilterModalVisible(true);
  };

  // 处理搜索对话框的确定按钮
  const handleFilterConfirm = async () => {
    try {
      const values = await filterForm.validateFields();
      setSearchText(values.name);
      setSelectedStatus(values.status);
      setDateRange(values.dateRange);
      setSelectedTags(values.tags);
      setSelectedTagKey(values.tagKey);
      setSelectedTagValue(values.tagValue);
      setIsFilterModalVisible(false);
      handleFilter();
    } catch (error) {
      // 表单验证失败
    }
  };

  // 处理搜索对话框的取消按钮
  const handleFilterCancel = () => {
    setIsFilterModalVisible(false);
  };

  // 处理临时标签添加
  const handleTempAddTag = () => {
    const values = filterForm.getFieldsValue();
    if (values.tagKey && values.tagValue) {
      const tag = availableTags.find(t => t.key === values.tagKey && t.value === values.tagValue);
      if (tag && !values.tags?.some((t: AssetTag) => t.id === tag.id)) {
        filterForm.setFieldsValue({
          tags: [...(values.tags || []), tag],
          tagValue: '',
        });
      }
    }
  };

  // 处理临时标签移除
  const handleTempTagRemove = (tag: AssetTag) => {
    const values = filterForm.getFieldsValue();
    filterForm.setFieldsValue({
      tags: values.tags.filter((t: AssetTag) => t.id !== tag.id),
    });
  };

  // 处理删除资产
  const handleDelete = async (asset: Asset) => {
    try {
      await financeAPI.deleteAsset(asset.id);
      message.success('删除成功');
      // 刷新资产列表
      fetchAssets();
    } catch (error) {
      console.error('删除资产失败:', error);
      message.error('删除失败');
    }
  };

  // 处理编辑资产
  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset);
    editForm.setFieldsValue({
      name: asset.name,
      description: asset.description,
      location: asset.location,
      status: asset.status,
      acquisition_date: asset.acquisition_date ? dayjs(asset.acquisition_date) : null,
      acquisition_source: asset.acquisition_source,
      acquisition_cost: asset.acquisition_cost / 100,
      acquisition_note: asset.acquisition_note,
    });
    setSelectedTags(asset.tags || []);
    setIsEditModalVisible(true);
  };

  // 处理编辑提交
  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingAsset) return;

      await financeAPI.updateAsset(editingAsset.id, {
        name: values.name,
        description: values.description || null,
        location: values.location || null,
        status: values.status,
        acquisition_date: values.acquisition_date ? values.acquisition_date.format('YYYY-MM-DD') : null,
        acquisition_source: values.acquisition_source,
        acquisition_cost: Math.round(values.acquisition_cost * 100),
        acquisition_note: values.acquisition_note || null,
        tags: selectedTags,
      });

      message.success('更新成功');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setSelectedTags([]);
      // 刷新资产列表
      fetchAssets();
    } catch (error) {
      console.error('更新资产失败:', error);
      message.error('更新失败');
    }
  };

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
    },
    {
      title: '位置',
      dataIndex: 'location',
      key: 'location',
      render: (location: string | null) => location || '-',
    },
    {
      title: '获得日期',
      dataIndex: 'acquisition_date',
      key: 'acquisition_date',
      render: (date: string | null) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '获得来源',
      dataIndex: 'acquisition_source',
      key: 'acquisition_source',
      render: (source: string | null) => source || '-',
    },
    {
      title: '获得成本',
      dataIndex: 'acquisition_cost',
      key: 'acquisition_cost',
      render: (cost: number | null) => cost ? `${(cost / 100).toFixed(2)}` : '-',
    },
    {
      title: '获得备注',
      dataIndex: 'acquisition_note',
      key: 'acquisition_note',
      render: (note: string | null) => note || '-',
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
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button 
            type="link" 
            danger 
            size="small" 
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除资产"${record.name}"吗？`,
                okText: '确认',
                cancelText: '取消',
                onOk: () => handleDelete(record)
              });
            }}
          >
            删除
          </Button>
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

  // 获取所有标签
  const fetchTags = async () => {
    try {
      setTagLoading(true);
      const data = await financeAPI.getAllTags();
      setTags(data);
    } catch (error) {
      console.error('获取标签列表失败:', error);
      message.error('获取标签列表失败');
    } finally {
      setTagLoading(false);
    }
  };

  // 初始化时获取标签列表
  useEffect(() => {
    fetchTags();
  }, []);

  // 处理标签提交
  const handleTagSubmit = async () => {
    try {
      const values = await tagForm.validateFields();
      await financeAPI.createTag({
        key: values.key,
        value: values.value,
      });
      message.success('标签创建成功');
      setIsTagModalVisible(false);
      tagForm.resetFields();
      // 刷新标签列表
      fetchTags();
    } catch (error) {
      console.error('创建标签失败:', error);
      message.error('创建标签失败');
    }
  };

  // 处理创建资产提交
  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      const asset = await financeAPI.createAsset({
        name: values.name,
        description: values.description || null,
        location: values.location || null,
        status: values.status,
        current_borrow_id: null,
        acquisition_date: values.acquisition_date ? values.acquisition_date.format('YYYY-MM-DD') : null,
        acquisition_source: values.acquisition_source,
        acquisition_cost: Math.round(values.acquisition_cost * 100),
        acquisition_note: values.acquisition_note || null,
        planned_disposal_date: null,
        actual_disposal_date: null,
        disposal_method: null,
        disposal_note: null,
        tags: selectedTags,
      });
      message.success('创建成功');
      setIsCreateModalVisible(false);
      createForm.resetFields();
      setSelectedTags([]);
      // 刷新资产列表
      fetchAssets();
    } catch (error) {
      console.error('创建资产失败:', error);
      message.error('创建失败');
    }
  };

  return (
    <>
      <Tabs defaultActiveKey="assets" items={[
        {
          key: 'assets',
          label: '资产列表',
          children: (
            <>
              <Card style={{ marginBottom: '8px' }} styles={{ body: { padding: '12px' } }}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size="small">
                      <Button type="primary" onClick={() => setIsCreateModalVisible(true)}>
                        添加资产
                      </Button>
                    </Space>
                  </div>

                  {/* 当前筛选条件展示 */}
                  {(
                    <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <Space wrap size="small">
                        <span>当前筛选：</span>
                        {searchText && (
                          <Tag closable onClose={() => setSearchText('')}>
                            名称包含：{searchText}
                          </Tag>
                        )}
                        {selectedStatus.map(status => {
                          const statusMap = {
                            pending: '待获得',
                            owned: '持有中',
                            borrowed: '已借出',
                            disposed: '已处置',
                          };
                          return (
                            <Tag
                              key={status}
                              closable
                              onClose={() => handleStatusRemove(status)}
                            >
                              状态：{statusMap[status as keyof typeof statusMap]}
                            </Tag>
                          );
                        })}
                        {dateRange && (
                          <Tag closable onClose={() => setDateRange(null)}>
                            日期范围：{dateRange[0].format('YYYY-MM-DD')} 至 {dateRange[1].format('YYYY-MM-DD')}
                          </Tag>
                        )}
                        {selectedTags.map(tag => (
                          <Tag
                            key={tag.id}
                            closable
                            onClose={() => handleTagRemove(tag)}
                          >
                            {tag.key}: {tag.value}
                          </Tag>
                        ))}
                        <Button type="link" size="small" onClick={handleOpenFilterModal}>
                          修改
                        </Button>
                        <Button type="link" size="small" onClick={handleReset}>
                          重置
                        </Button>
                      </Space>
                    </div>
                  )}
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
                rowKey="id"
              />
            </>
          ),
        },
        {
          key: 'borrow',
          label: '借出记录',
          children: (
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
              rowKey="id"
            />
          ),
        },
        {
          key: 'maintenance',
          label: '维护记录',
          children: (
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
              rowKey="id"
            />
          ),
        },
        {
          key: 'tags',
          label: '标签',
          children: (
            <>
              <Card type='inner'>
                <Button type="primary" onClick={() => setIsTagModalVisible(true)}>
                  创建标签
                </Button>
              </Card>

              <Table<AssetTag>
                columns={tagColumns}
                dataSource={tags}
                loading={loading}
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                size="small"
                style={{ fontSize: '12px' }}
                rowKey="id"
              />
            </>
          ),
        },
      ]} />

      {/* 创建资产对话框 */}
      <Modal
        title="创建资产"
        open={isCreateModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => {
          setIsCreateModalVisible(false);
          createForm.resetFields();
        }}
        width={600}
        style={{ padding: '12px 24px' }}
      >
        <Form
          form={createForm}
          layout="horizontal"
          className="compact-form"
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
          size="small"
        >
          <Form.Item
            name="name"
            label={
              <span
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >资产名称</span>
            }
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </Form.Item>
          <Form.Item
            name="location"
            label="位置"
          >
            <Input placeholder="请输入位置" />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
            initialValue="owned"
          >
            <Select placeholder="请选择状态">
              <Select.Option value="pending">待获得</Select.Option>
              <Select.Option value="owned">持有中</Select.Option>
              <Select.Option value="borrowed">已借出</Select.Option>
              <Select.Option value="disposed">已处置</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="acquisition_date"
            label="日期"
            initialValue={dayjs()}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="acquisition_source"
            label="来源"
          >
            <Input placeholder="请输入来源" />
          </Form.Item>
          <Form.Item
            name="acquisition_cost"
            label="成本"
          >
            <Input type="number" placeholder="请输入成本" />
          </Form.Item>
          <Form.Item
            name="acquisition_note"
            label="备注"
          >
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
          <Form.Item label="标签">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space size="small">
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
              <div>
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
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑资产对话框 */}
      <Modal
        title="编辑资产"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setIsEditModalVisible(false);
          editForm.resetFields();
          setSelectedTags([]);
        }}
        width={600}
        style={{ padding: '12px 24px' }}
      >
        <Form
          form={editForm}
          layout="horizontal"
          className="compact-form"
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
          size="small"
        >
          <Form.Item
            name="name"
            label={
              <span
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >资产名称</span>
            }
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </Form.Item>
          <Form.Item
            name="location"
            label="位置"
          >
            <Input placeholder="请输入位置" />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Select.Option value="pending">待获得</Select.Option>
              <Select.Option value="owned">持有中</Select.Option>
              <Select.Option value="borrowed">已借出</Select.Option>
              <Select.Option value="disposed">已处置</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="acquisition_date"
            label="日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="acquisition_source"
            label="来源"
          >
            <Input placeholder="请输入来源" />
          </Form.Item>
          <Form.Item
            name="acquisition_cost"
            label="成本"
          >
            <Input type="number" placeholder="请输入成本" />
          </Form.Item>
          <Form.Item
            name="acquisition_note"
            label="备注"
          >
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
          <Form.Item label="标签">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space size="small">
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
              <div>
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
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 筛选对话框 */}
      <Modal
        title="搜索条件"
        open={isFilterModalVisible}
        onOk={handleFilterConfirm}
        onCancel={handleFilterCancel}
        width={600}
        styles={{ body: { padding: '12px 24px' } }}
      >
        <Form 
          form={filterForm}
          layout="horizontal" 
          className="compact-form"
          labelCol={{ span: 6 }}
          labelAlign="right"
          labelWrap={false}
          wrapperCol={{ span: 18 }}
          size="small"
        >
          <Form.Item
            name="name"
            label={
              <span
                className="form-label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >名称</span>
            }
            rules={[{ message: '请输入名称' }]}
          >
            <Input
              placeholder="搜索名称"
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Select
              mode="multiple"
              placeholder="选择状态"
              style={{ width: '100%' }}
              options={[
                { label: '待获得', value: 'pending' },
                { label: '持有中', value: 'owned' },
                { label: '已借出', value: 'borrowed' },
                { label: '已处置', value: 'disposed' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="日期范围"
          >
            <RangePicker
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="tags"
            label="标签"
            initialValue={[]}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Space size="small">
                <Select
                  placeholder="选择标签类型"
                  style={{ width: 120 }}
                  value={filterForm.getFieldValue('tagKey')}
                  onChange={(value) => {
                    filterForm.setFieldsValue({
                      tagKey: value,
                      tagValue: '',
                    });
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
                  value={filterForm.getFieldValue('tagValue')}
                  onChange={(value) => filterForm.setFieldValue('tagValue', value)}
                  options={filterForm.getFieldValue('tagKey') ? getTagValues(filterForm.getFieldValue('tagKey')).map(value => ({
                    label: value,
                    value: value,
                  })) : []}
                  disabled={!filterForm.getFieldValue('tagKey')}
                  allowClear
                />
                <Button
                  type="primary"
                  onClick={handleTempAddTag}
                  disabled={!filterForm.getFieldValue('tagKey') || !filterForm.getFieldValue('tagValue')}
                  size="small"
                >
                  添加标签
                </Button>
              </Space>
              <div>
                {filterForm.getFieldValue('tags')?.map((tag: AssetTag) => (
                  <Tag
                    key={tag.id}
                    closable
                    onClose={() => handleTempTagRemove(tag)}
                    style={{ marginBottom: '4px', marginRight: '4px' }}
                  >
                    {tag.key}: {tag.value}
                  </Tag>
                ))}
              </div>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建标签对话框 */}
      <Modal
        title="创建标签"
        open={isTagModalVisible}
        onOk={handleTagSubmit}
        onCancel={() => {
          setIsTagModalVisible(false);
          tagForm.resetFields();
        }}
        width={400}
        confirmLoading={tagLoading}
      >
        <Form
          form={tagForm}
          layout="vertical"
        >
          <Form.Item
            name="key"
            label="标签键名"
            rules={[{ required: true, message: '请输入标签键名' }]}
          >
            <Input placeholder="请输入标签键名" />
          </Form.Item>
          <Form.Item
            name="value"
            label="标签值"
            rules={[{ required: true, message: '请输入标签值' }]}
          >
            <Input placeholder="请输入标签值" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default Assets;