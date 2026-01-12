import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Balance } from '../balances/balance.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(Balance)
    private readonly balancesRepo: Repository<Balance>,
  ) {}

  async create(dto: CreateUserDto) {
    const user = this.usersRepo.create(dto);
    const savedUser = await this.usersRepo.save(user);

    const balance = this.balancesRepo.create({
      user: savedUser,
      amount:0,
    });

    await this.balancesRepo.save(balance);

    return savedUser;
  }

  findAll() {
    return this.usersRepo.find({
      select: ['id', 'login'],
    });
  }

    async remove(id: number) {
    const user = await this.usersRepo.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    await this.balancesRepo.delete({ user: { id } });
    await this.usersRepo.delete(id);

    return { success: true };
  }
}
