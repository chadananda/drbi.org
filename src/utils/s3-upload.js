// s3-upload.js - S3 upload utility for Node.js scripts
import AWS from 'aws-sdk';
import { Buffer } from 'buffer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const guessContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg': return 'image/jpeg';
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.avif': return 'image/avif';
    case '.svg': return 'image/svg+xml';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.pdf': return 'application/pdf';
    default: return 'application/octet-stream';
  }
};

export const uploadS3 = async (base64Data, Key, ContentType = '') => {
  // Configuring the AWS region and credentials
  const region = process.env.AWS_BUCKET_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  ContentType = ContentType || guessContentType(Key);
  const Bucket = process.env.AWS_BUCKET_NAME;

  if (!region) throw new Error('AWS_BUCKET_REGION not set');
  if (!accessKeyId) throw new Error('AWS_ACCESS_KEY_ID not set');
  if (!secretAccessKey) throw new Error('AWS_SECRET_ACCESS_KEY not set');
  if (!Bucket) throw new Error('AWS_BUCKET_NAME not set');
  if (!Key) throw new Error('Key not set');
  if (!ContentType) throw new Error('ContentType could not be determined');

  AWS.config.update({ region, accessKeyId, secretAccessKey });

  // Convert base64 string to binary buffer
  const Body = Buffer.from(base64Data, 'base64');
  // Create an S3 instance
  const s3 = new AWS.S3();
  // Setting up S3 upload parameters
  const params = { Bucket, Key, Body, ContentType };
  
  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully at ${data.Location}`);
    return data.Location;
  } catch (err) {
    console.error('Error uploading file:', err);
    throw err;
  }
};