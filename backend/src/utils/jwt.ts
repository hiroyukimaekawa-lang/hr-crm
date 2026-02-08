import crypto from 'crypto';

type JwtPayload = {
  sub: string;
  name: string;
  role: string;
  exp: number;
};

const base64UrlEncode = (input: Buffer | string) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (input: string) => {
  const pad = 4 - (input.length % 4 || 4);
  const padded = input + '='.repeat(pad);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
};

export const signJwt = (payload: Omit<JwtPayload, 'exp'>, secret: string, expiresInSeconds: number) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload: JwtPayload = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest();

  const encodedSignature = base64UrlEncode(signature);
  return `${data}.${encodedSignature}`;
};

export const verifyJwt = (token: string, secret: string): JwtPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest();

  const expectedEncoded = base64UrlEncode(expectedSignature);
  if (expectedEncoded !== encodedSignature) throw new Error('Invalid token signature');

  const payloadJson = base64UrlDecode(encodedPayload);
  const payload = JSON.parse(payloadJson) as JwtPayload;

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
};
