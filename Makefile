CC=gcc
CFLAGS=-O3 -g -march=native -pipe -Wall -Wextra -Wno-comment -D_FORTIFY_SOURCE=2 -fsanitize=undefined -fstack-protector-strong -fcf-protection=full -fPIE -pie -Wl,-z,relro,-z,now -Wl,-z,noexecstack -Werror=incompatible-pointer-types -Werror=implicit-function-declaration

all: allears-fetcher allears-tester

allears-fetcher: all-ears.c Fetcher/*.c
	$(CC) $(CFLAGS) -o allears-fetcher all-ears.c Fetcher/*.c -lsodium

allears-tester: all-ears.c Tester/*.c
	$(CC) $(CFLAGS) -o allears-tester all-ears.c Tester/*.c -lsodium

.PHONY: clean
clean:
	-rm allears-fetcher allears-tester
