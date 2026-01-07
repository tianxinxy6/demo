import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { OrderDelegateEntity } from '@/entities/order-delegate.entity';
import { DelegateStatus } from '@/constants';
import { CreateDelegateOrderDto } from '../dto/delegate.dto';
import { ChainTokenEntity } from '@/entities/chain-token.entity';

/**
 * 委托订单服务
 * 职责：管理能量委托订单的创建、更新、查询
 */
@Injectable()
export class DelegateService {
  private readonly logger = new Logger(DelegateService.name);

  constructor(
    @InjectRepository(OrderDelegateEntity)
    private readonly delegateRepo: Repository<OrderDelegateEntity>,
  ) {}

  /**
   * 创建委托订单（在事务中）
   */
  async create(
    queryRunner: QueryRunner,
    token: IChainToken,
    dto: CreateDelegateOrderDto,
  ): Promise<OrderDelegateEntity> {
    const order = queryRunner.manager.create(OrderDelegateEntity, {
      orderNo: dto.orderNo,
      userId: dto.userId,
      receiverAddress: dto.receiverAddress,
      energyAmount: dto.energyAmount,
      duration: dto.duration,
      price: dto.price,
      token: token.code,
      tokenId: token.id,
      status: DelegateStatus.Pending,
    });

    return await queryRunner.manager.save(OrderDelegateEntity, order);
  }

  /**
   * 更新订单为成功状态（在事务中）
   */
  async updateSuccess(
    queryRunner: QueryRunner,
    order: OrderDelegateEntity,
    txHash: string,
    durationSeconds: number,
  ): Promise<void> {
    order.status = DelegateStatus.Success;
    order.hash = txHash;
    order.expireAt = new Date(Date.now() + durationSeconds * 1000);
    await queryRunner.manager.save(OrderDelegateEntity, order);
  }

  /**
   * 更新订单为失败状态
   */
  async updateFailed(order: OrderDelegateEntity, reason: string): Promise<void> {
    order.status = DelegateStatus.Failed;
    order.failReason = reason;
    await this.delegateRepo.save(order);
  }

  /**
   * 更新订单为已回收状态（在事务中）
   */
  async updateReclaimed(queryRunner: QueryRunner, order: OrderDelegateEntity): Promise<void> {
    order.status = DelegateStatus.Reclaimed;
    order.finishedAt = new Date();
    await queryRunner.manager.save(OrderDelegateEntity, order);
  }

  /**
   * 根据订单号和用户ID查询订单
   */
  async findByOrderNo(orderNo: string, userId: number): Promise<OrderDelegateEntity | null> {
    return await this.delegateRepo.findOne({
      where: { orderNo, userId },
    });
  }

  /**
   * 根据用户ID查询订单列表
   */
  async findByUserId(userId: number, limit = 20): Promise<OrderDelegateEntity[]> {
    return await this.delegateRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 查询已过期但未回收的订单
   */
  async findExpiredOrders(limit = 100): Promise<OrderDelegateEntity[]> {
    return await this.delegateRepo
      .createQueryBuilder('order')
      .where('order.status = :status', { status: DelegateStatus.Success })
      .andWhere('order.expireAt < :now', { now: new Date() })
      .orderBy('order.expireAt', 'ASC')
      .take(limit)
      .getMany();
  }
}
