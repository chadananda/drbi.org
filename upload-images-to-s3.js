#!/usr/bin/env node

/**
 * Upload DRBI category images to S3 bucket
 * This script uploads the local webp images to the S3 bucket for imgix serving
 */

import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_BUCKET_REGION || 'us-west-1'
});

const bucketName = process.env.AWS_BUCKET_NAME || 'drbi';
const imagesDir = './src/assets/drbi';

// List of images to upload
const images = [
  'arts.webp',
  'study.webp',
  'soil.webp', 
  'kure.webp',
  'cemetery.webp'
];

async function uploadImageToS3(fileName) {
  const filePath = path.join(imagesDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const fileContent = fs.readFileSync(filePath);
  const s3Key = `drbi/${fileName}`;

  const params = {
    Bucket: bucketName,
    Key: s3Key,
    Body: fileContent,
    ContentType: 'image/webp',
    CacheControl: 'max-age=31536000', // 1 year cache
  };

  try {
    console.log(`📤 Uploading ${fileName} to S3...`);
    const result = await s3.upload(params).promise();
    console.log(`✅ Successfully uploaded: ${result.Location}`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    return false;
  }
}

async function uploadAllImages() {
  console.log('🚀 Starting DRBI image upload to S3...');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`📁 Source: ${imagesDir}`);
  console.log('');

  let successCount = 0;
  let totalCount = images.length;

  for (const image of images) {
    const success = await uploadImageToS3(image);
    if (success) successCount++;
  }

  console.log('');
  console.log(`📊 Upload Summary: ${successCount}/${totalCount} images uploaded successfully`);
  
  if (successCount === totalCount) {
    console.log('🎉 All images uploaded successfully!');
    console.log('🖼️  Images are now available via imgix at: https://drbi.imgix.net/drbi/[filename]');
  } else {
    console.log('⚠️  Some images failed to upload. Check the errors above.');
    process.exit(1);
  }
}

// Run the upload
uploadAllImages().catch(error => {
  console.error('💥 Upload script failed:', error);
  process.exit(1);
});