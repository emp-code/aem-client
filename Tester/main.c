#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

int main(int argc, char *argv[]) {
	if (argc != 4 || strlen(argv[2]) != (crypto_box_PUBLICKEYBYTES * 2) || strlen(argv[3]) != (crypto_box_SECRETKEYBYTES * 2)) {
		puts("Usage: allears-tester [Domain] [SPK] [USK]");
		return 1;
	}

	unsigned char spk[crypto_box_SECRETKEYBYTES];
	sodium_hex2bin(spk, crypto_box_PUBLICKEYBYTES, argv[2], crypto_box_SECRETKEYBYTES * 2, NULL, NULL, NULL);

	unsigned char usk[crypto_box_SECRETKEYBYTES];
	sodium_hex2bin(usk, crypto_box_SECRETKEYBYTES, argv[3], crypto_box_SECRETKEYBYTES * 2, NULL, NULL, NULL);

	if (allears_init(argv[1], strlen(argv[1]), spk, usk) != 0) {
		puts("Init failed");
		return 1;
	}

	unsigned char pubkey[crypto_box_PUBLICKEYBYTES];
	if (allears_address_lookup("test", pubkey) == 0) {
		puts("address/lookup OK");
	} else {	
		puts("address/lookup Not-OK");
	}

	allears_free();
	return 0;
}
