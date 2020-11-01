#ifndef AEM_CLIENT_H
#define AEM_CLIENT_H

#include <stddef.h>
#include <sodium.h>

enum aem_api_commands {
	AEM_API_ACCOUNT_BROWSE,
	AEM_API_ACCOUNT_CREATE,
	AEM_API_ACCOUNT_DELETE,
	AEM_API_ACCOUNT_UPDATE,
	AEM_API_ADDRESS_CREATE,
	AEM_API_ADDRESS_DELETE,
	AEM_API_ADDRESS_LOOKUP,
	AEM_API_ADDRESS_UPDATE,
	AEM_API_MESSAGE_BROWSE,
	AEM_API_MESSAGE_CREATE,
	AEM_API_MESSAGE_DELETE,
	AEM_API_MESSAGE_UPLOAD,
	AEM_API_PRIVATE_UPDATE,
	AEM_API_SETTING_LIMITS
};

int allears_init(const char * const newOnionId, const unsigned char newSpk[crypto_box_PUBLICKEYBYTES], const unsigned char userKey[crypto_kdf_KEYBYTES]);
void allears_free(void);

int allears_account_create(const unsigned char * const targetPk);
int allears_account_delete(const unsigned char * const targetPk);
int allears_account_update(const unsigned char * const targetPk, const uint8_t level);
int allears_message_browse();

#endif
