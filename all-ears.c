#define _GNU_SOURCE

#include <arpa/inet.h>
#include <netdb.h>
#include <netinet/in.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#include <sodium.h>

#include "Include/Addr32.h"

#include "all-ears.h"

// Server settigns - must match server
#define AEM_MSG_MINBLOCKS 12
#define AEM_API_BOX_SIZE_MAX ((UINT16_MAX + AEM_MSG_MINBLOCKS) * 16)
#define AEM_MAXLEN_MSGDATA 4194304 // 4 MiB
#define AEM_PORT_API 302
#define AEM_LEVEL_MAX 3
#define AEM_RESPONSE_HEAD_SIZE_SHORT 166
#define AEM_RESPONSE_DATA_SIZE_SHORT 33
#define AEM_SEALCLEAR_LEN (1 + crypto_box_NONCEBYTES + crypto_box_PUBLICKEYBYTES)
#define AEM_ADDRESS_ARGON2_OPSLIMIT 3
#define AEM_ADDRESS_ARGON2_MEMLIMIT 67108864

// Local settings
#define AEM_MAXLEN_HOST 32
#define AEM_PORT_TOR 9050
#define AEM_SOCKET_TIMEOUT 30

static unsigned char api_pubkey[crypto_box_PUBLICKEYBYTES];
static unsigned char sig_pubkey[crypto_sign_PUBLICKEYBYTES];
static unsigned char saltNm[crypto_pwhash_SALTBYTES];
static char onionId[56];

static unsigned char userKey_kxHash[crypto_generichash_KEYBYTES];
static unsigned char userKey_symmetric[crypto_secretbox_KEYBYTES];
static unsigned char userKey_public[crypto_box_PUBLICKEYBYTES];
static unsigned char userKey_secret[crypto_box_SECRETKEYBYTES];

static uint16_t totalMsgCount = 0;
static uint32_t totalMsgBlock = 0;
static unsigned int count_intMsg = 0;
static struct aem_intMsg *intMsg;

static int makeTorSocket(void) {
	struct sockaddr_in torAddr;
	torAddr.sin_family = AF_INET;
	torAddr.sin_port = htons(AEM_PORT_TOR);
	torAddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

	const int sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (sock < 0) {perror("socket()"); return -1;}

	// Socket Timeout
	struct timeval tv;
	tv.tv_sec = AEM_SOCKET_TIMEOUT;
	tv.tv_usec = 0;
	setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (char*)&tv, sizeof(struct timeval));

	if (connect(sock, (struct sockaddr*)&torAddr, sizeof(struct sockaddr)) == -1) {perror("connect()"); return -1;}
	return sock;
}

static int torConnect(void) {
	const int sock = makeTorSocket();
	if (sock < 0) return -1;

	unsigned char req[72];
	unsigned char reply[8];

	memcpy(req, "\x04\x01\x01\x2e\x00\x00\x00\x01\x00", 9);
	memcpy(req + 9, onionId, 56);
	memcpy(req + 65, ".onion\0", 7);

	if (
	   send(sock, req, 72, 0) == 72
	&& recv(sock, reply, 8, 0) == 8
	&& reply[0] == 0 // version: 0
	&& reply[1] == 90 // status: 90
	&& reply[2] == 0
	&& reply[3] == 0 // DSTPORT: 0
	) return sock;

	close(sock);
	return -1;
}

static uint64_t normalHash(const char addr32[10]) {
	uint64_t halves[2];
	return (crypto_pwhash((unsigned char*)halves, 16, addr32, 10, saltNm, AEM_ADDRESS_ARGON2_OPSLIMIT, AEM_ADDRESS_ARGON2_MEMLIMIT, crypto_pwhash_ALG_ARGON2ID13) == 0) ? (halves[0] ^ halves[1]) : 0;
}

static int apiFetch(const int apiCmd, const void * const clear, const size_t lenClear, unsigned char **result) {
	if (apiCmd < 0 || clear == NULL || lenClear < 1 || lenClear > AEM_API_BOX_SIZE_MAX) return -100;

	const int sock = torConnect();
	if (sock < 0) return -101;

	size_t lenReq = AEM_SEALCLEAR_LEN + crypto_box_SEALBYTES + lenClear + crypto_box_MACBYTES;
	unsigned char req[141 + lenReq];

	// HTTP headers
	sprintf((char*)req,
		"POST /api HTTP/1.1\r\n"
		"Host: %.56s.onion:302\r\n"
		"Content-Length: %zu\r\n"
		"Connection: close\r\n"
		"\r\n",
	onionId, lenReq);
	const size_t lenHeaders = strlen((char*)req);
	lenReq += lenHeaders;

	unsigned char pbNonce[crypto_box_NONCEBYTES];
	randombytes_buf(pbNonce, crypto_box_NONCEBYTES);

	unsigned char sealClear[AEM_SEALCLEAR_LEN];
	sealClear[0] = apiCmd;
	memcpy(sealClear + 1, pbNonce, crypto_box_NONCEBYTES);
	memcpy(sealClear + 1 + crypto_box_NONCEBYTES, userKey_public, crypto_box_PUBLICKEYBYTES);

	const int ret1 = crypto_box_seal(req + lenHeaders, sealClear, AEM_SEALCLEAR_LEN, api_pubkey);
	const int ret2 = crypto_box_easy(req + lenHeaders + AEM_SEALCLEAR_LEN + crypto_box_SEALBYTES, clear, lenClear, pbNonce, api_pubkey, userKey_secret);

	const bool wantShortResponse = (apiCmd != AEM_API_ACCOUNT_BROWSE && apiCmd != AEM_API_MESSAGE_BROWSE);

	int lenResult = -1;
	if (ret1 == 0 && ret2 == 0) {
		if (send(sock, req, lenReq, 0) == (int)lenReq) {
			if (wantShortResponse) {
				unsigned char response[AEM_RESPONSE_HEAD_SIZE_SHORT + AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_NONCEBYTES + crypto_box_MACBYTES + 1];
				lenResult = recv(sock, response, AEM_RESPONSE_HEAD_SIZE_SHORT + AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_NONCEBYTES + crypto_box_MACBYTES + 1, 0);
				if (lenResult == AEM_RESPONSE_HEAD_SIZE_SHORT + AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_NONCEBYTES + crypto_box_MACBYTES) {
					unsigned char decrypted[AEM_RESPONSE_DATA_SIZE_SHORT];
					if (crypto_box_open_easy(decrypted, response + AEM_RESPONSE_HEAD_SIZE_SHORT + crypto_box_NONCEBYTES, AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_MACBYTES, response + AEM_RESPONSE_HEAD_SIZE_SHORT, api_pubkey, userKey_secret) == 0) {
						if (result != NULL) {
							const int lenCpy = decrypted[0];
							if (lenCpy < AEM_RESPONSE_DATA_SIZE_SHORT) {
								memcpy(*result, decrypted + 1, lenCpy);
								lenResult = lenCpy;
							} else lenResult = -1; // Invalid length --> Server reported error
						} else lenResult = 0; // Result data not wanted, 0=success
					} else lenResult = -2; // Failed to decrypt
				} else lenResult = -3; // Incorrect length received
			} else if (result != NULL) {
				*result = malloc(1000 + AEM_MAXLEN_MSGDATA);
				if (*result != NULL) {
					lenResult = recv(sock, *result, 1000 + AEM_MAXLEN_MSGDATA, 0);
					if (lenResult > 0) {
						const unsigned char * const headEnd = memmem(*result, lenResult, "\r\n\r\n", 4);
						if (headEnd != NULL) {
							const int lenBox = (*result + lenResult) - (headEnd + 4 + crypto_box_NONCEBYTES);
							unsigned char * const decrypted = malloc(lenBox - crypto_box_MACBYTES);
							if (decrypted != NULL) {
								if (crypto_box_open_easy(decrypted, headEnd + 4 + crypto_box_NONCEBYTES, lenBox, headEnd + 4, api_pubkey, userKey_secret) == 0) {
									lenResult = lenBox - crypto_box_MACBYTES;
									free(*result);
									*result = decrypted;
								} else {printf("%.80s", *result); free(*result); free(decrypted); lenResult = -1;} // Failed decrypting box
							} else {free(*result); lenResult = -2;} // Failed alloc
						} else {free(*result); lenResult = -3;} // Invalid response from server
					} else {free(*result); lenResult = -4;} // Server refused to answer
				} else lenResult = -5; // Failed alloc
			} else lenResult = -6; // Can't store long response: result parameter is null
		} else lenResult = -7; // Failed sending request
	} else lenResult = -8; // Failed creating encrypted boxes

	close(sock);
	return lenResult;
}

int allears_account_browse(struct aem_user ** const userList) {
	if (userList == NULL) return -1;

	unsigned char *res;
	const int ret = apiFetch(AEM_API_ACCOUNT_BROWSE, (unsigned char[]){0}, 1, &res);
	if (ret < 0) return ret;
	if (ret < 47) return -2;

/*	for (int i = 0; i < 4; i++) {
		maxStorage[i] = res[(i * 3) + 0];
		maxNormalA[i] = res[(i * 3) + 1];
		maxShieldA[i] = res[(i * 3) + 2];
	}
*/

	uint32_t userCount;
	memcpy(&userCount, res + 12, 4);

	*userList = malloc(sizeof(struct aem_user) * userCount);

	size_t offset = 16;
	for (unsigned int i = 0; i < userCount; i++) {
		uint16_t u16;
		memcpy(&u16, res + offset, 2);

		(*userList)[i].space = res[offset + 2] | ((u16 >> 4) & 3840);
		(*userList)[i].level = u16 & 3;
		(*userList)[i].addrNrm = (u16 >> 2) & 31;
		(*userList)[i].addrShd = (u16 >> 7) & 31;
		memcpy(((*userList)[i]).pk, res + offset + 3, crypto_box_PUBLICKEYBYTES);

		offset += 35;
	}

	free(res);
	return userCount;
}

int allears_account_create(const unsigned char * const targetPk) {
	return apiFetch(AEM_API_ACCOUNT_CREATE, targetPk, crypto_box_PUBLICKEYBYTES, NULL);
}

int allears_account_delete(const unsigned char * const targetPk) {
	return apiFetch(AEM_API_ACCOUNT_DELETE, targetPk, crypto_box_PUBLICKEYBYTES, NULL);
}

int allears_address_create(struct aem_address * const addr, const char * const norm, const size_t lenNorm) {
	if (norm == NULL) {
		unsigned char data[AEM_RESPONSE_DATA_SIZE_SHORT - 1];
		if (apiFetch(AEM_API_ADDRESS_CREATE, (const unsigned char[]){'S', 'H', 'I', 'E', 'L', 'D'}, 6, (unsigned char**)&data) != 0) return -1;

		memcpy(&(addr->hash), data, 8);
		memcpy(addr->addr32, data + 8, 10);
		return 0;
	}

	if (lenNorm < 1 || lenNorm > 15) return -1;

	addr32_store(addr->addr32, norm, lenNorm);
	addr->hash = normalHash((const char * const)addr->addr32);
	addr->flags = AEM_ADDR_FLAGS_DEFAULT;

	return apiFetch(AEM_API_ADDRESS_CREATE, &addr->hash, 8, NULL);
}

int allears_address_delete(const uint64_t hash) {
	return apiFetch(AEM_API_ADDRESS_DELETE, &hash, 8, NULL);
}

int allears_address_update(struct aem_address * const addr, const int count) {
	if (addr == NULL || count < 1) return -1;

	unsigned char data[9 * count];
	for (int i = 0; i < count; i++) {
		memcpy(data + (i * 9), &addr[i].hash, 8);
		data[(i * 9) + 8] = addr[i].flags;
	}

	return apiFetch(AEM_API_ADDRESS_UPDATE, data, count * 9, NULL);
}

int allears_account_update(const unsigned char * const targetPk, const uint8_t level) {
	if (level > AEM_LEVEL_MAX) return -1;

	unsigned char data[1 + crypto_box_PUBLICKEYBYTES];
	data[0] = level;
	memcpy(data + 1, targetPk, crypto_box_PUBLICKEYBYTES);

	return apiFetch(AEM_API_ACCOUNT_UPDATE, data, 1 + crypto_box_PUBLICKEYBYTES, NULL);
}

int allears_message_browse() {
	unsigned char *browseData;
	const int lenBrowseData = apiFetch(AEM_API_MESSAGE_BROWSE, (const unsigned char[]){0}, 1, &browseData);
	if (lenBrowseData < 6) {printf("nodata: %d\n", lenBrowseData); return 0;}

	memcpy(&totalMsgCount, browseData, 2);
	memcpy(&totalMsgBlock, browseData + 2, 4);

	int offset = 6;
	while (offset < lenBrowseData) {
		uint16_t msgBlocks;
		memcpy(&msgBlocks, browseData + offset, 2);
		const size_t msgBytes = (msgBlocks + AEM_MSG_MINBLOCKS) * 16;
		offset += 2;

		unsigned char msgId[16];
		memcpy(msgId, browseData + offset, 16);
		// TODO: Check if msgId exists, to avoid duplicates

		// TODO
	}

	free(browseData);
	return 0;
}

static void getKxPublic(const unsigned char addr32_from[10], unsigned char * const target) {
	unsigned char hash[crypto_kx_SEEDBYTES];
	crypto_generichash(hash, crypto_kx_SEEDBYTES, addr32_from, 10, userKey_kxHash, crypto_generichash_KEYBYTES);

	unsigned char kxKeyPublic[crypto_kx_PUBLICKEYBYTES];
	unsigned char kxKeySecret[crypto_kx_SECRETKEYBYTES];
	crypto_kx_seed_keypair(kxKeyPublic, kxKeySecret, hash);

	sodium_memzero(hash, crypto_kx_SEEDBYTES);
	sodium_memzero(kxKeySecret, crypto_kx_SECRETKEYBYTES);

	memcpy(target, kxKeyPublic, crypto_kx_PUBLICKEYBYTES);
	sodium_memzero(kxKeyPublic, crypto_kx_PUBLICKEYBYTES);
}

int allears_message_create(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody, const char * const addrFrom, const size_t lenAddrFrom, const char * const addrTo, const size_t lenAddrTo, const char * const replyId, const size_t lenReplyId, const unsigned char toPubkey[crypto_kx_PUBLICKEYBYTES]) {
	if (title == NULL || body == NULL || addrFrom == NULL || addrTo == NULL || lenTitle < 1 || lenBody < 1 || lenAddrFrom < 1 || lenAddrTo < 1) return -1;

	if (memchr(addrTo, '@', lenAddrTo) != NULL) {
		// TODO: Email
		return -1;
	}

	const bool isE2ee = (toPubkey != NULL);
	if (isE2ee) return -1; // TODO

	const size_t lenFinal = (crypto_kx_PUBLICKEYBYTES * 2) + 26 + lenTitle + lenBody;
	unsigned char final[lenFinal];
	bzero(final, lenFinal);

	// 128/64/32 unused
	final[0] = isE2ee? 16 : 0;
	if (lenAddrFrom == 16) final[0] |= 8;
	if (lenAddrTo   == 16) final[0] |= 4;
	// Server sets sender level (0-3)

	if (!isE2ee && (lenTitle + lenBody) < 38) return -1; // TODO: Add padding

	unsigned char addr32_from[10];
	unsigned char addr32_to[10];
	addr32_store(addr32_from, addrFrom, lenAddrFrom);
	addr32_store(addr32_to, addrTo, lenAddrTo);

	memcpy(final + crypto_kx_PUBLICKEYBYTES +  5, addr32_from, 10);
	memcpy(final + crypto_kx_PUBLICKEYBYTES + 15, addr32_to, 10);
	getKxPublic(addr32_from, final + crypto_kx_PUBLICKEYBYTES + 25);

	final[(crypto_kx_PUBLICKEYBYTES * 2) + 25] = lenTitle;

	if (isE2ee) {
		memcpy(final + 1, toPubkey, crypto_kx_PUBLICKEYBYTES);
//		memcpy(final + 1 + crypto_kx_PUBLICKEYBYTES, msgTs);
		// TODO
	} else {
		memcpy(final + (crypto_kx_PUBLICKEYBYTES * 2) + 26, title, lenTitle);
		memcpy(final + (crypto_kx_PUBLICKEYBYTES * 2) + 26 + lenTitle, body, lenBody);
	}

	return apiFetch(AEM_API_MESSAGE_CREATE, final, lenFinal, NULL);
}

int allears_message_public(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody) {
	if (title == NULL || body == NULL || lenTitle < 1 || lenBody < 1) return -1;

	const size_t lenFinal = lenTitle + 1 + lenBody;
	unsigned char final[lenFinal];

	memcpy(final, title, lenTitle);
	final[lenTitle] = '\n';
	memcpy(final + lenTitle + 1, body, lenBody);

	return apiFetch(AEM_API_MESSAGE_PUBLIC, final, lenFinal, NULL);
}

int allears_message_upload(const char * const fileName, const size_t lenFileName, const unsigned char * const fileData, const size_t lenFileData) {
	if (fileName == NULL || fileData == NULL || lenFileName < 1 || lenFileName > 256 || lenFileData < 1) return -1;

	const size_t lenData = 1 + lenFileName + lenFileData;
	const size_t lenFinal = lenData + crypto_secretbox_NONCEBYTES + crypto_secretbox_MACBYTES;
	if (lenFinal > AEM_API_BOX_SIZE_MAX) return -1;

	unsigned char data[lenData];
	data[0] = lenFileName - 1;
	memcpy(data + 1, fileName, lenFileName);
	memcpy(data + 1 + lenFileName, fileData, lenFileData);

	unsigned char final[lenFinal];

	randombytes_buf(final, crypto_secretbox_NONCEBYTES);
	crypto_secretbox_easy(final + crypto_secretbox_NONCEBYTES, data, lenData, final, userKey_symmetric);

	return apiFetch(AEM_API_MESSAGE_UPLOAD, final, lenFinal, NULL);
}

int allears_private_update(const unsigned char newPrivate[AEM_LEN_PRIVATE]) {
	return apiFetch(AEM_API_PRIVATE_UPDATE, newPrivate, AEM_LEN_PRIVATE, NULL);
}

int allears_init(const char * const newOnionId, const unsigned char pkApi[crypto_box_PUBLICKEYBYTES], const unsigned char pkSig[crypto_sign_PUBLICKEYBYTES], const unsigned char newSaltNm[crypto_pwhash_SALTBYTES], const unsigned char userKey[crypto_kdf_KEYBYTES]) {
	memcpy(onionId, newOnionId, 56);
	memcpy(saltNm, newSaltNm, crypto_pwhash_SALTBYTES);
	memcpy(api_pubkey, pkApi, crypto_box_PUBLICKEYBYTES);
	memcpy(sig_pubkey, pkSig, crypto_sign_PUBLICKEYBYTES);

	crypto_kdf_derive_from_key(userKey_kxHash, crypto_generichash_KEYBYTES, 4, "AEM-Usr0", userKey);
	crypto_kdf_derive_from_key(userKey_symmetric, crypto_secretbox_KEYBYTES, 5, "AEM-Usr0", userKey);

	unsigned char boxSeed[crypto_box_SEEDBYTES];
	crypto_kdf_derive_from_key(boxSeed, crypto_box_SEEDBYTES, 1, "AEM-Usr0", userKey);
	crypto_box_seed_keypair(userKey_public, userKey_secret, boxSeed);
	sodium_memzero(boxSeed, crypto_box_SEEDBYTES);
	return 0;
}

void allears_free(void) {
	sodium_memzero(userKey_kxHash, crypto_generichash_KEYBYTES);
	sodium_memzero(userKey_secret, crypto_box_SECRETKEYBYTES);
	sodium_memzero(userKey_symmetric, crypto_secretbox_KEYBYTES);
}
