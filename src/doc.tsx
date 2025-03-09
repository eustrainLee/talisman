import React from 'react';
import { Card, Space } from 'antd';

const Doc: React.FC = () => {
    return (
        <Space direction="vertical" style={{ width: '100%', padding: '24px' }}>
            <Card title="文档">
                {/* 文档内容将在这里添加 */}
            </Card>
        </Space>
    );
};

export default Doc; 