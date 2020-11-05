#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

int performTests(int * const retNum, const unsigned char * const key_admin, const unsigned char * const key_user1, const unsigned char * const key_user2, const unsigned char * const upk_user1, const unsigned char * const upk_user2) {
	*retNum = 0;

	int ret;
	struct aem_user *userList;
	(*retNum)++; if ((ret = allears_account_create(upk_user1)) != 0) return ret;
	(*retNum)++; if ((ret = allears_account_create(upk_user1)) => 0) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 1)) != 0) return ret;
	(*retNum)++; if ((ret = allears_account_browse(&userList)) < 0)  return ret;

	// Account created, level set to one: check result
	(*retNum)++;
	int found = -1;
	for (int i = 0; i < ret; i++) {
		if (memcmp(userList[i].pk, upk_user1, crypto_box_PUBLICKEYBYTES) == 0) {
			found = i;
			break;
		}
	}

	if (found == -1) return -1;
	free(userList);

	(*retNum)++; if ((ret = allears_account_delete(upk_user1) != 0)) return ret;

	return 0;
}

int main(int argc, char *argv[]) {
	if (argc != 4 || strlen(argv[1]) != 56 || strlen(argv[2]) != (crypto_box_PUBLICKEYBYTES * 2) || strlen(argv[3]) != (crypto_kdf_KEYBYTES * 2)) {
		printf("Usage: %s OnionID SPK USK\n", argv[0]);
		return EXIT_FAILURE;
	}

	if (sodium_init() != 0) {puts("Failed sodium_init()"); return EXIT_FAILURE;}

	// Admin
	unsigned char spk[crypto_box_PUBLICKEYBYTES];
	sodium_hex2bin(spk, crypto_box_PUBLICKEYBYTES, argv[2], crypto_box_PUBLICKEYBYTES * 2, NULL, NULL, NULL);

	unsigned char key_admin[crypto_kdf_KEYBYTES];
	sodium_hex2bin(key_admin, crypto_kdf_KEYBYTES, argv[3], crypto_kdf_KEYBYTES * 2, NULL, NULL, NULL);

	unsigned char tmp_bs[crypto_box_SEEDBYTES];
	unsigned char tmp_sk[crypto_box_SECRETKEYBYTES];

	if (allears_init(argv[1], spk, key_admin) != 0) return EXIT_FAILURE;

	// User 1
	unsigned char key_user1[crypto_kdf_KEYBYTES];
	unsigned char upk_user1[crypto_box_PUBLICKEYBYTES];
	crypto_kdf_derive_from_key(key_user1, crypto_kdf_KEYBYTES, 1, "AEM-Tst0", key_admin);
	crypto_kdf_derive_from_key(tmp_bs, crypto_box_SEEDBYTES, 1, "AEM-Usr0", key_user1);
	crypto_box_seed_keypair(upk_user1, tmp_sk, tmp_bs);

	// User 2
	unsigned char key_user2[crypto_kdf_KEYBYTES];
	unsigned char upk_user2[crypto_box_PUBLICKEYBYTES];
	crypto_kdf_derive_from_key(key_user2, crypto_kdf_KEYBYTES, 2, "AEM-Tst0", key_admin);
	crypto_kdf_derive_from_key(tmp_bs, crypto_box_SEEDBYTES, 1, "AEM-Usr0", key_user2);
	crypto_box_seed_keypair(upk_user2, tmp_sk, tmp_bs);

	// Perform the tests
	int retNum = 0;
	const int ret = performTests(&retNum, key_admin, key_user1, key_user2, upk_user1, upk_user2);
	if (ret != 0) printf("Failed test %d\n", retNum);

	allears_free();
	return EXIT_SUCCESS;
}
