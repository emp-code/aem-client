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

#include <mbedtls/net_sockets.h>
#include <mbedtls/ssl.h>
#include <mbedtls/entropy.h>
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/certs.h>
#include <mbedtls/x509.h>
#include <mbedtls/error.h>

#include <sodium.h>

#include "Include/Addr32.h"

#include "all-ears.h"

#define AEM_MAXLEN_HOST 32
#define AEM_ADDRESSES_PER_USER 50
#define AEM_PORT_API 302
#define AEM_LEVEL_MAX 3
#define AEM_LEN_PERSONAL (4096 - crypto_box_PUBLICKEYBYTES - 1 - (AEM_ADDRESSES_PER_USER * 14))
#define AEM_HEADBOX_SIZE 35 // Encrypted: (AEM_HEADBOX_SIZE + crypto_box_SEALBYTES)
#define AEM_API_POST_SIZE 8192 // 8 KiB
#define AEM_API_POST_BOXED_SIZE (crypto_box_NONCEBYTES + crypto_box_PUBLICKEYBYTES + AEM_API_POST_SIZE + 2 + crypto_box_MACBYTES)

#define AEM_RESPONSE_SIZE_BROWSE (281 + 131240)
#define AEM_RESPONSE_SIZE_SHORT 350
#define AEM_RESULT_SIZE_SHORT 33

#define AEM_PORT_TOR 9050 // Tor port
#define AEM_SOCKET_TIMEOUT 30 // Socket timeout in seconds

static mbedtls_ctr_drbg_context ctr_drbg;
static mbedtls_entropy_context entropy;
static mbedtls_ssl_config conf;
static mbedtls_ssl_context ssl;
static mbedtls_x509_crt cacert;

static unsigned char spk[crypto_box_PUBLICKEYBYTES];
static unsigned char usk[crypto_box_SECRETKEYBYTES];

static char host[AEM_MAXLEN_HOST + 1];
static size_t lenHost = 0;

static const int allears_csuite[] = {
	MBEDTLS_TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
	MBEDTLS_TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
0};

static const int allears_hashes[] = {MBEDTLS_SSL_HASH_SHA512,MBEDTLS_MD_NONE};

static const mbedtls_ecp_group_id allears_curves[] = {
//	MBEDTLS_ECP_DP_CURVE448, // MBEDTLS_ERR_SSL_FATAL_ALERT_MESSAGE (Client), MBEDTLS_ERR_SSL_NO_USABLE_CIPHERSUITE (Server)
//	MBEDTLS_ECP_DP_CURVE25519,
	MBEDTLS_ECP_DP_SECP521R1,
MBEDTLS_ECP_DP_NONE};

static uint16_t get_uint16(const unsigned char * const c) {uint16_t v; memcpy(&v, c, 2); return v;}
static uint32_t get_uint32(const unsigned char * const c) {uint32_t v; memcpy(&v, c, 4); return v;}
static void set_uint16(char * const c, const uint16_t v) {memcpy(c, &v, 2);}
static void set_uint32(char * const c, const uint32_t v) {memcpy(c, &v, 4);}

static int makeTorSocket(int * const sock) {
	struct sockaddr_in torAddr;
	torAddr.sin_family = AF_INET;
	torAddr.sin_port = htons(AEM_PORT_TOR);
	torAddr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

	if ((*sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) == -1) {perror("socket()"); return 1;}

	// Socket Timeout
	struct timeval tv;
	tv.tv_sec = AEM_SOCKET_TIMEOUT;
	tv.tv_usec = 0;
	setsockopt(*sock, SOL_SOCKET, SO_RCVTIMEO, (char*)&tv, sizeof(struct timeval));

	if (connect(*sock, (struct sockaddr*)&torAddr, sizeof(struct sockaddr)) == -1) {perror("connect()"); return 1;}
	return 0;
}

static int torConnect(int * const sock) {
	makeTorSocket(sock);

	const ssize_t lenReq = 10 + lenHost;
	char req[lenReq];

	req[0] = 4; // SOCKS version 4
	req[1] = 1; // Command: connect
	set_uint16(req + 2, htons(AEM_PORT_API)); // Port number
	set_uint32(req + 4, htonl(1)); // IP 0.0.0.1 - let Tor handle DNS
	req[8] = 0; // username (empty)
	memcpy(req + 9, host, lenHost);
	req[9 + lenHost] = '\0';

	if ((send(*sock, req, lenReq, 0)) != lenReq) return -1;

	unsigned char reply[8];
	if (recv(*sock, reply, 8, 0) != 8) return -1;

	if ((uint8_t)reply[0] != 0) return -1; // version: 0
	if ((uint8_t)reply[1] != 90) return -1; // status: 90
	if (get_uint16(reply + 2) != 0) return -1; // port: 0

	return 0;
}

static int tlsSend(const unsigned char * const data, const size_t lenData) {
	size_t sentBytes = 0;

	while (sentBytes < lenData) {
		int ret;
		do {ret = mbedtls_ssl_write(&ssl, data + sentBytes, lenData - sentBytes);} while (ret == MBEDTLS_ERR_SSL_WANT_WRITE);
		if (ret < 0) return sentBytes;
		sentBytes += ret;
	}

	return sentBytes;
}

static int tlsRead(unsigned char * const data, const int maxLen) {
	int readBytes = 0;

	while (readBytes < maxLen) {
		int ret;
		do {ret = mbedtls_ssl_read(&ssl, data + readBytes, maxLen);} while (ret == MBEDTLS_ERR_SSL_WANT_READ);

		if (ret == 0 || ret == MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY) return readBytes; // Server closed the connection cleanly
		if (ret < 0) return ret;

		readBytes += ret;
	}

	return readBytes;
}

static void freeTls(void) {
	mbedtls_ssl_free(&ssl);
	mbedtls_ssl_config_free(&conf);
	mbedtls_ctr_drbg_free(&ctr_drbg);
	mbedtls_entropy_free(&entropy);
	mbedtls_x509_crt_free(&cacert);
}

static int setupTls() {
	mbedtls_ssl_init(&ssl);
	mbedtls_ctr_drbg_init(&ctr_drbg);
	mbedtls_entropy_init(&entropy);
	if (mbedtls_ctr_drbg_seed(&ctr_drbg, mbedtls_entropy_func, &entropy, NULL, 0)) return -1;

	mbedtls_x509_crt_init(&cacert);
	if (mbedtls_x509_crt_parse_path(&cacert, "/etc/ssl/certs/") != 0) return -1;

	if (mbedtls_ssl_set_hostname(&ssl, host) != 0) return -1;

	mbedtls_ssl_config_init(&conf);
	if (mbedtls_ssl_config_defaults(&conf, MBEDTLS_SSL_IS_CLIENT, MBEDTLS_SSL_TRANSPORT_STREAM, MBEDTLS_SSL_PRESET_DEFAULT) != 0) return -1;
	mbedtls_ssl_conf_authmode(&conf, MBEDTLS_SSL_VERIFY_REQUIRED);
	mbedtls_ssl_conf_ca_chain(&conf, &cacert, NULL);
	mbedtls_ssl_conf_ciphersuites(&conf, allears_csuite);
	mbedtls_ssl_conf_curves(&conf, allears_curves);
	mbedtls_ssl_conf_dhm_min_bitlen(&conf, 2048); // Minimum length for DH parameters
	mbedtls_ssl_conf_fallback(&conf, MBEDTLS_SSL_IS_NOT_FALLBACK);
	mbedtls_ssl_conf_min_version(&conf, MBEDTLS_SSL_MAJOR_VERSION_3, MBEDTLS_SSL_MINOR_VERSION_3); // Require TLS v1.2+
	mbedtls_ssl_conf_read_timeout(&conf, AEM_SOCKET_TIMEOUT);
	mbedtls_ssl_conf_renegotiation(&conf, MBEDTLS_SSL_RENEGOTIATION_DISABLED);
	mbedtls_ssl_conf_rng(&conf, mbedtls_ctr_drbg_random, &ctr_drbg);
	mbedtls_ssl_conf_session_tickets(&conf, MBEDTLS_SSL_SESSION_TICKETS_DISABLED);
	mbedtls_ssl_conf_sig_hashes(&conf, allears_hashes);

	if (mbedtls_ssl_setup(&ssl, &conf) != 0) return -1;
	return 0;
}

static int setupConnection(int * const sock) {
	int ret = torConnect(sock);
	if (ret != 0) return -1;

	mbedtls_ssl_set_bio(&ssl, sock, mbedtls_net_send, mbedtls_net_recv, NULL);

	while ((ret = mbedtls_ssl_handshake(&ssl)) != 0) {
		if (ret != MBEDTLS_ERR_SSL_WANT_READ && ret != MBEDTLS_ERR_SSL_WANT_WRITE) return -1;
	}

	if (mbedtls_ssl_get_verify_result(&ssl) != 0) return -1; // Invalid cert

	return 0;
}

static int apiFetch(const char * const command, const void * const post, const size_t lenPost, unsigned char * const result) {
	if (command == NULL || post == NULL || lenPost < 1) return -1;

	int sock;
	int ret = setupConnection(&sock);
	if (ret != 0) return -1; // Failed setting up connection

	const int lenReq = 71 + lenHost + AEM_API_POST_BOXED_SIZE;
	unsigned char req[lenReq];

	// HTTP headers
	memcpy(req, "POST /api/", 10);
	memcpy(req + 10, command, 14);
	memcpy(req + 24, " HTTP/1.1\r\nContent-Length: 8266\r\nHost: ", 39);
	memcpy(req + 63, host, lenHost);
	memcpy(req + 63 + lenHost, ":302\r\n\r\n", 8);

	// POST data: Our public key + nonce + the encrypted box
	unsigned char * const postBegin = req + 71 + lenHost;
	crypto_scalarmult_base(postBegin, usk);
	randombytes_buf(postBegin + crypto_box_PUBLICKEYBYTES, crypto_box_NONCEBYTES);

	unsigned char clear[AEM_API_POST_SIZE + 2];
	const uint16_t u16 = lenPost;
	memcpy(clear, post, lenPost);
	memcpy(clear + AEM_API_POST_SIZE, &u16, 2);

	ret = crypto_box_easy(postBegin + crypto_box_PUBLICKEYBYTES + crypto_box_NONCEBYTES, clear, AEM_API_POST_SIZE + 2, postBegin + crypto_box_PUBLICKEYBYTES, spk, usk);
	sodium_memzero(clear, AEM_API_POST_SIZE + 2);

	int lenResponse = -1;
	if (ret == 0) {
		if (tlsSend(req, lenReq) == lenReq) {
			unsigned char response[AEM_RESPONSE_SIZE_SHORT + 1];
			lenResponse = tlsRead(response, AEM_RESPONSE_SIZE_SHORT + 1);
			if (lenResponse == 0) {
				lenResponse = -1; // Server refused to answer
			} else if (lenResponse != AEM_RESPONSE_SIZE_SHORT) {
				lenResponse = -1; // Invalid response size
			} else if (result != NULL) {
				lenResponse = result[AEM_RESPONSE_SIZE_SHORT - AEM_RESULT_SIZE_SHORT - 1];
				memcpy(response, result + AEM_RESPONSE_SIZE_SHORT - AEM_RESULT_SIZE_SHORT, AEM_RESULT_SIZE_SHORT - 1);
			}
		}
	}

	close(sock);
	mbedtls_ssl_close_notify(&ssl);
	mbedtls_ssl_session_reset(&ssl);
	return lenResponse;
}

int allears_address_lookup(const char * const query, unsigned char * const result) {
	unsigned char data[AEM_RESULT_SIZE_SHORT - 1];
	if (apiFetch("address/lookup", query, strlen(query), data) != 0) return -1;
	memcpy(result, data, AEM_RESULT_SIZE_SHORT - 1);
	return 0;
}

int allears_init(const char * const newHost, const size_t lenNewHost, const unsigned char newSpk[crypto_box_PUBLICKEYBYTES], const unsigned char newUsk[crypto_box_SECRETKEYBYTES]) {
	if (lenNewHost > AEM_MAXLEN_HOST) return -1;
	lenHost = lenNewHost;
	memcpy(host, newHost, lenNewHost);
	host[lenNewHost] = '\0';

	memcpy(spk, newSpk, crypto_box_SECRETKEYBYTES);
	memcpy(usk, newUsk, crypto_box_SECRETKEYBYTES);

	return setupTls();
}

void allears_free(void) {
	bzero(host, lenHost);
	lenHost = 0;
	sodium_memzero(usk, crypto_box_SECRETKEYBYTES);
	return freeTls();
}
