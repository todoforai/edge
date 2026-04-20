// TODOforAI Bridge — C runtime. WebSocket → PTY relay.
//
// Protocol v2 (multi-session):
//   Text frames (JSON) — Control messages:
//     → {"type":"identity","data":{...}}
//     ← {"type":"exec","todoId":"uuid","blockId":"..."}
//     ← {"type":"input","todoId":"uuid","blockId":"...","data":"base64"}
//     ← {"type":"resize","todoId":"uuid","rows":N,"cols":N}
//     ← {"type":"signal","todoId":"uuid","sig":N}
//     ← {"type":"kill","todoId":"uuid"}
//     → {"type":"output","todoId":"uuid","blockId":"...","data":"base64"}
//     → {"type":"exit","todoId":"uuid","blockId":"...","code":N}
//     ↔ {"type":"error","todoId":"uuid","blockId":"...","code":"ERR","message":"..."}

#define _POSIX_C_SOURCE 200809L

#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <openssl/evp.h>

#include "identity.h"
#include "json.h"
#include "pty.h"
#include "tls.h"
#include "ws.h"

// ── Defaults ────────────────────────────────────────────────────────────────

#define DEFAULT_HOST         "api.todofor.ai"
#define DEFAULT_PORT         443
#define DEFAULT_PATH         "/ws/v2/edge-shell"
#define DEFAULT_PATH_SANDBOX "/ws/v2/edge-shell?deviceType=SANDBOX"
#define DEFAULT_SHELL        "/bin/sh"
#define BUF_SIZE             4096
#define MAX_SESSIONS         16
#define TODO_ID_LEN          36
#define BLOCK_ID_CAP         64

// ── Session ─────────────────────────────────────────────────────────────────

typedef struct {
    int active;
    char todo_id[TODO_ID_LEN + 1];           // NUL-terminated
    char block_id[BLOCK_ID_CAP + 1];
    size_t block_id_len;
    bridge_pty_t pty;
} session_t;

typedef struct {
    bridge_conn_t *conn;
    session_t sessions[MAX_SESSIONS];

    // WebSocket receive buffer
    uint8_t ws_buf[BUF_SIZE * 8];
    size_t ws_len;

    // PTY read + base64 encode scratch
    uint8_t pty_buf[BUF_SIZE];
    char b64_buf[BUF_SIZE * 2];
} edge_t;

// ── Helpers ─────────────────────────────────────────────────────────────────

static int is_valid_uuid(const char *s, size_t len) {
    if (len != 36) return 0;
    for (size_t i = 0; i < 36; i++) {
        char c = s[i];
        int is_dash = (i == 8 || i == 13 || i == 18 || i == 23);
        if (is_dash) {
            if (c != '-') return 0;
        } else {
            if (!isxdigit((unsigned char)c)) return 0;
        }
    }
    return 1;
}

static session_t *find_session(edge_t *e, const char *tid, size_t tid_len) {
    for (int i = 0; i < MAX_SESSIONS; i++) {
        session_t *s = &e->sessions[i];
        if (s->active && strlen(s->todo_id) == tid_len &&
            memcmp(s->todo_id, tid, tid_len) == 0) {
            return s;
        }
    }
    return NULL;
}

static session_t *free_slot(edge_t *e) {
    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (!e->sessions[i].active) return &e->sessions[i];
    }
    return NULL;
}

static void set_block_id(session_t *s, const char *id, size_t id_len) {
    if (!id) return;
    size_t n = id_len < BLOCK_ID_CAP ? id_len : BLOCK_ID_CAP;
    memcpy(s->block_id, id, n);
    s->block_id[n] = '\0';
    s->block_id_len = n;
}

// Send a text WebSocket frame. Allocates on heap for large payloads.
static int ws_send_text(edge_t *e, const char *payload, size_t len) {
    size_t frame_cap = len + 14;
    uint8_t *buf = malloc(frame_cap);
    if (!buf) return -1;
    size_t frame_len = ws_encode(buf, WS_OP_TEXT, (const uint8_t *)payload, len);
    int rc = bridge_conn_write_all(e->conn, buf, frame_len);
    free(buf);
    return rc;
}

static int ws_send_frame(edge_t *e, ws_opcode_t op, const uint8_t *payload, size_t len) {
    size_t frame_cap = len + 14;
    uint8_t *buf = malloc(frame_cap);
    if (!buf) return -1;
    size_t frame_len = ws_encode(buf, op, payload, len);
    int rc = bridge_conn_write_all(e->conn, buf, frame_len);
    free(buf);
    return rc;
}

// Returns 0 so call sites can `return send_error(...)` from void functions.
static int send_error(edge_t *e,
                      const char *tid, size_t tid_len,
                      const char *bid, size_t bid_len,
                      const char *code, const char *message) {
    char buf[512];
    int n;
    if (tid && bid) {
        n = snprintf(buf, sizeof(buf),
            "{\"type\":\"error\",\"todoId\":\"%.*s\",\"blockId\":\"%.*s\","
            "\"code\":\"%s\",\"message\":\"%s\"}",
            (int)tid_len, tid, (int)bid_len, bid, code, message);
    } else if (tid) {
        n = snprintf(buf, sizeof(buf),
            "{\"type\":\"error\",\"todoId\":\"%.*s\","
            "\"code\":\"%s\",\"message\":\"%s\"}",
            (int)tid_len, tid, code, message);
    } else {
        n = snprintf(buf, sizeof(buf),
            "{\"type\":\"error\",\"code\":\"%s\",\"message\":\"%s\"}",
            code, message);
    }
    if (n > 0 && (size_t)n < sizeof(buf)) {
        ws_send_text(e, buf, (size_t)n);
    }
    fprintf(stderr, "error %s: %s\n", code, message);
    return 0;
}

static void send_exit(edge_t *e, session_t *s, int code) {
    char buf[256];
    int n;
    if (s->block_id_len > 0) {
        n = snprintf(buf, sizeof(buf),
            "{\"type\":\"exit\",\"todoId\":\"%s\",\"blockId\":\"%s\",\"code\":%d}",
            s->todo_id, s->block_id, code);
    } else {
        n = snprintf(buf, sizeof(buf),
            "{\"type\":\"exit\",\"todoId\":\"%s\",\"code\":%d}",
            s->todo_id, code);
    }
    if (n > 0 && (size_t)n < sizeof(buf)) {
        ws_send_text(e, buf, (size_t)n);
    }
    fprintf(stderr, "PTY exited: %s code=%d\n", s->todo_id, code);
}

static void forward_pty_output(edge_t *e, session_t *s) {
    long n = bridge_pty_read(&s->pty, e->pty_buf, sizeof(e->pty_buf));
    if (n <= 0) return;

    // base64 encode raw PTY bytes
    int b64_len = EVP_EncodeBlock((unsigned char *)e->b64_buf, e->pty_buf, (int)n);
    if (b64_len <= 0) return;

    // Build {"type":"output",...} — fits in a heap-allocated buffer
    size_t cap = (size_t)b64_len + 256;
    char *msg = malloc(cap);
    if (!msg) return;
    int mn;
    if (s->block_id_len > 0) {
        mn = snprintf(msg, cap,
            "{\"type\":\"output\",\"todoId\":\"%s\",\"blockId\":\"%s\",\"data\":\"%.*s\"}",
            s->todo_id, s->block_id, b64_len, e->b64_buf);
    } else {
        mn = snprintf(msg, cap,
            "{\"type\":\"output\",\"todoId\":\"%s\",\"data\":\"%.*s\"}",
            s->todo_id, b64_len, e->b64_buf);
    }
    if (mn > 0 && (size_t)mn < cap) {
        ws_send_text(e, msg, (size_t)mn);
    }
    free(msg);
}

// ── Command dispatch ────────────────────────────────────────────────────────

// Returns 0 (ignored). Shaped to let call sites use `return send_error(...)`.
static int handle_command(edge_t *e, const char *msg, size_t msg_len) {
    const char *type = NULL; size_t type_len = 0;
    if (!json_str(msg, msg_len, "type", &type, &type_len)) return 0;

    const char *tid = NULL; size_t tid_len = 0;
    int has_tid = json_str(msg, msg_len, "todoId", &tid, &tid_len);

    const char *bid = NULL; size_t bid_len = 0;
    int has_bid = json_str(msg, msg_len, "blockId", &bid, &bid_len);

    #define IS(s) (type_len == sizeof(s) - 1 && memcmp(type, s, sizeof(s) - 1) == 0)

    if (IS("exec")) {
        if (!has_tid)
            return send_error(e, NULL, 0, NULL, 0, "MISSING_TODO_ID", "exec requires todoId");
        if (!is_valid_uuid(tid, tid_len))
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "INVALID_TODO_ID", "todoId must be a valid UUID");
        if (find_session(e, tid, tid_len))
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "SESSION_EXISTS", "session already exists");
        session_t *slot = free_slot(e);
        if (!slot)
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "MAX_SESSIONS", "max 16 concurrent sessions");
        if (bridge_pty_spawn(&slot->pty, DEFAULT_SHELL) != 0)
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "SPAWN_FAILED", "failed to spawn PTY");
        slot->active = 1;
        memcpy(slot->todo_id, tid, TODO_ID_LEN);
        slot->todo_id[TODO_ID_LEN] = '\0';
        slot->block_id_len = 0;
        slot->block_id[0] = '\0';
        if (has_bid) set_block_id(slot, bid, bid_len);
        fprintf(stderr, "PTY spawned for %s\n", slot->todo_id);

    } else if (IS("input")) {
        if (!has_tid)
            return send_error(e, NULL, 0, NULL, 0, "MISSING_TODO_ID", "input requires todoId");
        session_t *s = find_session(e, tid, tid_len);
        if (!s)
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "SESSION_NOT_FOUND", "no session for todoId");
        if (has_bid) set_block_id(s, bid, bid_len);

        const char *b64 = NULL; size_t b64_len = 0;
        if (!json_str(msg, msg_len, "data", &b64, &b64_len))
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "MISSING_DATA", "input requires data");

        // Decoded size ≤ b64_len * 3 / 4
        if (b64_len / 4 * 3 > BUF_SIZE)
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "INPUT_TOO_LARGE", "input exceeds 4096 bytes");

        uint8_t decoded[BUF_SIZE + 4];
        int dec_len = EVP_DecodeBlock(decoded, (const unsigned char *)b64, (int)b64_len);
        if (dec_len < 0)
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "INVALID_BASE64", "data is not valid base64");

        // EVP_DecodeBlock ignores '=' padding — strip up to 2 trailing bytes.
        int pad = 0;
        if (b64_len >= 1 && b64[b64_len - 1] == '=') pad++;
        if (b64_len >= 2 && b64[b64_len - 2] == '=') pad++;
        if (dec_len >= pad) dec_len -= pad;

        if (bridge_pty_write_all(&s->pty, decoded, (size_t)dec_len) != 0) {
            fprintf(stderr, "PTY write error\n");
        }

    } else if (IS("resize")) {
        if (!has_tid) return 0;
        session_t *s = find_session(e, tid, tid_len);
        if (!s) return 0;
        long rows = 24, cols = 80;
        json_int(msg, msg_len, "rows", &rows);
        json_int(msg, msg_len, "cols", &cols);
        bridge_pty_resize(&s->pty, (uint16_t)rows, (uint16_t)cols);

    } else if (IS("signal")) {
        if (!has_tid) return 0;
        session_t *s = find_session(e, tid, tid_len);
        if (!s) return 0;
        long sig = 0;
        if (!json_int(msg, msg_len, "sig", &sig))
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "MISSING_SIG", "signal requires sig");
        if (!bridge_pty_signal(&s->pty, (int)sig))
            return send_error(e, tid, tid_len, has_bid ? bid : NULL, bid_len,
                              "SIGNAL_NOT_ALLOWED", "signal not in whitelist");

    } else if (IS("kill")) {
        if (!has_tid) return 0;
        for (int i = 0; i < MAX_SESSIONS; i++) {
            session_t *s = &e->sessions[i];
            if (s->active && strlen(s->todo_id) == tid_len &&
                memcmp(s->todo_id, tid, tid_len) == 0) {
                bridge_pty_close(&s->pty);
                s->active = 0;
                fprintf(stderr, "Session killed: %s\n", s->todo_id);
                break;
            }
        }
    }

    #undef IS
    return 0;
}

// ── Main loop ───────────────────────────────────────────────────────────────

static int handle_ws_data(edge_t *e) {
    long n = bridge_conn_read(e->conn, e->ws_buf + e->ws_len,
                              sizeof(e->ws_buf) - e->ws_len);
    if (n <= 0) return -1;
    e->ws_len += (size_t)n;

    for (;;) {
        ws_frame_t f;
        int r = ws_decode(e->ws_buf, e->ws_len, &f);
        if (r == 0) break;           // need more
        if (r < 0) return -1;        // protocol error

        switch (f.opcode) {
            case WS_OP_TEXT:
                (void)handle_command(e, (const char *)f.payload, f.payload_len);
                break;
            case WS_OP_PING:
                ws_send_frame(e, WS_OP_PONG, f.payload, f.payload_len);
                break;
            case WS_OP_CLOSE:
                return -1;
            default:
                break;
        }

        size_t remaining = e->ws_len - f.consumed;
        memmove(e->ws_buf, e->ws_buf + f.consumed, remaining);
        e->ws_len = remaining;
    }
    return 0;
}

static int run(edge_t *e) {
    // Send identity
    char id_json[1024];
    int id_len = bridge_identity_json(id_json, sizeof(id_json));
    if (id_len < 0) return -1;
    if (ws_send_text(e, id_json, (size_t)id_len) != 0) return -1;
    fprintf(stderr, "Identified\n");

    for (;;) {
        // Reap exited PTYs
        for (int i = 0; i < MAX_SESSIONS; i++) {
            session_t *s = &e->sessions[i];
            if (!s->active) continue;
            int code;
            if (bridge_pty_reap(&s->pty, &code)) {
                send_exit(e, s, code);
                bridge_pty_close(&s->pty);
                s->active = 0;
            }
        }

        // Build poll fds
        struct pollfd fds[1 + MAX_SESSIONS];
        int session_idx[MAX_SESSIONS];  // map fds[1+k] -> session slot
        fds[0].fd = bridge_conn_fd(e->conn);
        fds[0].events = POLLIN;
        fds[0].revents = 0;
        nfds_t nfds = 1;
        for (int i = 0; i < MAX_SESSIONS; i++) {
            session_t *s = &e->sessions[i];
            if (!s->active) continue;
            fds[nfds].fd = s->pty.master_fd;
            fds[nfds].events = POLLIN;
            fds[nfds].revents = 0;
            session_idx[nfds - 1] = i;
            nfds++;
        }

        int pr = poll(fds, nfds, 100);
        if (pr < 0) {
            if (errno == EINTR) continue;
            return -1;
        }

        if (fds[0].revents & (POLLERR | POLLHUP)) return -1;
        if (fds[0].revents & POLLIN) {
            if (handle_ws_data(e) != 0) return -1;
        }

        for (nfds_t k = 1; k < nfds; k++) {
            session_t *s = &e->sessions[session_idx[k - 1]];
            if (!s->active) continue;
            if (fds[k].revents & POLLIN) forward_pty_output(e, s);
            if (fds[k].revents & (POLLHUP | POLLERR)) {
                int code = bridge_pty_close(&s->pty);
                send_exit(e, s, code);
                s->active = 0;
            }
        }
    }
}

// ── Args / env ──────────────────────────────────────────────────────────────

static const char *value_flags[] = { "--host", "--port", NULL };

static int is_value_flag(const char *arg) {
    for (const char **f = value_flags; *f; f++) {
        if (strcmp(arg, *f) == 0) return 1;
    }
    return 0;
}

static const char *find_flag_value(int argc, char **argv, const char *name) {
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], name) == 0) return argv[i + 1];
    }
    return NULL;
}

static int has_flag(int argc, char **argv, const char *name) {
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], name) == 0) return 1;
    }
    return 0;
}

static const char *positional_token(int argc, char **argv) {
    for (int i = 1; i < argc; i++) {
        if (argv[i][0] == '-') {
            if (is_value_flag(argv[i])) i++;  // skip value
            continue;
        }
        return argv[i];
    }
    return NULL;
}

// Read edge.token=<value> from /proc/cmdline. Returns 0 or -1.
static int read_cmdline_token(char *out, size_t cap) {
    int fd = open("/proc/cmdline", O_RDONLY);
    if (fd < 0) return -1;
    char buf[4096];
    ssize_t n = read(fd, buf, sizeof(buf) - 1);
    close(fd);
    if (n <= 0) return -1;
    buf[n] = '\0';

    const char *needle = "edge.token=";
    const char *p = strstr(buf, needle);
    if (!p) return -1;
    p += strlen(needle);
    size_t i = 0;
    while (p[i] && p[i] != ' ' && p[i] != '\n' && i < cap - 1) {
        out[i] = p[i]; i++;
    }
    if (i == 0) return -1;
    out[i] = '\0';
    return 0;
}

// ── main ────────────────────────────────────────────────────────────────────

int main(int argc, char **argv) {
    bridge_tls_init();

    // Try kernel cmdline first (Firecracker sandbox)
    char cmdline_tok[512];
    int from_cmdline = (read_cmdline_token(cmdline_tok, sizeof(cmdline_tok)) == 0);

    const char *token;
    if (from_cmdline) {
        token = cmdline_tok;
    } else {
        token = positional_token(argc, argv);
        if (!token) token = getenv("EDGE_TOKEN");
    }

    if (!token || !*token) {
        fprintf(stderr, "Usage: bridge <token> [--plain] [--host HOST] [--port PORT]\n");
        fprintf(stderr, "  env: EDGE_TOKEN, EDGE_HOST, EDGE_PORT, EDGE_PLAIN=1\n");
        return 1;
    }

    int use_plain = has_flag(argc, argv, "--plain");
    if (!use_plain) {
        const char *ep = getenv("EDGE_PLAIN");
        use_plain = ep && ep[0] == '1';
    }

    const char *host = find_flag_value(argc, argv, "--host");
    if (!host) host = getenv("EDGE_HOST");
    if (!host) host = DEFAULT_HOST;

    const char *port_s = find_flag_value(argc, argv, "--port");
    if (!port_s) port_s = getenv("EDGE_PORT");
    uint16_t port;
    if (port_s) {
        int p = atoi(port_s);
        port = (p > 0 && p <= 65535) ? (uint16_t)p : DEFAULT_PORT;
    } else {
        port = use_plain ? 4000 : DEFAULT_PORT;
    }

    const char *path = from_cmdline ? DEFAULT_PATH_SANDBOX : DEFAULT_PATH;

    fprintf(stderr, "Connecting to %s:%u (%s)...\n",
            host, (unsigned)port, use_plain ? "plain" : "tls");

    bridge_conn_t *conn = use_plain
        ? bridge_plain_connect(host, port)
        : bridge_tls_connect(host, port);
    if (!conn) {
        fprintf(stderr, "connect failed\n");
        return 1;
    }

    if (ws_handshake(conn, host, path, token) != 0) {
        bridge_conn_close(conn);
        return 1;
    }
    fprintf(stderr, "Connected\n");

    edge_t *e = calloc(1, sizeof(*e));
    if (!e) { bridge_conn_close(conn); return 1; }
    e->conn = conn;

    int rc = run(e);

    for (int i = 0; i < MAX_SESSIONS; i++) {
        if (e->sessions[i].active) bridge_pty_close(&e->sessions[i].pty);
    }
    bridge_conn_close(conn);
    free(e);

    if (rc != 0) fprintf(stderr, "Disconnected\n");
    return rc == 0 ? 0 : 1;
}
