#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

static int performTests(int * const retNum, const char onionId[56], const unsigned char * const pkApi, const unsigned char * const pkSig, const unsigned char * const saltNm, const unsigned char * const key_admin, const unsigned char * const key_user1, const unsigned char * const upk_user1, const unsigned char * const upk_user2) {
	// Admin
	*retNum = 0;
	if (allears_init(onionId, pkApi, pkSig, saltNm, key_admin) != 0) return -999; //0

	int ret;
	struct aem_user *userList;
	(*retNum)++; if ((ret = allears_account_create(upk_user1)) != 0) return ret; //1
	(*retNum)++; if ((ret = allears_account_create(upk_user1)) >= 0) return -999; //2
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 2)) != 0) return ret; //3
	(*retNum)++; if ((ret = allears_account_browse(&userList)) < 0)  return ret; //4

	// Account created, level set to one: check result
	(*retNum)++;
	int found = -1;
	for (int i = 0; i < ret; i++) {
		if (memcmp(userList[i].pk, upk_user1, crypto_box_PUBLICKEYBYTES) == 0) {
			found = i;
			break;
		}
	}

	if (found == -1) return -999; //5
	free(userList);

	unsigned char privateData[AEM_LEN_PRIVATE];
	memset(privateData, 0xFC, AEM_LEN_PRIVATE);

	struct aem_address addr;

	char testAddress[16];
	sprintf(testAddress, "aemtest%.8x", randombytes_random());

	// User1
	if (allears_init(onionId, pkApi, pkSig, saltNm, key_user1) != 0) return -999;
	(*retNum)++; if ((ret = allears_account_create(upk_user2)) >= 0) return -999; //6
	(*retNum)++; if ((ret = allears_private_update(privateData)) != 0) return -999; //7
	(*retNum)++; if ((ret = allears_address_create(&addr, testAddress, 15)) != 0) return -999; //8
	addr.flags = AEM_ADDR_FLAG_ACCINT | AEM_ADDR_FLAG_ACCEXT;

	// Admin
	if (allears_init(onionId, pkApi, pkSig, saltNm, key_admin) != 0) return -999;
	(*retNum)++; if ((ret = allears_account_create(upk_user2)) != 0) return ret; //9
	(*retNum)++; if ((ret = allears_account_update(upk_user2, 2)) != 0) return -999; //10
	(*retNum)++; if ((ret = allears_message_create("Test Message", 12, "This here is a test message.", 28, "admin", 5, testAddress, 15, NULL, 0, NULL)) >= 0) return -999; //11

	// User1
	if (allears_init(onionId, pkApi, pkSig, saltNm, key_user1) != 0) return -999;
	(*retNum)++; if ((ret = allears_address_delete(UINT64_MAX)) >= 0) return -999; //12
	(*retNum)++; if ((ret = allears_account_delete(upk_user2)) >= 0) return -999; //13
	(*retNum)++; if ((ret = allears_account_update(upk_user2, 3)) >= 0) return -999; //14
	(*retNum)++; if ((ret = allears_account_update(upk_user2, 1)) >= 0) return -999; //15
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 3)) >= 0) return -999; //16
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 2)) >= 0) return -999; //17
	(*retNum)++; if ((ret = allears_account_update(upk_user1, 1)) != 0) return ret; //18
	(*retNum)++; if ((ret = allears_address_update(&addr, 1)) != 0) return ret; //19

	// Admin
	if (allears_init(onionId, pkApi, pkSig, saltNm, key_admin) != 0) return -999;
	(*retNum)++; if ((ret = allears_account_delete(upk_user2)) != 0) {puts("23?");return ret;} //20
	(*retNum)++; if ((ret = allears_message_public("Test announcement", 17, "This announcement is a part of a test run.", 42)) != 0) return ret; //21
	(*retNum)++; if ((ret = allears_message_create("Test Message", 12, "This here is a test message.", 28, "admin", 5, testAddress, 15, NULL, 0, NULL)) != 0) return ret; //22

	// User1
	if (allears_init(onionId, pkApi, pkSig, saltNm, key_user1) != 0) return -999; //26
	(*retNum)++; if ((ret = allears_message_upload("test.txt", 8, (unsigned char*)"This is an uploaded test file.", 30)) != 0) return ret; //23
	(*retNum)++; if ((ret = allears_message_browse()) != 0) return ret; //24

	struct aem_intMsg *msg = allears_intmsg(0);
	if (msg == NULL) return -1000;
	if (strcmp(msg->subj, "Test Message") != 0) return -1001;
	if (strcmp(msg->body, "This here is a test message.") != 0) return -1002;

	msg = allears_intmsg(1);
	if (msg == NULL) return -1010;
	if (strcmp(msg->subj, "Test announcement") != 0) return -1011;
	if (strcmp(msg->body, "This announcement is a part of a test run.") != 0) return -1012;

	(*retNum)++; if ((ret = allears_message_delete((unsigned char[]){0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0})) >= 0) return -999; //25
	(*retNum)++; if ((ret = allears_message_delete(msg->msgId)) != 0) return ret; //26

	(*retNum)++; if ((ret = allears_message_browse()) != 0) return ret; //27
	// TODO: Check messages

	(*retNum)++; if ((ret = allears_address_delete(addr.hash)) != 0) return ret; //28
	(*retNum)++; if ((ret = allears_account_delete(upk_user1)) != 0) return ret; //29

	return 0;
}

int main(int argc, char *argv[]) {
	// TODO: Add SigPub
	if (argc != 6 || strlen(argv[1]) != 56 || strlen(argv[2]) != (crypto_box_PUBLICKEYBYTES * 2) || strlen(argv[3]) != (crypto_sign_PUBLICKEYBYTES * 2) || strlen(argv[4]) != (crypto_pwhash_SALTBYTES * 2) || strlen(argv[5]) != (crypto_kdf_KEYBYTES * 2)) {
		printf("Usage: %s OnionID PkApi PkSig SaltNm USK\n", argv[0]);
		return EXIT_FAILURE;
	}

	if (sodium_init() != 0) {puts("Failed sodium_init()"); return EXIT_FAILURE;}

	unsigned char pkApi[crypto_box_PUBLICKEYBYTES];
	sodium_hex2bin(pkApi, crypto_box_PUBLICKEYBYTES, argv[2], crypto_box_PUBLICKEYBYTES * 2, NULL, NULL, NULL);

	unsigned char pkSig[crypto_sign_PUBLICKEYBYTES];
	sodium_hex2bin(pkSig, crypto_sign_PUBLICKEYBYTES, argv[3], crypto_sign_PUBLICKEYBYTES * 2, NULL, NULL, NULL);

	unsigned char saltNm[crypto_pwhash_SALTBYTES];
	sodium_hex2bin(saltNm, crypto_pwhash_SALTBYTES, argv[4], crypto_pwhash_SALTBYTES * 2, NULL, NULL, NULL);

	// Admin
	unsigned char key_admin[crypto_kdf_KEYBYTES];
	sodium_hex2bin(key_admin, crypto_kdf_KEYBYTES, argv[5], crypto_kdf_KEYBYTES * 2, NULL, NULL, NULL);

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
	const int ret = performTests(&retNum, argv[1], pkApi, pkSig, saltNm, key_admin, key_user1, upk_user1, upk_user2);
	if (ret != 0) printf("Failed test %d: %d\n", retNum, ret);

	allears_free();
	return EXIT_SUCCESS;
}
