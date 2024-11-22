import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { createCanvas, loadImage } from 'canvas';

@Injectable()
export class ImageKitService {
  
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png'];
  private readonly imageKitUrl: string;
  private readonly imageKitPrivateKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.imageKitUrl = this.configService.get<string>('IMAGEKIT_URL_ENDPOINT');
    this.imageKitPrivateKey = this.configService.get<string>('IMAGEKIT_PRIVATE_KEY');
  }

  async handleImage(
    image: Express.Multer.File | string | undefined,
    userId: number,
    oldImageUrl?: string
  ): Promise<string | undefined> {
    
    if (!image) return undefined;

    try {
      await this.deleteOldImage(oldImageUrl);
      const imageBuffer = await this.getImageBuffer(image);
      if (!imageBuffer) return undefined;

      const file = this.createFileObject(imageBuffer, userId);
      return await this.uploadImage(file, 'uploads/blog');
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      return undefined;
    }
  }

  private async deleteOldImage(oldImageUrl?: string): Promise<void> {
    if (!oldImageUrl) return;

    const imageName = oldImageUrl.split('/').pop();
    const imageId = await this.getImageId(imageName);
    if (imageId) await this.deleteImage(imageId);
  }

  private async getImageBuffer(image: Express.Multer.File | string): Promise<Buffer | undefined> {
    if (typeof image === 'string' && image.startsWith('http')) {
      return await this.downloadImage(image);
    }
    if (typeof image !== 'string') {
      return image.buffer;
    }
    return undefined;
  }

  private createFileObject(buffer: Buffer, userId: number): Express.Multer.File {
    const filename = `user_${userId}.jpg`;
    return {
      buffer,
      originalname: filename,
      fieldname: 'file',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: buffer.length,
      stream: null,
      destination: '',
      filename,
      path: ''
    };
  }

  private async uploadImage(image: Express.Multer.File, folder: string): Promise<string> {
    this.validateImage(image);
    const processedBuffer = await this.processImage(image.buffer);
    const form = this.createFormData(processedBuffer, image.originalname, folder);
    return await this.postImage(form);
  }

  private validateImage(image: Express.Multer.File): void {
    if (!this.ALLOWED_TYPES.includes(image.mimetype)) {
      throw new HttpException(
        'Formato de arquivo inválido. Apenas JPG e PNG são permitidos.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (image.size > this.MAX_FILE_SIZE) {
      throw new HttpException(
        'O arquivo excede o tamanho máximo permitido de 5MB.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private createFormData(buffer: Buffer, filename: string, folder: string): FormData {
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('fileName', filename);
    form.append('folder', folder);
    return form;
  }

  private async postImage(form: FormData): Promise<string> {

    try {
      const response = await lastValueFrom(
        this.httpService.post(this.imageKitUrl, form, {
          headers: this.getAuthHeaders(),
        }),
      );
      return response.data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  private async deleteImage(imageId: string): Promise<void> {
    const deleteUrl = `${this.configService.get<string>('IMAGEKIT_URL_DELETE')}/${imageId}`;
    
    try {
      const response = await lastValueFrom(
        this.httpService.delete(deleteUrl, {
          headers: this.getAuthHeaders(),
        }),
      );
      console.log('Delete response:', response.status, response.statusText);
    } catch (error) {
      console.error('Erro ao deletar arquivo:', error.response?.data || error.message);
    }
  }

  private async getImageId(imageName: string): Promise<string | null> {
    const url = `${this.configService.get<string>('IMAGEKIT_URL_DELETE')}?name=${imageName}`;
    
    try {
      const response = await lastValueFrom(
        this.httpService.get(url, {
          headers: this.getAuthHeaders(),
        }),
      );

      return Array.isArray(response.data) && response.data.length > 0
        ? response.data[0].fileId
        : null;
    } catch (error) {
      console.error('Error getting image ID:', error);
      return null;
    }
  }

  private async processImage(buffer: Buffer): Promise<Buffer> {
    try {
      const image = await loadImage(buffer);
      
      // Calculate new dimensions while maintaining aspect ratio
      let width = image.width;
      let height = image.height;
      const maxDimension = 800;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Use only imageSmoothingEnabled
      ctx.imageSmoothingEnabled = true;
      
      // Draw image with resize
      ctx.drawImage(image, 0, 0, width, height);
      
      // Convert to buffer with JPEG encoding
      return canvas.toBuffer('image/jpeg', {
        quality: 0.8,
        progressive: true
      });
    } catch (error) {
      console.error('Error processing image:', error);
      throw new HttpException('Erro ao processar a imagem', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}

  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await lastValueFrom(
        this.httpService.get(url, { responseType: 'arraybuffer' })
      );
      return Buffer.from(response.data);
    } catch (error) {
      throw new HttpException('Erro ao baixar a imagem', HttpStatus.BAD_REQUEST);
    }
  }

  private getAuthHeaders() {
    return {
      Authorization: `Basic ${Buffer.from(`${this.imageKitPrivateKey}:`).toString('base64')}`,
    };
  }
}

/**
 * Instalar:
 * 
 * npm install --save @types/multer
 * npm install canvas
 * npm install @nestjs/axios
 */