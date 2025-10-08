#ifndef AEM_KDF_H
#define AEM_KDF_H

#include <sodium.h>

#define AEM_KDF_UMK_KEYLEN 45 // 32 Key + 12 Nonce + 1 Counter (360 bits)
#define AEM_KDF_SUB_KEYLEN 40 // 32 Key + 8 Nonce (320 bits)

enum {
	// User: User Master Key
	AEM_KDF_KEYID_UMK_UAK = 0x01, // User Access Key
	AEM_KDF_KEYID_UMK_ESK = 0x02, // Envelope Secret Key
	AEM_KDF_KEYID_UMK_USK = 0x06, // User Signature Key

	// User: User Access Key
	AEM_KDF_KEYID_UAK_UID = 0x01  // UserID key
};

void aem_kdf_umk(unsigned char * const out, const size_t lenOut, const uint16_t n, const unsigned char umk[AEM_KDF_UMK_KEYLEN]);
void aem_kdf_sub(unsigned char * const out, const size_t lenOut, const uint64_t n, const unsigned char key[AEM_KDF_SUB_KEYLEN]);
uint16_t aem_getUserId(const unsigned char uak[AEM_KDF_SUB_KEYLEN]);

#endif
