#ifndef AEM_CLIENT_INTERNAL_H
#define AEM_CLIENT_INTERNAL_H

#include <stddef.h>

#define AEM_API_REQ_DATA_LEN 20

int apiFetch(const int cmd, const int flags, const unsigned char * const urlData, const unsigned char * const post, const size_t lenPost, unsigned char ** const out);
void apiFetch_setUak(const unsigned char new[AEM_KDF_SUB_KEYLEN]);
void apiFetch_setOnionId(const unsigned char new[56]);
void apiFetch_clear(void);

#endif
