# TRON 能量租赁平台 - API 文档

**版本**: v1.0  
**Base URL**: `https://api.example.com`  
**日期**: 2026年1月4日

---

## 目录

1. [认证机制](#认证机制)
2. [通用说明](#通用说明)
3. [能量相关 API](#能量相关-api)
4. [订单相关 API](#订单相关-api)
5. [账户相关 API](#账户相关-api)
6. [自动租赁 API](#自动租赁-api)
7. [监控 API](#监控-api)
8. [Webhook 回调](#webhook-回调)
9. [错误码](#错误码)
10. [SDK 示例](#sdk-示例)

---

## 认证机制

### API Key 认证

所有 API 请求都需要在请求头中包含认证信息：

```http
X-API-KEY: your_api_key
X-TIMESTAMP: 1735996800000
X-SIGNATURE: calculated_signature
```

### 签名生成

**步骤**：

1. 构造签名字符串：`timestamp + method + path + body`
2. 使用 HMAC-SHA256 算法，用 API Secret 对签名字符串进行加密
3. 将结果转换为十六进制字符串

**示例代码（JavaScript）**：

```javascript
const crypto = require('crypto');

function generateSignature(apiSecret, timestamp, method, path, body = '') {
  const message = `${timestamp}${method}${path}${body}`;
  return crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('hex');
}

// 使用示例
const timestamp = Date.now();
const method = 'POST';
const path = '/api/v1/energy/rent';
const body = JSON.stringify({ 
  receiver_address: 'TYxxxxxxxxxxxxx', 
  energy_amount: 65000 
});

const signature = generateSignature(apiSecret, timestamp, method, path, body);
```

**注意事项**：
- 时间戳必须在 60 秒内有效，防止重放攻击
- POST/PUT 请求的 body 必须参与签名计算
- GET 请求的 body 为空字符串

---

## 通用说明

### 响应格式

所有 API 响应统一格式：

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1735996800
}
```

### HTTP 状态码

| 状态码 | 说明 |
|-------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 频率限制

| 用户等级 | 限制 |
|---------|------|
| 普通用户 | 100 次/分钟 |
| VIP 1 | 200 次/分钟 |
| VIP 2 | 500 次/分钟 |
| 企业用户 | 2000 次/分钟 |

超出限制将返回 `429 Too Many Requests`

---

## 能量相关 API

### 1. 租赁能量

租赁指定数量的能量到指定地址。

**接口地址**：`POST /api/v1/energy/rent`

**请求参数**：

```json
{
  "receiver_address": "TYxxxxxxxxxxxxx",
  "energy_amount": 65000,
  "duration_hours": 1,
  "callback_url": "https://your-domain.com/webhook",
  "auto_renew": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| receiver_address | string | 是 | 接收能量的地址 |
| energy_amount | number | 是 | 能量数量（最小 32000） |
| duration_hours | number | 是 | 租赁时长（小时）：1, 6, 12, 24, 72, 168 |
| callback_url | string | 否 | Webhook 回调地址 |
| auto_renew | boolean | 否 | 是否自动续租（默认 false） |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "order_id": "ORDER_20260104_123456",
    "energy_amount": 65000,
    "price": 5.2,
    "receiver_address": "TYxxxxxxxxxxxxx",
    "expire_time": "2026-01-04T15:30:00Z",
    "status": "pending",
    "created_at": "2026-01-04T14:30:00Z"
  },
  "timestamp": 1735996800
}
```

**cURL 示例**：

```bash
curl -X POST https://api.example.com/api/v1/energy/rent \
  -H "X-API-KEY: your_api_key" \
  -H "X-TIMESTAMP: 1735996800000" \
  -H "X-SIGNATURE: your_signature" \
  -H "Content-Type: application/json" \
  -d '{
    "receiver_address": "TYxxxxxxxxxxxxx",
    "energy_amount": 65000,
    "duration_hours": 1
  }'
```

---

### 2. 查询能量价格

查询租赁能量的价格。

**接口地址**：`GET /api/v1/energy/price`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| amount | number | 是 | 能量数量 |
| duration | number | 是 | 租赁时长（小时） |

**请求示例**：

```
GET /api/v1/energy/price?amount=65000&duration=1
```

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "energy_amount": 65000,
    "duration_hours": 1,
    "price": 5.2,
    "unit_price": 0.00008,
    "market_price": 5.5,
    "discount_rate": 0.95,
    "available": true
  },
  "timestamp": 1735996800
}
```

---

### 3. 查询地址能量

查询指定地址的能量和余额信息。

**接口地址**：`GET /api/v1/energy/balance`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| address | string | 是 | TRON 地址 |

**请求示例**：

```
GET /api/v1/energy/balance?address=TYxxxxxxxxxxxxx
```

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "address": "TYxxxxxxxxxxxxx",
    "energy_available": 150000,
    "energy_used": 32000,
    "energy_limit": 182000,
    "bandwidth_available": 5000,
    "trx_balance": 100.5
  },
  "timestamp": 1735996800
}
```

---

## 订单相关 API

### 4. 查询订单详情

根据订单 ID 查询订单详细信息。

**接口地址**：`GET /api/v1/orders/{order_id}`

**路径参数**：

| 参数 | 类型 | 说明 |
|-----|------|------|
| order_id | string | 订单ID |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "order_id": "ORDER_20260104_123456",
    "energy_amount": 65000,
    "receiver_address": "TYxxxxxxxxxxxxx",
    "price": 5.2,
    "status": "completed",
    "transaction_hash": "abc123...",
    "create_time": "2026-01-04T14:30:00Z",
    "complete_time": "2026-01-04T14:30:35Z",
    "expire_time": "2026-01-04T15:30:00Z"
  },
  "timestamp": 1735996800
}
```

**订单状态说明**：

| 状态 | 说明 |
|-----|------|
| pending | 待处理 |
| processing | 处理中 |
| completed | 已完成 |
| failed | 失败 |
| refunded | 已退款 |

---

### 5. 查询订单列表

查询用户的订单列表，支持分页和筛选。

**接口地址**：`GET /api/v1/orders`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| page | number | 否 | 页码（默认 1） |
| page_size | number | 否 | 每页数量（默认 20，最大 100） |
| status | string | 否 | 订单状态筛选 |
| start_time | string | 否 | 开始时间（ISO 8601） |
| end_time | string | 否 | 结束时间（ISO 8601） |

**请求示例**：

```
GET /api/v1/orders?page=1&page_size=20&status=completed
```

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 328,
    "page": 1,
    "page_size": 20,
    "orders": [
      {
        "order_id": "ORDER_20260104_123456",
        "energy_amount": 65000,
        "receiver_address": "TYxxxxxxxxxxxxx",
        "price": 5.2,
        "status": "completed",
        "create_time": "2026-01-04T14:30:00Z",
        "expire_time": "2026-01-04T15:30:00Z"
      }
      // ... 更多订单
    ]
  },
  "timestamp": 1735996800
}
```

---

### 6. 取消订单

取消未处理的订单（仅限 pending 状态）。

**接口地址**：`POST /api/v1/orders/{order_id}/cancel`

**路径参数**：

| 参数 | 类型 | 说明 |
|-----|------|------|
| order_id | string | 订单ID |

**响应示例**：

```json
{
  "code": 200,
  "message": "订单已取消",
  "data": {
    "order_id": "ORDER_20260104_123456",
    "status": "refunded",
    "refund_amount": 5.2
  },
  "timestamp": 1735996800
}
```

---

## 账户相关 API

### 7. 查询账户余额

查询当前 API Key 关联账户的余额信息。

**接口地址**：`GET /api/v1/account/balance`

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "user_id": "user_123",
    "balance": 1000.5,
    "frozen_balance": 50.0,
    "available_balance": 950.5,
    "total_spent": 5000.0,
    "total_orders": 328
  },
  "timestamp": 1735996800
}
```

---

### 8. 查询账户信息

查询账户的详细信息。

**接口地址**：`GET /api/v1/account/profile`

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "user_id": "user_123",
    "username": "user_example",
    "member_level": "vip1",
    "api_key": "your_api_key",
    "api_enabled": true,
    "created_at": "2025-12-01T00:00:00Z",
    "last_active_at": "2026-01-04T14:30:00Z"
  },
  "timestamp": 1735996800
}
```

---

### 9. 生成新的 API Key

生成新的 API Key 和 Secret（旧的将被禁用）。

**接口地址**：`POST /api/v1/account/api-key`

**请求参数**：

```json
{
  "name": "My API Key",
  "permissions": ["read", "write"],
  "ip_whitelist": ["123.45.67.89", "192.168.1.1"]
}
```

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| name | string | 否 | API Key 名称 |
| permissions | array | 否 | 权限列表 |
| ip_whitelist | array | 否 | IP 白名单 |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "api_key": "new_api_key_xxxxx",
    "api_secret": "new_api_secret_xxxxx",
    "created_at": "2026-01-04T14:30:00Z"
  },
  "timestamp": 1735996800
}
```

⚠️ **重要**：API Secret 仅在生成时返回一次，请妥善保管！

---

## 自动租赁 API

### 10. 创建自动租赁规则

创建新的自动租赁规则。

**接口地址**：`POST /api/v1/auto-rent/rules`

**请求参数**：

```json
{
  "address": "TYxxxxxxxxxxxxx",
  "alias": "My Wallet",
  "trigger_energy_threshold": 32000,
  "rent_amount": 65000,
  "rent_duration_hours": 1
}
```

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| address | string | 是 | 监控地址 |
| alias | string | 否 | 地址别名 |
| trigger_energy_threshold | number | 是 | 触发阈值（能量低于此值时触发） |
| rent_amount | number | 是 | 租赁数量 |
| rent_duration_hours | number | 是 | 租赁时长 |

**响应示例**：

```json
{
  "code": 200,
  "message": "规则创建成功",
  "data": {
    "rule_id": 123,
    "address": "TYxxxxxxxxxxxxx",
    "alias": "My Wallet",
    "trigger_energy_threshold": 32000,
    "rent_amount": 65000,
    "rent_duration_hours": 1,
    "enabled": true,
    "created_at": "2026-01-04T14:30:00Z"
  },
  "timestamp": 1735996800
}
```

---

### 11. 查询自动租赁规则列表

查询所有自动租赁规则。

**接口地址**：`GET /api/v1/auto-rent/rules`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| enabled | boolean | 否 | 筛选启用/禁用的规则 |

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 3,
    "rules": [
      {
        "rule_id": 123,
        "address": "TYxxxxxxxxxxxxx",
        "alias": "My Wallet",
        "trigger_energy_threshold": 32000,
        "rent_amount": 65000,
        "rent_duration_hours": 1,
        "enabled": true,
        "trigger_count": 15,
        "last_trigger_at": "2026-01-04T10:00:00Z",
        "created_at": "2026-01-03T00:00:00Z"
      }
      // ... 更多规则
    ]
  },
  "timestamp": 1735996800
}
```

---

### 12. 更新自动租赁规则

更新已有的自动租赁规则。

**接口地址**：`PUT /api/v1/auto-rent/rules/{rule_id}`

**请求参数**：

```json
{
  "trigger_energy_threshold": 50000,
  "rent_amount": 130000,
  "rent_duration_hours": 6
}
```

**响应示例**：

```json
{
  "code": 200,
  "message": "规则更新成功",
  "data": {
    "rule_id": 123,
    "address": "TYxxxxxxxxxxxxx",
    "trigger_energy_threshold": 50000,
    "rent_amount": 130000,
    "rent_duration_hours": 6,
    "updated_at": "2026-01-04T14:30:00Z"
  },
  "timestamp": 1735996800
}
```

---

### 13. 删除自动租赁规则

删除指定的自动租赁规则。

**接口地址**：`DELETE /api/v1/auto-rent/rules/{rule_id}`

**响应示例**：

```json
{
  "code": 200,
  "message": "规则已删除",
  "timestamp": 1735996800
}
```

---

### 14. 启用/禁用自动租赁规则

切换规则的启用状态。

**接口地址**：`POST /api/v1/auto-rent/rules/{rule_id}/toggle`

**请求参数**：

```json
{
  "enabled": false
}
```

**响应示例**：

```json
{
  "code": 200,
  "message": "规则已禁用",
  "data": {
    "rule_id": 123,
    "enabled": false
  },
  "timestamp": 1735996800
}
```

---

## 监控 API

### 15. 添加监控地址

添加新的监控地址。

**接口地址**：`POST /api/v1/monitor/addresses`

**请求参数**：

```json
{
  "address": "TYxxxxxxxxxxxxx",
  "alias": "My Business Wallet",
  "monitor_balance": true,
  "monitor_energy": true,
  "monitor_transfers": true,
  "alert_transfer_amount": 100,
  "alert_energy_threshold": 10000
}
```

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| address | string | 是 | 监控地址 |
| alias | string | 否 | 地址别名 |
| monitor_balance | boolean | 否 | 是否监控余额变化 |
| monitor_energy | boolean | 否 | 是否监控能量 |
| monitor_transfers | boolean | 否 | 是否监控转账 |
| alert_transfer_amount | number | 否 | 转账告警阈值（TRX） |
| alert_energy_threshold | number | 否 | 能量告警阈值 |

**响应示例**：

```json
{
  "code": 200,
  "message": "监控地址已添加",
  "data": {
    "monitor_id": 456,
    "address": "TYxxxxxxxxxxxxx",
    "alias": "My Business Wallet",
    "enabled": true,
    "created_at": "2026-01-04T14:30:00Z"
  },
  "timestamp": 1735996800
}
```

---

### 16. 查询监控地址列表

查询所有监控地址。

**接口地址**：`GET /api/v1/monitor/addresses`

**响应示例**：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 3,
    "addresses": [
      {
        "monitor_id": 456,
        "address": "TYxxxxxxxxxxxxx",
        "alias": "My Business Wallet",
        "monitor_balance": true,
        "monitor_energy": true,
        "enabled": true,
        "created_at": "2026-01-04T14:30:00Z"
      }
      // ... 更多地址
    ]
  },
  "timestamp": 1735996800
}
```

---

### 17. 删除监控地址

删除指定的监控地址。

**接口地址**：`DELETE /api/v1/monitor/addresses/{monitor_id}`

**响应示例**：

```json
{
  "code": 200,
  "message": "监控已删除",
  "timestamp": 1735996800
}
```

---

## Webhook 回调

### 回调说明

当订单状态变更或触发告警时，系统会向您配置的 `callback_url` 发送 POST 请求。

**回调格式**：

```json
{
  "event_type": "order.completed",
  "timestamp": 1735996800,
  "data": {
    "order_id": "ORDER_20260104_123456",
    "status": "completed",
    "energy_amount": 65000,
    "transaction_hash": "abc123..."
  },
  "signature": "hmac_sha256_signature"
}
```

### 事件类型

| 事件类型 | 说明 |
|---------|------|
| order.completed | 订单完成 |
| order.failed | 订单失败 |
| auto_rent.triggered | 自动租赁触发 |
| auto_rent.failed | 自动租赁失败 |
| energy.low | 能量不足告警 |
| balance.low | 余额不足告警 |

### 签名验证

回调请求包含签名，用于验证请求来源：

```javascript
function verifyWebhookSignature(payload, signature, secret) {
  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === calculatedSignature;
}
```

---

## 错误码

### 业务错误码

| 错误码 | 说明 |
|-------|------|
| 1001 | 余额不足 |
| 1002 | 地址无效 |
| 1003 | 能量数量不符合要求 |
| 1004 | 订单不存在 |
| 1005 | 供应商服务异常 |
| 1006 | 订单状态不允许该操作 |
| 1007 | 规则已存在 |
| 1008 | 达到规则数量上限 |
| 1009 | 监控地址已存在 |
| 1010 | API Key 无效 |
| 1011 | 签名验证失败 |
| 1012 | 时间戳过期 |
| 1013 | IP 不在白名单 |

### 错误响应示例

```json
{
  "code": 1001,
  "message": "余额不足，当前余额: 3.5 TRX，需要: 5.2 TRX",
  "timestamp": 1735996800
}
```

---

## SDK 示例

### Node.js SDK

**安装**：

```bash
npm install @tron-energy/sdk
```

**使用示例**：

```javascript
const TronEnergyClient = require('@tron-energy/sdk');

const client = new TronEnergyClient({
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret',
  baseUrl: 'https://api.example.com'
});

// 租赁能量
async function rentEnergy() {
  try {
    const order = await client.energy.rent({
      receiverAddress: 'TYxxxxxxxxxxxxx',
      energyAmount: 65000,
      durationHours: 1
    });
    
    console.log('订单创建成功:', order);
    
    // 查询订单状态
    const orderInfo = await client.orders.get(order.order_id);
    console.log('订单状态:', orderInfo.status);
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

// 查询价格
async function getPrice() {
  const price = await client.energy.getPrice({
    amount: 65000,
    duration: 1
  });
  
  console.log('价格:', price.price, 'TRX');
}

// 创建自动租赁规则
async function createAutoRentRule() {
  const rule = await client.autoRent.createRule({
    address: 'TYxxxxxxxxxxxxx',
    triggerEnergyThreshold: 32000,
    rentAmount: 65000,
    rentDurationHours: 1
  });
  
  console.log('规则创建成功:', rule);
}

rentEnergy();
```

---

### Python SDK

**安装**：

```bash
pip install tron-energy-sdk
```

**使用示例**：

```python
from tron_energy import TronEnergyClient

client = TronEnergyClient(
    api_key='your_api_key',
    api_secret='your_api_secret',
    base_url='https://api.example.com'
)

# 租赁能量
order = client.energy.rent(
    receiver_address='TYxxxxxxxxxxxxx',
    energy_amount=65000,
    duration_hours=1
)

print(f"订单ID: {order['order_id']}")
print(f"价格: {order['price']} TRX")

# 查询订单
order_info = client.orders.get(order['order_id'])
print(f"订单状态: {order_info['status']}")

# 查询价格
price = client.energy.get_price(amount=65000, duration=1)
print(f"价格: {price['price']} TRX")

# 创建自动租赁规则
rule = client.auto_rent.create_rule(
    address='TYxxxxxxxxxxxxx',
    trigger_energy_threshold=32000,
    rent_amount=65000,
    rent_duration_hours=1
)

print(f"规则ID: {rule['rule_id']}")
```

---

### Go SDK

**安装**：

```bash
go get github.com/tron-energy/go-sdk
```

**使用示例**：

```go
package main

import (
    "fmt"
    "log"
    
    tron "github.com/tron-energy/go-sdk"
)

func main() {
    client := tron.NewClient(tron.Config{
        APIKey:    "your_api_key",
        APISecret: "your_api_secret",
        BaseURL:   "https://api.example.com",
    })
    
    // 租赁能量
    order, err := client.Energy.Rent(&tron.RentParams{
        ReceiverAddress: "TYxxxxxxxxxxxxx",
        EnergyAmount:    65000,
        DurationHours:   1,
    })
    
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("订单ID: %s\n", order.OrderID)
    fmt.Printf("价格: %.2f TRX\n", order.Price)
    
    // 查询价格
    price, err := client.Energy.GetPrice(65000, 1)
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("价格: %.2f TRX\n", price.Price)
}
```

---

## 联系我们

- **官方网站**: https://example.com
- **Telegram**: @tron_energy_support
- **Email**: support@example.com
- **文档更新**: https://docs.example.com

---

**最后更新**: 2026年1月4日
