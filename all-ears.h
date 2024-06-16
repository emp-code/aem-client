#ifndef AEM_CLIENT_H
#define AEM_CLIENT_H

#include <stddef.h>
#include <sodium.h>

#include "Include/AEM_KDF.h"
#include "Include/Error.h"

#define AEM_ADDR_FLAG_SHIELD 128
// 64 unused
#define AEM_ADDR_FLAG_ORIGIN 32
#define AEM_ADDR_FLAG_SECURE 16
#define AEM_ADDR_FLAG_ATTACH  8
#define AEM_ADDR_FLAG_ALLVER  4
#define AEM_ADDR_FLAG_ACCEXT  2
#define AEM_ADDR_FLAG_ACCINT  1
#define AEM_ADDR_FLAGS_DEFAULT (AEM_ADDR_FLAG_ACCEXT | AEM_ADDR_FLAG_ALLVER | AEM_ADDR_FLAG_ATTACH)

#define AEM_ADDRESSES_PER_USER 31

#define X25519_PKBYTES crypto_scalarmult_BYTES
#define X25519_SKBYTES crypto_scalarmult_SCALARBYTES

enum aem_api_command_get {
	AEM_API_ACCOUNT_BROWSE,
	AEM_API_ACCOUNT_DELETE,
	AEM_API_ACCOUNT_UPDATE,
	AEM_API_ADDRESS_CREATE,
	AEM_API_ADDRESS_DELETE,
	AEM_API_ADDRESS_LOOKUP,
	AEM_API_ADDRESS_UPDATE,
	AEM_API_MESSAGE_BROWSE,
	AEM_API_MESSAGE_DELETE,
	AEM_API_MESSAGE_SENDER,
	AEM_API_SETTING_LIMITS
};

enum aem_api_command_post {
	AEM_API_ACCOUNT_CREATE,
	AEM_API_MESSAGE_CREATE,
	AEM_API_MESSAGE_PUBLIC,
	AEM_API_MESSAGE_UPLOAD,
	AEM_API_MESSAGE_VERIFY,
	AEM_API_PRIVATE_UPDATE
};

/*
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
	unsigned char msgId[16];
	unsigned char flags;
	uint32_t ts;

	unsigned char addr32_from[10];
	unsigned char addr32_to[10];
	unsigned char senderPubkey[crypto_kx_PUBLICKEYBYTES];

	char *subj;
	char *body;
};

#define AEM_INTMSG_FLAGS_VALIDSIG 128
#define AEM_INTMSG_FLAGS_VALIDPAD  64
#define AEM_INTMSG_FLAGS_PUBLIC   128
#define AEM_INTMSG_FLAGS_ENCRYPTED 64
#define AEM_INTMSG_FLAGS_FROMSHIELD 8
#define AEM_INTMSG_FLAGS_TOSHIELD   4
#define AEM_INTMSG_FLAGS_FROMLEVEL  3
*/

// Begin/End
void aem_init(const char serverOnionId[56], const unsigned char umk[AEM_KDF_UMK_KEYLEN]);
void aem_free(void);

// Utility functions
uint8_t aem_getUserLevel(const uint16_t uid);

// API functions
int aem_account_browse(void);
int aem_account_create(const unsigned char uak[AEM_KDF_SUB_KEYLEN], const unsigned char epk[X25519_PKBYTES]);
int aem_account_update(const uint16_t uid, const uint8_t level);
int aem_account_delete(const uint16_t uid);
int aem_address_create(const char * const addr, const size_t lenAddr);

/*
struct aem_intMsg *aem_intmsg(const int num);

int aem_address_delete(const uint64_t hash);
int aem_address_update(struct aem_address * const addr, const int count);
int aem_message_browse();
int aem_message_create(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody, const char * const addrFrom, const size_t lenAddrFrom, const char * const addrTo, const size_t lenAddrTo, const char * const replyId, const size_t lenReplyId, const unsigned char toPubkey[crypto_kx_PUBLICKEYBYTES], unsigned char * const msgId);
int aem_message_delete(const unsigned char msgId[16]);
int aem_message_public(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody, unsigned char * const msgId);
int aem_message_upload(const char * const fileName, const size_t lenFileName, const unsigned char * const fileData, const size_t lenFileData, unsigned char * const msgId);
int aem_private_update(const unsigned char newPrivate[AEM_LEN_PRIVATE]);
*/

#endif
