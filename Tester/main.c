#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

int main(int argc, char *argv[]) {
	if (argc != 4 || strlen(argv[1]) != 56 || strlen(argv[2]) != (crypto_box_PUBLICKEYBYTES * 2) || strlen(argv[3]) != (crypto_kdf_KEYBYTES * 2)) {
		puts("Usage: allears-tester OnionID SPK USK");
		return 1;
	}

	unsigned char spk[crypto_box_PUBLICKEYBYTES];
	sodium_hex2bin(spk, crypto_box_PUBLICKEYBYTES, argv[2], crypto_box_PUBLICKEYBYTES * 2, NULL, NULL, NULL);

	unsigned char usk[crypto_kdf_KEYBYTES];
	sodium_hex2bin(usk, crypto_kdf_KEYBYTES, argv[3], crypto_kdf_KEYBYTES * 2, NULL, NULL, NULL);

	if (allears_init(argv[1], spk, usk) != 0) {
		puts("Init failed");
		return 1;
	}

	if (allears_message_browse() == 0) {
		puts("Ok");
	} else puts("Fail");

	allears_free();
	return 0;
}
