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
#define AEM_ADDRESSES_PER_USER 31
#define AEM_PORT_API 302
#define AEM_LEVEL_MAX 3
#define AEM_LEN_PRIVATE (4096 - crypto_box_PUBLICKEYBYTES - 1 - (AEM_ADDRESSES_PER_USER * 9))
#define AEM_RESPONSE_HEAD_SIZE_SHORT 166
#define AEM_RESPONSE_DATA_SIZE_SHORT 33
#define AEM_SEALCLEAR_LEN (1 + crypto_box_NONCEBYTES + crypto_box_PUBLICKEYBYTES)

// Local settings
#define AEM_MAXLEN_HOST 32
#define AEM_PORT_TOR 9050
#define AEM_SOCKET_TIMEOUT 30

static unsigned char spk[crypto_box_PUBLICKEYBYTES];
static unsigned char upk[crypto_box_PUBLICKEYBYTES];
static unsigned char usk[crypto_box_SECRETKEYBYTES];

static char onionId[56];

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

static int apiFetch(const int apiCmd, const void * const clear, const size_t lenClear, unsigned char **result) {
	if (apiCmd < 0 || clear == NULL || lenClear < 1 || lenClear > AEM_API_BOX_SIZE_MAX) return -1;

	const int sock = torConnect();
	if (sock < 0) return -1;

	size_t lenReq = AEM_SEALCLEAR_LEN + crypto_box_SEALBYTES + lenClear + crypto_box_MACBYTES;
	unsigned char req[122 + lenReq];

	// HTTP headers
	sprintf((char*)req,
		"POST /api HTTP/1.1\r\n"
		"Host: %.56s.onion:302\r\n"
		"Content-Length: %zu\r\n"
		"\r\n",
	onionId, lenReq);
	const size_t lenHeaders = strlen((char*)req);
	lenReq += lenHeaders;

	unsigned char pbNonce[crypto_box_NONCEBYTES];
	randombytes_buf(pbNonce, crypto_box_NONCEBYTES);

	unsigned char sealClear[AEM_SEALCLEAR_LEN];
	sealClear[0] = apiCmd;
	memcpy(sealClear + 1, pbNonce, crypto_box_NONCEBYTES);
	memcpy(sealClear + 1 + crypto_box_NONCEBYTES, upk, crypto_box_PUBLICKEYBYTES);

	const int ret1 = crypto_box_seal(req + lenHeaders, sealClear, AEM_SEALCLEAR_LEN, spk);
	const int ret2 = crypto_box_easy(req + lenHeaders + AEM_SEALCLEAR_LEN + crypto_box_SEALBYTES, clear, lenClear, pbNonce, spk, usk);

	const bool wantShortResponse = (apiCmd != AEM_API_ACCOUNT_BROWSE && apiCmd != AEM_API_MESSAGE_BROWSE);

	int lenResult = -1;
	if (ret1 == 0 && ret2 == 0) {
		if (send(sock, req, lenReq, 0) == (int)lenReq) {
			if (wantShortResponse) {
				unsigned char response[AEM_RESPONSE_HEAD_SIZE_SHORT + AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_NONCEBYTES + crypto_box_MACBYTES + 1];
				lenResult = recv(sock, response, AEM_RESPONSE_HEAD_SIZE_SHORT + AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_NONCEBYTES + crypto_box_MACBYTES + 1, 0);
				if (lenResult == AEM_RESPONSE_HEAD_SIZE_SHORT + AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_NONCEBYTES + crypto_box_MACBYTES) {
					unsigned char decrypted[AEM_RESPONSE_DATA_SIZE_SHORT];
					if (crypto_box_open_easy(decrypted, response + AEM_RESPONSE_HEAD_SIZE_SHORT + crypto_box_NONCEBYTES, AEM_RESPONSE_DATA_SIZE_SHORT + crypto_box_MACBYTES, response + AEM_RESPONSE_HEAD_SIZE_SHORT, spk, usk) == 0) {
						if (result != NULL) {
							const int lenCpy = decrypted[0];
							if (lenCpy < AEM_RESPONSE_DATA_SIZE_SHORT) {
								memcpy(*result, decrypted + 1, lenCpy);
								lenResult = lenCpy;
							} else lenResult = -1; // Invalid length --> Server reported error
						} else lenResult = 0; // Result data not wanted, 0=success
					} else lenResult = -1; // Failed to decrypt
				} else lenResult = -1; // Incorrect length received
			} else if (result != NULL) {
				*result = malloc(1000 + AEM_MAXLEN_MSGDATA);
				if (*result != NULL) {
					lenResult = recv(sock, *result, 1000 + AEM_MAXLEN_MSGDATA, 0);
					if (lenResult > 0) {
						const unsigned char * const headEnd = memmem(*result, lenResult, "\r\n\r\n", 4);
						if (headEnd != NULL) {
							const int lenFinal = (*result + lenResult) - (headEnd + 4);
							memcpy(*result, headEnd + 4, lenFinal);
							lenResult = lenFinal;
						} else {free(*result); lenResult = -1;} // Invalid response from server
					} else {free(*result); lenResult = -1;} // Server refused to answer
				} else lenResult = -1; // Failed alloc
			}
		}
	}

	close(sock);
	return lenResult;
}

int allears_account_create(const unsigned char * const newPk) {
	return apiFetch(AEM_API_ACCOUNT_CREATE, newPk, crypto_box_PUBLICKEYBYTES, NULL);
}

int allears_account_delete(const unsigned char * const newPk) {
	return apiFetch(AEM_API_ACCOUNT_DELETE, newPk, crypto_box_PUBLICKEYBYTES, NULL);
}

int allears_message_browse() {
	unsigned char *msgData;
	if (apiFetch(AEM_API_MESSAGE_BROWSE, (const unsigned char[]){0}, 1, &msgData) == -1) return -1;

	// TODO
	free(msgData);
	return 0;
}

int allears_init(const char * const newOnionId, const unsigned char newSpk[crypto_box_PUBLICKEYBYTES], const unsigned char userKey[crypto_kdf_KEYBYTES]) {
	memcpy(onionId, newOnionId, 56);
	memcpy(spk, newSpk, crypto_box_PUBLICKEYBYTES);

	unsigned char boxSeed[crypto_box_SEEDBYTES];
	crypto_kdf_derive_from_key(boxSeed, crypto_box_SEEDBYTES, 1, "AEM-Usr0", userKey);
	crypto_box_seed_keypair(upk, usk, boxSeed);
	sodium_memzero(boxSeed, crypto_box_SEEDBYTES);
	return 0;
}

void allears_free(void) {
	sodium_memzero(usk, crypto_box_SECRETKEYBYTES);
}
