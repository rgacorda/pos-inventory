import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from '../../entities/user.entity';
import { OrganizationEntity } from '../../entities/organization.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, OrganizationEntity])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
