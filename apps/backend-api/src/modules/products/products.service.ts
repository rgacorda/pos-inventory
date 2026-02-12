import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../../entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto';
import { UserRole } from '@pos/shared-types';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private productsRepository: Repository<ProductEntity>,
  ) {}

  async create(createProductDto: CreateProductDto, requestingUser: any) {
    const { sku, organizationId } = createProductDto;

    // Set organization from requesting user if not super admin
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      createProductDto.organizationId = requestingUser.organizationId;
    } else if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Check if SKU already exists in this organization
    const existing = await this.productsRepository.findOne({
      where: {
        sku,
        organizationId: createProductDto.organizationId,
      },
    });

    if (existing) {
      throw new ConflictException('SKU already exists in this organization');
    }

    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async findAll(requestingUser: any) {
    const query = this.productsRepository.createQueryBuilder('product');

    // Filter by organization for non-super-admins
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      query.where('product.organizationId = :orgId', {
        orgId: requestingUser.organizationId,
      });
    }

    return query.orderBy('product.name', 'ASC').getMany();
  }

  async findOne(id: string, requestingUser: any) {
    const product = await this.productsRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check tenant access
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      if (product.organizationId !== requestingUser.organizationId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    requestingUser: any,
  ) {
    const product = await this.findOne(id, requestingUser);

    // Check if new SKU conflicts
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existing = await this.productsRepository.findOne({
        where: {
          sku: updateProductDto.sku,
          organizationId: product.organizationId,
        },
      });

      if (existing) {
        throw new ConflictException('SKU already exists in this organization');
      }
    }

    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  async remove(id: string, requestingUser: any) {
    const product = await this.findOne(id, requestingUser);
    await this.productsRepository.remove(product);
  }

  async findByOrganization(organizationId: string) {
    return this.productsRepository.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }
}
