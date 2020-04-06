#ifndef AEM_CLIENT_H

#include <stddef.h>
#include <sodium.h>

int allears_init(const char * const newHost, const size_t lenNewHost, const unsigned char newUsk[crypto_box_SECRETKEYBYTES]);
int allears_address_lookup(const char * const addr);
void allears_free(void);

#endif
