#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

static void pppUserKeys(unsigned char * const uak, unsigned char * const epk) {
	unsigned char umk[AEM_KDF_UMK_KEYLEN];

	for(;;) {
		randombytes_buf(umk, AEM_KDF_UMK_KEYLEN);

		aem_kdf_umk(uak, AEM_KDF_SUB_KEYLEN, AEM_KDF_KEYID_UMK_UAK, umk);
		if (aem_kdf_uid(uak) != 4095) continue;

		unsigned char esk[crypto_scalarmult_SCALARBYTES];
		aem_kdf_umk(esk, crypto_scalarmult_SCALARBYTES, AEM_KDF_KEYID_UMK_ESK, umk);
		crypto_scalarmult_base(epk, esk);

		sodium_memzero(esk, crypto_scalarmult_SCALARBYTES);
		sodium_memzero(umk, AEM_KDF_UMK_KEYLEN);
		break;
	}
}

static int performTests(int * const ret) {
	unsigned char u1_uak[AEM_KDF_SUB_KEYLEN];
	unsigned char u1_epk[X25519_PKBYTES];
	pppUserKeys(u1_uak, u1_epk);

	if ((*ret = aem_account_create(u1_uak, u1_epk)) != 0) return 1;
	if ((*ret = aem_account_create(u1_uak, u1_epk)) != AEM_API_ERR_ACCOUNT_EXIST) return 2;
	if ((*ret = aem_account_update(4095, 1)) != 0) return 3;

	// Account created, level set to one: check result
	if ((*ret = aem_account_browse()) != 0)  return 4;
	if (aem_getUserLevel(4095) != 1) return 5;

	if ((*ret = aem_account_delete(4095)) != 0) return 6;

/*
	unsigned char privateData[AEM_LEN_PRIVATE];
	memset(privateData, 0xFC, AEM_LEN_PRIVATE);

	struct aem_address addr;

	char testAddress[16];
	sprintf(testAddress, "aemtest%.8x", randombytes_random());

	unsigned char msgId_msg[16];
	unsigned char msgId_ann[16];
	unsigned char msgId_upl[16];

	// User1
	if (aem_init(onionId, spk_api_box, spk_api_sig, spk_dlv_sig, saltNm, usk_user1) != 0) return -999;
	(*retNum)++; if ((ret = aem_account_create(upk_user2)) >= 0) return -999; //6
	(*retNum)++; if ((ret = aem_private_update(privateData)) != 0) return -999; //7
	(*retNum)++; if ((ret = aem_address_create(&addr, testAddress, 15)) != 0) return -999; //8
	addr.flags = AEM_ADDR_FLAG_ACCINT | AEM_ADDR_FLAG_ACCEXT;

	// Admin
	if (aem_init(onionId, spk_api_box, spk_api_sig, spk_dlv_sig, saltNm, usk_admin) != 0) return -999;
	(*retNum)++; if ((ret = aem_account_create(upk_user2)) != 0) return ret; //9
	(*retNum)++; if ((ret = aem_account_update(upk_user2, 2)) != 0) return -999; //10

	// User1
	if (aem_init(onionId, spk_api_box, spk_api_sig, spk_dlv_sig, saltNm, usk_user1) != 0) return -999;
	(*retNum)++; if ((ret = aem_address_delete(UINT64_MAX)) >= 0) return -999; //11
	(*retNum)++; if ((ret = aem_account_update(upk_user2, 3)) >= 0) return -999; //13
	(*retNum)++; if ((ret = aem_account_update(upk_user2, 1)) >= 0) return -999; //14
	(*retNum)++; if ((ret = aem_account_update(upk_user1, 3)) >= 0) return -999; //15
	(*retNum)++; if ((ret = aem_account_update(upk_user1, 2)) >= 0) return -999; //16
	(*retNum)++; if ((ret = aem_account_update(upk_user1, 1)) != 0) return ret; //17
	(*retNum)++; if ((ret = aem_address_update(&addr, 1)) != 0) return ret; //18

	// Admin
	if (aem_init(onionId, spk_api_box, spk_api_sig, spk_dlv_sig, saltNm, usk_admin) != 0) return -999;
	(*retNum)++; if ((ret = aem_account_delete(upk_user2)) != 0) return ret; //19
	(*retNum)++; if ((ret = aem_message_public("Test announcement", 17, "This announcement is a part of a test run.", 42, msgId_msg)) != 0) return ret; //20
	(*retNum)++; if ((ret = aem_message_create("Test Message", 12, "This here is a test message.", 28, "admin", 5, testAddress, 15, NULL, 0, NULL, msgId_ann)) != 0) return ret; //21

	// User1
	if (aem_init(onionId, spk_api_box, spk_api_sig, spk_dlv_sig, saltNm, usk_user1) != 0) return -999;
	(*retNum)++; if ((ret = aem_message_upload("test.txt", 8, (unsigned char*)"This is an uploaded test file.", 30, msgId_upl)) != 0) {puts("24?");return ret;} //22
	(*retNum)++; if ((ret = aem_message_browse()) != 0) {puts("25?");return ret;} //23

	struct aem_intMsg *msg = aem_intmsg(0);
	if (msg == NULL) return -1000;
	if (strcmp(msg->subj, "Test Message") != 0) return -1001;
	if (strcmp(msg->body, "This here is a test message.") != 0) return -1002;

	msg = aem_intmsg(1);
	if (msg == NULL) return -1010;
	if (strcmp(msg->subj, "Test announcement") != 0) return -1011;
	if (strcmp(msg->body, "This announcement is a part of a test run.") != 0) return -1012;

	(*retNum)++; if ((ret = aem_message_delete((unsigned char[]){0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0})) >= 0) return -999; //24
	(*retNum)++; if ((ret = aem_message_delete(msg->msgId)) != 0) return ret; //25

	(*retNum)++; if ((ret = aem_message_browse()) != 0) return ret; //26
	// TODO: Check messages

	(*retNum)++; if ((ret = aem_address_delete(addr.hash)) != 0) return ret; //27
	(*retNum)++; if ((ret = aem_account_delete(upk_user1)) != 0) return ret; //28
*/
	return 0;
}

int main(int argc, char *argv[]) {
	if (argc != 3 || strlen(argv[1]) != 56 || strlen(argv[2]) != 60) {
		printf("Usage: %s OnionID USK\n", argv[0]);
		return EXIT_FAILURE;
	}

	if (sodium_init() != 0) {puts("Failed sodium_init()"); return EXIT_FAILURE;}

	unsigned char umk_admin[AEM_KDF_UMK_KEYLEN];
	if (sodium_base642bin(umk_admin, AEM_KDF_UMK_KEYLEN, argv[2], 60, NULL, NULL, NULL, sodium_base64_VARIANT_ORIGINAL_NO_PADDING) != 0) {puts("Invalid UMK"); return EXIT_FAILURE;}
	aem_init(argv[1], umk_admin);

	int retNum;
	const int ret = performTests(&retNum);
	if (ret != 0) printf("Failed test %d: %d\n", ret, retNum); else puts("All Ok");

	aem_free();
	return EXIT_SUCCESS;
}
