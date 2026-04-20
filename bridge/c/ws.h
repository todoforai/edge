#ifndef BRIDGE_WS_H
#define BRIDGE_WS_H

#include <stddef.h>
#include <stdint.h>
#include "tls.h"

typedef enum {
    WS_OP_CONT  = 0x0,
    WS_OP_TEXT  = 0x1,
    WS_OP_BIN   = 0x2,
    WS_OP_CLOSE = 0x8,
    WS_OP_PING  = 0x9,
    WS_OP_PONG  = 0xA,
} ws_opcode_t;

typedef struct {
    ws_opcode_t opcode;
    const uint8_t *payload;
    size_t payload_len;
    size_t consumed;   // total bytes in the frame (header + payload)
    int fin;
} ws_frame_t;

// Encode a client->server frame with a random mask. Returns bytes written.
// `buf` must have space for payload_len + 14.
size_t ws_encode(uint8_t *buf, ws_opcode_t opcode,
                 const uint8_t *payload, size_t payload_len);

// Try to decode one server->client frame. Returns:
//   1  frame parsed (fields in *f, f->consumed bytes used)
//   0  need more data
//  -1  protocol error
int ws_decode(const uint8_t *buf, size_t buf_len, ws_frame_t *f);

// Client-side WebSocket handshake with Bearer auth.
// Returns 0 on success, -1 on failure.
int ws_handshake(bridge_conn_t *c, const char *host,
                 const char *path, const char *token);

#endif
