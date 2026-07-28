import { canonicalMarketplaceJson } from '../../shared/marketplace-entitlement.mjs'
import type {
  MarketplaceProductManifestV1,
  MarketplaceProductSignatureV1,
} from '../../shared/marketplace-entitlement.mjs'

export interface MarketplaceSigningKey {
  schemaVersion: 1
  algorithm: 'Ed25519'
  keyId: string
  publicKeyPem: string
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const bytes = atob(padded)
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}

function publicKeyDer(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, '')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

export async function verifyMarketplaceProductSignature(input: {
  manifest: MarketplaceProductManifestV1
  signature: MarketplaceProductSignatureV1
  key: MarketplaceSigningKey
}): Promise<boolean> {
  if (
    input.signature.algorithm !== 'Ed25519' ||
    input.key.algorithm !== 'Ed25519' ||
    input.signature.keyId !== input.key.keyId
  ) return false
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      ownedArrayBuffer(publicKeyDer(input.key.publicKeyPem)),
      { name: 'Ed25519' },
      false,
      ['verify'],
    )
    return crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      ownedArrayBuffer(decodeBase64Url(input.signature.signature)),
      ownedArrayBuffer(new TextEncoder().encode(canonicalMarketplaceJson(input.manifest))),
    )
  } catch {
    return false
  }
}

export async function verifyMarketplacePackageIntegrity(
  bytes: ArrayBuffer,
  expectedIntegrity: string,
): Promise<boolean> {
  if (!expectedIntegrity.startsWith('sha256-')) return false
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  let binary = ''
  for (const byte of digest) binary += String.fromCharCode(byte)
  return `sha256-${btoa(binary)}` === expectedIntegrity
}
