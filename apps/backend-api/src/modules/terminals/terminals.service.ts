import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TerminalEntity } from '../../entities/terminal.entity';
import { CreateTerminalDto, UpdateTerminalDto } from './dto';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class TerminalsService {
  constructor(
    @InjectRepository(TerminalEntity)
    private terminalsRepository: Repository<TerminalEntity>,
  ) {}

  async create(createTerminalDto: CreateTerminalDto, requestingUser: any) {
    const { terminalId, organizationId } = createTerminalDto;

    // Set organization from requesting user if not super admin
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      createTerminalDto.organizationId = requestingUser.organizationId;
    } else if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Check if terminal ID already exists
    const existing = await this.terminalsRepository.findOne({
      where: { terminalId },
    });

    if (existing) {
      throw new ConflictException('Terminal ID already exists');
    }

    const terminal = this.terminalsRepository.create(createTerminalDto);
    return this.terminalsRepository.save(terminal);
  }

  async findAll(requestingUser: any) {
    const query = this.terminalsRepository.createQueryBuilder('terminal');

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('terminal.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    return query.orderBy('terminal.name', 'ASC').getMany();
  }

  async findOne(id: string, requestingUser: any) {
    const terminal = await this.terminalsRepository.findOne({ where: { id } });

    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (terminal.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return terminal;
  }

  async update(
    id: string,
    updateTerminalDto: UpdateTerminalDto,
    requestingUser: any,
  ) {
    const terminal = await this.findOne(id, requestingUser);

    // Check if new terminal ID conflicts
    if (
      updateTerminalDto.terminalId &&
      updateTerminalDto.terminalId !== terminal.terminalId
    ) {
      const existing = await this.terminalsRepository.findOne({
        where: { terminalId: updateTerminalDto.terminalId },
      });

      if (existing) {
        throw new ConflictException('Terminal ID already exists');
      }
    }

    Object.assign(terminal, updateTerminalDto);
    return this.terminalsRepository.save(terminal);
  }

  async remove(id: string, requestingUser: any) {
    const terminal = await this.findOne(id, requestingUser);
    await this.terminalsRepository.remove(terminal);
  }

  async syncTerminal(id: string, requestingUser: any) {
    const terminal = await this.findOne(id, requestingUser);
    terminal.lastSyncAt = new Date();
    return this.terminalsRepository.save(terminal);
  }
}
