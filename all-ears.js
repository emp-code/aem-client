"use strict";

function AllEars(readyCallback) {
	if (typeof(readyCallback) !== "function") return;

	try {
		if ((!window.isSecureContext && !(/^[2-7a-z]{56}\.onion$/.test(document.domain)))
		|| window.self !== window.top
		|| window.opener !== null
		|| document.compatMode == "BackCompat"
		|| document.characterSet !== "UTF-8"
		) return readyCallback(false);
	} catch(e) {return readyCallback(false);}

// Private constants - must match server
	const _AEM_APIURL = document.head.querySelector("meta[name='aem.url.api']").content? document.head.querySelector("meta[name='aem.url.api']").content : "https://" + document.domain + ":302";
	const _AEM_USERCOUNT = 4096;
	const _AEM_MAXLEN_OURDOMAIN = 32;

	// GET
	const _AEM_API_ACCOUNT_BROWSE = 0;
	const _AEM_API_ACCOUNT_DELETE = 1;
	const _AEM_API_ACCOUNT_UPDATE = 2;
	const _AEM_API_ADDRESS_CREATE = 3;
	const _AEM_API_ADDRESS_DELETE = 4;
	const _AEM_API_ADDRESS_UPDATE = 6;
	const _AEM_API_MESSAGE_BROWSE = 7;
	const _AEM_API_MESSAGE_DELETE = 8;
	const _AEM_API_MESSAGE_SENDER = 9;
	const _AEM_API_SETTING_LIMITS = 10;
	// POST
	const _AEM_API_ACCOUNT_CREATE = 0;
	const _AEM_API_MESSAGE_CREATE = 1;
	const _AEM_API_MESSAGE_PUBLIC = 2;
	const _AEM_API_MESSAGE_UPLOAD = 3;
	const _AEM_API_MESSAGE_VERIFY = 4;
	const _AEM_API_PRIVATE_UPDATE = 5;

	const _AEM_UAK_TYPE_URL_AUTH  = 0;
	const _AEM_UAK_TYPE_URL_DATA = 32;
	const _AEM_UAK_TYPE_REQ_BODY = 64;
	const _AEM_UAK_TYPE_RES_BODY = 96;
	const _AEM_UAK_POST = 128;

	const _AEM_KDF_KEYID_UMK_UAK = 1;
	const _AEM_KDF_KEYID_UMK_ESK = 2;
	const _AEM_KDF_KEYID_UMK_EHK = 3;
	const _AEM_KDF_KEYID_UMK_PFK = 4;

	const _AEM_KDF_KEYID_UAK_UID = new Uint8Array([0x01,0,0,0,0,0,0,0]);

	// 128 reserved, 64 unused
	const _AEM_ADDR_FLAG_ORIGIN =  32;
	const _AEM_ADDR_FLAG_SECURE =  16;
	const _AEM_ADDR_FLAG_ATTACH =   8;
	const _AEM_ADDR_FLAG_ALLVER =   4;
	const _AEM_ADDR_FLAG_ACCEXT =   2;
	const _AEM_ADDR_FLAG_ACCINT =   1;
	const _AEM_ADDR_FLAGS_DEFAULT = (_AEM_ADDR_FLAG_ACCEXT | _AEM_ADDR_FLAG_ALLVER | _AEM_ADDR_FLAG_ATTACH);

	const _AEM_FLAG_OLDER = 8;
	const _AEM_FLAG_UINFO = 4;
	const _AEM_FLAG_EMAIL = 8;
	const _AEM_FLAG_EMPTY = 8;

	const _AEM_ADDR32_CHARS = "0123456789abcdefghjkmnpqrstuwxyz";
	const _AEM_ADDRESSES_PER_USER = 31;
	const _AEM_LEN_PRIVATE = 4518;
	const _AEM_MSG_MINBLOCKS = 12;
	const _AEM_MSG_SRC_MAXSIZE = 1048699; // ((2^16 - 1) + 12) * 16 - 48 - 5; 1MiB + 123B
	const _AEM_MSG_SRC_MINSIZE = 124;
	const _AEM_USER_MAXLEVEL = 3;
	const _X25519_PKBYTES = 32;

	const _AEM_EMAIL_CERT_MATCH_HDRFR = 96;
	const _AEM_EMAIL_CERT_MATCH_ENVFR = 64;
	const _AEM_EMAIL_CERT_MATCH_GREET = 32;

	const _AEM_EMAIL_CERT_EDDSA = 28;
	const _AEM_EMAIL_CERT_EC521 = 24;
	const _AEM_EMAIL_CERT_EC384 = 20;
	const _AEM_EMAIL_CERT_EC256 = 16;
	const _AEM_EMAIL_CERT_RSA4K = 12;
	const _AEM_EMAIL_CERT_RSA2K =  8;
	const _AEM_EMAIL_CERT_RSA1K =  4;

// Private variables
	let _ourDomain = "unknown";

	let _addrNormal_salt;
	let _addrNormal_olim;
	let _addrNormal_mlim;

	const _maxStorage = [];
	const _maxNormalA = [];
	const _maxShieldA = [];

	// User keys shared with the Server
	let _own_uak; // User Access Key

	// Private user keys
	let _own_esk; // Envelope Secret Key
	let _own_ehk; // Envelope Hidden Key
	let _own_pfk; // Private Field Key

	let _own_privateNonce = null;

	// Other user data
	let _own_uid = 0;
	let _own_upk = 0;
	let _own_level = 0;
	const _own_addr = [];

	const _extMsg = [];
	const _intMsg = [];
	const _uplMsg = [];
	const _outMsg = [];
	let _newestEvpId = null;
	let _newestMsgTs = 0;
	let _oldestEvpId = null;
	let _oldestMsgTs = 4294967296;

	let _totalMsgCount = 0;
	let _totalMsgBytes = 0;
	let _readyMsgBytes = 0;

	const _contactMail = [];
	const _contactName = [];
	const _contactNote = [];
	let _privateExtra = "";

	const _admin_userUid = [];
	const _admin_userKib = [];
	const _admin_userNrm = [];
	const _admin_userShd = [];
	const _admin_userLvl = [];

// Private functions
	function _ExtMsg(id, ts, hdrTs, hdrTz, ip, cc, cs, tls, esmtp, protV, inval, rares, attach, greetDomainIp, ipBlacklisted, dkim, dkimTxt, greet, rdns, auSys, envFrom, hdrFrom, dnFrom, envTo, hdrTo, dnTo, hdrRt, dnRt, hdrId, headers, subj, body) {
		this.id = id;
		this.ts = ts;
		this.hdrTs = hdrTs;
		this.hdrTz = hdrTz;
		this.ip = ip;
		this.countryCode = cc;
		this.cs = cs;
		this.tls = tls;
		this.esmtp = esmtp;
		this.protV = protV;
		this.inval = inval;
		this.rares = rares;
		this.attach = attach;
		this.greetDomainIp = greetDomainIp;
		this.ipBlacklisted = ipBlacklisted;
		this.dkim = dkim;
		this.dkimTxt = dkimTxt;
		this.greet = greet;
		this.rdns = rdns;
		this.auSys = auSys;
		this.envFrom = envFrom;
		this.hdrFrom = hdrFrom;
		this.dnFrom = dnFrom;
		this.hdrRt = hdrRt;
		this.dnRt = dnRt;
		this.envTo = envTo;
		this.hdrTo = hdrTo;
		this.dnTo = dnTo;
		this.hdrId = hdrId;
		this.headers = headers;
		this.subj = subj;
		this.body = body;
	}

	function _IntMsg(id, ts, isE2ee, fromLv, apk, from, to, title, body) {
		this.id = id;
		this.ts = ts;
		this.isE2ee = isE2ee;
		this.fromLv = fromLv;
		this.apk = apk;
		this.from = from;
		this.to = to;
		this.title = title;
		this.body = body;
	}

	function _OutMsg_Ext(id, ts, ip, cc, fr, to, sb, bd, mx, gr, st, cs, tlsVer, attach) {
		this.isInt = false;
		this.id = id;
		this.ts = ts;
		this.ip = ip;
		this.countryCode = cc;
		this.from = fr;
		this.to = to;
		this.subj = sb;
		this.body = bd;
		this.mxDom = mx;
		this.greet = gr;
		this.status = st;
		this.tlsCs = cs;
		this.tlsVer = tlsVer;
		this.attach = attach;
	}

	function _OutMsg_Int(id, ts, isE2ee, to, from, subj, body) {
		this.isInt = true;
		this.id = id;
		this.ts = ts;
		this.isE2ee = isE2ee;
		this.to = to;
		this.from = from;
		this.subj = subj;
		this.body = body;
	}

	function _UplMsg(id, ts, title, body, parent, blocks) {
		this.id = id;
		this.ts = ts;
		this.title = title;
		this.body = body;
		this.parent = parent;
		this.blocks = blocks;
	}

	function _Address(hash, addr32, flags, nick) {
		this.hash = hash;
		this.addr32 = addr32;
		this.flags = flags;
		this.nick = nick;
	}

	const _getBinTs = function() {
		const ts = BigInt(Date.now());

		return new Uint8Array([
			Number(ts & 255n),
			Number((ts >> 8n) & 255n),
			Number((ts >> 16n) & 255n),
			Number((ts >> 24n) & 255n),
			Number((ts >> 32n) & 255n)
		]);
	}

	const _aem_kdf_umk = function(size, id, key) {
		const counter = (id << 8) | (key[44] << 16);
		return sodium.crypto_stream_chacha20_ietf_xor_ic(new Uint8Array(size), key.slice(32, 44), counter, key.slice(0, 32));
	}

	const _aem_kdf_sub = function(size, n, key) {
		const counter = ((key[36] & 127) << 24) | ((key[36] & 128) << 16);
		const nonce = new Uint8Array([key[32], key[33], key[34], key[35], n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]]);
		return sodium.crypto_stream_chacha20_ietf_xor_ic(new Uint8Array(size), nonce, counter, key.slice(0, 32));
	}

	const _uak_derive = function(binTs, post, type) {
		const nonce = new Uint8Array(8);
		nonce.set(binTs);
		nonce[5] = (post? _AEM_UAK_POST : 0) | type;

		return _aem_kdf_sub(32, nonce, _own_uak);
	}

	const _fetchBinary = async function(urlBase, postData, callback) {
		let r;
		try {
			r = await fetch(_AEM_APIURL + "/" + sodium.to_base64(urlBase, sodium.base64_variants.URLSAFE), {
				method: postData? "POST" : "GET",
				credentials: "omit",
				headers: new Headers({
					"Accept": "",
					"Accept-Language": ""
				}),
				mode: "cors",
				redirect: "error",
				referrer: "",
				referrerPolicy: "no-referrer",
				body: (typeof(postData) === "object") ? postData : null
			});
		} catch(e) {callback(0x02);}

		callback(r? ((r.status === 200) ? new Uint8Array(await r.arrayBuffer()) : r.status) : 0x02);
	};

	const _fetchEncrypted = async function(cmd, flags, urlData, postData, callback) {
		await new Promise(resolve => setTimeout(resolve, 1)); // Ensure requests are never made within the same millisecond

		// Create one-use keys
		const binTs = _getBinTs();
		const auth_key = _uak_derive(binTs, postData? true:false, _AEM_UAK_TYPE_URL_AUTH);
		const data_key = _uak_derive(binTs, postData? true:false, _AEM_UAK_TYPE_URL_DATA);

		// Create URL Base
		const urlBase = new Uint8Array(48);
		urlBase.set(binTs);
		urlBase[5] = _own_uid & 255; // First 8 bits of UID
		urlBase[6] = (_own_uid >> 8) | ((cmd ^ (data_key[0] & 15)) << 4); // Last 4 bits of UID; Encrypted: CMD
		urlBase[7] = (flags & 15) ^ (data_key[0] >> 4); // High bits unused

		for (let i = 0; i < 24; i++) {
			if (urlData && i < urlData.length) {
				urlBase[8 + i] = urlData[i] ^ data_key[1 + i];
			} else {
				urlBase[8 + i] = data_key[1 + i];
			}
		}

		urlBase.set(sodium.crypto_onetimeauth(urlBase.slice(5, 32), auth_key), 32);

		let post = null;
		if (postData && (typeof(postData) === "object")) {
			post = await window.crypto.subtle.encrypt(
				{name: "AES-GCM", iv: new Uint8Array(12)},
				await window.crypto.subtle.importKey("raw", _uak_derive(binTs, true, _AEM_UAK_TYPE_REQ_BODY), {"name": "AES-GCM"}, false, ["encrypt"]),
				postData);
		}

		_fetchBinary(urlBase, post, async function(result) {
			if (typeof(result) === "number") {callback(result); return;}

			let dec;
			try {
				dec = await window.crypto.subtle.decrypt(
					{name: "AES-GCM", iv: new Uint8Array(12)},
					await window.crypto.subtle.importKey("raw", _uak_derive(binTs, postData? true:false, _AEM_UAK_TYPE_RES_BODY), {"name": "AES-GCM"}, false, ["decrypt"]),
					result);
			} catch(e) {callback(0x04);}

			let u8 = new Uint8Array(dec);
			u8 = u8.slice(1, u8.length - u8[0]);
			callback(u8);
		});
	};

	const _addr32_encode = function(srcTxt) {
		srcTxt = srcTxt.toLowerCase().replaceAll("o", "0").replaceAll("i", "1").replaceAll("l", "1").replaceAll("v", "w");

		let lenSrc = 0;
		const src = new Uint8Array(16);
		for (let i = 0; i < srcTxt.length; i++) {
			for (let j = 0; j < 32; j++) {
				if (srcTxt[i] === _AEM_ADDR32_CHARS[j]) {
					src[lenSrc] = j;
					lenSrc++;
					break;
				}
			}

			if (lenSrc == 16) break;
		}

		return new Uint8Array([
			((lenSrc == 16) ? (128 | (src[15] << 3)) : (lenSrc << 3)) | (src[0] >> 2),

			(src[0]  << 6) | (src[1]  << 1) | (src[2] >> 4),
			(src[2]  << 4) | (src[3]  >> 1),
			(src[3]  << 7) | (src[4]  << 2) | (src[5] >> 3),
			(src[5]  << 5) |  src[6],

			(src[7]  << 3) | (src[8]  >> 2),
			(src[8]  << 6) | (src[9]  << 1) | (src[10] >> 4),
			(src[10] << 4) | (src[11] >> 1),
			(src[11] << 7) | (src[12] << 2) | (src[13] >> 3),
			(src[13] << 5) |  src[14]
		]);
	};

	const _addr32_decode = function(x) {
		if (!x) return "(error)";

		const c = _AEM_ADDR32_CHARS;
		const dec =
		  c[((x[0] & 7) << 2) | (x[1] >> 6)]
		+ c[(x[1] & 62) >> 1]
		+ c[((x[1] & 1) << 4) | (x[2] >> 4)]
		+ c[((x[2] & 15) << 1) | (x[3] >> 7)]
		+ c[(x[3] >> 2) & 31]
		+ c[((x[3] & 3) << 3) | (x[4] >> 5)]
		+ c[x[4] & 31]

		+ c[x[5] >> 3]
		+ c[((x[5] & 7) << 2) | (x[6] >> 6)]
		+ c[(x[6] & 62) >> 1]
		+ c[((x[6] & 1) << 4) | (x[7] >> 4)]
		+ c[((x[7] & 15) << 1) | (x[8] >> 7)]
		+ c[(x[8] >> 2) & 31]
		+ c[((x[8] & 3) << 3) | (x[9] >> 5)]
		+ c[x[9] & 31];

		return ((x[0] >> 3) < 16) ? dec.slice(0, x[0] >> 3) : dec + c[x[0] >> 3];
	};

	const _getAddressCount = function(isShield) {
		let count = 0;

		for (let i = 0; i < _own_addr.length; i++) {
			if (_own_addr[i].addr32 && !isShield === !(_own_addr[i].addr32[0] & 128)) count++;
		}

		return count;
	};

	const _msgExists = function(id) {
		let found = false;

		_extMsg.forEach(function(msg) {if (msg.id === id) found = true;}); if (found) return true;
		_intMsg.forEach(function(msg) {if (msg.id === id) found = true;}); if (found) return true;
		_uplMsg.forEach(function(msg) {if (msg.id === id) found = true;}); if (found) return true;
		_outMsg.forEach(function(msg) {if (msg.id === id) found = true;}); if (found) return true;

		return false;
	};

	const _getFileType = function(filename) {
		if (!filename) return null;

		const ext = filename.lastIndexOf(".");
		if (ext < 0) return null;

		switch (filename.substr(ext + 1).toLowerCase()) {
			case "bat":
			case "c":
			case "c++":
			case "cc":
			case "cpp":
			case "css":
			case "csv":
			case "cxx":
			case "eml":
			case "h":
			case "h++":
			case "hh":
			case "hpp":
			case "hxx":
			case "ini":
			case "java":
			case "js":
			case "json":
			case "log":
			case "lua":
			case "md":
			case "php":
			case "py":
			case "rb":
			case "rs":
			case "sh":
			case "txt":
			case "vbs":
			case "xml":
			case "yaml":
			case "yml":
				return "text";

			// For non-text formats, only formats supported by browsers are sensible
			case "apng":
			case "avif":
			case "bmp":
			case "gif":
			case "ico":
			case "jpeg":
			case "jpg":
			case "png":
			case "webp":
				return "image";

			case "aac":
			case "flac":
			case "m4a":
			case "m4b":
			case "mp3":
			case "oga":
			case "ogg":
			case "opus":
			case "wav":
				return "audio";

			case "avi":
			case "m4v":
			case "mkv":
			case "mov":
			case "mp4":
			case "ogv":
			case "ogx":
			case "webm":
				return "video";

			case "pdf":
				return "pdf";

			case "html":
			case "htm":
				return "html";

			case "svg":
				return "svg";
		}

		return null;
	};

	const _getCiphersuite = function(cs) {
		if (typeof(cs) !== "number") return "(Error reading ciphersuite value)";

		switch(cs) {
			case 0: return "";
			case 1: return "(Error saving ciphersuite value)";

			// Best
			case 0x1302: return "AES_256_GCM_SHA384";
			case 0x1303: return "CHACHA20_POLY1305_SHA256";
			case 0x1301: return "AES_128_GCM_SHA256";
			case 0x1304: return "AES_128_CCM_SHA256";
			case 0x1305: return "AES_128_CCM_8_SHA256";
			case 0xC030: return "ECDHE_RSA_AES_256_GCM_SHA384";
			case 0x9F:   return "DHE_RSA_AES_256_GCM_SHA384";
			case 0xC02C: return "ECDHE_ECDSA_AES_256_GCM_SHA384";
			case 0xC02E: return "ECDH_ECDSA_AES_256_GCM_SHA384";
			case 0xC032: return "ECDH_RSA_AES_256_GCM_SHA384";
			case 0xCCA8: return "ECDHE_RSA_CHACHA20_POLY1305_SHA256";
			case 0xCCAA: return "DHE_RSA_CHACHA20_POLY1305_SHA256";
			case 0xCCA9: return "ECDHE_ECDSA_CHACHA20_POLY1305_SHA256";

			// Good
			case 0xC0AF: return "ECDHE_ECDSA_AES_256_CCM_8";
			case 0xC028: return "ECDHE_RSA_AES_256_CBC_SHA384";
			case 0x6B:   return "DHE_RSA_AES_256_CBC_SHA256";
			case 0xC024: return "ECDHE_ECDSA_AES_256_CBC_SHA384";
			case 0xC02A: return "ECDH_RSA_AES_256_CBC_SHA384";
			case 0xC026: return "ECDH_ECDSA_AES_256_CBC_SHA384";
			case 0xC02F: return "ECDHE_RSA_AES_128_GCM_SHA256";
			case 0x9E:   return "DHE_RSA_AES_128_GCM_SHA256";
			case 0xC02B: return "ECDHE_ECDSA_AES_128_GCM_SHA256";
			case 0xC031: return "ECDH_RSA_AES_128_GCM_SHA256";
			case 0xC02D: return "ECDH_ECDSA_AES_128_GCM_SHA256";
			case 0xC0AC: return "ECDHE_ECDSA_AES_128_CCM";
			case 0xC0AE: return "ECDHE_ECDSA_AES_128_CCM_8";
			case 0xC027: return "ECDHE_RSA_AES_128_CBC_SHA256";
			case 0x67:   return "DHE_RSA_AES_128_CBC_SHA256";
			case 0xC023: return "ECDHE_ECDSA_AES_128_CBC_SHA256";
			case 0xC029: return "ECDH_RSA_AES_128_CBC_SHA256";
			case 0xC025: return "ECDH_ECDSA_AES_128_CBC_SHA256";

			// Weak
			case 0xC014: return "ECDHE_RSA_AES_256_CBC_SHA";
			case 0x39:   return "DHE_RSA_AES_256_CBC_SHA";
			case 0xC00A: return "ECDHE_ECDSA_AES_256_CBC_SHA";
			case 0xC00F: return "ECDH_RSA_AES_256_CBC_SHA";
			case 0xC005: return "ECDH_ECDSA_AES_256_CBC_SHA";
			case 0xC013: return "ECDHE_RSA_AES_128_CBC_SHA";
			case 0xC009: return "ECDHE_ECDSA_AES_128_CBC_SHA";
			case 0x33:   return "DHE_RSA_AES_128_CBC_SHA";
			case 0xC00E: return "ECDH_RSA_AES_128_CBC_SHA";
			case 0xC004: return "ECDH_ECDSA_AES_128_CBC_SHA";

			default: return "(Unknown ciphersuite value: " + cs + ")";
		}
	};

	const _getCountryName = function(countryCode) {
		switch (countryCode) {
			case "??": return "Unknown";
			case "DZ": return "Algeria";
			case "AO": return "Angola";
			case "BJ": return "Benin";
			case "BW": return "Botswana";
			case "BF": return "Burkina Faso";
			case "BI": return "Burundi";
			case "CV": return "Cabo Verde";
			case "CM": return "Cameroon";
			case "CF": return "Central African Republic";
			case "TD": return "Chad";
			case "KM": return "Comoros";
			case "CD": return "Congo";
			case "DJ": return "Djibouti";
			case "EG": return "Egypt";
			case "GQ": return "Equatorial Guinea";
			case "ER": return "Eritrea";
			case "SZ": return "Eswatini";
			case "ET": return "Ethiopia";
			case "GA": return "Gabon";
			case "GM": return "Gambia";
			case "GH": return "Ghana";
			case "GW": return "Guinea-Bissau";
			case "GN": return "Guinea";
			case "CI": return "Ivory Coast";
			case "KE": return "Kenya";
			case "LS": return "Lesotho";
			case "LR": return "Liberia";
			case "LY": return "Libya";
			case "MG": return "Madagascar";
			case "MW": return "Malawi";
			case "ML": return "Mali";
			case "MR": return "Mauritania";
			case "MU": return "Mauritius";
			case "YT": return "Mayotte";
			case "MA": return "Morocco";
			case "MZ": return "Mozambique";
			case "NA": return "Namibia";
			case "NE": return "Niger";
			case "NG": return "Nigeria";
			case "CG": return "Republic of the Congo";
			case "RW": return "Rwanda";
			case "RE": return "Réunion";
			case "SH": return "Saint Helena";
			case "SN": return "Senegal";
			case "SC": return "Seychelles";
			case "SL": return "Sierra Leone";
			case "SO": return "Somalia";
			case "ZA": return "South Africa";
			case "SS": return "South Sudan";
			case "SD": return "Sudan";
			case "ST": return "São Tomé and Príncipe";
			case "TZ": return "Tanzania";
			case "TG": return "Togo";
			case "TN": return "Tunisia";
			case "UG": return "Uganda";
			case "EH": return "Western Sahara";
			case "ZM": return "Zambia";
			case "ZW": return "Zimbabwe";
			case "AQ": return "Antarctica";
			case "BV": return "Bouvet Island";
			case "TF": return "French Southern Territories";
			case "HM": return "Heard Island and McDonald Islands";
			case "GS": return "South Georgia and the South Sandwich Islands";
			case "AF": return "Afghanistan";
			case "AM": return "Armenia";
			case "AZ": return "Azerbaijan";
			case "BH": return "Bahrain";
			case "BD": return "Bangladesh";
			case "BT": return "Bhutan";
			case "IO": return "British Indian Ocean Territory";
			case "BN": return "Brunei";
			case "KH": return "Cambodia";
			case "CN": return "China";
			case "CC": return "Cocos [Keeling] Islands";
			case "GE": return "Georgia";
			case "JO": return "Jordan";
			case "HK": return "Hong Kong";
			case "IN": return "India";
			case "ID": return "Indonesia";
			case "IR": return "Iran";
			case "IQ": return "Iraq";
			case "IL": return "Israel";
			case "JP": return "Japan";
			case "KZ": return "Kazakhstan";
			case "KW": return "Kuwait";
			case "KG": return "Kyrgyzstan";
			case "LA": return "Laos";
			case "LB": return "Lebanon";
			case "MO": return "Macao";
			case "MY": return "Malaysia";
			case "MV": return "Maldives";
			case "MN": return "Mongolia";
			case "MM": return "Myanmar";
			case "NP": return "Nepal";
			case "KP": return "North Korea";
			case "OM": return "Oman";
			case "PK": return "Pakistan";
			case "PS": return "Palestine";
			case "PH": return "Philippines";
			case "QA": return "Qatar";
			case "SA": return "Saudi Arabia";
			case "SG": return "Singapore";
			case "KR": return "South Korea";
			case "LK": return "Sri Lanka";
			case "SY": return "Syria";
			case "TW": return "Taiwan";
			case "TJ": return "Tajikistan";
			case "TH": return "Thailand";
			case "TR": return "Turkey";
			case "TM": return "Turkmenistan";
			case "AE": return "United Arab Emirates";
			case "UZ": return "Uzbekistan";
			case "VN": return "Vietnam";
			case "YE": return "Yemen";
			case "AL": return "Albania";
			case "AD": return "Andorra";
			case "AT": return "Austria";
			case "BY": return "Belarus";
			case "BE": return "Belgium";
			case "BA": return "Bosnia and Herzegovina";
			case "BG": return "Bulgaria";
			case "HR": return "Croatia";
			case "CY": return "Cyprus";
			case "CZ": return "Czechia";
			case "DK": return "Denmark";
			case "EE": return "Estonia";
			case "FO": return "Faroe Islands";
			case "FI": return "Finland";
			case "FR": return "France";
			case "DE": return "Germany";
			case "GI": return "Gibraltar";
			case "GR": return "Greece";
			case "GG": return "Guernsey";
			case "HU": return "Hungary";
			case "IS": return "Iceland";
			case "IE": return "Ireland";
			case "IM": return "Isle of Man";
			case "IT": return "Italy";
			case "JE": return "Jersey";
			case "XK": return "Kosovo";
			case "LV": return "Latvia";
			case "LI": return "Liechtenstein";
			case "LU": return "Luxembourg";
			case "MT": return "Malta";
			case "MC": return "Monaco";
			case "ME": return "Montenegro";
			case "NL": return "Netherlands";
			case "MK": return "North Macedonia";
			case "NO": return "Norway";
			case "PL": return "Poland";
			case "PT": return "Portugal";
			case "LT": return "Lithuania";
			case "MD": return "Moldova";
			case "RO": return "Romania";
			case "RU": return "Russia";
			case "SM": return "San Marino";
			case "RS": return "Serbia";
			case "SK": return "Slovakia";
			case "SI": return "Slovenia";
			case "ES": return "Spain";
			case "SJ": return "Svalbard and Jan Mayen";
			case "SE": return "Sweden";
			case "CH": return "Switzerland";
			case "UA": return "Ukraine";
			case "GB": return "United Kingdom";
			case "VA": return "Vatican City";
			case "AX": return "Åland";
			case "AI": return "Anguilla";
			case "AG": return "Antigua and Barbuda";
			case "AW": return "Aruba";
			case "BS": return "Bahamas";
			case "BB": return "Barbados";
			case "BZ": return "Belize";
			case "BM": return "Bermuda";
			case "BQ": return "Bonaire, Sint Eustatius, and Saba";
			case "VG": return "British Virgin Islands";
			case "CA": return "Canada";
			case "KY": return "Cayman Islands";
			case "CR": return "Costa Rica";
			case "CU": return "Cuba";
			case "CW": return "Curaçao";
			case "DM": return "Dominica";
			case "DO": return "Dominican Republic";
			case "SV": return "El Salvador";
			case "GL": return "Greenland";
			case "GD": return "Grenada";
			case "GP": return "Guadeloupe";
			case "GT": return "Guatemala";
			case "HT": return "Haiti";
			case "HN": return "Honduras";
			case "JM": return "Jamaica";
			case "MQ": return "Martinique";
			case "MX": return "Mexico";
			case "MS": return "Montserrat";
			case "NI": return "Nicaragua";
			case "PA": return "Panama";
			case "PR": return "Puerto Rico";
			case "BL": return "Saint Barthélemy";
			case "LC": return "Saint Lucia";
			case "MF": return "Saint Martin";
			case "PM": return "Saint Pierre and Miquelon";
			case "VC": return "Saint Vincent and the Grenadines";
			case "SX": return "Sint Maarten";
			case "KN": return "St Kitts and Nevis";
			case "TT": return "Trinidad and Tobago";
			case "TC": return "Turks and Caicos Islands";
			case "VI": return "U.S. Virgin Islands";
			case "US": return "United States";
			case "AS": return "American Samoa";
			case "AU": return "Australia";
			case "CX": return "Christmas Island";
			case "CK": return "Cook Islands";
			case "TL": return "East Timor";
			case "FM": return "Federated States of Micronesia";
			case "FJ": return "Fiji";
			case "PF": return "French Polynesia";
			case "GU": return "Guam";
			case "KI": return "Kiribati";
			case "MH": return "Marshall Islands";
			case "NR": return "Nauru";
			case "NC": return "New Caledonia";
			case "NZ": return "New Zealand";
			case "NU": return "Niue";
			case "NF": return "Norfolk Island";
			case "MP": return "Northern Mariana Islands";
			case "PW": return "Palau";
			case "PG": return "Papua New Guinea";
			case "PN": return "Pitcairn Islands";
			case "WS": return "Samoa";
			case "SB": return "Solomon Islands";
			case "TK": return "Tokelau";
			case "TO": return "Tonga";
			case "TV": return "Tuvalu";
			case "UM": return "U.S. Minor Outlying Islands";
			case "VU": return "Vanuatu";
			case "WF": return "Wallis and Futuna";
			case "AR": return "Argentina";
			case "BO": return "Bolivia";
			case "BR": return "Brazil";
			case "CL": return "Chile";
			case "CO": return "Colombia";
			case "EC": return "Ecuador";
			case "FK": return "Falkland Islands";
			case "GF": return "French Guiana";
			case "GY": return "Guyana";
			case "PY": return "Paraguay";
			case "PE": return "Peru";
			case "SR": return "Suriname";
			case "UY": return "Uruguay";
			case "VE": return "Venezuela";
		}

		return "Error";
	};

	const _parsePrivate = async function(pdEnc) {
		// Derive the two key-nonce sets
		const pfk_nonce = new Uint8Array(8);
		pfk_nonce.set(pdEnc.slice(0, 4));

		const kn_client = _aem_kdf_sub(44, pfk_nonce, _own_pfk);
		pfk_nonce[7] = 1;
		const kn_server = _aem_kdf_sub(44, pfk_nonce, _own_pfk);

		// Decrypt the server's ChaCha20 encryption
		let pdAes = sodium.crypto_stream_chacha20_ietf_xor(
			pdEnc.slice(4),
			kn_server.slice(0, 12),
			kn_server.slice(12, 44)
		);

		// Decrypt and authenticate our AES256-GCM encryption
		let pd;
		try {
			pd = new Uint8Array(await window.crypto.subtle.decrypt(
				{name: "AES-GCM", iv: kn_client.slice(0, 12)},
				await window.crypto.subtle.importKey("raw", kn_client.slice(12), {"name": "AES-GCM"}, false, ["decrypt"]),
				pdAes
			));
		} catch(e) {
			// Private field unset/corrupted, set a random starting nonce
			_own_privateNonce = Math.floor(Math.random() * (Math.pow(2, 32) - 1));
			return;
		}

		// Set new nonce
		_own_privateNonce = new Uint32Array(pdEnc.slice(0, 4).buffer)[0] + 1;
		if (_own_privateNonce >= Math.pow(2, 32)) _own_privateNonce = 0;

		// Address data
		let privOffset = 1;
		for (let i = 0; i < pd[0]; i++) {
			const hash = pd.slice(privOffset, privOffset + 8);
			const addr32 = pd.slice(privOffset + 8, privOffset + 18);
			const lenNick = pd[privOffset + 18];

			for (let j = 0; j < _own_addr.length; j++) {
				let wasFound = true;

				for (let k = 0; k < 8; k ++) {
					if (hash[k] !== _own_addr[j].hash[k]) {
						wasFound = false;
						break;
					}
				}

				if (wasFound) {
					_own_addr[j].addr32 = addr32;
					_own_addr[j].nick = sodium.to_string(pd.slice(privOffset + 19, privOffset + 19 + lenNick));
					break;
				}
			}

			privOffset += 19 + lenNick;
		}

		// Contacts
		const contactCount = pd[privOffset];
		privOffset++;

		for (let i = 0; i < contactCount; i++) {
			let con = pd.slice(privOffset);
			let end = con.indexOf(10); // 10=LF
			if (end === -1) break;
			try {_contactMail[i] = sodium.to_string(con.slice(0, end));} catch(e) {}
			privOffset += end + 1;

			con = pd.slice(privOffset);
			end = con.indexOf(10);
			if (end === -1) break;
			try {_contactName[i] = sodium.to_string(con.slice(0, end));} catch(e) {}
			privOffset += end + 1;

			con = pd.slice(privOffset);
			end = con.indexOf(10);
			if (end === -1) break;
			try {_contactNote[i] = sodium.to_string(con.slice(0, end));} catch(e) {}
			privOffset += end + 1;
		}

		// Extra
		const extra = pd.slice(privOffset);
		const zeroIndex = extra.indexOf(0);
		try {_privateExtra = sodium.to_string((zeroIndex === -1) ? extra : extra.slice(0, zeroIndex));} catch(e) {_privateExtra = "(error)";}
	}

	const _parseUinfo = async function(browseData) {
		_own_level = browseData[0] & 3;

		// TODO empty arrays
		for (let i = 0; i < 4; i++) {
			if (i === _own_level) {
				_maxStorage.push(browseData[1]);
				_maxNormalA.push(browseData[2]);
				_maxShieldA.push(browseData[3]);
			} else {
				// Unknown
				_maxStorage.push(0);
				_maxNormalA.push(0);
				_maxShieldA.push(0);
			}
		}

		// Addresses
		let offset = 4;
		for (let i = 0; i < (browseData[0] >> 2); i++) {
			const hash = browseData.slice(offset, offset + 8);
			_own_addr.push(new _Address(hash, new Uint8Array(10), browseData[offset + 8], ""));
			offset += 9;
		}

		// Private field
		await _parsePrivate(browseData.slice(offset, offset + _AEM_LEN_PRIVATE));
		offset += _AEM_LEN_PRIVATE;

		_addrNormal_salt = browseData.slice(offset, offset + sodium.crypto_pwhash_SALTBYTES);
		offset += sodium.crypto_pwhash_SALTBYTES;
		_addrNormal_olim = browseData[offset];
		offset++;
		_addrNormal_mlim = new Uint32Array(browseData.slice(offset, offset + 4).buffer)[0];
		offset += 4;

		_ourDomain = sodium.to_string(browseData.slice(offset, offset + _AEM_MAXLEN_OURDOMAIN)).replaceAll("\0", "");
		offset += _AEM_MAXLEN_OURDOMAIN;

		return offset;
	};

	const _addOutMsg = function(msgData, msgId, msgTs) {
		const lenSb = msgData[0] & 127;

		let newMsg;

		if ((msgData[0] & 128) === 0) { // Email
			const msgIp = msgData.slice(1, 5);
			const msgCs = new Uint16Array(msgData.slice(5, 7).buffer)[0];
			const msgTlsVer = msgData[7] >> 5;
			const msgAttach = msgData[7] & 31;

			const msgCc = ((msgData[8] & 31) <= 26 && (msgData[9] & 31) <= 26) ? String.fromCharCode("A".charCodeAt(0) + (msgData[8] & 31)) + String.fromCharCode("A".charCodeAt(0) + (msgData[9] & 31)) : "??";
			const lenFr = msgData[10] & 31;
			const lenTo = msgData[11] & 127;
			const lenMx = msgData[12] & 127;
			const lenT1 = msgData[13] & 127;
			const lenT2 = msgData[14] & 127;
			const lenGr = msgData[15] & 127;
			const lenSt = msgData[16] & 127;

			let os = 17;
			const msgFr = sodium.to_string(msgData.slice(os, os + lenFr)); os += lenFr;
			const msgTo = sodium.to_string(msgData.slice(os, os + lenTo)); os += lenTo;
			const msgMx = sodium.to_string(msgData.slice(os, os + lenMx)); os += lenMx;
			const msgGr = sodium.to_string(msgData.slice(os, os + lenGr)); os += lenGr;
			const msgSt = sodium.to_string(msgData.slice(os, os + lenSb)); os += lenSt;
			const msgSb = sodium.to_string(msgData.slice(os, os + lenSb)); os += lenSb;

			let msgBd;
			try {
				msgBd = sodium.to_string(msgData.slice(os));
			} catch(e) {
				msgBd = "(error)";
			}

			newMsg = new _OutMsg_Ext(msgId, msgTs, msgIp, msgCc, msgFr, msgTo, msgSb, msgBd, msgMx, msgGr, msgSt, msgCs, msgTlsVer, msgAttach);
		} else { // Internal message
			const isE2ee = (msgData[1] & 64) !== 0;
			const msgFr = _addr32_decode(msgData.slice(2, 12));
			const msgTo = _addr32_decode(msgData.slice(12, 22));

			let msgBin;
			if (isE2ee) {
				// TODO
			} else {
				msgBin = msgData.slice(22);
			}

			let msgSb;
			let msgBd;

			try {
				const zero = msgBin.indexOf(0);
				msgBin = sodium.to_string(zero === -1 ? msgBin : msgBin.slice(0, zero));
				msgSb = msgBin.slice(0, lenSb);
				msgBd = msgBin.slice(lenSb);
			} catch(e) {
				msgSb = "(fail)";
				msgBd= "Message failed to decode.\n\n" + e + "\n\nBasic decode:\n\n";

				for (let i = 0; i < msgBin.length; i++) {
					if ((msgBin[i] !== 10 && msgBin[i] <= 31) || msgBin[i] >= 127)
						msgBd += "[" + msgBin[i] + "]";
					else
						msgBd += String.fromCharCode(msgBin[i]);
				}
			}

			newMsg = new _OutMsg_Int(msgId, msgTs, isE2ee, msgTo, msgFr, msgSb, msgBd);
		}

			_outMsg.push(newMsg);
	};

	const _downloadFile = function(title, body) {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(body);
		a.download = title;
		a.click();

		URL.revokeObjectURL(a.href);
		a.href = "";
		a.download = "";
	};

	// CET: Control-Enriched Text
	const _htmlCetLinks = function(body, needle, isSecure, linkIcon, fullUrl) {
		for(;;) {
			const begin = body.indexOf(needle);
			if (begin === -1) break;
			const end = body.slice(begin + 1).indexOf(needle);
			if (end === -1) break;

			const url = body.slice(begin + 1, begin + 1 + end);
			let linkDomain;
			if (!fullUrl) {
				const domainEnd = url.search("[/?]");
				linkDomain = ((domainEnd === -1) ? url : url.slice(0, domainEnd)).toLowerCase();
			}

			body = body.slice(0, begin) + "<a rel=\"noopener\" href=\"http" + (isSecure? "s://" : "://") + url + "\">" + linkIcon + "&NoBreak;" + (fullUrl? url : linkDomain) + "</a>" + body.slice(begin + end + 2);
		}

		return body;
	};

	const _textCetLinks = function(body, needle, isSecure) {
		while (body.indexOf(needle) >= 0) {
			body = body.replace(needle, isSecure? "https://" : "http://").replace(needle, " ");
		}

		return body;
	};

	const _cetTag = function(n) {
		switch (n) {
			case 0x0A: return "br";
			case 0x0B: return "hr";

			case 0x11: return "strong";
			case 0x12: return "small";
			case 0x13: return "sub";
			case 0x14: return "sup";
			case 0x15: return "code";
			case 0x16: return "b";
			case 0x17: return "i";
			case 0x18: return "u";
			case 0x19: return "s";
			case 0x1A: return "table";
			case 0x1B: return "tr";
			case 0x1C: return "td";
			case 0x1D: return "ol";
			case 0x1E: return "ul";
			case 0x1F: return "li";

			default : return "";
		}
	}

	const _htmlCetTags = function(body) {
		let tagOpen = Array(32).fill(false);

		let newBody = "";
		for (let i = 0; i < body.length; i++) {
			const cc = body.charCodeAt(i);
			const tagName = _cetTag(cc);
			if (tagName) {
				if (cc < 0x11) {
					newBody += "<" + tagName + ">";
				} else {
					newBody += (tagOpen[cc] ? "</" : "<") + tagName + ">"
					tagOpen[cc] = !tagOpen[cc];
				}
			} else {
				newBody += body[i];
			}
		}

		return newBody;
	}

	const getPlainExtBody = function(num) {
		let textBody = _extMsg[num].body;

		textBody = _textCetLinks(textBody, "\x01", false);
		textBody = _textCetLinks(textBody, "\x02", true);
		textBody = _textCetLinks(textBody, "\x03", false);
		textBody = _textCetLinks(textBody, "\x04", true);

		return textBody.replaceAll(/[\x05-\x09\x0c-\x15\x18-\x1c]/g, "").replaceAll(/[\x1d\x1e\x1f]/g, "\n").replaceAll("\x0B", "---\n---").replaceAll("\x16", "*").replaceAll("\x17", "_");
	};

	const _addMessage = async function(msgData, evpId) {
		const msgInfo = msgData[0];
		const padAmount = msgInfo & 15;

		const msgTs = new Uint32Array(msgData.slice(1, 5).buffer)[0];
		if (msgTs >= _newestMsgTs) {
			_newestEvpId = evpId;
			_newestMsgTs = msgTs;
		}

		if (msgTs < _oldestMsgTs) {
			_oldestEvpId = evpId;
			_oldestMsgTs = msgTs;
		}

		msgData = msgData.slice(5, msgData.length - padAmount);

		switch (msgInfo & 48) {
			case 0: { // ExtMsg
				const msgIp = msgData.slice(0, 4);
				const msgCs  = new Uint16Array(msgData.slice(4, 6).buffer)[0];
				const msgTls = msgData[6];

				const dkimCount = msgData[7] >> 5;
				const msgAttach = msgData[7] & 31;

				const msgIpBlk = (msgData[8] & 128) !== 0;
				const msgGrDom = (msgData[8] &  64) !== 0;
				const msgEsmtp = (msgData[8] &  32) !== 0;
				const msgInval = (msgData[9] & 128) !== 0;
				const msgProtV = (msgData[9] &  64) !== 0;
				const msgRares = (msgData[9] &  32) !== 0;
				const lenEnvTo = msgData[10] &  63;
				const msgDmarc = msgData[11] & 192;
				const lenHdrTo = msgData[11] &  63;
				const msgDnSec = msgData[12] & 192;
				const lenGreet = msgData[12] &  63;
				const msgDane  = msgData[13] & 192;
				const lenRvDns = msgData[13] &  63;
				// [14] & 192 unused
				const lenAuSys = msgData[14] &  63;
				const lenEnvFr = msgData[15] & 255;
				const lenHdrFr = msgData[16] & 255;
				const lenRplTo = msgData[17] & 255;
				const lenMsgId = msgData[18] & 255;
				const lenSbjct = msgData[19] & 255;
				const dkimFail = (msgData[20] & 128) !== 0;
				const msgHdrTz = (msgData[20] & 127) * 15 - 900; // Timezone offset in minutes; -900m..900m (-15h..+15h)

				const msgHdrTs = new Uint16Array(msgData.slice(21, 23).buffer)[0] - 736;
				const msgCc = ((msgData[8] & 31) <= 26 && (msgData[9] & 31) <= 26) ? String.fromCharCode("A".charCodeAt(0) + (msgData[8] & 31)) + String.fromCharCode("A".charCodeAt(0) + (msgData[9] & 31)) : "??";

				const msgDkim = (dkimCount > 0) ? (msgData.slice(23, 23 + (dkimCount * 12))) : null;
				const extOffset = (dkimCount > 0) ? (23 + (dkimCount * 12)) : 23;

				try {
					const msgBodyBr = new Int8Array(msgData.slice(extOffset));
					const msgBodyU8 = new Uint8Array(window.BrotliDecode(msgBodyBr));

					const d = new TextDecoder("utf-8");
					let o = 0;

					for (let i = 0; i < dkimCount; i++) {
						o += (msgDkim[i * 12 + 9] & 127) + (msgDkim[i * 12 + 10] & 127) + (msgDkim[i * 12 + 11] & 127);
					}

					const dkimTxt = (o > 0) ? d.decode(msgBodyU8.slice(0, o)) : null;

					const msgEnvTo = d.decode(msgBodyU8.slice(o, o + lenEnvTo)) + "@" + _ourDomain; o += lenEnvTo;
					const    hdrTo = d.decode(msgBodyU8.slice(o, o + lenHdrTo)); o+= lenHdrTo;
					const msgGreet = d.decode(msgBodyU8.slice(o, o + lenGreet)); o+= lenGreet;
					const msgRvDns = d.decode(msgBodyU8.slice(o, o + lenRvDns)); o+= lenRvDns;
					const msgAuSys = d.decode(msgBodyU8.slice(o, o + lenAuSys)); o+= lenAuSys;
					const msgEnvFr = d.decode(msgBodyU8.slice(o, o + lenEnvFr)); o+= lenEnvFr;
					const    hdrFr = d.decode(msgBodyU8.slice(o, o + lenHdrFr)); o+= lenHdrFr;
					const    rplTo = d.decode(msgBodyU8.slice(o, o + lenRplTo)); o+= lenRplTo;
					const msgMsgId = d.decode(msgBodyU8.slice(o, o + lenMsgId)); o+= lenMsgId;
					const msgSbjct = d.decode(msgBodyU8.slice(o, o + lenSbjct)); o+= lenSbjct;

					const msgHdrTo = hdrTo.includes("\x7F") ? hdrTo.slice(hdrTo.indexOf("\x7F") + 1) : hdrTo;
					const msgHdrFr = hdrFr.includes("\x7F") ? hdrFr.slice(hdrFr.indexOf("\x7F") + 1) : hdrFr;
					const msgRplTo = rplTo.includes("\x7F") ? rplTo.slice(rplTo.indexOf("\x7F") + 1) : rplTo;

					const msgDnTo = hdrTo.includes("\x7F") ? hdrTo.slice(0, hdrTo.indexOf("\x7F")) : null;
					const msgDnFr = hdrFr.includes("\x7F") ? hdrFr.slice(0, hdrFr.indexOf("\x7F")) : null;
					const msgDnRt = rplTo.includes("\x7F") ? rplTo.slice(0, rplTo.indexOf("\x7F")) : null;

					const body = d.decode(msgBodyU8.slice(o));
					const headersEnd = body.indexOf("\x7F");
					const msgHeaders = (headersEnd > 0) ? body.slice(0, headersEnd) : "";
					const msgBody = body.slice(headersEnd + 1);

					_extMsg.push(new _ExtMsg(evpId, msgTs, msgHdrTs, msgHdrTz, msgIp, msgCc, msgCs, msgTls, msgEsmtp, msgProtV, msgInval, msgRares, msgAttach, msgGrDom, msgIpBlk, msgDkim, dkimTxt, msgGreet, msgRvDns, msgAuSys, msgEnvFr, msgHdrFr, msgDnFr, msgEnvTo, msgHdrTo, msgDnTo, msgRplTo, msgDnRt, msgMsgId, msgHeaders, msgSbjct, msgBody));
				} catch(e) {
					_extMsg.push(new _ExtMsg(evpId, msgTs, msgHdrTs, msgHdrTz, msgIp, msgCc, msgCs, msgTls, msgEsmtp, msgProtV, msgInval, msgRares, msgAttach, msgGrDom, msgIpBlk, null, null, "", "", "", "", "", "", "", "", "", "", "", "", "", "Failed decompression", "Size: " + msgData.length));
				}
			break;}

			case 16: { // IntMsg
				const msgType = msgData[0] & 192;
				// 32/16/8/4 unused

				if (msgType >= 128) { // 192: System, 128: Public
					// 2/1 unused

					let bodyAndTitle;
					try {
						bodyAndTitle = sodium.to_string(msgData.slice(1));
					} catch(e) {bodyAndTitle = "(error)\nError decoding message: " + e;}

					const separator = bodyAndTitle.indexOf("\n");
					_intMsg.push(new _IntMsg(evpId, msgTs, false, 3, null, (msgType === 192) ? "system" : "public", "", bodyAndTitle.slice(0, separator), bodyAndTitle.slice(separator + 1)));
					break;
				}

				const msgFromLv = msgData[0] & 3;
				const msgFrom = _addr32_decode(msgData.slice( 1, 11));
				const msgTo   = _addr32_decode(msgData.slice(11, 21));
//				const msgApk  = msgData.slice(21, 21 + 32);

				const msgBin = msgData.slice(21 + 32);
				let msgTxt;
				try {
					msgTxt = sodium.to_string(msgBin);
				} catch(e) {msgTxt = "(error)\nError decoding message: " + e}

				const sep = msgTxt.indexOf('\n');
				const msgSubj = msgTxt.slice(0, sep);
				const msgBody = msgTxt.slice(sep + 1);

				_intMsg.push(new _IntMsg(evpId, msgTs, false, msgFromLv, null, msgFrom, msgTo, msgSubj, msgBody));
			break;}

			case 32: { // UplMsg (Email attachment, or uploaded file)
				let msgFn;
				let msgBody;
				let msgParent = null;

				if ((msgData[0] & 128) !== 0) {
					// Email attachment, no additional encryption

					msgParent = sodium.to_hex(msgData.slice(1, 3));
					msgFn = sodium.to_string(msgData.slice(3, 4 + (msgData[0] & 127)));
					msgBody = msgData.slice(4 + (msgData[0] & 127));
				} else {
					// Uploaded file
					const nonce = new Uint8Array(16);
					nonce.set(msgData.slice(1, 13));
					const dec = new Uint8Array(await window.crypto.subtle.decrypt(
						{name: "AES-CTR", counter: nonce, length: 32},
						await window.crypto.subtle.importKey("raw", _own_ehk, {"name": "AES-CTR"}, false, ["decrypt"]),
						msgData
					));

					const lenFn = (dec[0] & 127) + 1;
					try {
						msgFn = sodium.to_string(dec.slice(13, 13 + lenFn));
					} catch(e) {msgFn = "error";}
					msgBody = dec.slice(13 + lenFn);
				}

				if (msgFn.endsWith(".br")) {
					try {
						msgBody = new Uint8Array(window.BrotliDecode(new Int8Array(msgBody)));
						msgFn = msgFn.slice(0, msgFn.length - 3);
					} catch(e) {
						msgBody = "Failed decompression";
					}
				}

				_uplMsg.push(new _UplMsg(evpId, msgTs, msgFn, msgBody, msgParent, msgBody.length / 16));
			break;}

			case 48: // OutMsg (Delivery report for sent message)
				_addOutMsg(msgData, evpId, msgTs);
			break;
		}

		return msgTs;
	};

// Public
	this.reset = function() {
		_maxStorage.splice(0);
		_maxNormalA.splice(0);
		_maxShieldA.splice(0);
		_own_level = 0;
		_own_addr.splice(0);

		_extMsg.splice(0);
		_intMsg.splice(0);
		_uplMsg.splice(0);
		_outMsg.splice(0);

		_contactMail.splice(0);
		_contactName.splice(0);
		_contactNote.splice(0);

		_admin_userUid.splice(0);
		_admin_userKib.splice(0);
		_admin_userNrm.splice(0);
		_admin_userShd.splice(0);
		_admin_userLvl.splice(0);

		_totalMsgCount = 0;
		_totalMsgBytes = 0;
		_readyMsgBytes = 0;
	};

	this.getDomainApi = function() {return _AEM_DOMAIN_API;};
	this.getDomainEml = function() {return _ourDomain;};
	this.getLevelMax = function() {return _AEM_USER_MAXLEVEL;};
	this.getAddrPerUser = function() {return _AEM_ADDRESSES_PER_USER;};

	this.getAddress = function(num) {if(typeof(num)!=="number"){return;} return _addr32_decode(_own_addr[num].addr32);};
	this.getAddressNick = function(num) {if(typeof(num)!=="number"){return;} return _own_addr[num].nick? _own_addr[num].nick : _addr32_decode(_own_addr[num].addr32);};
	this.getAddressOrigin = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].flags & _AEM_ADDR_FLAG_ORIGIN) !== 0;};
	this.getAddressSecure = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].flags & _AEM_ADDR_FLAG_SECURE) !== 0;};
	this.getAddressAttach = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].flags & _AEM_ADDR_FLAG_ATTACH) !== 0;};
	this.getAddressAllVer = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].flags & _AEM_ADDR_FLAG_ALLVER) !== 0;};
	this.getAddressAccExt = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].flags & _AEM_ADDR_FLAG_ACCEXT) !== 0;};
	this.getAddressAccInt = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].flags & _AEM_ADDR_FLAG_ACCINT) !== 0;};
	this.isAddressShield  = function(num) {if(typeof(num)!=="number"){return;} return (_own_addr[num].addr32[0] & 128) != 0;}

	this.setAddressOrigin = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_own_addr[num].flags |= _AEM_ADDR_FLAG_ORIGIN;} else {_own_addr[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ORIGIN);}};
	this.setAddressSecure = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_own_addr[num].flags |= _AEM_ADDR_FLAG_SECURE;} else {_own_addr[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_SECURE);}};
	this.setAddressAttach = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_own_addr[num].flags |= _AEM_ADDR_FLAG_ATTACH;} else {_own_addr[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ATTACH);}};
	this.setAddressAllVer = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_own_addr[num].flags |= _AEM_ADDR_FLAG_ALLVER;} else {_own_addr[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ALLVER);}};
	this.setAddressAccExt = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_own_addr[num].flags |= _AEM_ADDR_FLAG_ACCEXT;} else {_own_addr[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ACCEXT);}};
	this.setAddressAccInt = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_own_addr[num].flags |= _AEM_ADDR_FLAG_ACCINT;} else {_own_addr[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ACCINT);}};
	this.setAddressNick = function(num, val) {if(typeof(num)!=="number" || typeof(val)!=="string"){return;} _own_addr[num].nick = val};

	this.getAddressCount = function() {return _own_addr.length;};
	this.getAddressCountNormal = function() {return _getAddressCount(false);};
	this.getAddressCountShield = function() {return _getAddressCount(true);};

	this.uidToName = function(uid) {return String.fromCharCode(97 + (uid & 15)) + String.fromCharCode(97 + ((uid >> 4) & 15)) + String.fromCharCode(97 + ((uid >> 8) & 15));};
	this.isUserAdmin = function() {return (_own_level === _AEM_USER_MAXLEVEL);};
	this.getOwnUid = function() {return _own_uid;};
	this.getOwnLevel = function() {return _own_level;};
	this.getLimitStorage = function(lvl) {if(typeof(lvl)!=="number"){return;} return _maxStorage[lvl];};
	this.getLimitNormalA = function(lvl) {if(typeof(lvl)!=="number"){return;} return _maxNormalA[lvl];};
	this.getLimitShieldA = function(lvl) {if(typeof(lvl)!=="number"){return;} return _maxShieldA[lvl];};

	this.getOwnApk = function(addr) {if (typeof(addr)!=="string"){return;}
		//TODO
	};

	this.getTotalMsgCount = function() {return _totalMsgCount;};
	this.getTotalMsgBytes = function() {return _totalMsgBytes;};
	this.getReadyMsgBytes = function() {return _readyMsgBytes;};

	this.getExtMsgCount = function() {return _extMsg.length;};
	this.getExtMsgId      = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].id;};
	this.getExtMsgTime    = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].ts;};
	this.getExtMsgHdrTime = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrTs;};
	this.getExtMsgHdrTz   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrTz;};
	this.getExtMsgTLS     = function(num) {if(typeof(num)!=="number"){return;} return (_extMsg[num].cs === 0) ? "" : "TLS v1." + (_extMsg[num].tls & 3) + " " + _getCiphersuite(_extMsg[num].cs);};
	this.getExtMsgIp      = function(num) {if(typeof(num)!=="number"){return;} return String(_extMsg[num].ip[0] + "." + _extMsg[num].ip[1] + "." + _extMsg[num].ip[2] + "." + _extMsg[num].ip[3]);};
	this.getExtMsgGreet   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].greet;};
	this.getExtMsgRdns    = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].rdns;};
	this.getExtMsgAuSys   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].auSys;};
	this.getExtMsgCcode   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].countryCode;};
	this.getExtMsgCname   = function(num) {if(typeof(num)!=="number"){return;} return _getCountryName(_extMsg[num].countryCode);};
	this.getExtMsgEnvFrom = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].envFrom;};
	this.getExtMsgHdrFrom = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrFrom;};
	this.getExtMsgDnFrom  = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].dnFrom;};
	this.getExtMsgHdrRt   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrRt;};
	this.getExtMsgDnRt    = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].dnRt;};
	this.getExtMsgDnTo    = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].dnTo;};
	this.getExtMsgEnvTo   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].envTo;};
	this.getExtMsgHdrTo   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrTo;};
	this.getExtMsgHdrId   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrId;};
	this.getExtMsgHeaders = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].headers;};
	this.getExtMsgTitle   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].subj;};
	this.getExtMsgBody    = function(num, fullUrl) {if(typeof(num)!=="number" || typeof(fullUrl)!=="boolean"){return;}
		if (!_extMsg[num].body) return "";

		let html = _extMsg[num].body.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").split("\x7F").reverse().join("<br><hr>");

		html = _htmlCetLinks(html, "\x01", false, "🔗", fullUrl);
		html = _htmlCetLinks(html, "\x02", true,  "🔒", fullUrl);
		html = _htmlCetLinks(html, "\x03", false, "👁", fullUrl);
		html = _htmlCetLinks(html, "\x04", true,  "🖼", fullUrl);
		return _htmlCetTags(html);
	};

	this.getExtMsgFlagPExt = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].esmtp;};
	this.getExtMsgFlagRare = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].rares;};
	this.getExtMsgFlagFail = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].inval;};
	this.getExtMsgFlagPErr = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].protV;};
	this.getExtMsgFlagGrDm = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].greetDomainIp;};
	this.getExtMsgFlagIpBl = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].ipBlacklisted;};

	this.getExtMsgTlsDomain = function(num) {if(typeof(num)!=="number"){return;}
		if (_extMsg[num].tls & _AEM_EMAIL_CERT_MATCH_HDRFR && _extMsg[num].hdrFrom) return _extMsg[num].hdrFrom.split("@")[1];
		if (_extMsg[num].tls & _AEM_EMAIL_CERT_MATCH_ENVFR && _extMsg[num].envFrom) return _extMsg[num].envFrom.split("@")[1];
		if (_extMsg[num].tls & _AEM_EMAIL_CERT_MATCH_GREET && _extMsg[num].greet)   return _extMsg[num].greet;
	};

	this.getExtMsgTls_CertType = function(num) {if(typeof(num)!=="number"){return;}
		switch (_extMsg[num].tls & _AEM_EMAIL_CERT_EDDSA) {
			case _AEM_EMAIL_CERT_EDDSA: return "EdDSA";
			case _AEM_EMAIL_CERT_EC521: return "EC-521";
			case _AEM_EMAIL_CERT_EC384: return "EC-384";
			case _AEM_EMAIL_CERT_EC256: return "EC-256";
			case _AEM_EMAIL_CERT_RSA4K: return "RSA-4k";
			case _AEM_EMAIL_CERT_RSA2K: return "RSA-2k";
			case _AEM_EMAIL_CERT_RSA1K: return "RSA-1k";
			default: return "";
		}
	};

	this.getExtMsgDkimCount = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].dkim? (_extMsg[num].dkim.length / 12) : 0};
	this.getExtMsgDkimDomain = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		let start = 0;
		for (let j = 0; j < i; j++) {
			start += (_extMsg[num].dkim[j * 12 + 9] & 127) + (_extMsg[num].dkim[j * 12 + 10] & 127) + (_extMsg[num].dkim[j * 12 + 11] & 127);
		}

		return _extMsg[num].dkimTxt.slice(start, start + _extMsg[num].dkim[i * 12 + 9] & 127);
	};
	this.getExtMsgDkimSelector = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		let start = 0;
		for (let j = 0; j < i; j++) {
			start += (_extMsg[num].dkim[j * 12 + 9] & 127) + (_extMsg[num].dkim[j * 12 + 10] & 127) + (_extMsg[num].dkim[j * 12 + 11] & 127);
		}

		start += _extMsg[num].dkim[i * 12 + 9] & 127;
		return _extMsg[num].dkimTxt.slice(start, start + _extMsg[num].dkim[i * 12 + 10] & 127);
	};
	this.getExtMsgDkimNotes = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		let start = 0;
		for (let j = 0; j < i; j++) {
			start += (_extMsg[num].dkim[j * 12 + 9] & 127) + (_extMsg[num].dkim[j * 12 + 10] & 127) + (_extMsg[num].dkim[j * 12 + 11] & 127);
		}

		start += (_extMsg[num].dkim[i * 12 + 9] & 127) + (_extMsg[num].dkim[i * 12 + 10] & 127);
		return _extMsg[num].dkimTxt.slice(start, start + _extMsg[num].dkim[i * 12 + 11] & 127);
	};
	this.getExtMsgDkimValidSig = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		return _extMsg[num].dkim[i * 12 + 6] & 1 === 1;
	};
	this.getExtMsgDkimHeadHash = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		switch (_extMsg[num].dkim[i * 12 + 6] & 6) {
			case 0: return "I"; // Invalid
			case 2: return "F"; // Fail
			case 4: return "R"; // Relaxed
			case 6: return "S"; // Simple
		}
	}
	this.getExtMsgDkimBodyHash = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		switch (_extMsg[num].dkim[i * 12 + 6] & 24) {
			case  0: return "I";
			case  8: return "F";
			case 16: return "R";
			case 24: return "S";
		}
	}
	this.getExtMsgDkimAlgo = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		switch (_extMsg[num].dkim[i * 12 + 7] & 15) {
			case 0: return "RSA-SHA1-BAD";
			case 1: return "RSA-SHA1-512";
			case 2: return "RSA-SHA1-1K";
			case 3: return "RSA-SHA1-2K";

			case 4: return "RSA-SHA256-BAD";
			case 5: return "RSA-SHA256-512";
			case 6: return "RSA-SHA256-1K";
			case 7: return "RSA-SHA256-2K";
			case 8: return "RSA-SHA256-4K";

			case  9: return "ED25519-SHA256-BAD";
			case 10: return "ED25519-SHA256";

			default: return "Invalid-Algo";
		}
	};
	this.getExtMsgDkimIdentity = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return;}
		switch (_extMsg[num].dkim[i * 12 + 7] & 192) {
			case   0: return "";
			case  64: return "envFr";
			case 128: return "hdrFr";
			case 192: return "hdrRt";
		}
	}
	this.getExtMsgDkimTs = function(num, i) {if(typeof(num)!=="number" || typeof(i)!=="number"){return 0;}
		return (_extMsg[num].dkim[i * 12] | (_extMsg[num].dkim[i * 12 + 1] << 8) | ((_extMsg[num].dkim[i * 12 + 2] & 63) << 16));
	}

	this.exportExtMsg = function(num) {if(typeof(num)!=="number"){return;}
		return "Return-Path: <" + _extMsg[num].envFrom + ">"
		+ "\r\nReceived: from " + _extMsg[num].greet +" (" + this.getExtMsgRdns(num) + " [" + this.getExtMsgIp(num) + "])"
			+ " by " + _ourDomain
			+ " with " + (_extMsg[num].esmtp ? "E" : "") + "SMTP" + (_extMsg[num].tls ? "S" : "")
			+ " id " + _extMsg[num].id
			+ " for <" + _extMsg[num].envTo + ">; "
			+ new Date(_extMsg[num].ts * 1000).toUTCString().slice(0, 26) + "+0000" // TODO: Preserve timezone info
		+ "\r\nContent-Transfer-Encoding: 8bit"
		+ "\r\nContent-Type: text/plain; charset=utf-8"
		+ "\r\nDate: " + new Date((_extMsg[num].ts + _extMsg[num].hdrTs) * 1000).toUTCString().slice(0, 26) + "+0000" // TODO: Preserve timezone info
		+ "\r\nFrom: " + (_extMsg[num].dnFrom ? ("\"" + _extMsg[num].dnFrom + "\" <" + _extMsg[num].hdrFrom + ">") : _extMsg[num].hdrFrom)
		+ "\r\nMIME-Version: 1.0"
		+ (_extMsg[num].hdrId? ("\r\nMessage-ID: <" + _extMsg[num].hdrId + ">") : "")
		+ (_extMsg[num].hdrRt? ("\r\nReply-To: " + (_extMsg[num].dnRt ? ("\"" + _extMsg[num].dnRt + "\" <" + _extMsg[num].hdrRt + ">") : _extMsg[num].hdrRt)) : "")
		+ "\r\nSubject: " + _extMsg[num].subj
		+ "\r\nTo: " + (_extMsg[num].dnTo ? ("\"" + _extMsg[num].dnTo + "\" <" + _extMsg[num].hdrTo + ">") : _extMsg[num].hdrTo)
		+ (_extMsg[num].headers? ("\r\n" + _extMsg[num].headers.replaceAll("\n", "\r\n")) : "")
		+ "\r\n\r\n" + getPlainExtBody(num).replaceAll("\x7F", "\n---\n").replaceAll("\n", "\r\n")
		+ "\r\n";
	};

	this.exportIntMsg = function(num) {if(typeof(num)!=="number"){return;}
		return "Content-Transfer-Encoding: 8bit"
		+ "\r\nContent-Type: text/plain; charset=utf-8"
		+ "\r\nDate: " + new Date(_intMsg[num].ts * 1000).toUTCString().slice(0, 26) + "+0000"
		+ "\r\nFrom: " + _intMsg[num].from + "@" + _ourDomain
		+ "\r\nMIME-Version: 1.0"
		+ "\r\nMessage-ID: <" + _intMsg[num].id + "@int." + _ourDomain + ">"
		+ "\r\nSubject: " + _intMsg[num].title
		+ (_intMsg[num].to? ("\r\nTo: " + _intMsg[num].to + "@" + _ourDomain) : "")
		+ "\r\n\r\n" + _intMsg[num].body.replaceAll("\n", "\r\n")
		+ "\r\n";
	};

	this.downloadExtMsg = function(num) {if(typeof(num)!=="number"){return;}
		_downloadFile(_extMsg[num].subj + ".eml", new Blob([this.exportExtMsg(num)]));
	};

	this.downloadIntMsg = function(num) {if(typeof(num)!=="number"){return;}
		_downloadFile(_intMsg[num].title + ".eml", new Blob([this.exportIntMsg(num)]));
	};

	this.downloadUplMsg = function(num) {if(typeof(num)!=="number"){return;}
		_downloadFile(_uplMsg[num].title, new Blob([_uplMsg[num].body.buffer]));
	};

	this.printExtMsg = function(num) {if(typeof(num)!=="number"){return;}
		const msgDate = new Date((_extMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");

		const elStyle = document.createElement("style");
		const elPre = document.createElement("pre");
		const elH1 = document.createElement("h1");
		const elP = document.createElement("p");
		const elBody = document.createElement("body");

		elStyle.textContent = "body {overflow-wrap: break-word;} a {text-decoration: none; word-break: break-all;}";
		elPre.textContent = "Date: " + msgDate + "\nFrom: " + _extMsg[num].hdrFrom + "\n  To: " + _extMsg[num].hdrTo;
		elH1.textContent = _extMsg[num].subj;
		elP.innerHTML = this.getExtMsgBody(num, true).replaceAll("\n", "<br>");
		elBody.replaceChildren(elPre, elH1, elP);

		const el = document.createElement("iframe");
		el.hidden = true;
		document.body.appendChild(el);
		el.contentWindow.document.head.replaceChildren(elStyle);
		el.contentWindow.document.body.replaceChildren(elBody);

		const oldTitle = document.title;
		document.title = _extMsg[num].subj;
		try {el.contentWindow.print();} catch(e){}

		document.title = oldTitle;
		document.body.removeChild(el);
	};

	this.printIntMsg = function(num) {if(typeof(num)!=="number"){return;}
		const msgDate = new Date((_intMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");

		const el = document.createElement("iframe");
		el.hidden = true;
		document.body.appendChild(el);
		el.contentWindow.document.body.innerHTML = "<pre>Date: " + msgDate + "\nFrom: " + _intMsg[num].from + "@" + _ourDomain
			+ (_intMsg[num].to? ("\n  To: " + _intMsg[num].to + "@" + _ourDomain) : "")
			+ "</pre><h1>" + _intMsg[num].title + "</h1>" + this.getIntMsgBody(num).replaceAll("\n", "<br>");

		el.contentWindow.print();
		document.body.removeChild(el);
	};

	this.htmlExtMsg = function(num) {if(typeof(num)!=="number"){return;}
		const msgDate = new Date((_extMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");
		const msg = "<html><body><pre>Date: " + msgDate + "\nFrom: " + _extMsg[num].hdrFrom + "\n  To: " + _extMsg[num].hdrTo + "</pre><h1>" + _extMsg[num].subj + "</h1><p>" + this.getExtMsgBody(num, true).replaceAll("\n", "<br>") + "</p></body></html>";
		_downloadFile(_extMsg[num].subj + ".html", new Blob([msg]));
	};

	this.htmlIntMsg = function(num) {if(typeof(num)!=="number"){return;}
		const msgDate = new Date((_intMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");
		const msg = "<!doctype html><html><body>\n<pre>"
			+ "\nDate: " + msgDate
			+ "\nFrom: " + _intMsg[num].from + "@" + _ourDomain
			+ (_intMsg[num].to? ("\n  To: " + _intMsg[num].to + "@" + _ourDomain) : "")
			+ "\n</pre>\n<h1>" + _intMsg[num].title + "</h1>\n<p>\n"
			+ this.getIntMsgBody(num).replaceAll("\n", "<br>") + "\n</p>\n</body></html>";

		_downloadFile(_intMsg[num].title + ".html", new Blob([msg]));
	};

	this.txtExtMsg = function(num, dl) {if(typeof(num)!=="number" || typeof(dl)!=="boolean"){return;}
		const msgDate = new Date((_extMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");
		const msg = "Date: " + msgDate + "\nFrom: " + _extMsg[num].hdrFrom + "\nTo: " + _extMsg[num].hdrTo + "\nSubject: " + _extMsg[num].subj + "\n\n" + getPlainExtBody(num);
		if (dl) {_downloadFile(_extMsg[num].subj + ".txt", new Blob([msg]));} else return msg;
	};

	this.txtIntMsg = function(num, dl) {if(typeof(num)!=="number" || typeof(dl)!=="boolean"){return;}
		const msgDate = new Date((_intMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");
		const msg = "Date: " + msgDate
			+ "\nFrom: " + _intMsg[num].from
			+ (_intMsg[num].to? ("@" + _ourDomain + "\nTo: " + _intMsg[num].to + "@" + _ourDomain) : "")
			+ "\nSubject: " + _intMsg[num].title
			+ "\n\n" + this.getIntMsgBody(num, true);

		if (dl) {_downloadFile(_intMsg[num].title + ".txt", new Blob([msg]));} else return msg;
	};

	this.getExtMsgReplyAddress = function(num) {if(typeof(num)!=="number"){return;}
		if (_extMsg[num].hdrRt)   return _extMsg[num].hdrRt;
		if (_extMsg[num].hdrFrom) return _extMsg[num].hdrFrom;
		if (_extMsg[num].envFrom) return _extMsg[num].envFrom;
		return null;
	};

	this.getIntMsgCount = function() {return _intMsg.length;};
	this.getIntMsgId     = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].id;};
	this.getIntMsgTime   = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].ts;};
	this.getIntMsgLevel  = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].fromLv;};
	this.getIntMsgApk    = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].apk? sodium.to_base64(_intMsg[num].apk, sodium.base64_variants.ORIGINAL_NO_PADDING) : "";};
	this.getIntMsgFrom   = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].from;};
	this.getIntMsgTo     = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].to;};
	this.getIntMsgTitle  = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].title;};
	this.getIntMsgBody   = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].body;};

	this.getIntMsgFlagE2ee = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].isE2ee;};

	this.getUplMsgCount = function() {return _uplMsg.length;};
	this.getUplMsgId    = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].id;};
	this.getUplMsgTime  = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].ts;};
	this.getUplMsgTitle = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].title;};
	this.getUplMsgBody  = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].body;};
	this.getUplMsgBytes = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].blocks * 16;};
	this.getUplMsgType  = function(num) {if(typeof(num)!=="number"){return;} return _getFileType(_uplMsg[num].title);};
	this.getUplMsgParent = function(num) {if(typeof(num)!=="number"){return;}
		if (!_uplMsg[num].parent) return false;

		for (let i = 0; i < _extMsg.length; i++) {
			if (_uplMsg[num].parent === _extMsg[i].id) return i;
		}

		return null;
	};

	this.getOutMsgCount = function() {return _outMsg.length;};
	this.getOutMsgId    = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].id;};
	this.getOutMsgIsInt = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].isInt;};
	this.getOutMsgTime  = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].ts;};
	this.getOutMsgIp    = function(num) {if(typeof(num)!=="number"){return;} return String(_outMsg[num].ip[0] + "." + _outMsg[num].ip[1] + "." + _outMsg[num].ip[2] + "." + _outMsg[num].ip[3]);};
	this.getOutMsgCcode = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].countryCode;};
	this.getOutMsgCname = function(num) {if(typeof(num)!=="number"){return;} return _getCountryName(_outMsg[num].countryCode);};
	this.getOutMsgTo    = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].to;};
	this.getOutMsgFrom  = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].from;};
	this.getOutMsgSubj  = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].subj;};
	this.getOutMsgBody  = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].body;};
	this.getOutMsgMxDom = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].mxDom;};
	this.getOutMsgGreet = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].greet;};
	this.getOutMsgTLS   = function(num) {if(typeof(num)!=="number"){return;} return (_outMsg[num].tlsCs === 0) ? "" : "TLS v1." + _outMsg[num].tlsVer + " " + _getCiphersuite(_outMsg[num].tlsCs);};
	this.getOutMsgAttach = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].attach;};

	this.getOutMsgFlagE2ee = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].isE2ee;};

	this.admin_getUserCount = function() {return _admin_userUid.length;};
	this.admin_getUserUid = function(num) {if(typeof(num)!=="number"){return;} return _admin_userUid[num];};
	this.admin_getUserKib = function(num) {if(typeof(num)!=="number"){return;} return _admin_userKib[num];};
	this.admin_getUserNrm = function(num) {if(typeof(num)!=="number"){return;} return _admin_userNrm[num];};
	this.admin_getUserShd = function(num) {if(typeof(num)!=="number"){return;} return _admin_userShd[num];};
	this.admin_getUserLvl = function(num) {if(typeof(num)!=="number"){return;} return _admin_userLvl[num];};

	this.getContactCount = function() {return _contactMail.length;};
	this.getContactMail = function(num) {if(typeof(num)!=="number"){return;} return _contactMail[num];};
	this.getContactName = function(num) {if(typeof(num)!=="number"){return;} return _contactName[num];};
	this.getContactNote = function(num) {if(typeof(num)!=="number"){return;} return _contactNote[num];};

	this.addContact = function(mail, name, note) {if(typeof(mail)!=="string" || typeof(name)!=="string" || typeof(note)!=="string"){return;}
		_contactMail.push(mail);
		_contactName.push(name);
		_contactNote.push(note);
	};

	this.deleteContact = function(index) {if(typeof(index)!=="number"){return;}
		_contactMail.splice(index, 1);
		_contactName.splice(index, 1);
		_contactNote.splice(index, 1);
	};

	this.getPrivateExtraSpaceMax = function() {
		let lenPriv = 2 + (_own_addr.length * 18);

		for (let i = 0; i < _contactMail.length; i++) {
			lenPriv += 3
				+ sodium.from_string(_contactMail[i]).length
				+ sodium.from_string(_contactName[i]).length
				+ sodium.from_string(_contactNote[i]).length;
		}

		return _AEM_LEN_PRIVATE - sodium.crypto_secretbox_NONCEBYTES - sodium.crypto_secretbox_MACBYTES - lenPriv;
	};

	this.getPrivateExtraSpace = function() {
		return sodium.from_string(_privateExtra).length;
	};

	this.getPrivateExtra = function() {
		return _privateExtra;
	};

	this.setPrivateExtra = function(newData) {if(typeof(newData)!=="string"){return;}
		if (sodium.from_string(newData).length > this.getPrivateExtraSpaceMax()) return 0x07;
		_privateExtra = newData;
		return 0;
	};

	this.setKeys = function(umk_b64, callback) {if(typeof(umk_b64)!=="string" || typeof(callback)!=="function"){return;}
		if (umk_b64.length !== 60) {
			callback(false);
			return;
		}

		let umk;
		try {
			umk = sodium.from_base64(umk_b64, sodium.base64_variants.ORIGINAL);
		} catch(e) {
			callback(false);
			return;
		}

		_own_uak = _aem_kdf_umk(37, _AEM_KDF_KEYID_UMK_UAK, umk);
		_own_esk = _aem_kdf_umk(32, _AEM_KDF_KEYID_UMK_ESK, umk);
		_own_ehk = _aem_kdf_umk(32, _AEM_KDF_KEYID_UMK_EHK, umk);
		_own_pfk = _aem_kdf_umk(37, _AEM_KDF_KEYID_UMK_PFK, umk);
		_own_uid = new Uint16Array(_aem_kdf_sub(2, _AEM_KDF_KEYID_UAK_UID, _own_uak).buffer)[0] & 4095;

		callback(true);
	};

	// API functions
	this.Account_Browse = function(callback) {if(typeof(callback)!=="function"){return;}
		_fetchEncrypted(_AEM_API_ACCOUNT_BROWSE, 0, null, null, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length === 1) {callback(response[0]); return;}

			_maxStorage.splice(0);
			_maxNormalA.splice(0);
			_maxShieldA.splice(0);

			for (let i = 0; i < 4; i++) {
				_maxStorage.push(response[(i * 3) + 0]);
				_maxNormalA.push(response[(i * 3) + 1]);
				_maxShieldA.push(response[(i * 3) + 2]);
			}

			let offset = 12;

			for (let uid = 0; uid < _AEM_USERCOUNT; uid++) {
				const u32 = new Uint32Array(response.slice(offset, offset + 4).buffer)[0];

				if (u32 !== 0) {
					_admin_userUid.push(uid);
					_admin_userLvl.push(u32 & 3);
					_admin_userNrm.push((u32 >> 2) & 31);
					_admin_userShd.push((u32 >> 7) & 31);
					_admin_userKib.push(u32 >> 12);
				}

				offset += 4;
			}

			callback(0);
		});
	};

	this.Account_Create = function(uak_hex, epk_hex, callback) {if(typeof(uak_hex)!=="string" || uak_hex.length!==74 || typeof(epk_hex)!=="string" || epk_hex.length!==64 || typeof(callback)!=="function"){return;}
		let data = new Uint8Array(69);
		data.set(sodium.from_hex(uak_hex));
		data.set(sodium.from_hex(epk_hex), 37);

		_fetchEncrypted(_AEM_API_ACCOUNT_CREATE, 0, null, data, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			if (response[0] !== 0x00) {callback(response[0]); return;}

			const new_uid = new Uint16Array(_aem_kdf_sub(2, _AEM_KDF_KEYID_UAK_UID, sodium.from_hex(uak_hex)).buffer)[0] & 4095;

			_admin_userUid.push(new_uid);
			_admin_userLvl.push(0);
			_admin_userKib.push(0);
			_admin_userNrm.push(0);
			_admin_userShd.push(0);

			callback(0);
		});
	};

	this.Account_Delete = function(uid, callback) {if(typeof(uid)!=="number" || typeof(callback)!=="function"){return;}
		_fetchEncrypted(_AEM_API_ACCOUNT_DELETE, 0, new Uint8Array(new Uint16Array([uid]).buffer), null, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			if (response[0] !== 0) {callback(response[0]); return;}

			let num = -1;
			for (let i = 0; i < _admin_userUid.length; i++) {
				if (uid === _admin_userUid[i]) {
					num = i;
					break;
				}
			}

			if (num >= 0) {
				_admin_userUid.splice(num, 1);
				_admin_userLvl.splice(num, 1);
				_admin_userKib.splice(num, 1);
				_admin_userNrm.splice(num, 1);
				_admin_userShd.splice(num, 1);
			}

			callback(0);
		});
	};

	this.Account_Update = function(uid, level, callback) {if(typeof(uid)!=="number" || typeof(level)!=="number" || typeof(callback)!=="function"){return;}
		if (level < 0 || level > _AEM_USER_MAXLEVEL) {callback(0x01); return;}

		const data = new Uint8Array(3);
		data.set(new Uint8Array(new Uint16Array([uid]).buffer));
		data[2] = level;

		_fetchEncrypted(_AEM_API_ACCOUNT_UPDATE, 0, data, null, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			if (response[0] !== 0) {callback(response[0]); return;}

			if (uid === _own_uid) { // Updated own account
				_own_level = level;
				callback(0);
				return;
			}

			let num = -1;
			for (let i = 0; i < _admin_userUid.length; i++) {
				if (uid === _admin_userUid[i]) {
					num = i;
					break;
				}
			}

			if (num >= 0) _admin_userLvl[num] = level;
			callback(0);
		});
	};

	this.Address_Create = function(addr, callback) {if(typeof(addr)!=="string" || typeof(callback)!=="function"){return;}
		if (this.getPrivateExtraSpaceMax() - this.getPrivateExtraSpace() < 18) {callback(0x09); return;}

		if (addr === "SHIELD") {
			_fetchEncrypted(_AEM_API_ADDRESS_CREATE, 0, null, null, function(response) {
				if (typeof(response) === "number") {callback(response); return;}
				if (response.length !== 18) {callback(0x04); return;}

				_own_addr.push(new _Address(response.slice(0, 8), response.slice(8, 18), _AEM_ADDR_FLAGS_DEFAULT, ""));
				callback(0);
			});
		} else {
			const addr32 = _addr32_encode(addr);
			if (!addr32) {callback(0x11); return;}

			let hash;
			if (_addrNormal_olim === 0) {
				hash = sodium.crypto_shorthash(addr32, _addrNormal_salt);
			} else {
				const full = sodium.crypto_pwhash(16, addr32, _addrNormal_salt, _addrNormal_olim, _addrNormal_mlim, sodium.crypto_pwhash_ALG_ARGON2ID13);
				hash = new Uint8Array([
					full[0] ^ full[8],
					full[1] ^ full[9],
					full[2] ^ full[10],
					full[3] ^ full[11],
					full[4] ^ full[12],
					full[5] ^ full[13],
					full[6] ^ full[14],
					full[7] ^ full[15]
				]);
			}

			_fetchEncrypted(_AEM_API_ADDRESS_CREATE, 0, hash, null, function(response) {
				if (typeof(response) === "number") {callback(response); return;}
				if (response.length !== 1) {callback(0x04); return;}
				if (response[0] !== 0) {callback(response[0]); return;}

				_own_addr.push(new _Address(hash, addr32, _AEM_ADDR_FLAGS_DEFAULT, ""));
				callback(0);
			});
		}
	};

	this.Address_Delete = function(num, callback) {if(typeof(num)!=="number" || typeof(callback)!=="function"){return;}
		_fetchEncrypted(_AEM_API_ADDRESS_DELETE, _own_addr[num].addr32[0] & 128, _own_addr[num].hash, null, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			if (response[0] !== 0) {callback(response[0]); return;}

			_own_addr.splice(num, 1);
			callback(0);
		});
	};

	this.Address_Update = function(callback) {if(typeof(callback)!=="function"){return;}
		const x = new Uint8Array(31);
		_own_addr.forEach(function(adr, n) {x[n] = adr.flags;});

		const data = new Uint8Array([
			(x[0]  & 63) | ((x[1]  & 48) << 2),
			(x[1]  & 15) | ((x[2]  & 60) << 2),
			(x[2]  &  3) | ((x[3]  & 63) << 2),
			(x[4]  & 63) | ((x[5]  & 48) << 2),
			(x[5]  & 15) | ((x[6]  & 60) << 2),
			(x[6]  &  3) | ((x[7]  & 63) << 2),
			(x[8]  & 63) | ((x[9]  & 48) << 2),
			(x[9]  & 15) | ((x[10] & 60) << 2),
			(x[10] &  3) | ((x[11] & 63) << 2),
			(x[12] & 63) | ((x[13] & 48) << 2),
			(x[13] & 15) | ((x[14] & 60) << 2),
			(x[14] &  3) | ((x[15] & 63) << 2),
			(x[16] & 63) | ((x[17] & 48) << 2),
			(x[17] & 15) | ((x[18] & 60) << 2),
			(x[18] &  3) | ((x[19] & 63) << 2),
			(x[20] & 63) | ((x[21] & 48) << 2),
			(x[21] & 15) | ((x[22] & 60) << 2),
			(x[22] &  3) | ((x[23] & 63) << 2),
			(x[24] & 63) | ((x[25] & 48) << 2),
			(x[25] & 15) | ((x[26] & 60) << 2),
			(x[26] &  3) | ((x[27] & 63) << 2),
			(x[28] & 63) | ((x[29] & 48) << 2),
			(x[29] & 15) | ((x[30] & 60) << 2),
			(x[30] &  3) // Last 6 bits unused
		]);

		_fetchEncrypted(_AEM_API_ADDRESS_UPDATE, 0, data, null, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			callback(response[0]);
		});
	};

	this.Message_Browse = function(newest, u_info, callback) {if(typeof(newest)!=="boolean" || typeof(u_info)!=="boolean" || typeof(callback)!=="function"){return;}
		const startId = _newestMsgTs? sodium.from_hex(newest? _newestEvpId : _oldestEvpId) : null;
		const flags = (u_info? _AEM_FLAG_UINFO : 0) | (newest? 0 : _AEM_FLAG_OLDER);

		_fetchEncrypted(_AEM_API_MESSAGE_BROWSE, flags, startId, null, async function(response) {
			if (response.length === 1 && response[0] === 0xB0 && startId) {callback(0); return;} // No more message data
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length === 1) {callback(response[0]); return;}
			if (typeof(response) !== "object") {callback(0x04); return;}

			if (u_info) {
				if (response.length < _AEM_LEN_PRIVATE) {callback(0x04); return;}
				const uinfo_bytes = await _parseUinfo(response);
				response = response.slice(uinfo_bytes);
			}

			_totalMsgCount = new Uint16Array(response.slice(0, 2).buffer)[0];
			_totalMsgBytes = new Uint32Array(response.slice(2, 6).buffer)[0] * 16;
			const evpCount = new Uint16Array(response.slice(6, 8).buffer)[0];
			const evpSize = new Uint16Array(response.slice(8, 8 + evpCount * 2).buffer);

			let offset = 8 + evpCount * 2;

			for (let i = 0; i < evpCount; i++) {
				const evpBlocks = evpSize[i];
				const evpBytes = (evpBlocks + _AEM_MSG_MINBLOCKS) * 16;
				const evpData = response.slice(offset, offset + evpBytes);

				const evpId = sodium.to_hex(new Uint8Array([
					evpData[0]  ^ evpData[1]  ^ evpData[2]  ^ evpData[3]  ^ evpData[4]  ^ evpData[5]  ^ evpData[6]  ^ evpData[7]  ^ evpData[8]  ^ evpData[9]  ^ evpData[10] ^ evpData[11] ^ evpData[12] ^ evpData[13] ^ evpData[14] ^ evpData[15],
					evpData[16] ^ evpData[17] ^ evpData[18] ^ evpData[19] ^ evpData[20] ^ evpData[21] ^ evpData[22] ^ evpData[23] ^ evpData[24] ^ evpData[25] ^ evpData[26] ^ evpData[27] ^ evpData[28] ^ evpData[29] ^ evpData[30] ^ evpData[31]
				]));

				if (_msgExists(evpId)) {
					offset += evpBytes;
					continue;
				}

				// Create the base for the hash
				const base = new Uint8Array(sodium.crypto_scalarmult_BYTES + _X25519_PKBYTES + 2);
				base.set(sodium.crypto_scalarmult(_own_esk, evpData.slice(0, _X25519_PKBYTES))); // Recreate the shared secret - this step cannot be done by the server
				base.set(sodium.crypto_scalarmult_base(_own_esk), sodium.crypto_scalarmult_BYTES);
				base.set(new Uint8Array(new Uint16Array([evpBlocks]).buffer), sodium.crypto_scalarmult_BYTES + _X25519_PKBYTES);

				// Create the key and nonce, and retrieve the Message from the Envelope
				const evp_KeyNonce = sodium.crypto_generichash(sodium.crypto_stream_chacha20_KEYBYTES + sodium.crypto_stream_chacha20_NONCEBYTES, base);
				const evpDec = sodium.crypto_stream_chacha20_xor(evpData.slice(_X25519_PKBYTES), evp_KeyNonce.slice(sodium.crypto_stream_chacha20_KEYBYTES), evp_KeyNonce.slice(0, sodium.crypto_stream_chacha20_KEYBYTES));

				const msgSig = evpDec.slice(0, 16);
				const msgData = evpDec.slice(16);

				_addMessage(msgData, evpId);

				_readyMsgBytes += evpBytes;
				offset += evpBytes;
			}

			_extMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_intMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_uplMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_outMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);

			callback(0);
		});
	};

	this.Message_Create = function(subject, body, addr_from, addr_to, replyId, to_apk, callback) {if(typeof(subject)!=="string" || typeof(body)!=="string" || typeof(addr_from)!=="string" || typeof(addr_to)!=="string" || typeof(callback)!=="function"){return;}
		if (addr_to.indexOf("@") > 0) { // Email
			if (replyId === null) {
				replyId = "";
			} else if (typeof(replyId) !== "string") {
				callback(0x01);
				return;
			}

			const post = sodium.from_string(addr_to + "\n" + replyId + "\n" + subject + "\n" + body);
			_fetchEncrypted(_AEM_API_MESSAGE_CREATE, _AEM_FLAG_EMAIL, sodium.from_string(addr_from), post, function(response) {
				if (typeof(response) === "number") {callback(response); return;}
				if (response.length === 1) {callback(response[0]); return;}
				callback(0x04);
			});

			return;
		}

		// Internal mail; TODO: E2EE support
		const addr32_from = _addr32_encode(addr_from);
		if (!addr32_from) {callback(0x11); return;}

		const addr32_to = _addr32_encode(addr_to);
		if (!addr32_to) {callback(0x11); return;}

		const url = new Uint8Array(24);
		url.set(addr32_from);
		url.set(addr32_to, 10);
		url[20]  = (addr_from.length === 16) ? 128 : 0;
		url[20] |= (addr_to.length   === 16) ?  64 : 0;
		url[21] = 0x01;
		url[22] = 0x02;
		url[23] = 0x03;

		const post = sodium.from_string(subject + '\n' + body);
		_fetchEncrypted(_AEM_API_MESSAGE_CREATE, 0, url, post, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length === 1) {callback(response[0]); return;}
			callback(0x04);
		});
	};

	this.Message_Delete = function(hexId, callback) {if(typeof(callback)!=="function"){return;}
		if (hexId === "ALL") {
			_fetchEncrypted(_AEM_API_MESSAGE_DELETE, _AEM_FLAG_EMPTY, null, null, function(response) {
				if (typeof(response) === "number") {callback(response); return;}
				if (response.length !== 1) {callback(0x04); return;}
				if (response[0] !== 0) {callback(response[0]); return;}

				[_extMsg, _intMsg, _uplMsg, _outMsg].forEach(function(msgSet) {
					msgSet.splice(msgSet.length);
				});

				_newestEvpId = null;
				_newestMsgTs = 0;
				_oldestEvpId = null;
				_oldestMsgTs = 4294967296;

				callback(0);
			});
		} else {
			// TODO: Allow deleting multiple (12 max)
			if (hexId.length !== 4) {callback(0x01); return;}

			if (_oldestEvpId === hexId) {
				callback(0x10);
				return;
			}

			_fetchEncrypted(_AEM_API_MESSAGE_DELETE, 0, sodium.from_hex(hexId), null, function(response) {
				if (typeof(response) === "number") {callback(response); return;}
				if (response.length !== 1) {callback(0x04); return;}
				if (response[0] !== 0) {callback(response[0]); return;}

				[_extMsg, _intMsg, _uplMsg, _outMsg].forEach(function(msgSet) {
					for (let j = 0; j < msgSet.length; j++) {
						if (hexId === msgSet[j].id) {msgSet.splice(j, 1); j--;}
					}
				});

				callback(0);
			});
		}
	};

	this.Message_Public = function(title, body, callback) {if(typeof(title)!=="string" || typeof(body)!=="string" || typeof(callback)!=="function"){return;}
		// TODO
/*		const binMsg = sodium.from_string(title + "\n" + body);
		if (binMsg.length < 59) {callback(0x06); return;} // 59 = 177-48-64-5-1

		_fetchEncrypted(_AEM_API_MESSAGE_PUBLIC, 0, binMsg, function(response) {
			if (fetchErr) {callback(fetchErr); return;}

			_intMsg.unshift(new _IntMsg(true, true, newMsgId, Date.now() / 1000, false, 3, null, "public", "", title, body));

			let x = binMsg.length + 118; // 5 (BoxInfo + ts) + 1 (InfoByte) + 64 (sig) + 48 (sealed box)
			if (x % 16 !== 0) x+= (16 - (x % 16));
			_totalMsgBytes += x;
			_readyMsgBytes += x;

			callback(0);
		});
*/	};

	this.Message_Sender = function(msgId, callback) {if(typeof(hash)!=="string" || typeof(callback)!=="function"){return;}
		// TODO
		if (msgId.length !== 64) {callback(0x01); return;}

		_fetchEncrypted(_AEM_API_MESSAGE_SENDER, 0, null, sodium.from_string(msgId), function(response) {
			//callback(fetchErr, (fetchErr === 0 && result) ? sodium.to_hex(result) : null);
		});
	};

	this.Message_Upload = async function(filename, body, callback) {if(typeof(filename)!=="string" || (typeof(body)!=="string" && body.constructor!==Uint8Array) || typeof(callback)!=="function"){return;}
		if (filename.length < 1) {callback(0x01); return;}

		const u8fn = sodium.from_string(filename);
		if (u8fn.length > 128) {callback(0x04); return;}
		const u8body = (typeof(body) === "string") ? sodium.from_string(body) : body;

		const lenData = 13 + u8fn.length + u8body.length;
		if (lenData > _AEM_MSG_SRC_MAXSIZE) {callback(0x07); return;}
		if (lenData < _AEM_MSG_SRC_MINSIZE) {callback(0x08); return;}

		const rawData = new Uint8Array(13 + u8fn.length + u8body.length);
		rawData[0] = u8fn.length - 1;
		// 12 byte nonce
		rawData.set(u8fn, 13);
		rawData.set(u8body, 13 + u8fn.length);

		const nonce = new Uint8Array(16);
		nonce.set(window.crypto.getRandomValues(new Uint8Array(12)));

		const encData = new Uint8Array(await window.crypto.subtle.encrypt(
			{name: "AES-CTR", counter: nonce, length: 32},
			await window.crypto.subtle.importKey("raw", _own_ehk, {"name": "AES-CTR"}, false, ["encrypt"]),
			rawData)
		);
		encData.set(nonce.slice(0, 12), 1);

		_fetchEncrypted(_AEM_API_MESSAGE_UPLOAD, 0, encData.slice(0, 24), encData.slice(24), function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			if (response[0] !== 0) {callback(response[0]); return;}

			let x = encData.length + 53; // 5 (info + ts) + 48 (Envelope)
			if (x % 16 !== 0) x+= (16 - (x % 16));
			_totalMsgBytes += x;
			_readyMsgBytes += x;

			_uplMsg.unshift(new _UplMsg(/*newMsgId*/null, Date.now() / 1000, filename, u8body, null, x / 16));
			callback(0);
		});
	};

	this.Private_Update = async function(callback) {if(typeof(callback)!=="function"){return;}
		if (typeof(_own_privateNonce) !== "number") {callback(0x12); return;}

		// Create the data field
		const pd = new Uint8Array(_AEM_LEN_PRIVATE - 20); // 16 MAC + 4 Nonce

		pd[0] = _own_addr.length;
		let offset = 1;

		for (let i = 0; i < _own_addr.length; i++) {
			pd.set(_own_addr[i].hash, offset);
			pd.set(_own_addr[i].addr32, offset + 8);
			pd[offset + 18] = _own_addr[i].nick.length;

			const nick = sodium.from_string(_own_addr[i].nick);
			pd.set(nick, offset + 19);

			offset += 19 + nick.length;
		}

		pd[offset] = _contactMail.length;
		offset++;

		for (let i = 0; i < _contactMail.length; i++) {
			const cMail = sodium.from_string(_contactMail[i] + "\n");
			const cName = sodium.from_string(_contactName[i] + "\n");
			const cNote = sodium.from_string(_contactNote[i] + "\n");

			pd.set(cMail, offset);
			offset += cMail.length;

			pd.set(cName, offset);
			offset += cName.length;

			pd.set(cNote, offset);
			offset += cNote.length;
		}

		pd.set(sodium.from_string(_privateExtra).slice(0, _AEM_LEN_PRIVATE - offset), offset);

		// Use the Private Field Key to derive two key-nonce sets: one for us, and one for the server
		_own_privateNonce++;
		if (_own_privateNonce >= Math.pow(2, 32)) _own_privateNonce = 0;

		const pfk_nonce = new Uint8Array(8);
		pfk_nonce.set(new Uint8Array(new Uint32Array([_own_privateNonce]).buffer));

		const kn_client = _aem_kdf_sub(44, pfk_nonce, _own_pfk);
		pfk_nonce[7] = 1;
		const kn_server = _aem_kdf_sub(44, pfk_nonce, _own_pfk);

		// Client-side encryption
		const encData = new Uint8Array(await window.crypto.subtle.encrypt(
			{name: "AES-GCM", iv: kn_client.slice(0, 12)},
			await window.crypto.subtle.importKey("raw", kn_client.slice(12), {"name": "AES-GCM"}, false, ["encrypt"]),
			pd
		));

		// POST data includes the key-nonce set for the server (not stored) and the 32-bit nonce (stored)
		const post = new Uint8Array(48 + encData.length);
		post.set(kn_server);
		post.set(pfk_nonce.slice(0, 4), 44);
		post.set(encData, 48);

		// Send the request
		_fetchEncrypted(_AEM_API_PRIVATE_UPDATE, 0, null, post, function(response) {
			if (typeof(response) === "number") {callback(response); return;}
			if (response.length !== 1) {callback(0x04); return;}
			callback(response[0]);
		});
	};

	this.Setting_Limits = function(mib, nrm, shd, callback) {if(typeof(mib)!=="object" || typeof(nrm)!=="object" || typeof(shd)!=="object" || typeof(callback)!=="function"){return;}
		const data = new Uint8Array([
			mib[0], nrm[0], shd[0],
			mib[1], nrm[1], shd[1],
			mib[2], nrm[2], shd[2],
			mib[3], nrm[3], shd[3]
		]);

		_fetchEncrypted(_AEM_API_SETTING_LIMITS, 0, data, null, function(fetchErr) {
			if (fetchErr === 0) {
				for (let i = 0; i < 4; i++) {
					_maxStorage[i] = mib[i];
					_maxNormalA[i] = nrm[i];
					_maxShieldA[i] = shd[i];
				}
			}

			callback(fetchErr);
		});
	};

	// Extras
	this.shieldMix = function(addr, extreme) {if(typeof(addr)!=="string"){return;}
		let newAddr = "";

		for (let i = 0; i < 16; i++) {
			switch (addr.charAt(i)) {
				case "1":
					newAddr += "1iIlL".charAt(Math.floor(Math.random() * 5));
					break;
				case "0":
					newAddr += "0oO".charAt(Math.floor(Math.random() * 3));
					break;
				case "w":
					newAddr += "VvWw".charAt(Math.floor(Math.random() * 4));
					break;
				default:
					newAddr += (Math.random() > 0.5) ? addr.charAt(i).toLowerCase() : addr.charAt(i).toUpperCase();
			}

			if (typeof(extreme) === "number" && extreme > 0 && extreme < 1 && Math.random() < extreme) newAddr += ".-_$+%=".charAt(Math.floor(Math.random() * 7));
		}

		const n = Math.floor(Math.random() * 16);
		if (n === 0) return newAddr;
		newAddr = newAddr.slice(0, n) + ((Math.random() > 0.5) ? "." : "-") + newAddr.slice(n);

		const m = Math.floor(Math.random() * 17);
		return (m === 0 || m === n || m === n + 1) ? newAddr : newAddr.slice(0, m) + ((Math.random() > 0.5) ? "." : "-") + newAddr.slice(m);
	};

	this.getErrorMessage = function(err) {if(typeof(err)!=="number"){return;}
		switch (err) {
			// 400+ Unauthenticated
			case 400: return "Bad request";
			case 403: return "Authentication failed";
			case 404: return "Connection error";
			case 500: return "Internal server error";

			// 0x00: OK

			// 0x01-0x1F	Client
			case 0x01: return "Invalid input";
			case 0x02: return "Connection failure";
			case 0x03: return "Failed connecting to server";
			case 0x04: return "Invalid response from server";
			case 0x05: return "Failed decrypting response";
			case 0x06: return "Name too long";
			case 0x07: return "Contents too large";
			case 0x08: return "Contents too small";
			case 0x09: return "Private-field out of space";
			case 0x10: return "Cannot delete oldest message";
			case 0x11: return "Invalid address";
			case 0x12: return "Cannot update Private field without fetching it first";

			// 0xA0-0xAF	Basic
			case 0xA0: return ["INTERNAL", "Internal server error"];
			case 0xA1: return ["CMD",      "Invalid API command"];
			case 0xA2: return ["PARAM",    "Invalid API parameters"];
			case 0xA3: return ["POST",     "Invalid POST body size"];
			case 0xA4: return ["RECV",     "Failed sending POST body"];
			case 0xA5: return ["DECRYPT",  "Server failed to decrypt POST body"];
			case 0xA6: return ["LEVEL",    "Insufficient account level"];

			// 0xB0-0xBF	General
			case 0xB0: return ["MESSAGE_BROWSE_NOMORE",   "No more message data"];
			case 0xB1: return ["MESSAGE_BROWSE_NOTFOUND", "Message not found"];
			case 0xB2: return ["MESSAGE_DELETE_NOTFOUND", "Failed deleting message: not found"];

			// 0xC0-0xC9	Account
			case 0xC0: return ["ACCOUNT_CREATE_EXIST",        "Account already exists"];
			case 0xC1: return ["ACCOUNT_DELETE_NOTEXIST",     "Account not found"];
			case 0xC2: return ["ACCOUNT_DELETE_FORBIDMASTER", "The Master Administrator cannot be deleted or demoted"];
			case 0xC3: return ["ACCOUNT_DELETE_NOSTORAGE",    "Account data was deleted, but deleting message data failed due to an internal error"];

			// 0xDA-0xDF	Address/Create|Delete|Update
			case 0xDA: return ["ADDRESS_CREATE_INUSE",     "Address already taken"];
			case 0xDB: return ["ADDRESS_CREATE_ATLIMIT",   "Limit reached - unable to register additional addresses"];
			case 0xDC: return ["ADDRESS_DELETE_SOMEFOUND", "Delete successful, but some addresses were not found"];
			case 0xDD: return ["ADDRESS_DELETE_NONEFOUND", "No such address(es)"];

			// 0xE0-0xE9	Message/Create
			case 0xE0: return ["MESSAGE_CREATE_EXT_MINLEVEL", "Account level too low"];
			case 0xE1: return ["MESSAGE_CREATE_EXT_HDR_ADFR", "Malformed from-address"];
			case 0xE2: return ["MESSAGE_CREATE_EXT_HDR_ADTO", "Malformed to-address"];
			case 0xE3: return ["MESSAGE_CREATE_EXT_HDR_RPLY", "Malformed reply-id"];
			case 0xE4: return ["MESSAGE_CREATE_EXT_HDR_SUBJ", "Malformed subject"];
			case 0xE5: return ["MESSAGE_CREATE_EXT_BDY_UTF8", "Body must be UTF-8"];
			case 0xE6: return ["MESSAGE_CREATE_EXT_BDY_CTRL", "Body must not contain control characters"];
			case 0xE7: return ["MESSAGE_CREATE_EXT_BDY_SIZE", "Body too long or short"];
			case 0xE8: return ["MESSAGE_CREATE_EXT_BDY_LONG", "Body exceeds line-length limit"];
			case 0xE9: return ["MESSAGE_CREATE_EXT_MYDOMAIN", "Remove @" + _ourDomain + " to send internally"];
			case 0xEE: return ["MESSAGE_CREATE_INT_OWN_ADDR", "Own address invalid"];
			case 0xEF: return ["MESSAGE_CREATE_INT_REC_DENY", "Message denied by receiver"];

			// 0xF0-0xF9	Message/Create sendMail()
			case 0xF0: return ["MESSAGE_CREATE_SENDMAIL_GREET", "Failed greeting receiver server"];
			case 0xF1: return ["MESSAGE_CREATE_SENDMAIL_EHLO",  "EHLO command failed"];
			case 0xF2: return ["MESSAGE_CREATE_SENDMAIL_STLS",  "STARTTLS command failed"];
			case 0xF3: return ["MESSAGE_CREATE_SENDMAIL_SHAKE", "TLS handshake failed"];
			case 0xF4: return ["MESSAGE_CREATE_SENDMAIL_NOTLS", "TLS not available"];
			case 0xF5: return ["MESSAGE_CREATE_SENDMAIL_MAIL",  "MAIL command failed"];
			case 0xF6: return ["MESSAGE_CREATE_SENDMAIL_RCPT",  "RCPT command failed"];
			case 0xF7: return ["MESSAGE_CREATE_SENDMAIL_DATA",  "DATA command failed"];
			case 0xF8: return ["MESSAGE_CREATE_SENDMAIL_BODY",  "Sending body failed"];
	//		case 0xF9: return ["", ""];

			// 0xFA-0xFF	Message/Create Int
			case 0xFA: return ["MESSAGE_CREATE_INT_TOOSHORT",     "Message too short"];
			case 0xFB: return ["MESSAGE_CREATE_INT_TS_INVALID",   "Invalid timestamp"];
			case 0xFC: return ["MESSAGE_CREATE_INT_SUBJECT_SIZE", "Subject too long or short"];
			case 0xFD: return ["MESSAGE_CREATE_INT_ADDR_NOTOWN",  "Sender address not owned"];
			case 0xFE: return ["MESSAGE_CREATE_INT_TO_NOTACCEPT", "Receiver address does not accept messages"];
			case 0xFF: return ["MESSAGE_CREATE_INT_TO_SELF",      "Sending to own account not allowed"];

			default: return ["???", "Unknown error"];
		}
	};

	readyCallback(true);
}
