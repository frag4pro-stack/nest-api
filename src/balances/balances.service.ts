import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceTransaction, TransactionType } from './balance-transaction.entity';
import { TransferDto } from './dto/transfer.dto';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Postgres deadlock error code = 40P01
function isPostgresDeadlock(err: unknown): boolean {
  const e = err as any;
  return e?.driverError?.code === '40P01' || e?.code === '40P01';
}

@Injectable()
export class BalancesService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,

    @InjectRepository(BalanceTransaction)
    private readonly txRepo: Repository<BalanceTransaction>,

    private readonly dataSource: DataSource,
  ) {}

  // 🔹 GET /balances/:userId
  async getBalance(userId: number) {
    const balance = await this.balanceRepo.findOne({
      where: { userId },
      relations: ['user'], // можно убрать если user не нужен
    });

    if (!balance) {
      throw new BadRequestException('Баланс не найден');
    }

    return balance;
  }

  // 🆕 POST /balances/:userId/add/:amount
  // Начисление средств пользователю (ТРАНЗАКЦИОННО)
  async addBalance(userId: number, amount: number) {
    return this.dataSource.transaction(async (manager) => {
      const balance = await manager.findOneBy(Balance, { userId });

      if (!balance) {
        throw new BadRequestException('Баланс не найден');
      }

      const inc = Number(amount);
      balance.amount = Number(balance.amount) + inc;

      await manager.save(Balance, balance);

      const tx = manager.create(BalanceTransaction, {
        userId,
        type: TransactionType.CREDIT,
        amount: inc,
        reason: 'add_balance',
      });

      await manager.save(BalanceTransaction, tx);

      return balance;
    });
  }

  // 🔹 POST /balances/transfer
  // BANK-GRADE: transaction + FOR UPDATE + deadlock-safe + retry
  async transfer(dto: TransferDto) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Нельзя переводить самому себе');
    }

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.dataSource.transaction(async (manager) => {
          // ✅ Deadlock-safe: фиксируем порядок блокировок
          const userIds = [dto.fromUserId, dto.toUserId].sort((a, b) => a - b);

          // 🔒 Блокируем обе строки одним запросом (SELECT ... FOR UPDATE)
          const balances = await manager
            .createQueryBuilder(Balance, 'b')
            .setLock('pessimistic_write') // FOR UPDATE
            .where('b.userId IN (:...userIds)', { userIds })
            .orderBy('b.userId', 'ASC')
            .getMany();

          if (balances.length !== 2) {
            throw new BadRequestException('Баланс не найден');
          }

          const from = balances.find((b) => b.userId === dto.fromUserId);
          const to = balances.find((b) => b.userId === dto.toUserId);

          if (!from || !to) {
            throw new BadRequestException('Баланс не найден');
          }

          if (Number(from.amount) < Number(dto.amount)) {
            throw new BadRequestException('Недостаточно средств');
          }

          from.amount = Number(from.amount) - Number(dto.amount);
          to.amount = Number(to.amount) + Number(dto.amount);

          await manager.save([from, to]);

          await manager.save(BalanceTransaction, [
            manager.create(BalanceTransaction, {
              userId: dto.fromUserId,
              type: TransactionType.DEBIT,
              amount: dto.amount,
              reason: 'transfer',
            }),
            manager.create(BalanceTransaction, {
              userId: dto.toUserId,
              type: TransactionType.CREDIT,
              amount: dto.amount,
              reason: 'transfer',
            }),
          ]);
        });

        return { success: true, attempt };
      } catch (err) {
        // ретраим только deadlock (40P01)
        if (!isPostgresDeadlock(err) || attempt === MAX_RETRIES) {
          throw err;
        }

        const backoffMs = 30 * attempt + Math.floor(Math.random() * 20);
        await sleep(backoffMs);
      }
    }
  }
}
