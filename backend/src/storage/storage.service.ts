import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HeadBucketCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicUrlBase: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID', '');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID', '');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY', '');
    this.bucket = config.get<string>('R2_BUCKET', '');
    this.publicUrlBase = config.get<string>('R2_PUBLIC_URL', '');

    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.s3 = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
        region: 'auto',
      });
    } else {
      this.logger.warn('R2 storage not configured');
    }
  }

  isNotConfigured(): boolean {
    return !this.s3;
  }

  upload(key: string, data: Buffer, contentType: string): string {
    if (!this.s3) throw new Error('R2 not configured');
    this.s3
      .send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
        }),
      )
      .then(() => this.logger.debug(`Uploaded ${key} (${data.length} bytes)`))
      .catch((e: Error) =>
        this.logger.error(`R2 upload failed for ${key}: ${e.message}`),
      );
    return this.publicUrl(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.s3) return false;
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (e) {
      if (e instanceof NoSuchKey) return false;
      this.logger.warn(
        `R2 exists check failed for ${key}: ${(e as Error).message}`,
      );
      return false;
    }
  }

  async pingBucket(): Promise<void> {
    if (!this.s3) throw new Error('R2 not configured');
    await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  publicUrl(key: string): string {
    if (!this.publicUrlBase) return key;
    return `${this.publicUrlBase.replace(/\/+$/, '')}/${key}`;
  }
}
