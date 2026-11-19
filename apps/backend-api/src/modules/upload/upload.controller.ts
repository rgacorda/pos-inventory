import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { diskStorage } from 'multer';
import { createReadStream, existsSync } from 'fs';
import { extname, resolve, sep } from 'path';
import { DataSource } from 'typeorm';
import { requireOrganizationId } from '../../common/organization-scope';

const RECEIPT_NAME = /^receipt-\d+-\d+\.(jpg|jpeg|png|gif|webp|pdf)$/i;

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly dataSource: DataSource) {}

  @Post('receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/receipts',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `receipt-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|pdf)$/)) {
          return callback(
            new BadRequestException('Only image files and PDFs are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { organizationId?: string | null },
  ) {
    requireOrganizationId(user);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      url: `/uploads/receipts/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
    };
  }

  @Get('receipts/:filename')
  async readReceipt(
    @Param('filename') filename: string,
    @CurrentUser() user: { organizationId?: string | null },
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const organizationId = requireOrganizationId(user);
    const safeName = filename.trim();
    if (!RECEIPT_NAME.test(safeName)) {
      throw new NotFoundException('Receipt not found');
    }

    const owned = await this.dataSource.query(
      `
      SELECT 1
      FROM expenses
      WHERE "organizationId" = $1
        AND "receiptImageUrl" LIKE '%/' || $2
      UNION ALL
      SELECT 1
      FROM inventory_deliveries
      WHERE "organizationId" = $1
        AND "receiptImageUrl" LIKE '%/' || $2
      LIMIT 1
      `,
      [organizationId, safeName],
    );
    if (!owned?.length) {
      throw new NotFoundException('Receipt not found');
    }

    const directory = resolve(process.cwd(), 'uploads', 'receipts');
    const filePath = resolve(directory, safeName);
    if (!filePath.startsWith(directory + sep)) {
      throw new NotFoundException('Receipt not found');
    }
    if (!existsSync(filePath)) {
      throw new NotFoundException('Receipt not found');
    }

    response.setHeader(
      'Content-Type',
      contentType(safeName),
    );
    response.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(createReadStream(filePath));
  }
}

function contentType(filename: string): string {
  const extension = extname(filename).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.pdf') return 'application/pdf';
  return 'image/jpeg';
}
