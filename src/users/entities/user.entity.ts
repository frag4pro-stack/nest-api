import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from 'typeorm';
import { Balance } from '../../balances/balance.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  login: string;

  @Column()
  password: string;

  @OneToOne(() => Balance, balance => balance.user)
  balance: Balance;

}

