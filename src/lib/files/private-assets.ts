import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const ASSET_ROOT = path.resolve(process.env.PRIVATE_ASSET_DIR || path.join(process.cwd(), '.data', 'private-assets'))
const s3Bucket = process.env.S3_BUCKET?.trim()
let s3Client: S3Client | null = null

function getS3Client() {
  if (!s3Bucket) return null
  if (!s3Client) {
    const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim()
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim()
    s3Client = new S3Client({
      region: process.env.S3_REGION?.trim() || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT?.trim()),
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    })
  }
  return s3Client
}

function assetPath(key: string) {
  const normalized = key.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Invalid private asset key.')
  }
  const absolute = path.resolve(ASSET_ROOT, normalized)
  if (!absolute.startsWith(`${ASSET_ROOT}${path.sep}`)) throw new Error('Invalid private asset key.')
  return absolute
}

export function newCreativeKey() {
  return `submissions/${randomUUID()}.webp`
}

export async function storePrivateAsset(key: string, data: Buffer, contentType = 'application/octet-stream') {
  const client = getS3Client()
  if (client && s3Bucket) {
    await client.send(new PutObjectCommand({ Bucket: s3Bucket, Key: key, Body: data, ContentType: contentType, CacheControl: 'private, max-age=300' }))
    return
  }
  const absolute = assetPath(key)
  await mkdir(path.dirname(absolute), { recursive: true })
  await writeFile(absolute, data, { flag: 'wx', mode: 0o600 })
}

export async function readPrivateAsset(key: string) {
  const client = getS3Client()
  if (client && s3Bucket) {
    const result = await client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: key }))
    if (!result.Body) throw new Error('Private image asset is missing.')
    return Buffer.from(await result.Body.transformToByteArray())
  }
  return readFile(assetPath(key))
}

export async function deletePrivateAsset(key: string) {
  const client = getS3Client()
  if (client && s3Bucket) {
    await client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }))
    return
  }
  await rm(assetPath(key), { force: true })
}
