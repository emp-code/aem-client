#include <math.h>
#include <netinet/in.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>
#include <time.h>

#include <sodium.h>

#include "AEM_KDF.h"

#include "aem_internal.h"

// Local settings
#define AEM_PORT_TOR 9050
#define AEM_SOCKET_TIMEOUT 30

// Must match server
#define AEM_BINTS_BEGIN 1735689600000
#define AEM_UAK_TYPE_URL_AUTH 0
#define AEM_UAK_TYPE_URL_DATA 16
#define AEM_UAK_TYPE_REQ_BODY 32
#define AEM_UAK_TYPE_RES_BODY 48

static unsigned char uak[AEM_KDF_UAK_KEYLEN];
static char onionId[56];

void apiFetch_setUak(const unsigned char new[AEM_KDF_UAK_KEYLEN]) {
	memcpy(uak, new, AEM_KDF_UAK_KEYLEN);
}

void apiFetch_setOnionId(const unsigned char new[56]) {
	memcpy(onionId, new, 56);
}

void apiFetch_clear(void) {
	sodium_memzero(uak, AEM_KDF_UAK_KEYLEN);
	sodium_memzero(onionId, 56);
}

static int makeTorSocket(void) {
	struct sockaddr_in torAddr;
	torAddr.sin_family = AF_INET;
	torAddr.sin_port = htons(AEM_PORT_TOR);
	torAddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

	const int sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
	if (sock < 0) return -1;

	// Socket Timeout
	struct timeval tv;
	tv.tv_sec = AEM_SOCKET_TIMEOUT;
	tv.tv_usec = 0;
	setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (char*)&tv, sizeof(struct timeval));

	if (connect(sock, (struct sockaddr*)&torAddr, sizeof(struct sockaddr)) != 0) return -1;
	return sock;
}

static int torSock(void) {
	const int sock = makeTorSocket();
	if (sock < 0) return -1;

	unsigned char req[72];
	unsigned char reply[8];

	memcpy(req, "\x04\x01\x01\x2e\x00\x00\x00\x01\x00", 9); // 012e: port 302
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

static bool memeq(const void * const a, const void * const b, const size_t len) {
	for (size_t i = 0; i < len; i++) {
		if (((const unsigned char * const)a)[i] != ((const unsigned char * const)b)[i]) return false;
	}

	return true;
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

static uint64_t getBinTs(void) {
	struct timespec t;
	clock_gettime(CLOCK_REALTIME, &t);
	return (t.tv_sec * 1000) + lrint((double)t.tv_nsec / 1000000) - AEM_BINTS_BEGIN;
}

static int api_send(const int sock, const int cmd, const int flags, const unsigned char * const urlData, const unsigned char * const post, const size_t lenPost, const uint64_t binTs) {
	if (cmd < 0 || cmd > 15 || flags < 0 || flags > 3 || lenPost > 9999999) return -1;

	// Create the URL
	unsigned char data_key[1 + AEM_API_REQ_DATA_LEN];
	aem_kdf_uak(data_key, 1 + AEM_API_REQ_DATA_LEN, binTs, (post != NULL), AEM_UAK_TYPE_URL_DATA, uak);

	unsigned char urlBase[42];
	bzero(urlBase, 42);
	memcpy(urlBase, &binTs, 6);
	urlBase[5] |= ((cmd << 2) | (flags << 6)) ^ (data_key[0] & 252); // 60 (Enc-Cmd) + 192 (Enc-Flags) = 252; 3: BinTs

	for (int i = 0; i < AEM_API_REQ_DATA_LEN; i++) {
		if ((urlData != NULL) && i < AEM_API_REQ_DATA_LEN) {
			urlBase[6 + i] = urlData[i] ^ data_key[1 + i];
		} else {
			urlBase[6 + i] = data_key[1 + i];
		}
	}

	// Add authentication
	unsigned char auth_key[crypto_onetimeauth_KEYBYTES];
	aem_kdf_uak(auth_key, crypto_onetimeauth_KEYBYTES, binTs, (post != NULL), AEM_UAK_TYPE_URL_AUTH, uak);
	crypto_onetimeauth(urlBase + 26, urlBase + 5, 21, auth_key);

	// Encode to Base64 and send
	char url[57];
	sodium_bin2base64(url, 57, urlBase, 42, sodium_base64_VARIANT_URLSAFE);

	if (post == NULL) {
		unsigned char req[64];
		sprintf((char*)req, "GET /%.56s H", url);
		if (send(sock, req, 63, 0) != 63) {close(sock); return -5;}
	} else {
		const ssize_t lenReq = 93 + numberOfDigits(lenPost) + lenPost + crypto_aead_aegis256_ABYTES;
		unsigned char req[lenReq + 1];
		sprintf((char*)req, "POST /%.56s HTTP/1.0\r\nContent-Length: %zu\r\n\r\n", url, lenPost + crypto_aead_aegis256_ABYTES);

		unsigned char nk[crypto_aead_aegis256_NPUBBYTES + crypto_aead_aegis256_KEYBYTES];
		aem_kdf_uak(nk, crypto_aead_aegis256_NPUBBYTES + crypto_aead_aegis256_KEYBYTES, binTs, (post != NULL), AEM_UAK_TYPE_REQ_BODY, uak);

		crypto_aead_aegis256_encrypt(req + 93 + numberOfDigits(lenPost), NULL, post, lenPost, NULL, 0, NULL, nk, nk + crypto_aead_aegis256_NPUBBYTES);
		if (send(sock, req, lenReq, 0) != lenReq) {close(sock); return -5;}
	}

	return 0;
}

// null out if expecting a 1-byte status response
static int api_recv(const int sock, unsigned char ** const out, const uint64_t binTs, const bool post) {
	unsigned char raw[73 + 257 + crypto_aead_aegis256_ABYTES];
	const ssize_t lenRaw = recv(sock, raw, 73 + 257 + crypto_aead_aegis256_ABYTES, 0);
	close(sock);

	if (lenRaw == -1) return -1;
	if (lenRaw == 0) return -2;
	if (lenRaw == 50) {return (memeq(raw, "HTTP/1.0 204 ", 13) && raw[13] >= 'A' && raw[13] <= 'Z') ? 1000 + (raw[13] - 'A') : -3;}
	if (lenRaw < 362 || (lenRaw - 106) % 256 != 0 || memcmp(raw, "HTTP/1.0 200 aem\r\n", 18) != 0) return -4;

	unsigned char nk[crypto_aead_aegis256_NPUBBYTES + crypto_aead_aegis256_KEYBYTES];
	aem_kdf_uak(nk, crypto_aead_aegis256_NPUBBYTES + crypto_aead_aegis256_KEYBYTES, binTs, post, AEM_UAK_TYPE_RES_BODY, uak);

	size_t lenDec = lenRaw - 73 - crypto_aead_aegis256_ABYTES;
	unsigned char *dec = malloc(lenDec);
	if (dec == NULL) return -5;
	if (crypto_aead_aegis256_decrypt(dec, NULL, NULL, raw + 73, lenRaw - 73, NULL, 0, nk, nk + crypto_aead_aegis256_NPUBBYTES) != 0) {free(dec); return -6;}

	if (out == NULL) {
		const int ret = (lenDec == 257 && dec[0] == 255) ? dec[1] : -7;
		free(dec);
		return ret;
	}

	lenDec -= dec[0] + 1; // Remove padding and padding-amount
	memmove(dec, dec + 1, lenDec);
	*out = realloc(dec, lenDec);
	return lenDec;
}

int apiFetch(const int cmd, const int flags, const unsigned char * const urlData, const unsigned char * const post, const size_t lenPost, unsigned char ** const out) {
	const int sock = torSock();
	if (sock < 0) return -999;
	uint64_t binTs = getBinTs();
	int ret = api_send(sock, cmd, flags, urlData, post, lenPost, binTs);
	if (ret < 0) return ret;

	return api_recv(sock, out, binTs, (post != NULL));
}
