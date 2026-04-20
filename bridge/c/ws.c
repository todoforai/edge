#define _GNU_SOURCE  // memmem
#include <ctype.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <unistd.h>

#include <openssl/evp.h>
#include <openssl/rand.h>

#include "ws.h"

// ── Frame codec ──────────────────────────────────────────────────────────────

size_t ws_encode(uint8_t *buf, ws_opcode_t opcode,
                 const uint8_t *payload, size_t payload_len) {
    size_t i = 0;
    buf[i++] = 0x80 | (uint8_t)opcode;  // FIN=1

    if (payload_len < 126) {
        buf[i++] = 0x80 | (uint8_t)payload_len;
    } else if (payload_len <= 0xFFFF) {
        buf[i++] = 0x80 | 126;
        buf[i++] = (uint8_t)(payload_len >> 8);
        buf[i++] = (uint8_t)(payload_len & 0xFF);
    } else {
        buf[i++] = 0x80 | 127;
        for (int j = 0; j < 8; j++) {
            buf[i++] = (uint8_t)((payload_len >> (56 - j * 8)) & 0xFF);
        }
    }

    uint8_t mask[4];
    if (RAND_bytes(mask, 4) != 1) {
        // Fallback: non-crypto mask is acceptable for WS masking.
        for (int j = 0; j < 4; j++) mask[j] = (uint8_t)rand();
    }
    memcpy(buf + i, mask, 4);
    i += 4;

    for (size_t j = 0; j < payload_len; j++) {
        buf[i + j] = payload[j] ^ mask[j % 4];
    }
    return i + payload_len;
}

int ws_decode(const uint8_t *buf, size_t buf_len, ws_frame_t *f) {
    if (buf_len < 2) return 0;

    uint8_t b0 = buf[0], b1 = buf[1];
    int fin = (b0 & 0x80) != 0;
    uint8_t opcode_raw = b0 & 0x0F;
    if (opcode_raw > 10 || (opcode_raw > 2 && opcode_raw < 8)) return -1;

    int masked = (b1 & 0x80) != 0;
    if (masked) return -1;  // Server must not mask

    size_t payload_len = b1 & 0x7F;
    size_t offset = 2;

    if (payload_len == 126) {
        if (buf_len < 4) return 0;
        payload_len = ((size_t)buf[2] << 8) | buf[3];
        offset = 4;
    } else if (payload_len == 127) {
        if (buf_len < 10) return 0;
        payload_len = 0;
        for (int i = 0; i < 8; i++) payload_len = (payload_len << 8) | buf[2 + i];
        offset = 10;
    }

    if (buf_len < offset + payload_len) return 0;

    f->opcode = (ws_opcode_t)opcode_raw;
    f->payload = buf + offset;
    f->payload_len = payload_len;
    f->consumed = offset + payload_len;
    f->fin = fin;
    return 1;
}

// ── Handshake ────────────────────────────────────────────────────────────────

static void b64_encode(const uint8_t *in, size_t in_len, char *out, size_t out_cap) {
    int n = EVP_EncodeBlock((unsigned char *)out, in, (int)in_len);
    if (n < 0 || (size_t)n >= out_cap) n = 0;
    out[n] = '\0';
}

static void compute_accept(const char *key_b64, char out[29]) {
    static const char *magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    uint8_t hash[20];  // SHA1 output
    unsigned int hash_len = sizeof(hash);

    EVP_MD_CTX *ctx = EVP_MD_CTX_new();
    EVP_DigestInit_ex(ctx, EVP_sha1(), NULL);
    EVP_DigestUpdate(ctx, key_b64, strlen(key_b64));
    EVP_DigestUpdate(ctx, magic, strlen(magic));
    EVP_DigestFinal_ex(ctx, hash, &hash_len);
    EVP_MD_CTX_free(ctx);

    b64_encode(hash, sizeof(hash), out, 29);
}

// Case-insensitive check for "Name: Value" header in a CRLF response.
static int has_header(const char *response, size_t len,
                      const char *name, const char *expected) {
    const char *p = response;
    const char *end = response + len;
    while (p < end) {
        const char *line_end = memmem(p, (size_t)(end - p), "\r\n", 2);
        if (!line_end) line_end = end;
        const char *colon = memchr(p, ':', (size_t)(line_end - p));
        if (colon) {
            // Trim name
            const char *ns = p;
            const char *ne = colon;
            while (ns < ne && (*ns == ' ' || *ns == '\t')) ns++;
            while (ne > ns && (ne[-1] == ' ' || ne[-1] == '\t')) ne--;

            // Trim value
            const char *vs = colon + 1;
            const char *ve = line_end;
            while (vs < ve && (*vs == ' ' || *vs == '\t')) vs++;
            while (ve > vs && (ve[-1] == ' ' || ve[-1] == '\t')) ve--;

            size_t nlen = strlen(name);
            size_t elen = strlen(expected);
            if ((size_t)(ne - ns) == nlen && strncasecmp(ns, name, nlen) == 0 &&
                (size_t)(ve - vs) == elen && strncasecmp(vs, expected, elen) == 0) {
                return 1;
            }
        }
        if (line_end == end) break;
        p = line_end + 2;
    }
    return 0;
}

int ws_handshake(bridge_conn_t *c, const char *host,
                 const char *path, const char *token) {
    // Generate 16-byte nonce -> base64 (24 chars + NUL)
    uint8_t nonce[16];
    if (RAND_bytes(nonce, sizeof(nonce)) != 1) {
        for (size_t i = 0; i < sizeof(nonce); i++) nonce[i] = (uint8_t)rand();
    }
    char key_b64[32];
    b64_encode(nonce, sizeof(nonce), key_b64, sizeof(key_b64));

    // Build request
    char req[2048];
    int req_len = snprintf(req, sizeof(req),
        "GET %s HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "Authorization: Bearer %s\r\n\r\n",
        path, host, key_b64, token);
    if (req_len < 0 || (size_t)req_len >= sizeof(req)) return -1;

    if (bridge_conn_write_all(c, req, (size_t)req_len) != 0) return -1;

    // Read response until we see \r\n\r\n
    char buf[4096];
    size_t total = 0;
    while (total < sizeof(buf)) {
        long n = bridge_conn_read(c, buf + total, sizeof(buf) - total);
        if (n <= 0) return -1;
        total += (size_t)n;
        if (memmem(buf, total, "\r\n\r\n", 4)) break;
    }
    if (total >= sizeof(buf)) return -1;

    // Status line: HTTP/1.1 101
    if (total < 12 || memcmp(buf, "HTTP/1.1 101", 12) != 0) {
        const char *eol = memmem(buf, total, "\r\n", 2);
        size_t fl = eol ? (size_t)(eol - buf) : total;
        fprintf(stderr, "ws handshake failed: %.*s\n", (int)fl, buf);
        return -1;
    }

    if (!has_header(buf, total, "upgrade", "websocket")) return -1;
    if (!has_header(buf, total, "connection", "upgrade")) return -1;

    char expected[29];
    compute_accept(key_b64, expected);
    if (!has_header(buf, total, "sec-websocket-accept", expected)) return -1;

    return 0;
}
