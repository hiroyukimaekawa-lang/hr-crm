"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJwt = exports.signJwt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const base64UrlEncode = (input) => {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
};
const base64UrlDecode = (input) => {
    const pad = 4 - (input.length % 4 || 4);
    const padded = input + '='.repeat(pad);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
};
const signJwt = (payload, secret, expiresInSeconds) => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const fullPayload = Object.assign(Object.assign({}, payload), { exp });
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto_1.default
        .createHmac('sha256', secret)
        .update(data)
        .digest();
    const encodedSignature = base64UrlEncode(signature);
    return `${data}.${encodedSignature}`;
};
exports.signJwt = signJwt;
const verifyJwt = (token, secret) => {
    const parts = token.split('.');
    if (parts.length !== 3)
        throw new Error('Invalid token format');
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto_1.default
        .createHmac('sha256', secret)
        .update(data)
        .digest();
    const expectedEncoded = base64UrlEncode(expectedSignature);
    if (expectedEncoded !== encodedSignature)
        throw new Error('Invalid token signature');
    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson);
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
    }
    return payload;
};
exports.verifyJwt = verifyJwt;
