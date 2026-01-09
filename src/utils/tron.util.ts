import { TronWeb, Types } from 'tronweb';

export interface TronAddressInfo {
  address: string;
  publicKey: string;
  privateKey: string;
  hexAddress: string;
}

export interface TronResource {
  energy: number;
  bandwidth: number;
  totalEnergy: number;
  totalBandwidth: number;
}

export interface GasInfo {
  gas: bigint;
  bandwidthShortage: number;
  energyShortage: number;
}

/**
 * TRON 链操作工具类 - 基于 TronWeb 6.x
 */
export class TronUtil {
  private tronWeb: TronWeb;

  // TRON 资源消耗常量(固定值)
  private readonly TRX_BANDWIDTH = 270; // TRX 转账固定消耗
  private readonly TRC20_BANDWIDTH = 360; // TRC20 转账固定消耗
  private readonly TRC20_ENERGY = 65000; // TRC20 转账典型能量消耗(USDT等标准合约)

  constructor(nodeUrl: string, privateKey?: string) {
    this.tronWeb = new TronWeb({
      fullHost: nodeUrl,
      privateKey: privateKey,
    });
  }

  /**
   * 生成 TRON 地址 (静态方法)
   */
  static async generate(): Promise<TronAddressInfo> {
    const account = await TronWeb.createAccount();

    return {
      address: account.address.base58,
      publicKey: account.publicKey,
      privateKey: account.privateKey,
      hexAddress: account.address.hex,
    };
  }

  /**
   * 验证 TRON 地址格式
   */
  static validateAddress(address: string): boolean {
    try {
      return TronWeb.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查地址是否激活
   */
  async checkAddressActivated(address: string): Promise<boolean> {
    try {
      const account = await this.tronWeb.trx.getAccount(address);
      // 检查账户是否存在且有余额或资源
      return !!account && (account.balance > 0 || account.create_time > 0);
    } catch (error) {
      // 地址不存在视为未激活
      return false;
    }
  }

  /**
   * 验证私钥格式
   */
  static validatePrivateKey(privateKey: string): boolean {
    try {
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      return /^[a-fA-F0-9]{64}$/.test(cleanKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * 将十六进制地址转换为 TRON 地址格式
   */
  static hexToAddress(hexAddress: string): string {
    return TronWeb.address.fromHex(hexAddress);
  }

  async getContract(contract: string): Promise<Types.ContractInstance<Types.ContractAbiInterface>> {
    return await this.tronWeb.contract().at(contract);
  }

  /**
   * 获取地址余额
   */
  async getTRXBalance(address: string): Promise<number> {
    return await this.tronWeb.trx.getBalance(address);
  }

  async getTRC20Balance(address: string, contract: string): Promise<number> {
    const contractInstance = await this.getContract(contract);
    return await contractInstance.balanceOf(address).call({ from: address });
  }

  /**
   * 获取交易信息
   */
  async getTransaction(txHash: string): Promise<Types.GetTransactionResponse | null> {
    return await this.tronWeb.trx.getTransaction(txHash);
  }

  /**
   * 获取交易详细信息（包含费用等信息）
   */
  async getTransactionInfo(txHash: string): Promise<Types.TransactionInfo> {
    return await this.tronWeb.trx.getTransactionInfo(txHash);
  }

  /**
   * 检查交易是否成功
   * @param txHash 交易哈希
   * @returns 返回交易状态信息
   */
  async isTransactionSuccess(txHash: string): Promise<boolean> {
    try {
      // 获取交易信息
      const transaction = await this.getTransaction(txHash);
      if (!transaction || !transaction.txID) {
        return false;
      }

      // 检查 ret 数组中的 contractRet 状态
      const contractRet = transaction.ret?.[0]?.contractRet;
      return contractRet === 'SUCCESS';
    } catch (error) {
      return false;
    }
  }

  /**
   * 发送 TRX 交易
   */
  async sendTrx(to: string, amount: number): Promise<string> {
    try {
      const fromAddress = this.getFromAddress();
      if (!fromAddress) {
        throw new Error('Failed to derive address from private key');
      }

      // 构建交易
      const transaction = await this.tronWeb.transactionBuilder.sendTrx(to, amount, fromAddress);

      // 签名交易
      const signedTx = await this.tronWeb.trx.sign(transaction);

      // 广播交易
      const broadcast = await this.tronWeb.trx.sendRawTransaction(signedTx);
      if (!broadcast.result) {
        throw new Error(`Transaction failed: ${TronUtil.parseMessage(broadcast.message)}`);
      }

      return broadcast.txid;
    } catch (error) {
      throw new Error(`Failed to send TRX: ${error.message}`);
    }
  }

  async sendTrc20(to: string, amount: number, contract: string): Promise<string> {
    const fromAddress = this.getFromAddress();
    if (!fromAddress) {
      throw new Error('Failed to derive address from private key');
    }

    const contractInstance = await this.getContract(contract);
    return await contractInstance.transfer(to, amount).send({
      from: fromAddress,
    });
  }

  /**
   * 委托能量或带宽
   */
  async delegateResource(
    receiverAddress: string,
    amount: number,
    resource: 'ENERGY' | 'BANDWIDTH' = 'ENERGY',
    lock: boolean = false,
  ) {
    const fromAddress = this.getFromAddress();
    if (!fromAddress) {
      throw new Error('Failed to derive address from private key');
    }
    const tx = await this.tronWeb.transactionBuilder.delegateResource(
      amount,
      receiverAddress,
      resource,
      fromAddress,
      lock,
    );

    const signedTx = await this.tronWeb.trx.sign(tx);
    return await this.tronWeb.trx.sendRawTransaction(signedTx);
  }

  /**
   * 取消能量委托
   * 用于到期后回收能量
   */
  async undelegateResource(
    receiverAddress: string,
    amount: number,
    resource: 'ENERGY' | 'BANDWIDTH' = 'ENERGY',
  ) {
    const fromAddress = this.getFromAddress();
    if (!fromAddress) {
      throw new Error('Failed to derive address from private key');
    }

    const tx = await this.tronWeb.transactionBuilder.undelegateResource(
      amount,
      receiverAddress,
      resource,
      fromAddress,
    );

    const signedTx = await this.tronWeb.trx.sign(tx);
    return await this.tronWeb.trx.sendRawTransaction(signedTx);
  }

  /**
   * 使用指定权限委托能量或带宽（支持多签场景）
   * 适用场景：当前账户被 owner 授权，可以操作 owner 的资源
   *
   * @param ownerAddress 资源所有者地址（被授权的账户）
   * @param receiverAddress 接收资源的目标地址
   * @param amount 委托的资源数量（单位：SUN）
   * @param resource 资源类型（ENERGY 或 BANDWIDTH）
   * @param lock 是否锁定委托
   * @param permissionId 使用的权限ID，默认为2（active权限）
   * @returns 交易结果
   */
  async delegateResourceWithPermission(
    ownerAddress: string,
    receiverAddress: string,
    amount: number,
    resource: 'ENERGY' | 'BANDWIDTH' = 'ENERGY',
    lock: boolean = false,
    permissionId: number = 2,
  ) {
    // 创建交易时指定 ownerAddress
    const tx = await this.tronWeb.transactionBuilder.delegateResource(
      amount,
      receiverAddress,
      resource,
      ownerAddress,
      lock,
    );

    // 设置交易的 permissionId
    (tx.raw_data as any).Permission_id = permissionId;

    // 使用 multiSign 进行签名（即使只有一个签名者）
    // 注意：multiSign 的第二个参数必须传入 privateKey，第三个参数是 permissionId
    const signedTx = await this.tronWeb.trx.multiSign(
      tx,
      this.tronWeb.defaultPrivateKey,
      permissionId,
    );

    return await this.tronWeb.trx.sendRawTransaction(signedTx);
  }

  /**
   * 使用指定权限取消能量委托（支持多签场景）
   * 适用场景：当前账户被 owner 授权，可以操作 owner 的资源
   *
   * @param ownerAddress 资源所有者地址（被授权的账户）
   * @param receiverAddress 接收资源的目标地址
   * @param amount 要回收的资源数量（单位：SUN）
   * @param resource 资源类型（ENERGY 或 BANDWIDTH）
   * @param permissionId 使用的权限ID，默认为2（active权限）
   * @returns 交易结果
   */
  async undelegateResourceWithPermission(
    ownerAddress: string,
    receiverAddress: string,
    amount: number,
    resource: 'ENERGY' | 'BANDWIDTH' = 'ENERGY',
    permissionId: number = 2,
  ) {
    // 创建交易时指定 ownerAddress
    const tx = await this.tronWeb.transactionBuilder.undelegateResource(
      amount,
      receiverAddress,
      resource,
      ownerAddress,
    );

    // 设置交易的 permissionId
    (tx.raw_data as any).Permission_id = permissionId;

    // 使用 multiSign 进行签名（即使只有一个签名者）
    // 注意：multiSign 的第二个参数必须传入 privateKey，第三个参数是 permissionId
    const signedTx = await this.tronWeb.trx.multiSign(
      tx,
      this.tronWeb.defaultPrivateKey,
      permissionId,
    );

    return await this.tronWeb.trx.sendRawTransaction(signedTx);
  }

  /**
   * 查询委托给指定地址的资源数量
   * @param toAddress 接收资源的目标地址
   * @param resource 资源类型（ENERGY 或 BANDWIDTH）
   * @param fromAddress 委托方地址（可选，默认使用当前实例地址）
   * @returns 委托的资源数量（单位：SUN），如果没有委托则返回 0
   */
  async getDelegatedAmount(
    toAddress: string,
    resource: 'ENERGY' | 'BANDWIDTH' = 'ENERGY',
    fromAddress?: string,
  ): Promise<number> {
    const ownerAddress = fromAddress || this.getFromAddress();
    if (!ownerAddress) {
      return 0;
    }

    try {
      // 使用 getDelegatedResourceV2 查询委托信息
      const delegatedInfo = await this.tronWeb.trx.getDelegatedResourceV2(ownerAddress, toAddress);
      if (!delegatedInfo || !delegatedInfo.delegatedResource) {
        return 0;
      }

      const delegatedResources = delegatedInfo.delegatedResource;

      // 处理数组或对象两种情况（兼容不同版本的 TronWeb）
      const resources = Array.isArray(delegatedResources)
        ? delegatedResources
        : [delegatedResources];

      for (const item of resources) {
        if (resource === 'ENERGY' && item.frozen_balance_for_energy) {
          return item.frozen_balance_for_energy;
        } else if (resource === 'BANDWIDTH' && item.frozen_balance_for_bandwidth) {
          return item.frozen_balance_for_bandwidth;
        }
      }

      return 0;
    } catch (error) {
      // 查询失败或没有委托记录时返回 0
      return 0;
    }
  }

  /**
   * 查询指定地址的质押 TRX 数量
   * @param address 质押 TRX 的地址
   * @returns 质押的 TRX 数量（单位：SUN）
   */
  async getStakedAmount(address?: string): Promise<number> {
    const ownerAddress = address || this.getFromAddress();
    if (!ownerAddress) {
      return 0;
    }
    // 获取账户信息，查找质押的 TRX
    const account = await this.tronWeb.trx.getAccount(ownerAddress);

    // 从 account_resource 中获取质押的 TRX（Stake 2.0）
    // frozenV2 是 Stake 2.0 的质押信息
    let stakedTrxForEnergy = 0;

    if (account.frozenV2) {
      // Stake 2.0: 遍历 frozenV2 数组找到 ENERGY 类型的质押
      for (const frozen of account.frozenV2) {
        if (frozen.type === 'ENERGY') {
          stakedTrxForEnergy += frozen.amount || 0;
        }
      }
    }

    // 如果使用旧版 Stake 1.0（已废弃，但仍需兼容）
    if (stakedTrxForEnergy === 0 && account.account_resource?.frozen_balance_for_energy) {
      stakedTrxForEnergy = account.account_resource.frozen_balance_for_energy.frozen_balance || 0;
    }

    return stakedTrxForEnergy;
  }

  getFromAddress(): string | false {
    return this.tronWeb.defaultAddress.base58;
  }

  /**
   * 获取最新区块号
   */
  async getLatestBlockNumber(): Promise<number> {
    const block = await this.tronWeb.trx.getCurrentBlock();
    return block.block_header?.raw_data?.number || 0;
  }

  /**
   * 获取区块信息
   */
  async getBlock(blockNumber: number): Promise<Types.Block> {
    return await this.tronWeb.trx.getBlock(blockNumber);
  }

  /**
   * 转换单位：TRX 到 SUN
   */
  static toSun(trx: number | string): string {
    const result = TronWeb.toSun(Number(trx));
    return typeof result === 'string' ? result : String(result);
  }

  /**
   * 转换单位：SUN 到 TRX
   */
  static fromSun(sun: number | string | bigint): string {
    const result = TronWeb.fromSun(Number(sun));
    return typeof result === 'string' ? result : String(result);
  }

  /**
   * 获取 TronWeb 实例（用于高级操作）
   */
  getTronWeb(): TronWeb {
    return this.tronWeb;
  }

  /**
   * 设置私钥
   */
  setPrivateKey(privateKey: string): void {
    this.tronWeb.setPrivateKey(privateKey);
  }

  /**
   * 设置地址
   */
  setAddress(address: string): void {
    this.tronWeb.setAddress(address);
  }

  async calculateTrxTransFee(address: string, toAddress: string, amount: number): Promise<bigint> {
    const gasInfo = await this.calculateTrxFee(address, this.TRX_BANDWIDTH, 0);
    return gasInfo.gas;
  }

  async calculateTrc20TransFee(
    address: string,
    contractAddress: string,
    toAddress: string,
    amount: number,
  ): Promise<GasInfo> {
    const { bandwidth, energy } = await this.estimateTrc20Transaction(
      address,
      contractAddress,
      toAddress,
      amount,
    );

    return await this.calculateTrxFee(address, bandwidth, energy);
  }

  /**
   * 获取账户剩余资源
   */
  async getAccountResource(targetAddress?: string): Promise<TronResource> {
    const address = targetAddress || this.getFromAddress();
    if (!address) {
      throw new Error('Failed to derive address from private key');
    }
    // 获取账户资源信息
    const accountResources = await this.tronWeb.trx.getAccountResources(address);

    // 计算带宽费用
    const energyLimit = accountResources.EnergyLimit || 0;
    const energyUsed = accountResources.EnergyUsed || 0;

    // 计算带宽费用
    const freeNetLimit = accountResources.freeNetLimit || 0;
    const netLimit = accountResources.NetLimit || 0;
    const freeNetUsed = accountResources.freeNetUsed || 0;
    return {
      energy: energyLimit - energyUsed,
      totalEnergy: energyLimit,
      bandwidth: freeNetLimit + netLimit - freeNetUsed,
      totalBandwidth: freeNetLimit,
    };
  }

  /**
   * 计算交易所需的手续费
   * @param address 转账地址
   * @param bandwidth 所需带宽
   * @param energy 所需能量
   * @returns 实际需要燃烧的 TRX（单位：SUN）
   */
  private async calculateTrxFee(
    address: string,
    bandwidth: number,
    energy: number,
  ): Promise<GasInfo> {
    // 获取账户资源信息
    const accountResources = await this.getAccountResource(address);

    const bandwidthShortage = accountResources.bandwidth < bandwidth ? bandwidth : 0;

    const energyShortage = accountResources.energy < energy ? energy - accountResources.energy : 0;

    // 动态获取资源价格
    const { bandwidthPrice, energyPrice } = await this.getResourcePrices();

    // 计算总费用
    const bandwidthFee = BigInt(bandwidthShortage) * bandwidthPrice;
    const energyFee = BigInt(energyShortage) * energyPrice;

    return {
      gas: bandwidthFee + energyFee,
      energyShortage,
      bandwidthShortage,
    };
  }

  /**
   * 完整估算 TRC20 转账的带宽和能量消耗
   * @param fromAddress 转账发起地址
   * @param contractAddress TRC20 合约地址
   * @param toAddress 接收地址
   * @param amount 转账数量
   * @returns 带宽和能量的预估值
   */
  async estimateTrc20Transaction(
    fromAddress: string,
    contractAddress: string,
    toAddress: string,
    amount: number,
  ): Promise<{ bandwidth: number; energy: number }> {
    // 使用 triggerSmartContract 模拟执行
    const parameter = [
      { type: 'address', value: toAddress },
      { type: 'uint256', value: amount },
    ];

    const transaction = await this.tronWeb.transactionBuilder.triggerSmartContract(
      contractAddress,
      'transfer(address,uint256)',
      { feeLimit: 100_000_000 },
      parameter,
      fromAddress,
    );

    // 估算带宽:根据交易大小
    const bandwidth = transaction?.transaction
      ? JSON.stringify(transaction.transaction).length
      : this.TRC20_BANDWIDTH;

    // 估算能量:从返回结果中获取
    const energy = transaction?.energy_used || this.TRC20_ENERGY;

    return { bandwidth, energy };
  }

  /**
   * 获取链上资源价格
   */
  private async getResourcePrices(): Promise<{
    energyPrice: bigint;
    bandwidthPrice: bigint;
  }> {
    try {
      const chainParameters = await this.tronWeb.trx.getChainParameters();

      // 从链参数中获取 energy 和 bandwidth 的价格
      // getEnergyFee: 每个 energy 的价格（单位：SUN）
      // getTransactionFee: 每个 bandwidth 的价格（单位：SUN）
      const energyFeeParam = chainParameters.find((p: any) => p.key === 'getEnergyFee');
      const bandwidthFeeParam = chainParameters.find((p: any) => p.key === 'getTransactionFee');

      const energyPrice = energyFeeParam ? BigInt(energyFeeParam.value) : 100n; // 默认 100 SUN
      const bandwidthPrice = bandwidthFeeParam ? BigInt(bandwidthFeeParam.value) : 1000n; // 默认 1000 SUN

      return { energyPrice, bandwidthPrice };
    } catch (error) {
      return { energyPrice: 100n, bandwidthPrice: 1000n };
    }
  }

  /**
   * 解析 TRON 返回的错误消息
   * 将十六进制格式的错误信息解码为可读文本
   * @param message 错误消息（可能是十六进制格式）
   * @returns 解码后的错误消息
   */
  static parseMessage(message: string): string {
    if (!message) {
      return '未知错误';
    }

    try {
      // 检查是否为十六进制字符串（只包含 0-9 和 a-f）
      if (/^[0-9a-fA-F]+$/.test(message) && message.length % 2 === 0) {
        // 将十六进制转换为 Buffer
        const buffer = Buffer.from(message, 'hex');
        // 解码为 UTF-8 字符串
        const decoded = buffer.toString('utf8');

        // 检查解码结果是否包含可打印字符
        if (/[\x20-\x7E]/.test(decoded)) {
          return decoded;
        }
      }

      // 如果不是十六进制或解码失败，返回原始消息
      return message;
    } catch (error) {
      // 解析失败时返回原始消息
      return message;
    }
  }

  /**
   * 将能量数量转换为需要委托的 TRX 数量（单位：SUN）
   *
   * 原理：
   * 1. 查询账户已质押的 TRX 数量
   * 2. 查询账户的总能量（EnergyLimit）
   * 3. 计算比例：委托TRX = (委托能量 / 总能量) × 质押TRX
   *
   * @param energyAmount 要委托的能量数量
   * @param fromAddress 委托方地址（可选，默认使用当前实例地址）
   * @returns 需要委托的 TRX 数量（单位：SUN）
   */
  async convertEnergyToTrx(ownerAddress: string, energyAmount: number): Promise<number> {
    // 获取账户信息，查找质押的 TRX
    const resource = await this.getAccountResource(ownerAddress);

    // 从 account_resource 中获取质押的 TRX（Stake 2.0）
    // frozenV2 是 Stake 2.0 的质押信息
    const stakedTrxForEnergy = await this.getStakedAmount(ownerAddress);

    // 计算需要委托的 TRX 数量（SUN）
    // 公式：委托TRX = (委托能量 / 总能量) × 质押TRX
    const trxToDelegate = (energyAmount / resource.totalEnergy) * stakedTrxForEnergy;

    return Math.floor(trxToDelegate);
  }
}
