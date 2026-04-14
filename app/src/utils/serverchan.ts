import { md5 } from 'js-md5'

/** 模板占位符：{serverName} {level} {levelLabel} {metric} {value} {threshold} {condition} {units} {message} {time} {alertId} */
export function renderNotificationTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

/**
 * Server酱 SCT 端对端加密（与官网 PHP 示例一致）
 * key = md5(password) 前 16 字符；iv = md5(ivSeed) 前 16 字符；明文为 base64(utf8 原文)
 */
export async function encryptSctDesp(content: string, password: string, ivSeed: string): Promise<string> {
  const keyStr = md5(password).slice(0, 16)
  const ivStr = md5(ivSeed).slice(0, 16)
  const keyBytes = new TextEncoder().encode(keyStr)
  const ivBytes = new TextEncoder().encode(ivStr)
  const b64Inner = btoa(unescape(encodeURIComponent(content)))
  const plainBytes = new TextEncoder().encode(b64Inner)
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC', length: 128 }, false, ['encrypt'])
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, cryptoKey, plainBytes)
  const bytes = new Uint8Array(cipherBuf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export type ServerChanEndpoint = 'sct' | 'sc3'

export async function postServerChan(
  endpoint: ServerChanEndpoint,
  sendkey: string,
  body: Record<string, unknown>
): Promise<void> {
  const url =
    endpoint === 'sc3'
      ? `https://${sendkey}.push.ft07.com/send`
      : `https://sctapi.ftqq.com/${sendkey}.send`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(body),
  })

  let json: Record<string, unknown> = {}
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    /* 非 JSON */
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`)
  }

  if (typeof json.code === 'number' && json.code !== 0) {
    throw new Error((json.message as string) || `code=${json.code}`)
  }

  const data = json.data as { errno?: number; errmsg?: string } | undefined
  if (data && typeof data.errno === 'number' && data.errno !== 0) {
    throw new Error(data.errmsg || `errno=${data.errno}`)
  }
}
