#include <netinet/in.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
#include <time.h>

#include <sodium.h>

#include "Include/Addr32.h"
#include "Include/AEM_KDF.h"

#include "all-ears.h"

// Server settigns - must match server
#define AEM_MSG_MINBLOCKS 12
#define AEM_API_MAXSIZE_RESPONSE 2097152 // 2 MiB

//#define AEM_LEVEL_MAX 3
#define AEM_ADDRESS_ARGON2_OPSLIMIT 2
#define AEM_ADDRESS_ARGON2_MEMLIMIT 16777216

#define AEM_UAK_TYPE_URL_AUTH  0
#define AEM_UAK_TYPE_URL_DATA 32
#define AEM_UAK_TYPE_REQ_BODY 64
#define AEM_UAK_TYPE_RES_BODY 96
#define AEM_UAK_POST 128

// Local settings
#define AEM_PORT_TOR 9050
#define AEM_SOCKET_TIMEOUT 30

#define AEM_API_REQ_LEN 48
#define AEM_API_REQ_LEN_BASE64 64
#define AEM_API_REQ_DATA_LEN 24

// Connection data
static int req_sock;
static uint64_t req_binTs;
static bool req_post;

// Server data
static unsigned char saltNm[crypto_pwhash_SALTBYTES];
static char onionId[56];

// User data
static unsigned char own_uak[AEM_KDF_SUB_KEYLEN];
static unsigned char own_esk[X25519_SKBYTES];
static unsigned char own_ehk[crypto_aead_aes256gcm_KEYBYTES];
static unsigned char own_pfk[AEM_KDF_SUB_KEYLEN];
static uint16_t own_uid = UINT16_MAX;

/*
static uint16_t totalMsgCount = 0;
static uint32_t totalMsgBlock = 0;
static int count_intMsg = 0;
static struct aem_intMsg *intMsg = NULL;

static uint8_t maxStorage[AEM_LEVEL_MAX + 1];
static uint8_t maxNormalA[AEM_LEVEL_MAX + 1];
static uint8_t maxShieldA[AEM_LEVEL_MAX + 1];

struct aem_intMsg *allears_intmsg(const int num) {
	return (intMsg == NULL || num >= count_intMsg) ? NULL : intMsg + num;
}
*/

static int makeTorSocket(void) {
	struct sockaddr_in torAddr;
	torAddr.sin_family = AF_INET;
	torAddr.sin_port = htons(AEM_PORT_TOR);
	torAddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

	req_sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (req_sock < 0) return -1;

	// Socket Timeout
	struct timeval tv;
	tv.tv_sec = AEM_SOCKET_TIMEOUT;
	tv.tv_usec = 0;
	setsockopt(req_sock, SOL_SOCKET, SO_RCVTIMEO, (char*)&tv, sizeof(struct timeval));

	return connect(req_sock, (struct sockaddr*)&torAddr, sizeof(struct sockaddr));
}

static int torConnect(void) {
	if (makeTorSocket() < 0) return -1;

	unsigned char req[72];
	unsigned char reply[8];

	memcpy(req, "\x04\x01\x01\x2e\x00\x00\x00\x01\x00", 9);
	memcpy(req + 9, onionId, 56);
	memcpy(req + 65, ".onion\0", 7);

	if (
	   send(req_sock, req, 72, 0) == 72
	&& recv(req_sock, reply, 8, 0) == 8
	&& reply[0] == 0 // version: 0
	&& reply[1] == 90 // status: 90
	&& reply[2] == 0
	&& reply[3] == 0 // DSTPORT: 0
	) return 0;

	close(req_sock);
	return -1;
}

static uint64_t normalHash(const char addr32[10]) {
	uint64_t halves[2];
	return (crypto_pwhash((unsigned char*)halves, 16, addr32, 10, saltNm, AEM_ADDRESS_ARGON2_OPSLIMIT, AEM_ADDRESS_ARGON2_MEMLIMIT, crypto_pwhash_ALG_ARGON2ID13) == 0) ? (halves[0] ^ halves[1]) : 0;
}

static int numberOfDigits(const size_t x) {
	return
		(x < 10 ? 1 :
		(x < 100 ? 2 :
		(x < 1000 ? 3 :
		(x < 10000 ? 4 :
		(x < 100000 ? 5 :
		(x < 1000000 ? 6 :
		(x < 10000000 ? 7 :
		(x < 100000000 ? 8 :
		(x < 1000000000 ? 9 :
		10)))))))));
}

static int api_send(const int cmd, const int flags, const unsigned char * const urlData, const unsigned char * const post, const size_t lenPost) {
	if (cmd < 0 || lenPost > 9999999) return -1001;
	if (torConnect() < 0) return -1002;

	req_post = (post != NULL);

	struct timespec ts;
	req_binTs = (clock_gettime(CLOCK_REALTIME, &ts) == 0) ? (ts.tv_sec * 1000 + (ts.tv_nsec / 1000000)) & 1099511627775 : 0;

	// Create one-use keys
	unsigned char auth_key[crypto_onetimeauth_KEYBYTES];
	aem_kdf_sub(auth_key, crypto_onetimeauth_KEYBYTES, req_binTs | ((uint64_t)((req_post? AEM_UAK_POST : 0) | AEM_UAK_TYPE_URL_AUTH) << 40), own_uak);

	unsigned char data_key[1 + AEM_API_REQ_DATA_LEN];
	aem_kdf_sub(data_key, 1 + AEM_API_REQ_DATA_LEN, req_binTs | ((uint64_t)((req_post? AEM_UAK_POST : 0) | AEM_UAK_TYPE_URL_DATA) << 40), own_uak);

	// Create the URL
	unsigned char urlBase[48];
	bzero(urlBase, 48);
	memcpy(urlBase, &req_binTs, 5);
	urlBase[5] = own_uid & 255; // First 8 bits of UID
	urlBase[6] = (own_uid >> 8) | ((cmd ^ (data_key[0] & 15)) << 4); // Last 4 bits of UID; Encrypted: CMD
	urlBase[7] = (flags & 15) ^ (data_key[0] >> 4); // High bits unused

	for (int i = 0; i < AEM_API_REQ_DATA_LEN; i++) {
		if ((urlData != NULL) && i < AEM_API_REQ_DATA_LEN) {
			urlBase[8 + i] = urlData[i] ^ data_key[1 + i];
		} else {
			urlBase[8 + i] = data_key[1 + i];
		}
	}

	crypto_onetimeauth(urlBase + 32, urlBase + 5, 27, auth_key);

	char url[65];
	sodium_bin2base64(url, 65, urlBase, 48, sodium_base64_VARIANT_URLSAFE);

	if (!req_post) {
		unsigned char req[176];
		sprintf((char*)req,
			"GET /%.64s HTTP/1.1\r\n"
			"Host: %.56s.onion:302\r\n"
			"Connection: close\r\n"
			"\r\n",
		url, onionId);

		if (send(req_sock, req, 175, 0) != 175) {close(req_sock); return -1003;}
	} else {
		const ssize_t lenReq = 194 + numberOfDigits(lenPost) + lenPost + crypto_aead_aes256gcm_ABYTES;

		unsigned char req[lenReq];
		sprintf((char*)req,
			"POST /%.64s HTTP/1.1\r\n"
			"Host: %.56s.onion:302\r\n"
			"Content-Length: %zu\r\n"
			"Connection: close\r\n"
			"\r\n",
		url, onionId, lenPost + crypto_aead_aes256gcm_ABYTES);

		unsigned char body_nonce[crypto_aead_aes256gcm_NPUBBYTES];
		bzero(body_nonce, crypto_aead_aes256gcm_NPUBBYTES);

		unsigned char body_key[crypto_aead_aes256gcm_KEYBYTES];
		aem_kdf_sub(body_key, crypto_aead_aes256gcm_KEYBYTES, req_binTs | ((uint64_t)(AEM_UAK_POST | AEM_UAK_TYPE_REQ_BODY) << 40), own_uak);

		crypto_aead_aes256gcm_encrypt(req + 194 + numberOfDigits(lenPost), NULL, post, lenPost, NULL, 0, NULL, body_nonce, body_key);
		if (send(req_sock, req, lenReq, 0) != lenReq) {close(req_sock); return -1003;}
	}

	return 0;
}

static int api_readStatus(void) {
	unsigned char raw[1 + 73 + 257 + crypto_aead_aes256gcm_ABYTES];
	const ssize_t lenRaw = recv(req_sock, raw, 1 + 73 + 257 + crypto_aead_aes256gcm_ABYTES, 0);
	close(req_sock);

	if (lenRaw < 1) return -1010;
	if (lenRaw == 71) return (((raw[9] - '0') * 100) + ((raw[10] - '0') * 10) + (raw[11] - '0')) * -1;
	if (lenRaw != 73 + 257 + crypto_aead_aes256gcm_ABYTES || memcmp(raw, "HTTP/1.1 200 aem\r\nContent-Length: 273\r\nAccess-Control-Allow-Origin: *\r\n\r\n", 73) != 0) return -1011;

	unsigned char nonce[crypto_aead_aes256gcm_NPUBBYTES];
	bzero(nonce, crypto_aead_aes256gcm_NPUBBYTES);

	unsigned char key[crypto_aead_aes256gcm_KEYBYTES];
	aem_kdf_sub(key, crypto_aead_aes256gcm_KEYBYTES, req_binTs | ((uint64_t)((req_post? AEM_UAK_POST : 0) | AEM_UAK_TYPE_RES_BODY) << 40), own_uak);

	unsigned char dec[257];
	if (crypto_aead_aes256gcm_decrypt(dec, NULL, NULL, raw + 73, lenRaw - 73, NULL, 0, nonce, key) != 0) return -1012;

	if (dec[0] != 255) return -1013;
	return dec[1];
}

static unsigned char *api_readData(void) {
	return NULL; // TODO
}

/*
int aem_account_browse(struct aem_user ** const userList) {
	if (userList == NULL) return -1;

	unsigned char *res = NULL;
	const int ret = apiFetch(AEM_API_ACCOUNT_BROWSE, (unsigned char[]){0}, 1, &res);
	if (ret < 0) return ret;
	if (ret < 47) return -2;

	for (int i = 0; i < 4; i++) {
		maxStorage[i] = res[(i * 3) + 0];
		maxNormalA[i] = res[(i * 3) + 1];
		maxShieldA[i] = res[(i * 3) + 2];
	}

	uint32_t userCount;
	memcpy(&userCount, res + 12, 4);

	*userList = malloc(sizeof(struct aem_user) * userCount);
	if (*userList == NULL) {free(res); return -100;}

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
*/

int aem_account_create(const unsigned char uak[AEM_KDF_SUB_KEYLEN], const unsigned char epk[X25519_PKBYTES]) {
	unsigned char data[AEM_KDF_SUB_KEYLEN + X25519_PKBYTES];
	memcpy(data, uak, AEM_KDF_SUB_KEYLEN);
	memcpy(data + AEM_KDF_SUB_KEYLEN, epk, X25519_PKBYTES);

	const int ret = api_send(AEM_API_ACCOUNT_CREATE, 0, NULL, data, AEM_KDF_SUB_KEYLEN + X25519_PKBYTES);
	return (ret < 0) ? ret : api_readStatus();
}

/*
int aem_account_delete(const uint16_t uid) {
	return apiFetch(AEM_API_ACCOUNT_DELETE, targetPk, crypto_box_PUBLICKEYBYTES, NULL);
}

int aem_account_update(const unsigned char * const targetPk, const uint8_t level) {
	if (level > AEM_LEVEL_MAX) return -1;

	unsigned char data[1 + crypto_box_PUBLICKEYBYTES];
	data[0] = level;
	memcpy(data + 1, targetPk, crypto_box_PUBLICKEYBYTES);

	return apiFetch(AEM_API_ACCOUNT_UPDATE, data, 1 + crypto_box_PUBLICKEYBYTES, NULL);
}

/*
int aem_address_create(struct aem_address * const addr, const char * const norm, const size_t lenNorm) {
	if (norm == NULL) {
		unsigned char data[AEM_LEN_SHORTRESPONSE_DECRYPT - 1];
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

int aem_address_delete(const uint64_t hash) {
	return apiFetch(AEM_API_ADDRESS_DELETE, &hash, 8, NULL);
}

int aem_address_update(struct aem_address * const addr, const int count) {
	if (addr == NULL || count < 1) return -1;

	unsigned char data[9 * count];
	for (int i = 0; i < count; i++) {
		memcpy(data + (i * 9), &addr[i].hash, 8);
		data[(i * 9) + 8] = addr[i].flags;
	}

	return apiFetch(AEM_API_ADDRESS_UPDATE, data, count * 9, NULL);
}

int aem_message_browse() {
	unsigned char *browseData = NULL;
	const int lenBrowseData = apiFetch(AEM_API_MESSAGE_BROWSE, (const unsigned char[]){0}, 1, &browseData);
	if (lenBrowseData < 0) return lenBrowseData;
	if (lenBrowseData < 6) return -100;

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

		const size_t lenMsgData = msgBytes - crypto_box_SEALBYTES;
		unsigned char msgData[lenMsgData];
		if (crypto_box_seal_open(msgData, browseData + offset, msgBytes, usk_public, usk_secret) != 0) {
			// Error decrypting
			offset += msgBytes;
			continue;
		}

		unsigned char msgInfo = msgData[0];
		const uint8_t padAmount = msgInfo & 15;

		unsigned char padBytes[padAmount];
		randombytes_buf_deterministic(padBytes, padAmount, msgData);
		const bool validPad = (memcmp(padBytes, msgData + lenMsgData - crypto_sign_BYTES - padAmount, padAmount) == 0);
		const bool validSig = (crypto_sign_verify_detached(msgData + lenMsgData - crypto_sign_BYTES, msgData, lenMsgData - crypto_sign_BYTES, spk_dlv_sig) == 0);

		uint32_t msgTs;
		memcpy(&msgTs, msgData + 1, 4);

		switch (msgInfo & 48) {
			case 0: { // ExtMsg
				// TODO
			break;}

			case 16: { // IntMsg
				count_intMsg++;

				struct aem_intMsg *intMsg2 = realloc(intMsg, sizeof(struct aem_intMsg) * count_intMsg);
				if (intMsg2 == NULL) break;
				intMsg = intMsg2;

				memcpy(intMsg[count_intMsg - 1].msgId, msgId, 16);
				memcpy(&intMsg[count_intMsg - 1].ts, &msgTs, 4);

				intMsg[count_intMsg - 1].flags = msgData[5];
				// TODO store validPad/Sig flags
//				if (validPad) 
//				if (validSig) 

				if ((intMsg[count_intMsg - 1].flags & AEM_INTMSG_FLAGS_PUBLIC) != 0) {
					const size_t lenData = lenMsgData - 6 - crypto_sign_BYTES - padAmount;
					const unsigned char * const br = memchr(msgData + 6, '\n', lenData);
					if (br == NULL) return -1; // Invalid format, shouldn't happen

					const size_t lenSubj = br - (msgData + 6);
					const size_t lenBody = lenData - lenSubj - 1;
					if (lenSubj < 1 || lenBody < 1) return -1; // Invalid format, shouldn't happen

					intMsg[count_intMsg - 1].subj = malloc(lenSubj + 1);
					memcpy(intMsg[count_intMsg - 1].subj, msgData + 6, lenSubj);
					intMsg[count_intMsg - 1].subj[lenSubj] = '\0';

					intMsg[count_intMsg - 1].body = malloc(lenBody + 1);
					memcpy(intMsg[count_intMsg - 1].body, msgData + 7 + lenSubj, lenBody);
					intMsg[count_intMsg - 1].body[lenBody] = '\0';

					break;
				}

				memcpy(intMsg[count_intMsg - 1].addr32_from, msgData + 6, 10);
				memcpy(intMsg[count_intMsg - 1].addr32_to, msgData + 16, 10);
				memcpy(intMsg[count_intMsg - 1].senderPubkey, msgData + 26, crypto_kx_PUBLICKEYBYTES);

				const int lenSubj = (msgData[26 + crypto_kx_PUBLICKEYBYTES] & 127); // 128 unused
				const bool isE2ee = (intMsg[count_intMsg - 1].flags & AEM_INTMSG_FLAGS_ENCRYPTED) != 0;

				unsigned char *msgBox = msgData + 27 + crypto_kx_PUBLICKEYBYTES;

				unsigned char *decrypted;
				if (isE2ee) {
					unsigned char nonce[crypto_secretbox_NONCEBYTES];
					memcpy(nonce, &msgTs, 4);
					bzero(nonce + 4, crypto_secretbox_NONCEBYTES - 4);

					unsigned char seedHash[crypto_kx_SEEDBYTES];
					crypto_generichash(seedHash, crypto_kx_SEEDBYTES, intMsg[count_intMsg - 1].addr32_to, 10, usk_kxHash, crypto_generichash_KEYBYTES);

					unsigned char kxKeyPk[crypto_kx_PUBLICKEYBYTES];
					unsigned char kxKeySk[crypto_kx_SECRETKEYBYTES];
					crypto_kx_seed_keypair(kxKeyPk, kxKeySk, seedHash);

					unsigned char rx[crypto_kx_SESSIONKEYBYTES];
					unsigned char tx[crypto_kx_SESSIONKEYBYTES];
					crypto_kx_server_session_keys(rx, tx, kxKeyPk, kxKeySk, intMsg[count_intMsg - 1].senderPubkey);

					decrypted = malloc(lenMsgData - 27 - crypto_kx_PUBLICKEYBYTES - crypto_secretbox_MACBYTES);
					crypto_secretbox_open_easy(decrypted, msgData + 27 + crypto_kx_PUBLICKEYBYTES, lenMsgData - 27 - crypto_kx_PUBLICKEYBYTES, nonce, rx);
					msgBox = decrypted;
				}

				intMsg[count_intMsg - 1].subj = malloc(lenSubj + 1);
				if (intMsg[count_intMsg - 1].subj == NULL) {free(browseData); return -1;}
				memcpy(intMsg[count_intMsg - 1].subj, msgBox, lenSubj);
				intMsg[count_intMsg - 1].subj[lenSubj] = '\0';

				const size_t lenBody = lenMsgData - 27 - crypto_kx_PUBLICKEYBYTES - lenSubj - crypto_sign_BYTES - padAmount;
				intMsg[count_intMsg - 1].body = malloc(lenBody + 1);
				if (intMsg[count_intMsg - 1].body == NULL) {free(browseData); return -1;}
				memcpy(intMsg[count_intMsg - 1].body, msgBox + lenSubj, lenBody);
				intMsg[count_intMsg - 1].body[lenBody] = '\0';
			break;}

			case 32: { // UplMsg
				// TODO
			break;}

			case 48: { // OutMsg
				// TODO
			break;}
		}

		offset += msgBytes;
	}

	free(browseData);
	return 0;
}

int aem_message_create(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody, const char * const addrFrom, const size_t lenAddrFrom, const char * const addrTo, const size_t lenAddrTo, const char * const replyId, const size_t lenReplyId, const unsigned char toPubkey[crypto_kx_PUBLICKEYBYTES], unsigned char * const msgId) {
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

	unsigned char *res = NULL;
	const int ret = apiFetch(AEM_API_MESSAGE_CREATE, final, lenFinal, &res);
	if (res != NULL) free(res);
	if (ret < 0) return -ret;
	return 0;
}

int aem_message_delete(const unsigned char msgId[16]) {
	// TODO: Support deleting multiple messages at a time
	return apiFetch(AEM_API_MESSAGE_DELETE, msgId, 16, NULL);
}

int aem_message_public(const char * const title, const size_t lenTitle, const char * const body, const size_t lenBody, unsigned char * const msgId) {
	if (title == NULL || body == NULL || lenTitle < 1 || lenBody < 1) return -1;

	const size_t lenFinal = lenTitle + 1 + lenBody;
	unsigned char final[lenFinal];

	memcpy(final, title, lenTitle);
	final[lenTitle] = '\n';
	memcpy(final + lenTitle + 1, body, lenBody);

	unsigned char result[32];
	unsigned char * const p_result = (unsigned char*)result;

	const int ret = apiFetch(AEM_API_MESSAGE_PUBLIC, final, lenFinal, &p_result);
	if (ret < 0) return -ret;
	if (ret != 16) return -999;
	memcpy(msgId, result, 16);
	return 0;
}

int aem_message_upload(const char * const fileName, const size_t lenFileName, const unsigned char * const fileData, const size_t lenFileData, unsigned char * const msgId) {
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
	crypto_secretbox_easy(final + crypto_secretbox_NONCEBYTES, data, lenData, final, usk_symmetric);

	unsigned char result[32];
	unsigned char * const p_result = (unsigned char*)result;

	const int ret = apiFetch(AEM_API_MESSAGE_UPLOAD, final, lenFinal, &p_result);
	if (ret < 0) return -ret;
	if (ret != 16) return -999;
	memcpy(msgId, result, 16);
	return 0;
}

int aem_private_update(const unsigned char newPrivate[AEM_LEN_PRIVATE]) {
	return apiFetch(AEM_API_PRIVATE_UPDATE, newPrivate, AEM_LEN_PRIVATE, NULL);
}
*/

void aem_init(const char newOnionId[56], const unsigned char umk[AEM_KDF_UMK_KEYLEN]) {
	memcpy(onionId, newOnionId, 56);

	aem_kdf_umk(own_uak, AEM_KDF_SUB_KEYLEN,             AEM_KDF_KEYID_UMK_UAK, umk);
	aem_kdf_umk(own_esk, X25519_SKBYTES,                 AEM_KDF_KEYID_UMK_UAK, umk);
	aem_kdf_umk(own_ehk, crypto_aead_aes256gcm_KEYBYTES, AEM_KDF_KEYID_UMK_UAK, umk);
	aem_kdf_umk(own_pfk, AEM_KDF_SUB_KEYLEN,             AEM_KDF_KEYID_UMK_UAK, umk);

	own_uid = aem_kdf_uid(own_uak);
}

void aem_free(void) {
	sodium_memzero(own_uak, AEM_KDF_SUB_KEYLEN);
	sodium_memzero(own_esk, X25519_SKBYTES);
	sodium_memzero(own_ehk, crypto_aead_aes256gcm_KEYBYTES);
	sodium_memzero(own_pfk, AEM_KDF_SUB_KEYLEN);

/*
	if (intMsg != NULL) {
		for (int i = 0; i < count_intMsg; i++) {
			free(intMsg[i].subj);
			free(intMsg[i].body);
		}

		free(intMsg);
		intMsg = NULL;
		count_intMsg = 0;
	}
*/

	sodium_memzero(saltNm, crypto_pwhash_SALTBYTES);
	sodium_memzero(onionId, 56);
}
