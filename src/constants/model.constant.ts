/**
 * 通用状态枚举
 */
export enum Status {
  Disable = 0,
  Enabled = 1,
}

/**
 * 系统钱包类型
 */
export enum SysWalletType {
  Fee = 1, // 手续费钱包（用于支付gas/能量）
  Widthdraw = 2, // 提现钱包（用于用户提现）
  Energy = 3, // 能量钱包（用于能量充值）
}

// ============= 钱包相关 =============

/**
 * 中心化钱包状态
 */
export enum WalletStatus {
  DISABLED = 0, // 禁用
  ACTIVE = 1, // 正常
  FROZEN = 2, // 冻结
}

/**
 * 钱包变动类型
 */
export enum WalletLogType {
  DEPOSIT = 1, // 充值
  WITHDRAWAL = 2, // 提现
  TRANSFER_OUT = 3, // 转账出
  TRANSFER_IN = 4, // 转账入
  TRADE_BUY = 5, // 交易买入
  TRADE_SELL = 6, // 交易卖出
  FEE = 7, // 手续费
  REWARD = 8, // 奖励
  ADMIN_ADJUSTMENT = 9, // 管理员调整
  FREEZE = 10, // 冻结
  UNFREEZE = 11, // 解冻
  SWAP_OUT = 12, // 闪兑支出
  SWAP_IN = 13, // 闪兑收入
  ENERGY_RENT = 14, // 能量租赁
  ENERGY_RECLAIM = 15, // 能量回收
}

// ============= 交易相关 =============

/**
 * 交易类型
 */
export enum TransactionType {
  DEPOSIT = 0, // 充值
  WITHDRAWAL = 1, // 提现
  TRANSFER = 2, // 转账
  SETTLEMENT = 3, // 结算
}

/**
 * 交易状态
 */
export enum TransactionStatus {
  PENDING = 0, // 待处理
  CONFIRMED = 1, // 已确认
  COLLECTED = 2, // 已归集
  FAILED = 3, // 失败
}

// ============= 订单相关 =============

/**
 * 充值订单状态
 */
export enum DepositStatus {
  PENDING = 0, // 待确认
  SETTLED = 1, // 已结算
  FAILED = 2, // 交易失败
}

/**
 * 提现订单状态
 */
export enum WithdrawalStatus {
  PENDING = 0, // 等待审核
  APPROVED = 1, // 已审核通过
  PROCESSING = 2, // 正在广播交易
  CONFIRMED = 3, // 链上已确认
  SETTLED = 4, // 已结算（最终状态）
  CANCELLED = 5, // 已取消
  FAILED = 6, // 失败（链上被拒）
}

/**
 * 转账订单状态
 */
export enum TransferStatus {
  PENDING = 0, // 待处理
  SUCCESS = 1, // 转账成功
  FAILED = 2, // 转账失败
}

/**
 * 委托订单状态
 */
export enum DelegateStatus {
  Pending = 0, // 待处理
  Success = 1, // 成功
  Reclaimed = 2, // 已回收
  Failed = 3, // 回收失败
}
