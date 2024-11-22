import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import * as sharp from 'sharp';

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
    return await sharp(buffer)
      .resize(800, 800, { fit: sharp.fit.inside, withoutEnlargement: true })
      .toFormat('jpeg')
      .jpeg({ quality: 80 })
      .toBuffer();
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