import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Balance } from '../balances/balance.entity';


@Module({
  imports: [TypeOrmModule.forFeature([User, Balance])], // 👈 ВОТ ЭТО КЛЮЧЕВО
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
