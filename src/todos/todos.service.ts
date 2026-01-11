import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo } from './entities/todo.entity';

@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(Todo)
    private readonly todoRepository: Repository<Todo>,
  ) {}

  create(title: string) {
    const todo = this.todoRepository.create({ title });
    return this.todoRepository.save(todo);
  }

  findAll() {
    return this.todoRepository.find();
  }

  toggle(id: number) {
    return this.todoRepository.update(id, {
      completed: true,
    });
  }

  remove(id: number) {
    return this.todoRepository.delete(id);
  }
}

