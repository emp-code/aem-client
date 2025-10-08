#include <stddef.h>
#include <string.h>

#include <sodium.h>

#include "../all-ears.h"

static int performTests(const char * const onionId, const unsigned char * const admin_umk, int * const ret) {
	aem_init(onionId, admin_umk);

	char testAddress[16];
	sprintf(testAddress, "aemtest%.8x", randombytes_random());
	if ((*ret = aem_address_create(testAddress, 15)) != 0) return 1;
	if ((*ret = aem_address_delete(testAddress, 15)) != 0) return 2;
	return 0;
}

int main(int argc, char *argv[]) {
	if (argc != 3 || strlen(argv[1]) != 56 || strlen(argv[2]) != 60) {
		printf("Usage: %s OnionID UMK\n", argv[0]);
		return EXIT_FAILURE;
	}

	if (sodium_init() != 0) {puts("Failed sodium_init()"); return EXIT_FAILURE;}

	unsigned char umk_admin[AEM_KDF_UMK_KEYLEN];
	if (sodium_base642bin(umk_admin, AEM_KDF_UMK_KEYLEN, argv[2], 60, NULL, NULL, NULL, sodium_base64_VARIANT_ORIGINAL) != 0) {puts("Invalid UMK"); return EXIT_FAILURE;}

	int retNum;
	const int ret = performTests(argv[1], umk_admin, &retNum);
	if (ret != 0) printf("Failed test %d: %d\n", ret, retNum); else puts("All Ok");

	aem_free();
	return EXIT_SUCCESS;
}
