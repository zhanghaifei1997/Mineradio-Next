import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const COOKIE_ATTRIBUTE_NAMES = new Set(['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'])

let cookieDir = process.cwd()

export function setCookieDir(dir) {
  cookieDir = dir
}

function collectCookiePair(picked, key, value) {
  key = String(key || '').trim()
  if (!key || COOKIE_ATTRIBUTE_NAMES.has(key.toLowerCase())) return
  if (value === null || value === undefined) return
  picked.set(key, String(value).trim())
}

function collectCookieInput(input, picked) {
  if (input === null || input === undefined) return
  if (Array.isArray(input)) {
    input.forEach(item => collectCookieInput(item, picked))
    return
  }
  if (typeof input === 'object') {
    if (input.name && Object.prototype.hasOwnProperty.call(input, 'value')) {
      collectCookiePair(picked, input.name, input.value)
      return
    }
    Object.keys(input).forEach(key => {
      const value = input[key]
      if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
        collectCookiePair(picked, key, value.value)
      } else if (typeof value !== 'object') {
        collectCookiePair(picked, key, value)
      }
    })
    return
  }
  String(input).split(/\r?\n/).forEach(line => {
    line.split(';').forEach(part => {
      const raw = String(part || '').trim()
      const idx = raw.indexOf('=')
      if (idx <= 0) return
      collectCookiePair(picked, raw.slice(0, idx), raw.slice(idx + 1))
    })
  })
}

export function normalizeCookieHeader(input) {
  const picked = new Map()
  collectCookieInput(input, picked)
  return Array.from(picked.entries())
    .filter(([key, value]) => key && value != null && String(value) !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

function rawCookieFallback(input) {
  if (typeof input === 'string') return input.trim()
  if (Array.isArray(input) && input.every(item => typeof item === 'string')) return input.join('; ').trim()
  return ''
}

export function readCookieFromResponse(response) {
  if (!response) return ''
  if (response.cookie) return normalizeCookieHeader(response.cookie)
  if (response.headers && response.headers['set-cookie']) {
    return normalizeCookieHeader(response.headers['set-cookie'])
  }
  return ''
}

let userCookie = ''
let qqCookie = ''

function getCookieFilePath(name) {
  return join(cookieDir, name)
}

export function loadCookies() {
  try {
    const cookieFile = getCookieFilePath('.cookie')
    if (existsSync(cookieFile)) {
      userCookie = readFileSync(cookieFile, 'utf8').trim()
    }
  } catch (e) {
    userCookie = ''
  }
  try {
    const qqCookieFile = getCookieFilePath('.qq-cookie')
    if (existsSync(qqCookieFile)) {
      qqCookie = readFileSync(qqCookieFile, 'utf8').trim()
    }
  } catch (e) {
    qqCookie = ''
  }
}

export function saveCookie(c) {
  userCookie = normalizeCookieHeader(c) || rawCookieFallback(c)
  try {
    const cookieFile = getCookieFilePath('.cookie')
    writeFileSync(cookieFile, userCookie)
  } catch (e) {}
}

export function saveQQCookie(c) {
  qqCookie = normalizeCookieHeader(c) || rawCookieFallback(c)
  try {
    const qqCookieFile = getCookieFilePath('.qq-cookie')
    writeFileSync(qqCookieFile, qqCookie)
  } catch (e) {}
}

export function getUserCookie() {
  return userCookie
}

export function getQQCookie() {
  return qqCookie
}

export function clearCookie() {
  userCookie = ''
  try {
    const cookieFile = getCookieFilePath('.cookie')
    writeFileSync(cookieFile, '')
  } catch (e) {}
}

export function clearQQCookie() {
  qqCookie = ''
  try {
    const qqCookieFile = getCookieFilePath('.qq-cookie')
    writeFileSync(qqCookieFile, '')
  } catch (e) {}
}
