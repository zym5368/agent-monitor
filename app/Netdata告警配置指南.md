# Netdata 告警配置指南

## 功能说明

系统已支持两种告警规则配置方式：

### 1. 预设快速指标（简单模式）
- CPU 使用率
- 内存使用率
- 磁盘使用率
- GPU 使用率
- CPU 温度
- GPU 温度

### 2. 自定义 Netdata 指标（高级模式）
支持从 Netdata 服务器动态加载所有可用的 Charts 和 Dimensions，配置任何你需要的指标。

## 已实现的核心组件

### 类型定义 (`src/shared/types.ts`)
- `NetdataChartInfo`: Netdata Chart 信息
- `NetdataDimensionInfo`: Netdata Dimension 信息
- `AlertRule`: 更新为支持 `netdataMetric` 字段

### API 函数 (`src/api/client.ts`)
- `fetchNetdataCharts()`: 从 Netdata 获取所有可用 Charts
- `fetchNetdataChartData()`: 获取指定 Chart 的数据
- `getNetdataDimensionValue()`: 从 Chart 数据中提取 Dimension 值

### 告警工具 (`src/api/alerts.ts`)
- 更新支持自定义指标的显示
- `getMetricLabel()`: 支持从 AlertRule 获取标签
- `getMetricUnit()`: 获取指标单位

### 告警引擎 (`src/utils/alertEngine.ts`)
- 支持自定义 Netdata 指标检测
- 每30秒自动检查自定义指标
- `updateServers()`: 更新服务器列表

### Netdata 指标选择器组件
位于 `src/pages/Alerts.tsx` 中的 `NetdataMetricSelector` 组件：
- 自动加载服务器的 Netdata Charts
- 支持搜索过滤
- 双列选择：Chart + Dimension
- 显示已选择的指标信息

## 下一步：完善 RuleForm

如需完成自定义指标配置界面，需要在 `RuleForm` 组件中添加：

1. **指标类型选择**：
   - 单选按钮：「预设指标」/「自定义 Netdata 指标」

2. **条件渲染**：
   - 选择「预设指标」时显示现有的 metric 下拉框
   - 选择「自定义 Netdata 指标」时显示 `NetdataMetricSelector` 组件

3. **表单状态管理**：
   - 添加 `useNetdataMetric` state
   - 添加 `netdataChartId` state
   - 添加 `netdataDimensionName` state
   - 添加 `netdataChartTitle` state
   - 添加 `netdataDimensionLabel` state
   - 添加 `netdataUnits` state

4. **提交数据**：
   - 根据选择的类型设置 `metric` 或 `netdataMetric` 字段

## 使用示例

### 配置自定义 Netdata 指标告警（需完善 RuleForm 后）

1. 进入「告警配置」→「告警规则」
2. 点击「+ 添加规则」
3. 填写规则名称
4. 选择一个已配置 Netdata 的服务器（必须）
5. 选择「自定义 Netdata 指标」
6. 等待系统加载该服务器的所有指标
7. 使用搜索框找到需要的指标（如 `network`、`disk` 等）
8. 在左侧选择 Chart（如 `net.eth0`）
9. 在右侧选择 Dimension（如 `received`、`sent`）
10. 配置触发条件、阈值、告警级别
11. 保存规则

### 常用 Netdata Charts 示例

- `system.cpu`: CPU 使用率
- `system.ram`: 内存使用
- `disk_space._`: 磁盘空间
- `net.eth0`: 网络流量
- `mem.available`: 可用内存
- `system.load`: 系统负载
- `ipv4.tcpsock`: TCP 连接数
- `apps.cpu`: 进程 CPU 使用

## 数据持久化

所有配置（告警规则、通知渠道、历史记录）都保存在浏览器的 localStorage 中：
- `cluster-alert-rules`: 告警规则
- `cluster-notification-channels`: 通知渠道
- `cluster-alert-history`: 告警历史
- `cluster-notification-logs`: 通知日志

## 开发服务器

运行 `npm run dev` 启动开发服务器，访问 http://localhost:5173/
