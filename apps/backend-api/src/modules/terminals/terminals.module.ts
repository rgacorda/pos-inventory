import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';
import { TerminalEntity } from '../../entities/terminal.entity';
import { OrganizationEntity } from '../../entities/organization.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TerminalEntity, OrganizationEntity])],
  controllers: [TerminalsController],
  providers: [TerminalsService],
  exports: [TerminalsService],
})
export class TerminalsModule {}
