# TRON 能量租赁平台 - 文档总览

**项目名称**: TRON 能量租赁平台  
**技术栈**: Node.js + TypeScript + MySQL + Redis + TronWeb  
**业务模式**: 自主质押 TRX 出租能量  
**更新日期**: 2026年1月4日

---

46370

## 📚 文档列表

### 1. [产品需求文档 (PRD)](./PRD-产品需求文档.md)

**主要内容**：

- ✅ 产品定位和目标用户
- ✅ **核心功能一：API 自动化模块**
  - RESTful API 设计
  - 能量租赁、价格查询、订单管理等接口
  - API 安全机制（签名验证、频率限制）
  - Webhook 回调
- ✅ **核心功能二：TG 机器人模块**
  - 能量购买（交互式流程）
  - 钱包查询（实时余额和能量）
  - 汇率查询（TRX 价格）
  - 自动租赁（智能监控和触发）
  - 监控钱包（余额变动告警）
  - 日报概览（每日统计推送）
- ✅ 系统架构和功能模块
- ✅ 数据库表结构设计
- ✅ 项目路线图（MVP、增强版、企业版）

### 2. [技术设计方案](./技术设计方案.md)

**主要内容**：

- ✅ **技术栈**
  - 后端：Node.js 20+ / TypeScript 5+ / Express
  - 数据库：MySQL 8.0+（主库）+ Redis 7+（缓存）
  - 区块链：TronWeb 5.x
  - 消息队列：Redis + BullMQ
- ✅ **核心服务设计**
  - 订单服务（Order Service）
  - 能量服务（Energy Service）
  - TRX 资源池管理服务（Resource Pool Service）⭐
  - TRON 链交互服务（Tron Service）⭐
  - 自动租赁服务（Auto Rent Service）
  - TG 机器人架构
- ✅ **数据库设计（MySQL）**
  - 10+ 张核心表
  - 包含资源池状态表、委托记录表等
- ✅ **部署方案**
  - Docker Compose 配置
  - MySQL + Redis 容器化
  - 多服务编排

### 3. [API 文档](./API文档.md)

**主要内容**：

- ✅ 认证机制和签名算法
- ✅ 17+ 个 API 接口详细说明
- ✅ 请求/响应示例
- ✅ Webhook 回调规范
- ✅ 错误码列表
- ✅ 多语言 SDK 示例
  - JavaScript/Node.js
  - Python
  - Go

### 4. [业务流程说明](./业务流程说明.md) ⭐ NEW

**主要内容**：

- ✅ **自主质押模式详解**
  - 平台质押 TRX → 获取能量 → 委托给用户
  - 与第三方供应商模式对比
- ✅ **技术实现流程**
  - 完整的订单处理代码示例
  - TronWeb API 使用说明
  - freezeBalanceV2（质押）
  - delegateResource（委托）
  - 交易确认和错误处理
- ✅ **资源池管理策略**
  - TRX 储备管理
  - 能量计算公式
  - 自动回收机制
- ✅ **定价策略**
  - 成本计算模型
  - 时长折扣（1小时~7天）
  - 会员折扣（VIP1-3）
- ✅ **风险管理**
  - TRX 价格波动应对
  - 资源池耗尽预防
  - 链上操作失败处理
- ✅ **运营建议**
  - 初期储备：50,000-100,000 TRX
  - 扩展计划

---

## 🎯 两大核心功能

### 核心一：API 自动化 🤖

**目标用户**：开发者、企业客户  
**使用场景**：系统集成、批量操作、自动化流程

**核心接口**：

```bash
# 租赁能量
POST /api/v1/energy/rent

# 查询价格
GET /api/v1/energy/price

# 查询订单
GET /api/v1/orders/{order_id}

# 创建自动租赁规则
POST /api/v1/auto-rent/rules
```

**特色功能**：

- ✅ 签名验证保证安全
- ✅ Webhook 回调实时通知
- ✅ 多语言 SDK 支持
- ✅ 高性能（P99 < 500ms）

### 核心二：TG 机器人 💬

**目标用户**：个人用户、小团队  
**使用场景**：日常管理、快速操作、实时监控

**核心命令**：

```
/buy          - 购买能量（交互式流程）
/balance      - 查询钱包余额和能量
/price        - 查询 TRX 汇率和能量价格
/auto_rent    - 设置自动租赁规则
/monitor      - 添加监控地址
/daily        - 查看每日报告
```

**特色功能**：

- ✅ 零门槛使用（无需编程）
- ✅ 24/7 智能监控
- ✅ 自动触发购买
- ✅ 实时告警通知
- ✅ 中英双语支持

---

## 🏗️ 核心技术架构

```
┌──────────────────────────────────────────────────────┐
│                    用户层                             │
│  [API 客户端]  [TG 机器人]  [Web 管理后台]          │
└────────────┬─────────────────────────────────────────┘
             │ HTTPS
┌────────────┴─────────────────────────────────────────┐
│                   API Gateway                         │
│  (Nginx / 负载均衡 / 限流熔断)                       │
└────────────┬─────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────┐
│              业务服务层 (Node.js + TypeScript)        │
│  ┌─────────────────────────────────────────────┐    │
│  │ 订单服务 │ 资源池服务 │ 监控服务 │ 通知服务  │    │
│  └─────────────────────────────────────────────┘    │
└────────────┬─────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────┐
│              TronWeb 区块链交互层                     │
│  • freezeBalanceV2   (质押 TRX)                      │
│  • delegateResource  (委托能量)                      │
│  • getAccount        (查询账户)                      │
└────────────┬─────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────┐
│            数据存储层                                 │
│  [MySQL 8.0]  [Redis 7]  [消息队列]                 │
└──────────────────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────┐
│              TRON 区块链网络                          │
└──────────────────────────────────────────────────────┘
```

---

## 💼 业务模式亮点

### 自主质押模式 vs 第三方供应商

| 特性     | 我们（自主质押）    | 竞品（第三方供应商） |
| -------- | ------------------- | -------------------- |
| 资金控制 | ✅ 完全自主         | ❌ 依赖供应商        |
| 利润空间 | ✅ 更高（无中间商） | ❌ 较低（需分成）    |
| 响应速度 | ✅ 快（直接链上）   | ❌ 慢（API 调用）    |
| 稳定性   | ✅ 高（自主可控）   | ❌ 依赖供应商        |
| 初始投入 | ⚠️ 需要 TRX 储备    | ✅ 无需前期投入      |

### 业务流程

```
1. 平台质押 55 TRX
   ↓
2. 获得 65,000 能量
   ↓
3. 委托给用户（锁定 1 小时）
   ↓
4. 用户支付 5.8 TRX
   ↓
5. 平台利润：5.8 TRX（质押不消耗）
   ↓
6. 1 小时后自动回收能量
   ↓
7. TRX 解冻可再次使用
```

---

## 📊 数据库设计要点

### 核心表（MySQL）

1. **users** - 用户表
2. **orders** - 订单表
3. **resource_pool_status** - 资源池状态表 ⭐
4. **resource_delegations** - 委托记录表 ⭐
5. **auto_rent_rules** - 自动租赁规则表
6. **monitor_addresses** - 监控地址表
7. **deposits / withdrawals** - 充值/提现表
8. **notifications** - 通知记录表
9. **price_history** - 价格历史表
10. **operation_logs** - 操作日志表

### 关键设计

```sql
-- 资源池状态表（实时监控）
CREATE TABLE resource_pool_status (
  total_trx DECIMAL(20, 6),      -- 总 TRX
  frozen_trx DECIMAL(20, 6),     -- 已质押 TRX
  available_trx DECIMAL(20, 6),  -- 可用 TRX
  utilization_rate DECIMAL(5, 4) -- 利用率
);

-- 委托记录表（链上操作记录）
CREATE TABLE resource_delegations (
  trx_amount DECIMAL(20, 6),     -- 质押的 TRX 数量
  energy_amount BIGINT,          -- 委托的能量数量
  freeze_tx_hash VARCHAR(128),   -- 质押交易哈希
  delegate_tx_hash VARCHAR(128), -- 委托交易哈希
  expire_time DATETIME           -- 到期时间
);
```

---

## 🚀 开发路线图

### Phase 1: MVP 版本（4周）

**Week 1-2**：核心功能

- ✅ 基础架构（Node.js + MySQL + Redis）
- ✅ TronWeb 集成
- ✅ 资源池管理
- ✅ 订单系统
- ✅ 基础 API

**Week 3**：TG 机器人

- ✅ 基础命令（/start, /buy, /balance）
- ✅ 能量购买流程
- ✅ 钱包查询

**Week 4**：测试上线

- ✅ 功能测试
- ✅ 安全测试
- ✅ 小范围内测

### Phase 2: 增强版（4周）

- 自动租赁功能
- 钱包监控和告警
- 日报功能
- 管理后台

### Phase 3: 企业版（4周）

- API 批量操作
- 高级统计分析
- 多语言 SDK
- 白标方案

---

## ⚙️ 环境配置

### 必需环境变量

```bash
# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tron_energy
DB_USER=your_user
DB_PASSWORD=your_password

# TRON
TRON_FULL_HOST=https://api.trongrid.io
TRON_PRIVATE_KEY=your_private_key
TRON_HOT_WALLET_ADDRESS=TYourAddress

# Telegram
TG_BOT_TOKEN=your_bot_token

# 资源池
RESOURCE_POOL_MIN_TRX=50000
ENERGY_PER_TRX=1200
```

---

## 📈 关键指标 (KPI)

### 产品指标

- DAU > 500
- 日订单量 > 1000
- 订单成功率 > 99%
- API 调用量 > 5000/天

### 业务指标

- 月 GMV > 100,000 TRX
- 客单价 > 50 TRX
- 7日留存 > 20%

### 技术指标

- 系统可用性 > 99.9%
- API P99 延迟 < 500ms
- 订单处理时间 < 60s

---

## 🔧 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 3. 初始化数据库

```bash
npm run migrate
npm run seed
```

### 4. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm run build
npm start
```

### 5. 使用 Docker

```bash
docker-compose up -d
```

---

## 📞 联系方式

- **文档问题**：提交 Issue
- **技术支持**：Telegram @support
- **商务合作**：business@example.com

---

## 📝 更新日志

### v1.0 (2026-01-04)

- ✅ 初始版本
- ✅ 完成产品需求文档
- ✅ 完成技术设计方案
- ✅ 完成 API 文档
- ✅ 新增业务流程说明
- ✅ 技术栈更新为 MySQL
- ✅ 确定自主质押业务模式

---

**文档状态**: ✅ 已完成  
**下一步**: 开始 MVP 开发
