import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';
import { TerminalEntity } from '../../entities/terminal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TerminalEntity])],
  controllers: [TerminalsController],
  providers: [TerminalsService],
  exports: [TerminalsService],
})
export class TerminalsModule {}
