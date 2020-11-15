#ifndef AEM_CLIENT_H
#define AEM_CLIENT_H

#include <stddef.h>
#include <sodium.h>

#define AEM_ADDR_FLAG_ACCINT 2
#define AEM_ADDR_FLAG_ACCEXT 1
#define AEM_ADDR_FLAGS_DEFAULT AEM_ADDR_FLAG_ACCEXT

#define AEM_ADDRESSES_PER_USER 31
#define AEM_LEN_PRIVATE (4096 - crypto_box_PUBLICKEYBYTES - 1 - (AEM_ADDRESSES_PER_USER * 9))

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
	AEM_API_MESSAGE_PUBLIC,
	AEM_API_MESSAGE_UPLOAD,
	AEM_API_PRIVATE_UPDATE,
	AEM_API_SETTING_LIMITS
};

struct aem_user {
	uint16_t space;
	uint8_t level;
	uint8_t addrNrm;
	uint8_t addrShd;
	unsigned char pk[crypto_box_PUBLICKEYBYTES];
};

struct aem_address {
	uint64_t hash;
	unsigned char addr32[10];
	uint8_t flags;
};

struct aem_intMsg {
	unsigned char flags;
	uint32_t ts;

	unsigned char addr32_from[10];
	unsigned char addr32_to[10];
	unsigned char senderPubkey[crypto_kx_PUBLICKEYBYTES];

	char *subj;
	char *body;
};

#define AEM_INTMSG_FLAGS_ENCRYPTED 16
#define AEM_INTMSG_FLAGS_FROMSHIELD 8
#define AEM_INTMSG_FLAGS_TOSHIELD   4
#define AEM_INTMSG_FLAGS_FROMLEVEL  3

int allears_init(const char * const newOnionId, const unsigned char pkApi[crypto_box_PUBLICKEYBYTES], const unsigned char pkSig[crypto_sign_PUBLICKEYBYTES], const unsigned char newSaltNm[crypto_pwhash_SALTBYTES], const unsigned char userKey[crypto_kdf_KEYBYTES]);
void allears_free(void);

int allears_account_browse(struct aem_user ** const userList);
int allears_account_create(const unsigned char * const targetPk);
int allears_account_delete(const unsigned char * const targetPk);
int allears_account_update(const unsigned char * const targetPk, const uint8_t level);
int allears_address_create(struct aem_address * const addr, const char * const norm, const size_t lenNorm);
int allears_address_delete(const uint64_t hash);
int allears_address_update(struct aem_address * const addr, const int count);
int allears_message_browse();
int allears_message_create(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody, const char * const addrFrom, const size_t lenAddrFrom, const char * const addrTo, const size_t lenAddrTo, const char * const replyId, const size_t lenReplyId, const unsigned char toPubkey[crypto_kx_PUBLICKEYBYTES]);
int allears_message_public(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody);
int allears_message_upload(const char * const fileName, const size_t lenFileName, const unsigned char * const fileData, const size_t lenFileData);
int allears_private_update(const unsigned char newPrivate[AEM_LEN_PRIVATE]);

#endif
