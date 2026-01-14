import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from './balance.entity';
import { BalanceTransaction, TransactionType } from './balance-transaction.entity';
import { TransferDto } from './dto/transfer.dto';

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
// Получить текущий баланс пользователя
async getBalance(userId: number) {
  // Ищем баланс ПО userId (быстро и без join)
  const balance = await this.balanceRepo.findOne({
    where: { userId },
    relations: ['user'],
  });

  // Если баланса нет — ошибка
  if (!balance) {
    throw new BadRequestException('Баланс не найден');
  }

  return balance;
}

  // 🆕 POST /balances/:userId/add/:amount
// Начисление средств пользователю (БЕЗ транзакции — допустимо для демо)
async addBalance(userId: number, amount: number) {
  // Получаем баланс по userId
  const balance = await this.balanceRepo.findOne({
    where: { userId },
    relations: ['user'], // не обязательно
  });

  if (!balance) {
    throw new BadRequestException('Баланс не найден');
  }

  // ⚠️ numeric из Postgres приходит строкой → приводим к number
  balance.amount = Number(balance.amount) + Number(amount);

  // Сохраняем обновлённый баланс
  await this.balanceRepo.save(balance);

  // Логируем операцию (ledger)
  await this.txRepo.save(
    this.txRepo.create({
      userId,
      type: TransactionType.CREDIT,
      amount,
      reason: 'add_balance',
    }),
  );

  return balance;
}

  // 🔹 POST /balances/transfer
  async transfer(dto: TransferDto) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Нельзя переводить самому себе');
    }

    await this.dataSource.transaction(async (manager) => {
      // ✅ Deadlock-safe: всегда блокируем в одном порядке
      const userIds = [dto.fromUserId, dto.toUserId].sort((a, b) => a - b);

      // 🔒 Блокируем ОБА баланса одним запросом (SELECT ... FOR UPDATE)
      const balances = await manager
        .createQueryBuilder(Balance, 'b')
        .setLock('pessimistic_write') // = FOR UPDATE
        .where('b.userId IN (:...userIds)', { userIds })
        .orderBy('b.userId', 'ASC')
        .getMany();

      if (balances.length !== 2) {
        throw new BadRequestException('Пользователь не найден');
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

    return { success: true };
  }
}
