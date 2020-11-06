CC=gcc
CFLAGS=-O3 -g -march=native -pipe -Wall -Wextra -Wno-comment -D_FORTIFY_SOURCE=2 -fsanitize=undefined -fstack-protector-strong -fcf-protection=full -fPIE -pie -Wl,-z,relro,-z,now -Wl,-z,noexecstack -Werror=incompatible-pointer-types -Werror=implicit-function-declaration

all: aem-fetcher aem-tester

aem-fetcher: all-ears.c Fetcher/*.c Include/*.c
	$(CC) $(CFLAGS) -o aem-fetcher all-ears.c Include/*.c Fetcher/*.c -lsodium

aem-tester: all-ears.c Tester/*.c Include/*.c
	$(CC) $(CFLAGS) -o aem-tester all-ears.c Include/*.c Tester/*.c -lsodium

.PHONY: clean
clean:
	-rm aem-fetcher aem-tester
