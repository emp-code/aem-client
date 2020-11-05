#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

static int performTests(int * const retNum, const char onionId[56], const unsigned char * const spk, const unsigned char * const key_admin, const unsigned char * const key_user1, const unsigned char * const upk_user1, const unsigned char * const upk_user2) {
	// Admin
	*retNum = 0;
	if (allears_init(onionId, spk, key_admin) != 0) return -1;

	int ret;
	struct aem_user *userList;
	(*retNum)++; if ((ret = allears_account_create(upk_user1)) != 0) return ret;
	(*retNum)++; if ((ret = allears_account_create(upk_user1)) >= 0) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 2)) != 0) return ret;
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

	// User1
	if (allears_init(onionId, spk, key_user1) != 0) return -1;
	// TODO: Update private
	// TODO: Create address
	(*retNum)++; if ((ret = allears_account_create(upk_user2)) >= 0) return -1;

	// Admin
	if (allears_init(onionId, spk, key_admin) != 0) return -1;
	(*retNum)++; if ((ret = allears_account_create(upk_user2)) < 0) {return ret;}
	(*retNum)++; if ((ret = allears_account_update(upk_user2, 2)) != 0) return -1;
	// TODO: Send User1 a message

	// User1
	if (allears_init(onionId, spk, key_user1) != 0) return -1;
	// TODO: Delete non-existent address
	(*retNum)++; if ((ret = allears_account_delete(upk_user2) >= 0)) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user2, 3)) >= 0) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user2, 1)) >= 0) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 3)) >= 0) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 2)) >= 0) return -1;
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 1)) != 0) return ret;
	// TODO: Update address setting

	// Admin
	if (allears_init(onionId, spk, key_admin) != 0) return -1;
	// TODO: Send User1 a message

	// User1
	if (allears_init(onionId, spk, key_user1) != 0) return -1;
	// TODO: Upload a file
	// TODO: Browse messages
	// TODO: Delete a message
	// TODO: Delete a non-existing message
	// TODO: Browse messages, verify corrrect message deleted
	// TODO: Delete address
	(*retNum)++; if ((ret = allears_account_delete(upk_user1) != 0)) return ret;

	return 0;
}

int main(int argc, char *argv[]) {
	if (argc != 4 || strlen(argv[1]) != 56 || strlen(argv[2]) != (crypto_box_PUBLICKEYBYTES * 2) || strlen(argv[3]) != (crypto_kdf_KEYBYTES * 2)) {
		printf("Usage: %s OnionID SPK USK\n", argv[0]);
		return EXIT_FAILURE;
	}

	if (sodium_init() != 0) {puts("Failed sodium_init()"); return EXIT_FAILURE;}

	unsigned char spk[crypto_box_PUBLICKEYBYTES];
	sodium_hex2bin(spk, crypto_box_PUBLICKEYBYTES, argv[2], crypto_box_PUBLICKEYBYTES * 2, NULL, NULL, NULL);

	// Admin
	unsigned char key_admin[crypto_kdf_KEYBYTES];
	sodium_hex2bin(key_admin, crypto_kdf_KEYBYTES, argv[3], crypto_kdf_KEYBYTES * 2, NULL, NULL, NULL);

	unsigned char tmp_bs[crypto_box_SEEDBYTES];
	unsigned char tmp_sk[crypto_box_SECRETKEYBYTES];

	// User 1
	unsigned char key_user1[crypto_kdf_KEYBYTES];
	unsigned char upk_user1[crypto_box_PUBLICKEYBYTES];
	crypto_kdf_derive_from_key(key_user1, crypto_kdf_KEYBYTES, 1, "AEM-Tst0", key_admin);
	crypto_kdf_derive_from_key(tmp_bs, crypto_box_SEEDBYTES, 1, "AEM-Usr0", key_user1);
	crypto_box_seed_keypair(upk_user1, tmp_sk, tmp_bs);

	// User 2
	unsigned char upk_user2[crypto_box_PUBLICKEYBYTES];
	crypto_kdf_derive_from_key(upk_user2, crypto_box_PUBLICKEYBYTES, 2, "AEM-Tst0", key_admin);

	// Perform the tests
	int retNum = 0;
	const int ret = performTests(&retNum, argv[1], spk, key_admin, key_user1, upk_user1, upk_user2);
	if (ret != 0) printf("Failed test %d\n", retNum);

	allears_free();
	return EXIT_SUCCESS;
}
