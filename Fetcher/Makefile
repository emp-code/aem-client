CC=gcc
CFLAGS=-g -O1 -march=native -pipe -Wall -Wextra -Werror -Wno-comment -D_FORTIFY_SOURCE=2 -fsanitize=undefined -fstack-protector-strong -fcf-protection=full -fPIE -pie -Wl,-z,relro,-z,now -Wl,-z,noexecstack -Wno-error=unused-result  -Wno-error=unused-function -Wno-error=unused-parameter -Wno-error=unused-variable

objects = main.o ../all-ears.o

allears-fetcher: *.c
	$(CC) $(CFLAGS) -o allears-fetcher main.c ../all-ears.c ../Include/Addr32.c -lsodium -lmbedtls -lmbedcrypto -lmbedx509 -lcap

.PHONY: clean
clean:
	-rm allears-fetcher
