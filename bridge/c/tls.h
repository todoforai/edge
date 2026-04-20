// Unified connection API (TLS via OpenSSL, or plain TCP for local testing).
#ifndef BRIDGE_TLS_H
#define BRIDGE_TLS_H

#include <stddef.h>
#include <stdint.h>

typedef struct bridge_conn bridge_conn_t;

// Global init for TLS backend. Call once before any connect.
void bridge_tls_init(void);

// Connect plain TCP.  Returns NULL on failure.
bridge_conn_t *bridge_plain_connect(const char *host, uint16_t port);

// Connect TLS.  Returns NULL on failure.
bridge_conn_t *bridge_tls_connect(const char *host, uint16_t port);

// Blocking read. Returns bytes read, 0 on close, -1 on error.
long bridge_conn_read(bridge_conn_t *c, void *buf, size_t len);

// Write entire buffer. Returns 0 on success, -1 on error.
int bridge_conn_write_all(bridge_conn_t *c, const void *buf, size_t len);

// Underlying fd for poll().
int bridge_conn_fd(bridge_conn_t *c);

void bridge_conn_close(bridge_conn_t *c);

#endif
