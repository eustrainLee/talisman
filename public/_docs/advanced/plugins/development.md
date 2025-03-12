# 插件开发指南

## 插件结构

一个典型的插件包含以下文件：

```
my-plugin/
  ├── index.ts
  ├── package.json
  └── README.md
```

## API 参考

插件可以使用以下 API：

```typescript
interface Plugin {
  name: string;
  version: string;
  activate(): void;
  deactivate(): void;
}
```

## 示例

这是一个最小化的插件示例：

```typescript
export default {
  name: 'my-plugin',
  version: '1.0.0',
  activate() {
    console.log('Plugin activated');
  },
  deactivate() {
    console.log('Plugin deactivated');
  }
};
``` 