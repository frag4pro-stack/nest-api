import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';
import { TodosService } from './todos.service';

@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Post()
  create(@Body('title') title: string) {
    return this.todosService.create(title);
  }

  @Get()
  findAll() {
    return this.todosService.findAll();
  }

  @Patch(':id')
  toggle(@Param('id') id: string) {
    return this.todosService.toggle(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.todosService.remove(+id);
  }
}
