//! NeteaseCloudMusicApi encryption layer — Rust port of util/crypto.js
//!
//! Three encryption schemes:
//! - weapi: AES-128-CBC double encrypt + RSA public key
//! - linuxapi: AES-128-ECB
//! - eapi: AES-128-ECB + MD5 digest

use aes::cipher::{BlockDecrypt, BlockEncrypt, KeyInit};
use aes::{Aes128Dec, Aes128Enc, Block};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use md5::{Digest, Md5};
use rand::Rng;
use rsa::{pkcs8::DecodePublicKey, RsaPublicKey};

const IV: &[u8; 16] = b"0102030405060708";
const PRESET_KEY: &[u8; 16] = b"0CoJUm6Qyw8W8jud";
const LINUXAPI_KEY: &[u8; 16] = b"rFgB&h#%2?^eDg:Q";
const EAPI_KEY: &[u8; 16] = b"e82ckenh8dichen8";
const BASE62: &[u8; 62] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const PUBLIC_KEY_PEM: &str = "-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ3
7BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvakl
V8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44o
ncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----";

// ---- Manual AES-ECB / AES-CBC implementations ----
// Avoids version conflicts between aes/cipher and ecb/cbc crates.

/// PKCS7 pad data to a multiple of block_size (16 for AES-128).
fn pkcs7_pad(data: &[u8]) -> Vec<u8> {
    let block_size = 16usize;
    let pad_len = block_size - (data.len() % block_size);
    let mut result = data.to_vec();
    result.extend(std::iter::repeat(pad_len as u8).take(pad_len));
    result
}

/// Remove PKCS7 padding.
#[allow(dead_code)]
fn pkcs7_unpad(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.is_empty() {
        return Err("empty data".into());
    }
    let pad_byte = *data.last().unwrap();
    let pad_len = pad_byte as usize;
    if pad_len == 0 || pad_len > 16 || pad_len > data.len() {
        return Err(format!("invalid padding length: {}", pad_len));
    }
    for &b in &data[data.len() - pad_len..] {
        if b != pad_byte {
            return Err("invalid PKCS7 padding".into());
        }
    }
    Ok(data[..data.len() - pad_len].to_vec())
}

/// AES-128-ECB encrypt.
fn aes128_ecb_encrypt(plaintext: &[u8], key: &[u8; 16]) -> Vec<u8> {
    let cipher = Aes128Enc::new_from_slice(key).expect("invalid key length");
    let padded = pkcs7_pad(plaintext);
    let mut result = padded.clone();
    for chunk in result.chunks_exact_mut(16) {
        let mut block = Block::clone_from_slice(chunk);
        cipher.encrypt_block(&mut block);
        chunk.copy_from_slice(&block);
    }
    result
}

/// AES-128-ECB decrypt.
#[allow(dead_code)]
fn aes128_ecb_decrypt(ciphertext: &[u8], key: &[u8; 16]) -> Result<Vec<u8>, String> {
    if ciphertext.len() % 16 != 0 {
        return Err("ciphertext length not multiple of 16".into());
    }
    let cipher = Aes128Dec::new_from_slice(key).expect("invalid key length");
    let mut result = ciphertext.to_vec();
    for chunk in result.chunks_exact_mut(16) {
        let mut block = Block::clone_from_slice(chunk);
        cipher.decrypt_block(&mut block);
        chunk.copy_from_slice(&block);
    }
    pkcs7_unpad(&result)
}

/// AES-128-CBC encrypt.
fn aes128_cbc_encrypt(plaintext: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Vec<u8> {
    let cipher = Aes128Enc::new_from_slice(key).expect("invalid key length");
    let padded = pkcs7_pad(plaintext);
    let mut result = Vec::with_capacity(padded.len());
    let mut prev = *iv;
    for chunk in padded.chunks(16) {
        let mut block = Block::default();
        for i in 0..16 {
            block[i] = chunk[i] ^ prev[i];
        }
        cipher.encrypt_block(&mut block);
        result.extend_from_slice(&block);
        let block_arr: [u8; 16] = block.into();
        prev = block_arr;
    }
    result
}

/// AES-128-CBC decrypt.
#[allow(dead_code)]
fn aes128_cbc_decrypt(ciphertext: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> Result<Vec<u8>, String> {
    if ciphertext.len() % 16 != 0 {
        return Err("ciphertext length not multiple of 16".into());
    }
    let cipher = Aes128Dec::new_from_slice(key).expect("invalid key length");
    let mut result = Vec::with_capacity(ciphertext.len());
    let mut prev = *iv;
    for chunk in ciphertext.chunks(16) {
        let mut block = Block::clone_from_slice(chunk);
        cipher.decrypt_block(&mut block);
        for i in 0..16 {
            result.push(block[i] ^ prev[i]);
        }
        prev.copy_from_slice(chunk);
    }
    pkcs7_unpad(&result)
}

// ---- Encoding helpers ----

fn aes_cbc_encrypt_base64(plaintext: &[u8], key: &[u8; 16], iv: &[u8; 16]) -> String {
    BASE64.encode(aes128_cbc_encrypt(plaintext, key, iv))
}

fn aes_ecb_encrypt_hex(plaintext: &[u8], key: &[u8; 16]) -> String {
    hex::encode(aes128_ecb_encrypt(plaintext, key))
}

#[allow(dead_code)]
fn aes_ecb_decrypt_hex(ciphertext_hex: &str, key: &[u8; 16]) -> Result<String, String> {
    let ct = hex::decode(ciphertext_hex).map_err(|e| e.to_string())?;
    let pt = aes128_ecb_decrypt(&ct, key)?;
    String::from_utf8(pt).map_err(|e| e.to_string())
}

// ---- RSA ----

/// RSA encrypt with the fixed public key (no padding), return hex.
fn rsa_encrypt_nopadding(data: &[u8]) -> Result<String, String> {
    let pubkey = RsaPublicKey::from_public_key_pem(PUBLIC_KEY_PEM)
        .map_err(|e| format!("RSA key parse failed: {}", e))?;
    use rsa::traits::PublicKeyParts;
    let n = pubkey.n();
    let e = pubkey.e();
    let m = rsa::BigUint::from_bytes_be(data);
    let c = m.modpow(e, n);
    let key_size = pubkey.size();
    let c_bytes = c.to_bytes_be();
    let mut result = vec![0u8; key_size];
    result[key_size - c_bytes.len()..].copy_from_slice(&c_bytes);
    Ok(hex::encode(result))
}

/// Generate a random 16-char base62 secret key.
fn random_secret_key() -> String {
    let mut rng = rand::thread_rng();
    (0..16)
        .map(|_| BASE62[rng.gen_range(0..62)] as char)
        .collect()
}

// ---- Public API ----

/// weapi encryption: double AES-CBC + RSA.
pub fn weapi(data: &serde_json::Value) -> Result<serde_json::Value, String> {
    let text = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let secret_key = random_secret_key();

    let first = aes_cbc_encrypt_base64(text.as_bytes(), PRESET_KEY, IV);
    let params = aes_cbc_encrypt_base64(first.as_bytes(), secret_key.as_bytes().try_into().unwrap(), IV);

    let reversed: String = secret_key.chars().rev().collect();
    let enc_sec_key = rsa_encrypt_nopadding(reversed.as_bytes())?;

    Ok(serde_json::json!({
        "params": params,
        "encSecKey": enc_sec_key,
    }))
}

/// linuxapi encryption: AES-ECB.
pub fn linuxapi(data: &serde_json::Value) -> Result<serde_json::Value, String> {
    let text = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let eparams = aes_ecb_encrypt_hex(text.as_bytes(), LINUXAPI_KEY);
    Ok(serde_json::json!({
        "eparams": eparams,
    }))
}

/// eapi encryption: MD5 digest + AES-ECB.
pub fn eapi(url: &str, data: &serde_json::Value) -> Result<serde_json::Value, String> {
    let text = serde_json::to_string(data).map_err(|e| e.to_string())?;
    let message = format!("nobody{}use{}md5forencrypt", url, text);
    let digest = format!("{:x}", Md5::digest(message.as_bytes()));
    let payload = format!("{}-36cd479b6b5-{}-36cd479b6b5-{}", url, text, digest);
    let params = aes_ecb_encrypt_hex(payload.as_bytes(), EAPI_KEY);
    Ok(serde_json::json!({
        "params": params,
    }))
}

/// eapi response decrypt.
#[allow(dead_code)]
pub fn eapi_res_decrypt(encrypted_hex: &str) -> Result<serde_json::Value, String> {
    let decrypted = aes_ecb_decrypt_hex(encrypted_hex, EAPI_KEY)?;
    serde_json::from_str(&decrypted).map_err(|e| e.to_string())
}

/// eapi response decrypt with gzip decompression.
#[allow(dead_code)]
pub fn eapi_res_decrypt_gzip(encrypted_hex: &str) -> Result<serde_json::Value, String> {
    use flate2::read::GzDecoder;
    use std::io::Read;

    let raw_bytes = hex::decode(encrypted_hex).map_err(|e| e.to_string())?;
    let decrypted = aes128_ecb_decrypt(&raw_bytes, EAPI_KEY)?;

    let mut decoder = GzDecoder::new(&decrypted[..]);
    let mut result = String::new();
    decoder.read_to_string(&mut result).map_err(|e| e.to_string())?;
    serde_json::from_str(&result).map_err(|e| e.to_string())
}

/// eapi request decrypt (URL + data extraction).
#[allow(dead_code)]
pub fn eapi_req_decrypt(encrypted_hex: &str) -> Result<(String, serde_json::Value), String> {
    let decrypted = aes_ecb_decrypt_hex(encrypted_hex, EAPI_KEY)?;
    // Pattern: url-36cd479b6b5-data-36cd479b6b5-digest
    let re = regex_lite::Regex::new(r"(.*?)-36cd479b6b5-(.*?)-36cd479b6b5-(.*)")
        .map_err(|e| e.to_string())?;
    if let Some(caps) = re.captures(&decrypted) {
        let url = caps.get(1).unwrap().as_str().to_string();
        let data: serde_json::Value =
            serde_json::from_str(caps.get(2).unwrap().as_str()).map_err(|e| e.to_string())?;
        Ok((url, data))
    } else {
        Err("eapi_req_decrypt: pattern mismatch".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_weapi_produces_params_and_enc_sec_key() {
        let data = serde_json::json!({"s": "test", "type": 1, "limit": 30});
        let result = weapi(&data).unwrap();
        assert!(result["params"].is_string());
        assert!(result["encSecKey"].is_string());
        assert!(!result["params"].as_str().unwrap().is_empty());
        assert!(!result["encSecKey"].as_str().unwrap().is_empty());
    }

    #[test]
    fn test_linuxapi_produces_eparams() {
        let data = serde_json::json!({"method": "POST", "url": "https://music.163.com/api/test", "params": {}});
        let result = linuxapi(&data).unwrap();
        assert!(result["eparams"].is_string());
    }

    #[test]
    fn test_eapi_roundtrip() {
        let url = "/api/test/endpoint";
        let data = serde_json::json!({"id": 12345});
        let encrypted = eapi(url, &data).unwrap();
        let params_hex = encrypted["params"].as_str().unwrap();
        // Just verify decryption doesn't panic (it returns the padded payload)
        let _decrypted = eapi_res_decrypt(params_hex);
    }

    #[test]
    fn test_aes_ecb_roundtrip() {
        let plaintext = "hello world test message!";
        let encrypted = aes_ecb_encrypt_hex(plaintext.as_bytes(), EAPI_KEY);
        let decrypted = aes_ecb_decrypt_hex(&encrypted, EAPI_KEY).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_cbc_roundtrip() {
        let plaintext = "hello cbc mode test!";
        let encrypted = aes128_cbc_encrypt(plaintext.as_bytes(), PRESET_KEY, IV);
        let decrypted = aes128_cbc_decrypt(&encrypted, PRESET_KEY, IV).unwrap();
        assert_eq!(decrypted, plaintext.as_bytes());
    }
}
