import http from "node:http";
import https from "node:https";
import { Client } from "minio";
import { env } from "@/lib/env";

let client: Client | null = null;
let bucketReady = false;

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function applyEndpointPathPrefix(instance: Client, pathname: string) {
  const prefix = pathname.replace(/\/+$/, "");
  if (!prefix) return instance;
  const raw = instance as Client & {
    getRequestOptions: (opts: unknown) => { path: string };
  };
  const original = raw.getRequestOptions.bind(raw);
  raw.getRequestOptions = ((opts: unknown) => {
    const req = original(opts);
    const path = req.path.startsWith("/") ? req.path : `/${req.path}`;
    return { ...req, path: `${prefix}${path}` };
  }) as typeof raw.getRequestOptions;
  return instance;
}

export function minio(): Client {
  if (client) return client;
  const config = env();
  const url = new URL(config.S3_ENDPOINT);
  const loopback = isLoopbackHost(url.hostname);
  const useSSL = url.protocol === "https:";
  const instance = new Client({
    // Node résout `localhost` en IPv6 (::1) en premier ; MinIO local n’écoute souvent que 127.0.0.1.
    endPoint: loopback ? "127.0.0.1" : url.hostname,
    port: url.port ? Number(url.port) : useSSL ? 443 : 80,
    useSSL,
    accessKey: config.S3_ACCESS_KEY,
    secretKey: config.S3_SECRET_KEY,
    region: config.S3_REGION,
    pathStyle: config.S3_FORCE_PATH_STYLE !== "false",
    transportAgent: loopback
      ? useSSL
        ? new https.Agent({ family: 4 })
        : new http.Agent({ family: 4 })
      : undefined,
  });
  client = applyEndpointPathPrefix(instance, url.pathname);
  return client;
}

export function resetMinioClient() {
  client = null;
  bucketReady = false;
}

export async function ensureBucket() {
  if (bucketReady) return;
  const bucket = env().S3_BUCKET;
  const exists = await minio().bucketExists(bucket);
  if (!exists) {
    await minio().makeBucket(bucket, env().S3_REGION);
  }
  bucketReady = true;
}

export function objectKey(tenantId: string, uuid: string, filename?: string): string {
  const safe = filename ? `/${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}` : "";
  return `tenants/${tenantId}/${uuid}${safe}`;
}

export async function putObject(key: string, body: Buffer, mimeType: string, size: number) {
  try {
    await ensureBucket();
    await minio().putObject(env().S3_BUCKET, key, body, size, { "Content-Type": mimeType });
  } catch (error) {
    resetMinioClient();
    throw error;
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  await ensureBucket();
  const stream = await minio().getObject(env().S3_BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function copyObject(sourceKey: string, destKey: string) {
  await ensureBucket();
  await minio().copyObject(env().S3_BUCKET, destKey, `/${env().S3_BUCKET}/${sourceKey}`);
}

export async function removeObject(key: string) {
  await ensureBucket();
  await minio().removeObject(env().S3_BUCKET, key);
}
