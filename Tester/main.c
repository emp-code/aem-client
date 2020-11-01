#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

int main(int argc, char *argv[]) {
	if (argc != 4 || strlen(argv[1]) != 56 || strlen(argv[2]) != (crypto_box_PUBLICKEYBYTES * 2) || strlen(argv[3]) != (crypto_kdf_KEYBYTES * 2)) {
		printf("Usage: %s OnionID SPK USK\n", argv[0]);
		return EXIT_FAILURE;
	}

	if (sodium_init() != 0) {puts("Failed sodium_init()"); return EXIT_FAILURE;}

	unsigned char spk[crypto_box_PUBLICKEYBYTES];
	sodium_hex2bin(spk, crypto_box_PUBLICKEYBYTES, argv[2], crypto_box_PUBLICKEYBYTES * 2, NULL, NULL, NULL);

	unsigned char usk[crypto_kdf_KEYBYTES];
	sodium_hex2bin(usk, crypto_kdf_KEYBYTES, argv[3], crypto_kdf_KEYBYTES * 2, NULL, NULL, NULL);

	if (allears_init(argv[1], spk, usk) != 0) {
		puts("Init failed");
		return EXIT_FAILURE;
	}

	unsigned char *tmpKey = (unsigned char*)"abcdefghijklmnopqrstuvwxyz012345";

	int ret;
	if ((ret = allears_account_create(tmpKey)) != 0) {
		printf("Failed Account/Create: %d\n", ret);
		allears_free();
		return EXIT_FAILURE;
	}

	if ((ret = allears_account_update(tmpKey, 1)) != 0) {
		printf("Failed Account/Update: %d\n", ret);
	}

	struct aem_user *userList;
	if ((ret = allears_account_browse(&userList)) < 0) {
		printf("Failed Account/Browse: %d\n", ret);
	}

	// TODO Look for the user in userList

	if ((ret = allears_account_delete(tmpKey) != 0)) {
		printf("Failed Account/Delete: %d\n", ret);
	}

	allears_free();
	return EXIT_SUCCESS;
}
