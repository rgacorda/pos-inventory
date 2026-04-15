import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { TerminalEntity } from '../../entities/terminal.entity';
import { OrganizationEntity } from '../../entities/organization.entity';
import { CreateTerminalDto, UpdateTerminalDto } from './dto';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class TerminalsService {
  // In-memory cache for sync status checks (reduces DB load)
  private syncStatusCache = new Map<
    string,
    { syncRequested: boolean; timestamp: number }
  >();
  private readonly CACHE_TTL = 10000; // 10 seconds cache

  constructor(
    @InjectRepository(TerminalEntity)
    private terminalsRepository: Repository<TerminalEntity>,
    @InjectRepository(OrganizationEntity)
    private organizationRepository: Repository<OrganizationEntity>,
  ) {}

  async create(createTerminalDto: CreateTerminalDto, requestingUser: any) {
    const { terminalId, organizationId } = createTerminalDto;

    // Set organization from requesting user if not super admin
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      createTerminalDto.organizationId = requestingUser.organizationId;
    } else if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Check subscription limits (skip for SUPER_ADMIN)
    const targetOrgId = createTerminalDto.organizationId;
    if (targetOrgId && requestingUser.role !== UserRole.SUPER_ADMIN) {
      await this.validateTerminalLimit(targetOrgId);
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

  private async validateTerminalLimit(organizationId: string) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      relations: ['subscription'],
    });

    if (!organization || !organization.subscription) {
      throw new BadRequestException('Organization subscription not found');
    }

    const { maxTerminals } = organization.subscription.limits;

    // -1 means unlimited (Enterprise plan)
    if (maxTerminals === -1) {
      return;
    }

    // Count existing active terminals in the organization
    const currentTerminalCount = await this.terminalsRepository.count({
      where: { 
        organizationId,
        isActive: true 
      },
    });

    if (currentTerminalCount >= maxTerminals) {
      throw new BadRequestException(
        `Terminal limit reached. Your plan allows ${maxTerminals} terminals. Please upgrade your subscription.`,
      );
    }
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
    
    try {
      await this.terminalsRepository.remove(terminal);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        // Handle foreign key constraint violations
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('foreign key constraint') ||
          errorMessage.includes('violates foreign key') ||
          errorMessage.includes('fk_')
        ) {
          throw new BadRequestException(
            'Cannot delete terminal as it has associated records (orders, transactions, etc.). Please remove all related records first.',
          );
        }
      }
      throw error;
    }
  }

  async syncTerminal(id: string, requestingUser: any) {
    const terminal = await this.findOne(id, requestingUser);
    // Set flag to request sync from the POS terminal
    terminal.syncRequested = true;

    // Invalidate cache for this terminal
    const cacheKey = `${terminal.terminalId}-${terminal.organizationId}`;
    this.syncStatusCache.delete(cacheKey);

    return this.terminalsRepository.save(terminal);
  }

  async checkSyncRequest(terminalId: string, requestingUser: any) {
    // Check cache first (only cache negative results to avoid delaying sync triggers)
    const cacheKey = `${terminalId}-${requestingUser.organizationId}`;
    const cached = this.syncStatusCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      // Only use cache if sync is NOT requested (false)
      // Always check DB if cache says sync IS requested (true) to avoid stale data
      if (!cached.syncRequested) {
        return { syncRequested: false };
      }
    }

    // Optimized query: only select needed fields
    const terminal = await this.terminalsRepository.findOne({
      where: { terminalId },
      select: ['id', 'syncRequested', 'organizationId'],
    });

    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (terminal.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Update cache
    this.syncStatusCache.set(cacheKey, {
      syncRequested: terminal.syncRequested,
      timestamp: Date.now(),
    });

    // Clean old cache entries (simple garbage collection)
    if (this.syncStatusCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.syncStatusCache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL * 2) {
          this.syncStatusCache.delete(key);
        }
      }
    }

    return { syncRequested: terminal.syncRequested };
  }

  async clearSyncRequest(terminalId: string, requestingUser: any) {
    // Optimized query: only select needed fields
    const terminal = await this.terminalsRepository.findOne({
      where: { terminalId },
      select: [
        'id',
        'terminalId',
        'syncRequested',
        'lastSyncAt',
        'organizationId',
      ],
    });

    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (terminal.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Optimized update: only update changed fields
    await this.terminalsRepository.update(
      { id: terminal.id },
      { syncRequested: false, lastSyncAt: new Date() },
    );

    // Invalidate cache for this terminal
    const cacheKey = `${terminalId}-${requestingUser.organizationId}`;
    this.syncStatusCache.delete(cacheKey);

    return { success: true };
  }
}
