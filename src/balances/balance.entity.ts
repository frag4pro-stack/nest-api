import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity()
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

  // ✅ FK как обычное поле (ради него всё делаем)
  @Column({ name: 'userId' })
  userId: number;

  // ✅ Связь использует тот же столбец userId
  @OneToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
  type: 'numeric',
  default: 0,
  transformer: {
    to: (value: number) => value,
    from: (value: string) => Number(value),
  },
})
amount: number;

}
