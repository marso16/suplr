package com.suplr.backend.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.net.URI;

@Slf4j
@Service
public class StorageService {

    @Value("${app.r2.account-id:}")
    private String accountId;

    @Value("${app.r2.access-key-id:}")
    private String accessKeyId;

    @Value("${app.r2.secret-access-key:}")
    private String secretAccessKey;

    @Value("${app.r2.bucket:}")
    private String bucket;

    @Value("${app.r2.public-url:}")
    private String publicUrlBase;

    private S3Client s3Client;

    @PostConstruct
    public void init() {
        if (isNotConfigured()) {
            log.warn("Cloudflare R2 storage credentials are not fully configured.");
            return;
        }

        this.s3Client = S3Client.builder()
                .endpointOverride(URI.create(
                        "https://" + accountId + ".r2.cloudflarestorage.com"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
                .region(Region.of("auto"))
                .build();
    }

    public boolean isNotConfigured() {
        return isBlank(accountId)
                || isBlank(accessKeyId)
                || isBlank(secretAccessKey)
                || isBlank(bucket);
    }

    private boolean isBlank(String str) {
        return str == null || str.isBlank();
    }

    public String upload(String key, byte[] data, String contentType) {
        if (isNotConfigured()) {
            throw new IllegalStateException("R2 storage is not configured.");
        }
        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(data)
            );
            log.debug("Uploaded {} ({} bytes) to R2", key, data.length);
            return publicUrl(key);
        } catch (Exception e) {
            log.error("R2 upload failed for key {}: {}", key, e.getMessage());
            throw new RuntimeException("R2 upload failed: " + e.getMessage(), e);
        }
    }

    public boolean exists(String key) {
        if (isNotConfigured()) return false;
        try {
            s3Client.headObject(
                    HeadObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .build()
            );
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (Exception e) {
            log.warn("R2 exists check failed for key {}: {}", key, e.getMessage());
            return false;
        }
    }

    public void pingBucket() {
        if (isNotConfigured()) {
            throw new IllegalStateException("R2 not configured");
        }
        s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
    }

    public String publicUrl(String key) {
        if (isBlank(publicUrlBase)) {
            return key;
        }
        return publicUrlBase.replaceAll("/+$", "") + "/" + key;
    }
}