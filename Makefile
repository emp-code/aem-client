CC=gcc
CFLAGS=-g -O1 -march=native -pipe -Wall -Wextra -Werror -Wno-comment -D_FORTIFY_SOURCE=2 -fsanitize=undefined -fstack-protector-strong -fcf-protection=full -fPIE -pie -Wl,-z,relro,-z,now -Wl,-z,noexecstack -Wno-error=unused-result  -Wno-error=unused-function -Wno-error=unused-parameter -Wno-error=unused-variable

all: allears-fetcher allears-tester

allears-fetcher: all-ears.c Fetcher/*.c
	$(CC) $(CFLAGS) -o allears-fetcher all-ears.c Fetcher/*.c -lsodium -lmbedtls -lmbedcrypto -lmbedx509

allears-tester: all-ears.c Tester/*.c
	$(CC) $(CFLAGS) -o allears-tester all-ears.c Tester/*.c -lsodium -lmbedtls -lmbedcrypto -lmbedx509

.PHONY: clean
clean:
	-rm allears-fetcher allears-tester
