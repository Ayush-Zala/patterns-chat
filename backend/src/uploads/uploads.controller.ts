import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync } from 'fs';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('upload')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${uniqueSuffix}${ext}`);
        },
      }),
      // Support large files (up to 50 GB) of any file type without limitation
      limits: {
        fileSize: 50 * 1024 * 1024 * 1024, // 50 Gigabytes max
        fieldSize: 50 * 1024 * 1024 * 1024,
      },
    }),
  )
  uploadFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file transfer failed');
    }

    return {
      fileUrl: `/uploads/${file.filename}`,
      url: `/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.mimetype || 'application/octet-stream',
    };
  }

  // Stream & download files of any size with original filename & resume support
  @Get('download/:filename')
  downloadFile(
    @Param('filename') filename: string,
    @Query('name') originalName: string,
    @Res() res: Response,
  ) {
    // Sanitize filename to prevent directory traversal
    const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    const filePath = join(process.cwd(), 'uploads', safeFilename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Requested file not found');
    }

    const downloadName = originalName || safeFilename;
    return res.download(filePath, downloadName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).send('Error streaming download');
      }
    });
  }
}
