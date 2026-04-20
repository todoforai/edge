CC      ?= cc
CFLAGS  ?= -Os -Wall -Wextra -Wpedantic -Wshadow -Wformat=2 -Wno-unused-function \
           -ffunction-sections -fdata-sections -fomit-frame-pointer
LDFLAGS ?= -Wl,--gc-sections
LIBS    ?= -lssl -lcrypto -lutil

# macOS: openssl from homebrew, no libutil, no --gc-sections
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  LDFLAGS =
  LIBS = -lssl -lcrypto
  ifneq ($(wildcard /opt/homebrew/opt/openssl@3/include),)
    CFLAGS  += -I/opt/homebrew/opt/openssl@3/include
    LDFLAGS += -L/opt/homebrew/opt/openssl@3/lib
  endif
  ifneq ($(wildcard /usr/local/opt/openssl@3/include),)
    CFLAGS  += -I/usr/local/opt/openssl@3/include
    LDFLAGS += -L/usr/local/opt/openssl@3/lib
  endif
endif

SRCS = main.c tls.c pty.c ws.c identity.c
HDRS = tls.h pty.h ws.h identity.h json.h

.PHONY: all clean

all: build/bridge

build/bridge: $(SRCS) $(HDRS) | build
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SRCS) $(LIBS)

build:
	mkdir -p build

clean:
	rm -rf build
