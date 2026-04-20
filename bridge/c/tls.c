// TLS (OpenSSL) + plain TCP connection wrappers.
#define _POSIX_C_SOURCE 200809L
#include "tls.h"

#include <errno.h>
#include <netdb.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#include <openssl/ssl.h>
#include <openssl/err.h>

typedef enum { CONN_PLAIN, CONN_TLS } conn_kind_t;

struct bridge_conn {
    conn_kind_t kind;
    int fd;
    SSL *ssl;       // TLS only
    SSL_CTX *ctx;   // TLS only
};

// ── TCP connect ──────────────────────────────────────────────────────────────

static int tcp_connect(const char *host, uint16_t port) {
    char port_s[8];
    snprintf(port_s, sizeof(port_s), "%u", port);

    struct addrinfo hints, *res = NULL;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    if (getaddrinfo(host, port_s, &hints, &res) != 0) return -1;

    int fd = -1;
    for (struct addrinfo *a = res; a; a = a->ai_next) {
        fd = socket(a->ai_family, a->ai_socktype, a->ai_protocol);
        if (fd < 0) continue;
        if (connect(fd, a->ai_addr, a->ai_addrlen) == 0) break;
        close(fd);
        fd = -1;
    }
    freeaddrinfo(res);
    return fd;
}

// ── Init ─────────────────────────────────────────────────────────────────────

void bridge_tls_init(void) {
    OPENSSL_init_ssl(0, NULL);
}

// ── Plain ────────────────────────────────────────────────────────────────────

bridge_conn_t *bridge_plain_connect(const char *host, uint16_t port) {
    int fd = tcp_connect(host, port);
    if (fd < 0) return NULL;
    bridge_conn_t *c = calloc(1, sizeof(*c));
    if (!c) { close(fd); return NULL; }
    c->kind = CONN_PLAIN;
    c->fd = fd;
    return c;
}

// ── TLS ──────────────────────────────────────────────────────────────────────

bridge_conn_t *bridge_tls_connect(const char *host, uint16_t port) {
    int fd = tcp_connect(host, port);
    if (fd < 0) return NULL;

    SSL_CTX *ctx = SSL_CTX_new(TLS_client_method());
    if (!ctx) { close(fd); return NULL; }
    if (SSL_CTX_set_default_verify_paths(ctx) != 1) {
        SSL_CTX_free(ctx); close(fd); return NULL;
    }

    SSL *ssl = SSL_new(ctx);
    if (!ssl) { SSL_CTX_free(ctx); close(fd); return NULL; }

    SSL_set_tlsext_host_name(ssl, host);
    SSL_set_fd(ssl, fd);

    if (SSL_connect(ssl) != 1) {
        SSL_free(ssl); SSL_CTX_free(ctx); close(fd);
        return NULL;
    }

    bridge_conn_t *c = calloc(1, sizeof(*c));
    if (!c) { SSL_free(ssl); SSL_CTX_free(ctx); close(fd); return NULL; }
    c->kind = CONN_TLS;
    c->fd = fd;
    c->ssl = ssl;
    c->ctx = ctx;
    return c;
}

// ── Unified I/O ──────────────────────────────────────────────────────────────

long bridge_conn_read(bridge_conn_t *c, void *buf, size_t len) {
    if (c->kind == CONN_TLS) {
        int n = SSL_read(c->ssl, buf, (int)len);
        if (n <= 0) return -1;
        return n;
    }
    ssize_t n = read(c->fd, buf, len);
    if (n < 0) return -1;
    return (long)n;
}

int bridge_conn_write_all(bridge_conn_t *c, const void *buf, size_t len) {
    const uint8_t *p = buf;
    size_t written = 0;
    while (written < len) {
        if (c->kind == CONN_TLS) {
            int n = SSL_write(c->ssl, p + written, (int)(len - written));
            if (n <= 0) return -1;
            written += (size_t)n;
        } else {
            ssize_t n = write(c->fd, p + written, len - written);
            if (n < 0) {
                if (errno == EINTR) continue;
                return -1;
            }
            written += (size_t)n;
        }
    }
    return 0;
}

int bridge_conn_fd(bridge_conn_t *c) { return c->fd; }

void bridge_conn_close(bridge_conn_t *c) {
    if (!c) return;
    if (c->kind == CONN_TLS) {
        if (c->ssl) { SSL_shutdown(c->ssl); SSL_free(c->ssl); }
        if (c->ctx) SSL_CTX_free(c->ctx);
    }
    if (c->fd >= 0) close(c->fd);
    free(c);
}
