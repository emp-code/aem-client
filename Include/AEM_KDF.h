#ifndef AEM_KDF_H
#define AEM_KDF_H

#include <sodium.h>

#define AEM_KDF_UMK_KEYLEN 45 // 32 Key + 12 Nonce + 1 Counter (360 bits)
#define AEM_KDF_UAK_KEYLEN 43
#define AEM_KDF_SUB_KEYLEN 40 // 32 Key + 8 Nonce (320 bits)

#define AEM_UAK_POST 64

// User - User Master Key
	#define AEM_KDF_KEYID_UMK_UAK  1 // User API Key
	#define AEM_KDF_KEYID_UMK_USK  4 // User Signature Key
	#define AEM_KDF_KEYID_UMK_EWS 12 // Envelope Weak Secret

void aem_kdf_uak(unsigned char * const out, const size_t lenOut, const uint64_t binTs, const bool post, const uint8_t type, const unsigned char key[AEM_KDF_UAK_KEYLEN]);
void aem_kdf_sub(unsigned char * const out, const size_t lenOut, const uint64_t n, const unsigned char key[AEM_KDF_SUB_KEYLEN]);
uint16_t aem_getUserId(const unsigned char uak[AEM_KDF_UAK_KEYLEN]);
void aem_kdf_umk(unsigned char * const out, const size_t lenOut, const uint16_t n, const unsigned char umk[AEM_KDF_UMK_KEYLEN]);

#endif
