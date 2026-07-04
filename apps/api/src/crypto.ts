/**
 * Crypt —— 后端用的对称加/解密。
 *
 * 应用场景：
 *  - 桌面端 Electron 主进程用 safeStorage 把 api key 加密，得到密文。
 *  - 密文 + 算法无关，可以用本模块对称解密。
 *  - 解密 secret 注入方式：
 *      XUEXI_DECRYPT_SECRET  (base64, AES-256 密钥)
 *
 * 算法：AES-256-GCM。
 * 密文格式：base64( IV(12B) || ciphertext || authTag(16B) )
 */

import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.XUEXI_DECRYPT_SECRET
  if (!raw) throw new Error('XUEXI_DECRYPT_SECRET not set')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('XUEXI_DECRYPT_SECRET must decode to 32 bytes (AES-256)')
  return key
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, ct, tag]).toString('base64')
}

export function decrypt(payload: string): string {
  const key = getKey()
  const buf = Buffer.from(payload, 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('crypto payload too short')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(buf.length - TAG_LEN)
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** 不抛错的 decrypt：失败时返回原始字符串（用于开发模式无 secret）。 */
export function decryptSafe(payload: string): string {
  try {
    return decrypt(payload)
  } catch {
    return payload
  }
}