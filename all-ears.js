"use strict";

function AllEars(readyCallback) {
	try {
		if ((!window.isSecureContext && !document.domain.endsWith(".onion"))
		|| window.self !== window.top
		|| window.opener !== null
		|| document.compatMode == "BackCompat"
		|| document.characterSet !== "UTF-8"
		) {readyCallback(false); return;}
	} catch(e) {readyCallback(false); return;}

	const docDomApi = document.head.querySelector("meta[name='aem.domain.api']").content;
	const docDomEml = document.head.querySelector("meta[name='aem.domain.eml']").content;
	const docPubApi = document.head.querySelector("meta[name='aem.pubkey.api']").content;
	const docPubSig = document.head.querySelector("meta[name='aem.pubkey.sig']").content;
	const docSltNrm = document.head.querySelector("meta[name='aem.adrslt.nrm']").content;

	if (!docPubApi || !docPubSig || !docSltNrm || docPubApi.length !== sodium.crypto_box_SECRETKEYBYTES * 2 || docPubSig.length !== sodium.crypto_sign_PUBLICKEYBYTES * 2 || docSltNrm.length !== sodium.crypto_pwhash_SALTBYTES * 2) {
		readyCallback(false);
		return;
	}

// Private constants - must match server
	const _AEM_API_ACCOUNT_BROWSE = 0;
	const _AEM_API_ACCOUNT_CREATE = 1;
	const _AEM_API_ACCOUNT_DELETE = 2;
	const _AEM_API_ACCOUNT_UPDATE = 3;
	const _AEM_API_ADDRESS_CREATE = 4;
	const _AEM_API_ADDRESS_DELETE = 5;
	const _AEM_API_ADDRESS_LOOKUP = 6;
	const _AEM_API_ADDRESS_UPDATE = 7;
	const _AEM_API_MESSAGE_BROWSE = 8;
	const _AEM_API_MESSAGE_CREATE = 9;
	const _AEM_API_MESSAGE_DELETE = 10;
	const _AEM_API_MESSAGE_PUBLIC = 11;
	const _AEM_API_MESSAGE_SENDER = 12;
	const _AEM_API_MESSAGE_UPLOAD = 13;
	const _AEM_API_PRIVATE_UPDATE = 14;
	const _AEM_API_SETTING_LIMITS = 15;

	const _AEM_ADDR_FLAG_SHIELD = 128;
	// 64/32/16/8/4 unused
	const _AEM_ADDR_FLAG_ACCINT = 2;
	const _AEM_ADDR_FLAG_ACCEXT = 1;

	const _AEM_FLAG_UINFO = 2;
	const _AEM_FLAG_NEWER = 1;

	const _AEM_ADDR32_CHARS = "0123456789abcdefghjkmnpqrstuwxyz";
	const _AEM_ADDRESSES_PER_USER = 31;
	const _AEM_LEN_PRIVATE = 4096 - sodium.crypto_box_PUBLICKEYBYTES - 1 - (_AEM_ADDRESSES_PER_USER * 9);
	const _AEM_MSG_MINBLOCKS = 12;
	const _AEM_API_BOX_SIZE_MAX = 1048635; // (((2^16 - 1) + 12) * 16) - 117
	const _AEM_USER_MAXLEVEL = 3;

	const _AEM_ARGON2_MEMLIMIT = 67108864;
	const _AEM_ARGON2_OPSLIMIT = 3;

	const _AEM_DOMAIN_API = docDomApi? docDomApi : document.domain;
	const _AEM_DOMAIN_EML = docDomEml? docDomEml : document.domain;
	const _AEM_API_PUBKEY = sodium.from_hex(docPubApi);
	const _AEM_SIG_PUBKEY = sodium.from_hex(docPubSig);
	const _AEM_SALT_NORMAL = sodium.from_hex(docSltNrm);

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
	const _maxStorage = [];
	const _maxNormalA = [];
	const _maxShieldA = [];

	let _userKeyPublic;
	let _userKeySecret;
	let _userKeyKxHash;
	let _userKeySymmetric;

	let _userLevel = 0;
	const _userAddress = [];
	const _extMsg = [];
	const _intMsg = [];
	const _uplMsg = [];
	const _outMsg = [];

	let _totalMsgCount = 0;
	let _totalMsgBytes = 0;
	let _readyMsgBytes = 0;

	const _contactMail = [];
	const _contactName = [];
	const _contactNote = [];

	const _admin_userPkHex = [];
	const _admin_userSpace = [];
	const _admin_userNaddr = [];
	const _admin_userSaddr = [];
	const _admin_userLevel = [];

// Private functions
	function _NewDkim() {
		this.domain = [];
		this.senderId = [];
		this.sgnAll = [];
		this.sgnDate = [];
		this.sgnFrom = [];
		this.sgnMsgId = [];
		this.sgnReplyTo = [];
		this.sgnSubject = [];
		this.sgnTo = [];
	}

	function _NewExtMsg(validPad, validSig, id, ts, hdrTs, hdrTz, ip, cc, cs, tls, esmtp, quitR, protV, inval, rares, attach, greetDomainIp, ipBlacklisted, dkimFail, dkim, greet, rdns, envFrom, hdrFrom, dnFrom, envTo, hdrTo, dnTo, hdrRt, dnRt, hdrId, headers, subj, body) {
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.hdrTs = hdrTs;
		this.hdrTz = hdrTz;
		this.ip = ip;
		this.countryCode = cc;
		this.cs = cs;
		this.tls = tls;
		this.esmtp = esmtp;
		this.quitR = quitR;
		this.protV = protV;
		this.inval = inval;
		this.rares = rares;
		this.attach = attach;
		this.greetDomainIp = greetDomainIp;
		this.ipBlacklisted = ipBlacklisted;
		this.dkimFail = dkimFail;
		this.dkim = dkim;
		this.greet = greet;
		this.rdns = rdns;
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

	function _NewIntMsg(validPad, validSig, id, ts, isE2ee, fromLv, fromPk, from, to, title, body) {
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.isE2ee = isE2ee;
		this.fromLv = fromLv;
		this.fromPk = fromPk;
		this.from = from;
		this.to = to;
		this.title = title;
		this.body = body;
	}

	function _NewOutMsg_Ext(validPad, validSig, id, ts, ip, to, from, subj, body, mxDom, greet, tlsCs, tlsVer, attach) {
		this.isInt = false;
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.ip = ip;
		this.to = to;
		this.from = from;
		this.subj = subj;
		this.body = body;
		this.mxDom = mxDom;
		this.greet = greet;
		this.tlsCs = tlsCs;
		this.tlsVer = tlsVer;
		this.attach = attach;
	}

	function _NewOutMsg_Int(validPad, validSig, id, ts, isE2ee, to, from, subj, body) {
		this.isInt = true;
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.isE2ee = isE2ee;
		this.to = to;
		this.from = from;
		this.subj = subj;
		this.body = body;
	}

	function _NewUplMsg(id, ts, title, body, parent, blocks) {
		this.id = id;
		this.ts = ts;
		this.title = title;
		this.body = body;
		this.parent = parent;
		this.blocks = blocks;
	}

	function _NewAddress(hash, addr32, is_shd, accExt, accInt) {
		this.hash = hash;
		this.addr32 = addr32;
		this.is_shd = is_shd;
		this.accExt = accExt;
		this.accInt = accInt;
	}

	const _FetchBinary = function(postData, callback) {
		fetch((_AEM_DOMAIN_API.endsWith(".onion") ? "http://" : "https://") + _AEM_DOMAIN_API + ":302/api", {
			method: "POST",
			cache: "no-store",
			credentials: "omit",
			headers: new Headers({
				"Accept": "",
				"Accept-Language": ""
			}),
			mode: "cors",
			redirect: "error",
			referrer: "",
			referrerPolicy: "no-referrer",
			body: postData
		}).then(function(response) {
			if (response.statusText !== "aem") {callback(0x20); return null;}
			if (response.status === 400) {callback(0x17); return null;}
			if (response.status === 403) {callback(0x18); return null;}
			if (response.status === 500) {callback(0x19); return null;}
			if (response.status !== 200) {callback(0x20); return null;}
			return response.arrayBuffer();
		}).then(function(ab) {
			if (ab) callback(0, new Uint8Array(ab));
		}).catch(() => {
			callback(0x03);
		});
	};

	const _FetchEncrypted = function(apiCmd, clearU8, callback) {
		if (typeof(apiCmd) !== "number" || apiCmd < 0 || apiCmd > 255 || typeof(clearU8) !== "object" || clearU8.length > _AEM_API_BOX_SIZE_MAX) {
			callback(0x04);
			return;
		}

		// postBox: clearU8 encrypted
		const nonce = new Uint8Array(sodium.crypto_box_NONCEBYTES);
		window.crypto.getRandomValues(nonce);
		const postBox = sodium.crypto_box_easy(clearU8, nonce, _AEM_API_PUBKEY, _userKeySecret);

		// sealBox: apiCmd + UPK + Nonce for postBox
		const sealClear = new Uint8Array(1 + sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES);
		sealClear[0] = apiCmd;
		sealClear.set(nonce, 1);
		sealClear.set(_userKeyPublic, 1 + sodium.crypto_box_NONCEBYTES);
		const sealBox = sodium.crypto_box_seal(sealClear, _AEM_API_PUBKEY);

		// postMsg: sealBox + postBox
		const postMsg = new Uint8Array(sealBox.length + postBox.length);
		postMsg.set(sealBox);
		postMsg.set(postBox, sealBox.length);

		_FetchBinary(postMsg, function(ret, encData) {
			if (ret !== 0) {callback(ret); return;}

			let decData;
			try {decData = sodium.crypto_box_open_easy(encData.slice(sodium.crypto_box_NONCEBYTES), encData.slice(0, sodium.crypto_box_NONCEBYTES), _AEM_API_PUBKEY, _userKeySecret);}
			catch(e) {callback(0x05); return;}

			if (decData.length > 33) {callback(0, decData); return;} // Long response
			if (decData.length !== 33) {callback(0x06, decData); return;}

			// Short response
			if (decData[0] > 32) callback(decData[0]); // Error
			else if (decData[0] === 0) callback(0, null); // No-content ok
			else callback(0, decData.slice(1, 1 + decData[0]));
		});
	};

	const _GetBit = function(src, bitNum) {
		const bit = bitNum % 8;
		const byte = (bitNum - bit) / 8;

		return ((1 & (src[byte] >> (7 - bit))) === 1);
	};

	const _SetBit = function(src, bitNum) {
		const bit = bitNum % 8;
		const byte = (bitNum - bit) / 8;

		src[byte] |= 1 << (7 - bit);
	};

	const _addr32_decode = function(byteArray, is_shd) {
		if (!byteArray || byteArray.length !== 10) return "???";

		const len = is_shd ? 16 : (byteArray[0] & 248) >> 3; // First five bits (128+64+32+16+8=248) store length for Normal addresses

		let decoded = "";

		for (let i = 0; i < len; i++) {
			let num = 0;
			const skipBits = (is_shd ? i : i + 1) * 5;

			if (_GetBit(byteArray, skipBits + 0)) num += 16;
			if (_GetBit(byteArray, skipBits + 1)) num +=  8;
			if (_GetBit(byteArray, skipBits + 2)) num +=  4;
			if (_GetBit(byteArray, skipBits + 3)) num +=  2;
			if (_GetBit(byteArray, skipBits + 4)) num +=  1;

			decoded += _AEM_ADDR32_CHARS[num];
		}

		return decoded;
	};

	const _addr32_charToUint5 = function(c) {
		for (let i = 0; i < 32; i++) {
			if (c === _AEM_ADDR32_CHARS[i]) return i;
		}

		if (c === "o") return 0; // 0
		if (c === "i" || c === "l") return 1; // 1
		if (c === "v") return 28; // w

		return -1;
	};

	// Only for Normal, not Shield addresses
	const _addr32_encode = function(source) {
		if (source.length < 1 || source.length > 15) return null;

		let encoded = new Uint8Array(10);
		encoded[0] = source.length << 3; // First five bits store length

		for (let i = 0; i < source.length; i++) {
			const skipBits = (i + 1) * 5;

			let num = _addr32_charToUint5(source[i]);
			if (num < 0) return null;
			if (num >= 16) {_SetBit(encoded, skipBits + 0); num -= 16;}
			if (num >=  8) {_SetBit(encoded, skipBits + 1); num -=  8;}
			if (num >=  4) {_SetBit(encoded, skipBits + 2); num -=  4;}
			if (num >=  2) {_SetBit(encoded, skipBits + 3); num -=  2;}
			if (num >=  1) {_SetBit(encoded, skipBits + 4); num -=  1;}
		}

		return encoded;
	};

	const _GetAddressCount = function(isShield) {
		let count = 0;

		for (let i = 0; i < _userAddress.length; i++) {
			if (_userAddress[i].is_shd === isShield) count++;
		}

		return count;
	};

	const _arraysEqual = function(a, b) {
		try {return a.every((el, ix) => el === b[ix]);}
		catch(e) {return false;}
	};

	const _MsgExists = function(id) {
		let found = false;

		_extMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_intMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_uplMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_outMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;

		return false;
	};

	const _GetNewestMsgId = function() {
		let ts = (_extMsg.length === 0) ? 0 : _extMsg[0].ts;
		let result = 0;

		if (_intMsg.length !== 0 && _intMsg[0].ts > ts) {result = 1; ts = _intMsg[0].ts;}
		if (_uplMsg.length !== 0 && _uplMsg[0].ts > ts) {result = 2; ts = _uplMsg[0].ts;}
		if (_outMsg.length !== 0 && _outMsg[0].ts > ts) {result = 3;}

		switch (result) {
			case 0: return _extMsg[0].id;
			case 1: return _intMsg[0].id;
			case 2: return _uplMsg[0].id;
			case 3: return _outMsg[0].id;
		}
	};

	const _GetOldestMsgId = function() {
		let ts = (_extMsg.length === 0) ? 4294967296 : _extMsg[_extMsg.length - 1].ts;
		let result = 0;

		if (_intMsg.length !== 0 && _intMsg[_intMsg.length - 1].ts < ts) {result = 1; ts = _intMsg[_intMsg.length - 1].ts;}
		if (_uplMsg.length !== 0 && _uplMsg[_uplMsg.length - 1].ts < ts) {result = 2; ts = _uplMsg[_uplMsg.length - 1].ts;}
		if (_outMsg.length !== 0 && _outMsg[_outMsg.length - 1].ts < ts) {result = 3;}

		switch (result) {
			case 0: return _extMsg[_extMsg.length - 1].id;
			case 1: return _intMsg[_intMsg.length - 1].id;
			case 2: return _uplMsg[_uplMsg.length - 1].id;
			case 3: return _outMsg[_outMsg.length - 1].id;
		}
	};

	const _GetFileType = function(filename) {
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

	const _GetCiphersuite = function(cs) {
		if (typeof(cs) !== "number") return "(Error reading ciphersuite value)";

		switch(cs) {
			case 0: return "";
			case 1: return "(Error saving ciphersuite value)";
			case 0x67:   return "DHE_RSA_WITH_AES_128_CBC_SHA256";
			case 0xC09E: return "DHE_RSA_WITH_AES_128_CCM";
			case 0xC0A2: return "DHE_RSA_WITH_AES_128_CCM_8";
			case 0x9E:   return "DHE_RSA_WITH_AES_128_GCM_SHA256";
			case 0x6B:   return "DHE_RSA_WITH_AES_256_CBC_SHA256";
			case 0xC09F: return "DHE_RSA_WITH_AES_256_CCM";
			case 0xC0A3: return "DHE_RSA_WITH_AES_256_CCM_8";
			case 0x9F:   return "DHE_RSA_WITH_AES_256_GCM_SHA384";
			case 0xC044: return "DHE_RSA_WITH_ARIA_128_CBC_SHA256";
			case 0xC052: return "DHE_RSA_WITH_ARIA_128_GCM_SHA256";
			case 0xC045: return "DHE_RSA_WITH_ARIA_256_CBC_SHA384";
			case 0xC053: return "DHE_RSA_WITH_ARIA_256_GCM_SHA384";
			case 0xBE:   return "DHE_RSA_WITH_CAMELLIA_128_CBC_SHA256";
			case 0xC07C: return "DHE_RSA_WITH_CAMELLIA_128_GCM_SHA256";
			case 0xC4:   return "DHE_RSA_WITH_CAMELLIA_256_CBC_SHA256";
			case 0xC07D: return "DHE_RSA_WITH_CAMELLIA_256_GCM_SHA384";
			case 0xCCAA: return "DHE_RSA_WITH_CHACHA20_POLY1305_SHA256";
			case 0xC023: return "ECDHE_ECDSA_WITH_AES_128_CBC_SHA256";
			case 0xC0AC: return "ECDHE_ECDSA_WITH_AES_128_CCM";
			case 0xC0AE: return "ECDHE_ECDSA_WITH_AES_128_CCM_8";
			case 0xC02B: return "ECDHE_ECDSA_WITH_AES_128_GCM_SHA256";
			case 0xC024: return "ECDHE_ECDSA_WITH_AES_256_CBC_SHA384";
			case 0xC0AD: return "ECDHE_ECDSA_WITH_AES_256_CCM";
			case 0xC0AF: return "ECDHE_ECDSA_WITH_AES_256_CCM_8";
			case 0xC02C: return "ECDHE_ECDSA_WITH_AES_256_GCM_SHA384";
			case 0xC048: return "ECDHE_ECDSA_WITH_ARIA_128_CBC_SHA256";
			case 0xC05C: return "ECDHE_ECDSA_WITH_ARIA_128_GCM_SHA256";
			case 0xC049: return "ECDHE_ECDSA_WITH_ARIA_256_CBC_SHA384";
			case 0xC05D: return "ECDHE_ECDSA_WITH_ARIA_256_GCM_SHA384";
			case 0xC072: return "ECDHE_ECDSA_WITH_CAMELLIA_128_CBC_SHA256";
			case 0xC086: return "ECDHE_ECDSA_WITH_CAMELLIA_128_GCM_SHA256";
			case 0xC073: return "ECDHE_ECDSA_WITH_CAMELLIA_256_CBC_SHA384";
			case 0xC087: return "ECDHE_ECDSA_WITH_CAMELLIA_256_GCM_SHA384";
			case 0xCCA9: return "ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256";
			case 0xC027: return "ECDHE_RSA_WITH_AES_128_CBC_SHA256";
			case 0xC02F: return "ECDHE_RSA_WITH_AES_128_GCM_SHA256";
			case 0xC028: return "ECDHE_RSA_WITH_AES_256_CBC_SHA384";
			case 0xC030: return "ECDHE_RSA_WITH_AES_256_GCM_SHA384";
			case 0xC04C: return "ECDHE_RSA_WITH_ARIA_128_CBC_SHA256";
			case 0xC060: return "ECDHE_RSA_WITH_ARIA_128_GCM_SHA256";
			case 0xC04D: return "ECDHE_RSA_WITH_ARIA_256_CBC_SHA384";
			case 0xC061: return "ECDHE_RSA_WITH_ARIA_256_GCM_SHA384";
			case 0xC076: return "ECDHE_RSA_WITH_CAMELLIA_128_CBC_SHA256";
			case 0xC08A: return "ECDHE_RSA_WITH_CAMELLIA_128_GCM_SHA256";
			case 0xC077: return "ECDHE_RSA_WITH_CAMELLIA_256_CBC_SHA384";
			case 0xC08B: return "ECDHE_RSA_WITH_CAMELLIA_256_GCM_SHA384";
			case 0xCCA8: return "ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256";
			case 0xC025: return "ECDH_ECDSA_WITH_AES_128_CBC_SHA256";
			case 0xC02D: return "ECDH_ECDSA_WITH_AES_128_GCM_SHA256";
			case 0xC026: return "ECDH_ECDSA_WITH_AES_256_CBC_SHA384";
			case 0xC02E: return "ECDH_ECDSA_WITH_AES_256_GCM_SHA384";
			case 0xC04A: return "ECDH_ECDSA_WITH_ARIA_128_CBC_SHA256";
			case 0xC05E: return "ECDH_ECDSA_WITH_ARIA_128_GCM_SHA256";
			case 0xC04B: return "ECDH_ECDSA_WITH_ARIA_256_CBC_SHA384";
			case 0xC05F: return "ECDH_ECDSA_WITH_ARIA_256_GCM_SHA384";
			case 0xC074: return "ECDH_ECDSA_WITH_CAMELLIA_128_CBC_SHA256";
			case 0xC088: return "ECDH_ECDSA_WITH_CAMELLIA_128_GCM_SHA256";
			case 0xC075: return "ECDH_ECDSA_WITH_CAMELLIA_256_CBC_SHA384";
			case 0xC089: return "ECDH_ECDSA_WITH_CAMELLIA_256_GCM_SHA384";
			case 0xC029: return "ECDH_RSA_WITH_AES_128_CBC_SHA256";
			case 0xC031: return "ECDH_RSA_WITH_AES_128_GCM_SHA256";
			case 0xC02A: return "ECDH_RSA_WITH_AES_256_CBC_SHA384";
			case 0xC032: return "ECDH_RSA_WITH_AES_256_GCM_SHA384";
			case 0xC04E: return "ECDH_RSA_WITH_ARIA_128_CBC_SHA256";
			case 0xC062: return "ECDH_RSA_WITH_ARIA_128_GCM_SHA256";
			case 0xC04F: return "ECDH_RSA_WITH_ARIA_256_CBC_SHA384";
			case 0xC063: return "ECDH_RSA_WITH_ARIA_256_GCM_SHA384";
			case 0xC078: return "ECDH_RSA_WITH_CAMELLIA_128_CBC_SHA256";
			case 0xC08C: return "ECDH_RSA_WITH_CAMELLIA_128_GCM_SHA256";
			case 0xC079: return "ECDH_RSA_WITH_CAMELLIA_256_CBC_SHA384";
			case 0xC08D: return "ECDH_RSA_WITH_CAMELLIA_256_GCM_SHA384";
			case 0x3C:   return "RSA_WITH_AES_128_CBC_SHA256";
			case 0xC09C: return "RSA_WITH_AES_128_CCM";
			case 0xC0A0: return "RSA_WITH_AES_128_CCM_8";
			case 0x9C:   return "RSA_WITH_AES_128_GCM_SHA256";
			case 0x3D:   return "RSA_WITH_AES_256_CBC_SHA256";
			case 0xC09D: return "RSA_WITH_AES_256_CCM";
			case 0xC0A1: return "RSA_WITH_AES_256_CCM_8";
			case 0x9D:   return "RSA_WITH_AES_256_GCM_SHA384";
			case 0xC03C: return "RSA_WITH_ARIA_128_CBC_SHA256";
			case 0xC050: return "RSA_WITH_ARIA_128_GCM_SHA256";
			case 0xC03D: return "RSA_WITH_ARIA_256_CBC_SHA384";
			case 0xC051: return "RSA_WITH_ARIA_256_GCM_SHA384";
			case 0xBA:   return "RSA_WITH_CAMELLIA_128_CBC_SHA256";
			case 0xC07A: return "RSA_WITH_CAMELLIA_128_GCM_SHA256";
			case 0xC0:   return "RSA_WITH_CAMELLIA_256_CBC_SHA256";
			case 0xC07B: return "RSA_WITH_CAMELLIA_256_GCM_SHA384";
			case 0xC00A: return "ECDHE_ECDSA_WITH_AES_256_CBC_SHA";
			case 0x39:   return "DHE_RSA_WITH_AES_256_CBC_SHA";
			case 0xC014: return "ECDHE_RSA_WITH_AES_256_CBC_SHA";
			case 0x88:   return "DHE_RSA_WITH_CAMELLIA_256_CBC_SHA";
			case 0xC009: return "ECDHE_ECDSA_WITH_AES_128_CBC_SHA";
			case 0xC013: return "ECDHE_RSA_WITH_AES_128_CBC_SHA";
			case 0x33:   return "DHE_RSA_WITH_AES_128_CBC_SHA";
			case 0x45:   return "DHE_RSA_WITH_CAMELLIA_128_CBC_SHA";
			case 0xC005: return "ECDH_ECDSA_WITH_AES_256_CBC_SHA";
			case 0xC00F: return "ECDH_RSA_WITH_AES_256_CBC_SHA";
			case 0xC004: return "ECDH_ECDSA_WITH_AES_128_CBC_SHA";
			case 0xC00E: return "ECDH_RSA_WITH_AES_128_CBC_SHA";
			case 0x35:   return "RSA_WITH_AES_256_CBC_SHA";
			case 0x84:   return "RSA_WITH_CAMELLIA_256_CBC_SHA";
			case 0x2F:   return "RSA_WITH_AES_128_CBC_SHA";
			case 0x41:   return "RSA_WITH_CAMELLIA_128_CBC_SHA";
			case 0xC007: return "ECDHE_ECDSA_WITH_RC4_128_SHA";
			case 0xC011: return "ECDHE_RSA_WITH_RC4_128_SHA";
			case 0xC008: return "ECDHE_ECDSA_WITH_3DES_EDE_CBC_SHA";
			case 0xC012: return "ECDHE_RSA_WITH_3DES_EDE_CBC_SHA";
			case 0x16:   return "DHE_RSA_WITH_3DES_EDE_CBC_SHA";
			case 0xC002: return "ECDH_ECDSA_WITH_RC4_128_SHA";
			case 0xC00C: return "ECDH_RSA_WITH_RC4_128_SHA";
			case 0xC003: return "ECDH_ECDSA_WITH_3DES_EDE_CBC_SHA";
			case 0xC00D: return "ECDH_RSA_WITH_3DES_EDE_CBC_SHA";
			case 0x0A:   return "RSA_WITH_3DES_EDE_CBC_SHA";
			case 0x05:   return "RSA_WITH_RC4_128_SHA";
			case 0x04:   return "RSA_WITH_RC4_128_MD5";
			default: return "(Unknown ciphersuite value: " + cs + ")";
		}
	};

	const _GetCountryName = function(countryCode) {
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
			case "JO": return "Hashemite Kingdom of Jordan";
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
			case "LT": return "Republic of Lithuania";
			case "MD": return "Republic of Moldova";
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
			case "TL": return "Democratic Republic of Timor-Leste";
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

	const _ParseUinfo = function(browseData) {
		_userLevel = browseData[0] & 3;

		for (let i = 0; i < 4; i++) {
			if (i === _userLevel) {
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
		for (let i = 0; i < (browseData[0] >> 3); i++) {
			const hash = browseData.slice(offset, offset + 8);
			const accExt = (browseData[offset + 8] & _AEM_ADDR_FLAG_ACCEXT) !== 0;
			const accInt = (browseData[offset + 8] & _AEM_ADDR_FLAG_ACCINT) !== 0;
			const is_shd = (browseData[offset + 8] & _AEM_ADDR_FLAG_SHIELD) !== 0;

			_userAddress.push(new _NewAddress(hash, null, is_shd, accExt, accInt));
			offset += 9;
		}

		// Private field
		const privNonce = browseData.slice(offset, offset + sodium.crypto_secretbox_NONCEBYTES);
		const privData_enc = browseData.slice(offset + sodium.crypto_secretbox_NONCEBYTES, offset + _AEM_LEN_PRIVATE);

		let privData = "0";
		privData_enc.forEach(function(n) {
			if (n !== 0) {
				privData = null;
				return;
			}
		});

		if (privData === "0") return offset + _AEM_LEN_PRIVATE; // All zeroes = newly created, no data

		try {privData = sodium.crypto_secretbox_open_easy(privData_enc, privNonce, _userKeySymmetric);}
		catch(e) {return -(offset + _AEM_LEN_PRIVATE);}

		offset += _AEM_LEN_PRIVATE;

		// Private - Address data
		for (let i = 0; i < privData[0]; i++) {
			const start = 1 + (i * 18);
			const hash = privData.slice(start, start + 8);
			const addr32 = privData.slice(start + 8, start + 18);

			for (let j = 0; j < _userAddress.length; j++) {
				let wasFound = true;

				for (let k = 0; k < 8; k ++) {
					if (hash[k] !== _userAddress[j].hash[k]) {
						wasFound = false;
						break;
					}
				}

				if (wasFound) {
					_userAddress[j].addr32 = addr32;
					break;
				}
			}
		}

		// Private - Contacts
		let privOffset = 1 + (privData[0] * 18);
		const contactCount = privData[privOffset];
		privOffset++;

		for (let i = 0; i < contactCount; i++) {
			let con = privData.slice(privOffset);
			let end = con.indexOf(10); // 10=LF
			if (end === -1) break;
			_contactMail[i] = sodium.to_string(con.slice(0, end));
			privOffset += end + 1;

			con = privData.slice(privOffset);
			end = con.indexOf(10);
			if (end === -1) break;
			_contactName[i] = sodium.to_string(con.slice(0, end));
			privOffset += end + 1;

			con = privData.slice(privOffset);
			end = con.indexOf(10);
			if (end === -1) break;
			_contactNote[i] = sodium.to_string(con.slice(0, end));
			privOffset += end + 1;
		}

		return offset;
	};

	const _AddOutMsg = function(msgData, validPad, validSig, msgId, msgTs, msgTs_bin, newest) {
		const lenSb = msgData[0] & 127;

		let newMsg;

		if ((msgData[0] & 128) === 0) { // Email
			const msgIp = msgData.slice(1, 5);
			const msgCs = new Uint16Array(msgData.slice(5, 7).buffer)[0];
			const msgTlsVer = msgData[7] >> 5;
			const msgAttach = msgData[7] & 31;
			// msgData[8]: TLS_InfoByte

			const lenTo = msgData[9];
			const lenFr = msgData[10];
			const lenMx = msgData[11];
			const lenGr = msgData[12];

			let os = 13;
			const msgTo = sodium.to_string(msgData.slice(os, os + lenTo)); os += lenTo;
			const msgFr = sodium.to_string(msgData.slice(os, os + lenFr)); os += lenFr;
			const msgMx = sodium.to_string(msgData.slice(os, os + lenMx)); os += lenMx;
			const msgGr = sodium.to_string(msgData.slice(os, os + lenGr)); os += lenGr;
			const msgSb = sodium.to_string(msgData.slice(os, os + lenSb)); os += lenSb;
			const msgBd = sodium.to_string(msgData.slice(os));

			newMsg = new _NewOutMsg_Ext(validPad, validSig, msgId, msgTs, msgIp, msgTo, msgFr, msgSb, msgBd, msgMx, msgGr, msgCs, msgTlsVer, msgAttach);
		} else { // Internal message
			const isE2ee       = (msgData[1] & 64) !== 0;
			const isFromShield = (msgData[1] &  8) !== 0;
			const isToShield   = (msgData[1] &  4) !== 0;

			const msgFr = _addr32_decode(msgData.slice(2, 12), isFromShield);
			const msgTo = _addr32_decode(msgData.slice(12, 22), isToShield);

			let msgBin;
			if (isE2ee) {
				const nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
				nonce.fill(0);
				nonce.set(msgTs_bin);

				const addr32_from = msgData.slice(2, 12);
				const recv_pubkey = msgData.slice(22, 22 + sodium.crypto_kx_PUBLICKEYBYTES);

				const kxKeys = sodium.crypto_kx_seed_keypair(sodium.crypto_generichash(sodium.crypto_kx_SEEDBYTES, addr32_from, _userKeyKxHash));
				const sessionKeys = sodium.crypto_kx_client_session_keys(kxKeys.publicKey, kxKeys.privateKey, recv_pubkey);

				msgBin = msgData.slice(22 + sodium.crypto_kx_PUBLICKEYBYTES);
				msgBin = sodium.crypto_secretbox_open_easy(msgBin, nonce, sessionKeys.sharedTx);
			} else {
				msgBin = msgData.slice(22);
			}

			msgBin = sodium.to_string(msgBin);
			const msgSb = msgBin.slice(0, lenSb);
			const msgBd = msgBin.slice(lenSb);

			newMsg = new _NewOutMsg_Int(validPad, validSig, msgId, msgTs, isE2ee, msgTo, msgFr, msgSb, msgBd);
		}

		if (newest) {
			_outMsg.unshift(newMsg);
		} else {
			_outMsg.push(newMsg);
		}
	};

// Public
	this.Reset = function() {
		_maxStorage.splice(0);
		_maxNormalA.splice(0);
		_maxShieldA.splice(0);
		_userLevel = 0;
		_userAddress.splice(0);

		_extMsg.splice(0);
		_intMsg.splice(0);
		_uplMsg.splice(0);
		_outMsg.splice(0);

		_contactMail.splice(0);
		_contactName.splice(0);
		_contactNote.splice(0);

		_admin_userPkHex.splice(0);
		_admin_userSpace.splice(0);
		_admin_userNaddr.splice(0);
		_admin_userSaddr.splice(0);
		_admin_userLevel.splice(0);

		if (_userKeyPublic) sodium.memzero(_userKeyPublic);
		if (_userKeySecret) sodium.memzero(_userKeySecret);
		if (_userKeyKxHash) sodium.memzero(_userKeyKxHash);
		if (_userKeySymmetric) sodium.memzero(_userKeySymmetric);

		_userKeySecret = null;
		_userKeyPublic = null;
		_userKeyKxHash = null;
		_userKeySymmetric = null;

		_totalMsgCount = 0;
		_totalMsgBytes = 0;
		_readyMsgBytes = 0;
	};

	this.GetDomainApi = function() {return _AEM_DOMAIN_API;};
	this.GetDomainEml = function() {return _AEM_DOMAIN_EML;};
	this.GetLevelMax = function() {return _AEM_USER_MAXLEVEL;};
	this.GetAddrPerUser = function() {return _AEM_ADDRESSES_PER_USER;};

	this.GetAddress = function(num) {return _addr32_decode(_userAddress[num].addr32, _userAddress[num].is_shd);};
	this.GetAddressAccExt = function(num) {return _userAddress[num].accExt;};
	this.GetAddressAccInt = function(num) {return _userAddress[num].accInt;};

	this.SetAddressAccExt = function(num, val) {_userAddress[num].accExt = val;};
	this.SetAddressAccInt = function(num, val) {_userAddress[num].accInt = val;};

	this.GetAddressCount = function() {return _userAddress.length;};
	this.GetAddressCountNormal = function() {return _GetAddressCount(false);};
	this.GetAddressCountShield = function() {return _GetAddressCount(true);};

	this.IsUserAdmin = function() {return (_userLevel === _AEM_USER_MAXLEVEL);};
	this.GetUserPkHex = function() {return sodium.to_hex(_userKeyPublic);};
	this.GetUserLevel = function() {return _userLevel;};
	this.GetLimitStorage = function(lvl) {return _maxStorage[lvl];};
	this.GetLimitNormalA = function(lvl) {return _maxNormalA[lvl];};
	this.GetLimitShieldA = function(lvl) {return _maxShieldA[lvl];};

	this.GetTotalMsgCount = function() {return _totalMsgCount;};
	this.GetTotalMsgBytes = function() {return _totalMsgBytes;};
	this.GetReadyMsgBytes = function() {return _readyMsgBytes;};

	this.GetExtMsgCount = function() {return _extMsg.length;};
	this.GetExtMsgIdHex   = function(num) {return sodium.to_hex(_extMsg[num].id);};
	this.GetExtMsgTime    = function(num) {return _extMsg[num].ts;};
	this.GetExtMsgHdrTime = function(num) {return _extMsg[num].hdrTs;};
	this.GetExtMsgHdrTz   = function(num) {return _extMsg[num].hdrTz;};
	this.GetExtMsgTLS     = function(num) {return (_extMsg[num].cs === 0) ? "" : "TLS v1." + (_extMsg[num].tls & 3) + " " + _GetCiphersuite(_extMsg[num].cs);};
	this.GetExtMsgIp      = function(num) {return String(_extMsg[num].ip[0] + "." + _extMsg[num].ip[1] + "." + _extMsg[num].ip[2] + "." + _extMsg[num].ip[3]);};
	this.GetExtMsgDkim    = function(num) {return _extMsg[num].dkim;};
	this.GetExtMsgGreet   = function(num) {return _extMsg[num].greet;};
	this.GetExtMsgRdns    = function(num) {return _extMsg[num].rdns;};
	this.GetExtMsgCcode   = function(num) {return _extMsg[num].countryCode;};
	this.GetExtMsgCname   = function(num) {return _GetCountryName(_extMsg[num].countryCode);};
	this.GetExtMsgEnvFrom = function(num) {return _extMsg[num].envFrom;};
	this.GetExtMsgHdrFrom = function(num) {return _extMsg[num].hdrFrom;};
	this.GetExtMsgDnFrom  = function(num) {return _extMsg[num].dnFrom;};
	this.GetExtMsgHdrRt   = function(num) {return _extMsg[num].hdrRt;};
	this.GetExtMsgDnRt    = function(num) {return _extMsg[num].dnRt;};
	this.GetExtMsgDnTo    = function(num) {return _extMsg[num].dnTo;};
	this.GetExtMsgEnvTo   = function(num) {return _extMsg[num].envTo;};
	this.GetExtMsgHdrTo   = function(num) {return _extMsg[num].hdrTo;};
	this.GetExtMsgHdrId   = function(num) {return _extMsg[num].hdrId;};
	this.GetExtMsgHeaders = function(num) {return _extMsg[num].headers;};
	this.GetExtMsgTitle   = function(num) {return _extMsg[num].subj;};
	this.GetExtMsgBody    = function(num) {
		let html = _extMsg[num].body.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").split("\r").reverse().join("<br><hr>");

		// Links
		while(1) {
			const begin = html.indexOf("\x11");
			if (begin === -1) break;
			const end = html.slice(begin).indexOf("\x12");
			if (end === -1) break;

			let linkDomain = html.slice(begin + 1);
			linkDomain = linkDomain.slice(0, linkDomain.indexOf("\x12"));

			let secure = false;
			if (linkDomain.startsWith("https://")) {
				secure = true;
				linkDomain = linkDomain.slice(8);
			} else if (linkDomain.startsWith("http://")) {
				linkDomain = linkDomain.slice(7);
			} else {
				html = html.replace("\x11", "").replace("\x12", "");
				continue;
			}

			const domainEnd = linkDomain.search("[/?]");
			if (domainEnd !== -1) linkDomain = linkDomain.slice(0, domainEnd);

			html = html.replace("\x11", "<a href=\"").replace("\x12", "\">" + (secure? "🔒&NoBreak;" : "🔗&NoBreak;") + linkDomain + "</a> ");
		}

		// Images
		while(1) {
			const begin = html.indexOf("\x13");
			if (begin === -1) break;
			const end = html.slice(begin).indexOf("\x14");
			if (end === -1) break;

			let linkDomain = html.slice(begin + 1);
			linkDomain = linkDomain.slice(0, linkDomain.indexOf("\x14"));

			let secure = false;
			if (linkDomain.startsWith("https://")) {
				secure = true;
				linkDomain = linkDomain.slice(8);
			} else if (linkDomain.startsWith("http://")) {
				linkDomain = linkDomain.slice(7);
			} else {
				html = html.replace("\x13", "").replace("\x14", "");
				continue;
			}

			const domainEnd = linkDomain.search("[/?]");
			if (domainEnd !== -1) linkDomain = linkDomain.slice(0, domainEnd);

			html = html.replace("\x13", "<a href=\"").replace("\x14", "\">" + (secure? "🖼&NoBreak;" : "👁&NoBreak;") + linkDomain + "</a> ");
		}

		return html;
	};

	this.GetExtMsgFlagVPad = function(num) {return _extMsg[num].validPad;};
	this.GetExtMsgFlagVSig = function(num) {return _extMsg[num].validSig;};
	this.GetExtMsgFlagPExt = function(num) {return _extMsg[num].esmtp;};
	this.GetExtMsgFlagQuit = function(num) {return _extMsg[num].quitR;};
	this.GetExtMsgFlagRare = function(num) {return _extMsg[num].rares;};
	this.GetExtMsgFlagFail = function(num) {return _extMsg[num].inval;};
	this.GetExtMsgFlagPErr = function(num) {return _extMsg[num].protV;};
	this.GetExtMsgFlagGrDm = function(num) {return _extMsg[num].greetDomainIp;};
	this.GetExtMsgFlagIpBl = function(num) {return _extMsg[num].ipBlacklisted;};
	this.GetExtMsgFlagDkFl = function(num) {return _extMsg[num].dkimFail;};

	this.GetExtMsgTlsDomain = function(num) {
		if (_extMsg[num].tls & _AEM_EMAIL_CERT_MATCH_HDRFR && _extMsg[num].hdrFrom) return _extMsg[num].hdrFrom.split("@")[1];
		if (_extMsg[num].tls & _AEM_EMAIL_CERT_MATCH_ENVFR && _extMsg[num].envFrom) return _extMsg[num].envFrom.split("@")[1];
		if (_extMsg[num].tls & _AEM_EMAIL_CERT_MATCH_GREET && _extMsg[num].greet)   return _extMsg[num].greet;
	};

	this.GetExtMsgTls_CertType = function(num) {
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

	this.ExportExtMsg = function(num) {
		return "Received: from " + _extMsg[num].greet +" (" + this.GetExtMsgRdns(num) + " [" + this.GetExtMsgIp(num) + "])"
			+ " by " + _AEM_DOMAIN_EML
			+ " with " + (_extMsg[num].esmtp ? "E" : "") + "SMTP" + (_extMsg[num].tls ? "S" : "")
			+ " id " + sodium.to_base64(_extMsg[num].id, sodium.base64_variants.URLSAFE_NO_PADDING)
			+ " for <" + _extMsg[num].envTo + ">; "
			+ new Date(_extMsg[num].ts * 1000).toUTCString().slice(0, 26) + "+0000" // TODO: Preserve timezone info
		+ "\r\nContent-Transfer-Encoding: 8bit"
		+ "\r\nContent-Type: text/plain; charset=utf-8"
		+ "\r\nDate: " + new Date((_extMsg[num].ts + _extMsg[num].hdrTs) * 1000).toUTCString().slice(0, 26) + "+0000" // TODO: Preserve timezone info
		+ "\r\nFrom: " + (_extMsg[num].dnFrom ? ("\"" + _extMsg[num].dnFrom + "\" <" + _extMsg[num].hdrFrom + ">") : _extMsg[num].hdrFrom)
		+ "\r\nMIME-Version: 1.0"
		+ (_extMsg[num].hdrId? ("\r\nMessage-ID: <" + _extMsg[num].hdrId + ">") : "")
		+ (_extMsg[num].hdrRt? ("\r\nReply-To: " + (_extMsg[num].dnRt ? ("\"" + _extMsg[num].dnRt + "\" <" + _extMsg[num].hdrRt + ">") : _extMsg[num].hdrRt)) : "")
		+ "\r\nReturn-Path: <" + _extMsg[num].envFrom + ">"
		+ "\r\nSubject: " + _extMsg[num].subj
		+ "\r\nTo: " + (_extMsg[num].dnTo ? ("\"" + _extMsg[num].dnTo + "\" <" + _extMsg[num].hdrTo + ">") : _extMsg[num].hdrTo)
		+ "\r\n" + _extMsg[num].headers.replaceAll("\n", "\r\n")
		+ "\r\n\r\n" + _extMsg[num].body.replaceAll("\n", "\r\n")
		+ "\r\n";
	};

	this.ExportIntMsg = function(num) {
		return "Content-Transfer-Encoding: 8bit"
		+ "\r\nContent-Type: text/plain; charset=utf-8"
		+ "\r\nDate: " + new Date(_intMsg[num].ts * 1000).toUTCString().slice(0, 26) + "+0000"
		+ "\r\nFrom: " + _intMsg[num].from + "@" + _AEM_DOMAIN_EML
		+ "\r\nMIME-Version: 1.0"
		+ "\r\nMessage-ID: <" + sodium.to_hex(_intMsg[num].id) + "@int." + _AEM_DOMAIN_EML + ">"
		+ "\r\nSubject: " + _intMsg[num].title
		+ (_intMsg[num].to? ("\r\nTo: " + _intMsg[num].to + "@" + _AEM_DOMAIN_EML) : "")
		+ "\r\n\r\n" + _intMsg[num].body.replaceAll("\n", "\r\n")
		+ "\r\n";
	};

	this.GetExtMsgReplyAddress = function(num) {
		if (_extMsg[num].hdrRt)   return _extMsg[num].hdrRt;
		if (_extMsg[num].hdrFrom) return _extMsg[num].hdrFrom;
		if (_extMsg[num].envFrom) return _extMsg[num].envFrom;
		return null;
	};

	this.GetIntMsgCount = function() {return _intMsg.length;};
	this.GetIntMsgIdHex  = function(num) {return _intMsg[num].id? sodium.to_hex(_intMsg[num].id) : null;};
	this.GetIntMsgTime   = function(num) {return _intMsg[num].ts;};
	this.GetIntMsgLevel  = function(num) {return _intMsg[num].fromLv;};
	this.GetIntMsgFromPk = function(num) {return _intMsg[num].fromPk? sodium.to_base64(_intMsg[num].fromPk, sodium.base64_variants.ORIGINAL_NO_PADDING) : "";};
	this.GetIntMsgFrom   = function(num) {return _intMsg[num].from;};
	this.GetIntMsgTo     = function(num) {return _intMsg[num].to;};
	this.GetIntMsgTitle  = function(num) {return _intMsg[num].title;};
	this.GetIntMsgBody   = function(num) {return _intMsg[num].body;};

	this.GetIntMsgFlagVPad = function(num) {return _intMsg[num].validPad;};
	this.GetIntMsgFlagVSig = function(num) {return _intMsg[num].validSig;};
	this.GetIntMsgFlagE2ee = function(num) {return _intMsg[num].isE2ee;};

	this.GetUplMsgCount = function() {return _uplMsg.length;};
	this.GetUplMsgIdHex = function(num) {return _uplMsg[num].id? sodium.to_hex(_uplMsg[num].id) : null;};
	this.GetUplMsgTime  = function(num) {return _uplMsg[num].ts;};
	this.GetUplMsgTitle = function(num) {return _uplMsg[num].title;};
	this.GetUplMsgBody  = function(num) {return _uplMsg[num].body;};
	this.GetUplMsgBytes = function(num) {return _uplMsg[num].blocks * 16;};
	this.GetUplMsgType  = function(num) {return _GetFileType(_uplMsg[num].title);};
	this.GetUplMsgParent = function(num) {
		for (let i = 0; i < _extMsg.length; i++) {
			if (_arraysEqual(_uplMsg[num].parent), _extMsg[num].id) {
				return i;
			}
		}

		return null;
	};

	this.GetOutMsgCount = function() {return _outMsg.length;};
	this.GetOutMsgIdHex = function(num) {return sodium.to_hex(_outMsg[num].id);};
	this.GetOutMsgIsInt = function(num) {return _outMsg[num].isInt;};
	this.GetOutMsgTime = function(num) {return _outMsg[num].ts;};
	this.GetOutMsgIp   = function(num) {return String(_outMsg[num].ip[0] + "." + _outMsg[num].ip[1] + "." + _outMsg[num].ip[2] + "." + _outMsg[num].ip[3]);};
	this.GetOutMsgTo   = function(num) {return _outMsg[num].to;};
	this.GetOutMsgFrom = function(num) {return _outMsg[num].from;};
	this.GetOutMsgSubj = function(num) {return _outMsg[num].subj;};
	this.GetOutMsgBody = function(num) {return _outMsg[num].body;};
	this.GetOutMsgMxDom = function(num) {return _outMsg[num].mxDom;};
	this.GetOutMsgGreet = function(num) {return _outMsg[num].greet;};
	this.GetOutMsgTLS   = function(num) {return (_outMsg[num].tlsCs === 0) ? "" : "TLS v1." + _outMsg[num].tlsVer + " " + _GetCiphersuite(_outMsg[num].tlsCs);};
	this.GetOutMsgAttach = function(num) {return _outMsg[num].attach;};

	this.GetOutMsgFlagE2ee = function(num) {return _outMsg[num].isE2ee;};
	this.GetOutMsgFlagVPad = function(num) {return _outMsg[num].validPad;};
	this.GetOutMsgFlagVSig = function(num) {return _outMsg[num].validSig;};

	this.Admin_GetUserCount = function() {return _admin_userPkHex.length;};
	this.Admin_GetUserPkHex = function(num) {return _admin_userPkHex[num];};
	this.Admin_GetUserSpace = function(num) {return _admin_userSpace[num];};
	this.Admin_GetUserNAddr = function(num) {return _admin_userNaddr[num];};
	this.Admin_GetUserSAddr = function(num) {return _admin_userSaddr[num];};
	this.Admin_GetUserLevel = function(num) {return _admin_userLevel[num];};

	this.GetContactCount = function() {return _contactMail.length;};
	this.GetContactMail = function(num) {return _contactMail[num];};
	this.GetContactName = function(num) {return _contactName[num];};
	this.GetContactNote = function(num) {return _contactNote[num];};

	this.AddContact = function(mail, name, note) {
		_contactMail.push(mail);
		_contactName.push(name);
		_contactNote.push(note);
	};

	this.DeleteContact = function(index) {
		_contactMail.splice(index, 1);
		_contactName.splice(index, 1);
		_contactNote.splice(index, 1);
	};

	this.SetKeys = function(skey_hex, callback) {
		if (!skey_hex || typeof(skey_hex) !== "string" || skey_hex.length !== sodium.crypto_box_SECRETKEYBYTES * 2) {
			callback(false);
			return;
		}

		const boxSeed = sodium.crypto_kdf_derive_from_key(sodium.crypto_box_SEEDBYTES, 1, "AEM-Usr0", sodium.from_hex(skey_hex));
		const boxKeys = sodium.crypto_box_seed_keypair(boxSeed);

		_userKeyPublic = boxKeys.publicKey;
		_userKeySecret = boxKeys.privateKey;
		_userKeyKxHash = sodium.crypto_kdf_derive_from_key(sodium.crypto_generichash_KEYBYTES, 4, "AEM-Usr0", sodium.from_hex(skey_hex));
		_userKeySymmetric = sodium.crypto_kdf_derive_from_key(sodium.crypto_secretbox_KEYBYTES, 5, "AEM-Usr0", sodium.from_hex(skey_hex));

		if (!_userKeyPublic || !_userKeySecret || !_userKeyKxHash || !_userKeySymmetric) {
			_userKeySecret = null;
			_userKeyPublic = null;
			_userKeyKxHash = null;
			_userKeySymmetric = null;
			callback(false);
			return;
		}

		callback(true);
	};

	this.Account_Browse = function(callback) {
		if (_userLevel !== _AEM_USER_MAXLEVEL) {callback(0x02); return;}

		_FetchEncrypted(_AEM_API_ACCOUNT_BROWSE, new Uint8Array([0]), function(fetchErr, browseData) {
			if (fetchErr) {callback(fetchErr); return;}

			_maxStorage.splice(0);
			_maxNormalA.splice(0);
			_maxShieldA.splice(0);

			for (let i = 0; i < 4; i++) {
				_maxStorage.push(browseData[(i * 3) + 0]);
				_maxNormalA.push(browseData[(i * 3) + 1]);
				_maxShieldA.push(browseData[(i * 3) + 2]);
			}

			let offset = 12;
			const userCount = new Uint32Array(browseData.slice(offset, offset + 4).buffer)[0];
			offset += 4;

			for (let i = 0; i < userCount; i++) {
				const s = browseData.slice(offset, offset + 35);

				const u16 = new Uint16Array(s.slice(0, 2).buffer)[0];

				const newSpace = s[2] | ((u16 >> 4) & 3840);
				const newLevel = u16 & 3;
				const newAddrN = (u16 >> 2) & 31;
				const newAddrS = (u16 >> 7) & 31;
				const newPkHex = sodium.to_hex(s.slice(3));

				_admin_userPkHex.push(newPkHex);
				_admin_userLevel.push(newLevel);
				_admin_userSpace.push(newSpace);
				_admin_userNaddr.push(newAddrN);
				_admin_userSaddr.push(newAddrS);

				offset += 35;
			}

			callback(0);
		});
	};

	this.Account_Create = function(pk_hex, callback) {
		_FetchEncrypted(_AEM_API_ACCOUNT_CREATE, sodium.from_hex(pk_hex), function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			_admin_userPkHex.push(pk_hex);
			_admin_userLevel.push(0);
			_admin_userSpace.push(0);
			_admin_userNaddr.push(0);
			_admin_userSaddr.push(0);

			callback(0);
		});
	};

	this.Account_Delete = function(pk_hex, callback) {
		_FetchEncrypted(_AEM_API_ACCOUNT_DELETE, sodium.from_hex(pk_hex), function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			let num = -1;
			for (let i = 0; i < _admin_userPkHex.length; i++) {
				if (pk_hex === _admin_userPkHex[i]) {
					num = i;
					break;
				}
			}

			if (num >= 0) {
				_admin_userPkHex.splice(num, 1);
				_admin_userLevel.splice(num, 1);
				_admin_userSpace.splice(num, 1);
				_admin_userNaddr.splice(num, 1);
				_admin_userSaddr.splice(num, 1);
			}

			callback(0);
		});
	};

	this.Account_Update = function(pk_hex, level, callback) {
		if (level < 0 || level > _AEM_USER_MAXLEVEL) {callback(0x02); return;}

		const upData = new Uint8Array(33);
		upData[0] = level;
		upData.set(sodium.from_hex(pk_hex), 1);

		_FetchEncrypted(_AEM_API_ACCOUNT_UPDATE, upData, function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			let num = -1;
			for (let i = 0; i < _admin_userPkHex.length; i++) {
				if (pk_hex === _admin_userPkHex[i]) {
					num = i;
					break;
				}
			}

			if (num >= 0)
				_admin_userLevel[num] = level;

			callback(0);
		});
	};

	this.Address_Create = function(addr, callback) {
		if (addr == "SHIELD") {
			_FetchEncrypted(_AEM_API_ADDRESS_CREATE, sodium.from_string("SHIELD"), function(fetchErr, byteArray) {
				if (fetchErr) {callback(fetchErr); return;}

				_userAddress.push(new _NewAddress(byteArray.slice(0, 8), byteArray.slice(8, 18), true, true, false));
				callback(0);
			});
		} else {
			const addr32 = _addr32_encode(addr);
			if (!addr32) {callback(0x08); return;}

			const full = sodium.crypto_pwhash(16, addr32, _AEM_SALT_NORMAL, _AEM_ARGON2_OPSLIMIT, _AEM_ARGON2_MEMLIMIT, sodium.crypto_pwhash_ALG_ARGON2ID13);
			const hash = new Uint8Array([
				full[0] ^ full[8],
				full[1] ^ full[9],
				full[2] ^ full[10],
				full[3] ^ full[11],
				full[4] ^ full[12],
				full[5] ^ full[13],
				full[6] ^ full[14],
				full[7] ^ full[15]
			]);

			_FetchEncrypted(_AEM_API_ADDRESS_CREATE, hash, function(fetchErr) {
				if (fetchErr) {callback(fetchErr); return;}

				_userAddress.push(new _NewAddress(hash, addr32, false, true, false));
				callback(0);
			});
		}
	};

	this.Address_Delete = function(num, callback) {
		_FetchEncrypted(_AEM_API_ADDRESS_DELETE, _userAddress[num].hash, function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			_userAddress.splice(num, 1);
			callback(0);
		});
	};

	this.Address_Lookup = function(addr, callback) {
		_FetchEncrypted(_AEM_API_ADDRESS_LOOKUP, sodium.from_string(addr), function(fetchErr, result) {
			callback(fetchErr? fetchErr : result);
		});
	};

	this.Address_Update = function(callback) {
		const data = new Uint8Array(_userAddress.length * 9);

		for (let i = 0; i < _userAddress.length; i++) {
			data.set(_userAddress[i].hash, (i * 9));

			let flags = 0;
			if (_userAddress[i].accExt) flags |= _AEM_ADDR_FLAG_ACCEXT;
			if (_userAddress[i].accInt) flags |= _AEM_ADDR_FLAG_ACCINT;

			data[(i * 9) + 8] = flags;
		}

		_FetchEncrypted(_AEM_API_ADDRESS_UPDATE, data, function(fetchErr) {callback(fetchErr);});
	};

	this.Message_Browse = function(newest, u_info, callback) {
		if (typeof(newest) !== "boolean" || typeof(u_info) !== "boolean") {callback(0x01); return;}

		let fetchId;
		if (_extMsg.length > 0 || _intMsg.length > 0 || _uplMsg.length > 0 || _outMsg.length > 0) {
			fetchId = new Uint8Array(17);
			fetchId[0] = 0;
			if (newest) fetchId[0] |= _AEM_FLAG_NEWER;
			if (u_info) fetchId[0] |= _AEM_FLAG_UINFO;
			fetchId.set(newest? _GetNewestMsgId() : _GetOldestMsgId(), 1);
		} else fetchId = new Uint8Array([u_info? _AEM_FLAG_UINFO : 0]);

		let privateFail = false;
		_FetchEncrypted(_AEM_API_MESSAGE_BROWSE, fetchId, function(fetchErr, browseData) {
			if (fetchErr !== 0) {callback(fetchErr); return;}

			if (u_info) {
				if (browseData.length < 1000) {callback(0x07); return;}
				const uinfo_bytes = _ParseUinfo(browseData);
				browseData = browseData.slice(Math.abs(uinfo_bytes));
				if (uinfo_bytes < 0) privateFail = true;
			}

			if (browseData.length <= 6) {callback(0); return;} // No messages or error getting messages

			_totalMsgCount = new Uint16Array(browseData.slice(0, 2).buffer)[0];
			_totalMsgBytes = new Uint32Array(browseData.slice(2, 6).buffer)[0] * 16;

			let offset = 6;

			while (offset < browseData.length) {
				const msgBytes = (new Uint16Array(browseData.slice(offset, offset + 2).buffer)[0] + _AEM_MSG_MINBLOCKS) * 16;
				offset += 2;

				const msgEnc = browseData.slice(offset, offset + msgBytes);

				const msgId = msgEnc.slice(0, 16);
				if (_MsgExists(msgId)) {
					offset += msgBytes;
					continue;
				}

				_readyMsgBytes += msgBytes;

				let msgData;
				try {msgData = sodium.crypto_box_seal_open(msgEnc, _userKeyPublic, _userKeySecret);}
				catch(e) {
					_intMsg.push(new _NewIntMsg(true, true, msgId, Date.now() / 1000, false, 3, null, "system", "", "(error)", e));
					offset += msgBytes;
					continue;
				}

				const msgInfo = msgData[0];
				const padAmount = msgInfo & 15;

				const padA = msgData.slice(msgData.length - sodium.crypto_sign_BYTES - padAmount, msgData.length - sodium.crypto_sign_BYTES);
				const padB = sodium.randombytes_buf_deterministic(padAmount, msgData.slice(0, 32), null); // 32=sodium.randombytes_SEEDBYTES
				const validPad = (padA && padB && padA.length === padB.length && _arraysEqual(padA, padB));
				const validSig = sodium.crypto_sign_verify_detached(msgData.slice(msgData.length - sodium.crypto_sign_BYTES), msgData.slice(0, msgData.length - sodium.crypto_sign_BYTES), _AEM_SIG_PUBKEY);

				const msgTs = new Uint32Array(msgData.slice(1, 5).buffer)[0];
				const msgTs_bin = msgData.slice(1, 5);

				msgData = msgData.slice(5, msgData.length - padAmount - sodium.crypto_sign_BYTES);

				switch (msgInfo & 48) {
					case 0: { // ExtMsg
						const msgIp = msgData.slice(0, 4);
						const msgCs  = new Uint16Array(msgData.slice(4, 6).buffer)[0];
						const msgTls = msgData[6];

						const dkimCount = msgData[7] >> 5;
						const msgAttach = msgData[7] & 31;

						const msgEsmtp = (msgData[8]  & 128) !== 0;
						const msgQuitR = (msgData[8]  &  64) !== 0;
						const msgProtV = (msgData[8]  &  32) !== 0;
						const msgInval = (msgData[9] & 128) !== 0;
						const msgRares = (msgData[9] &  64) !== 0;
						const msgGrDom = (msgData[9] &  32) !== 0;
						const msgSpf   = (msgData[10] & 192);
						const dkimFail = (msgData[10] &  32) !== 0;
						const lenEnvTo =  msgData[10] &  31;
						const msgDmarc = (msgData[11] & 192);
						const lenHdrTo =  msgData[11] &  63;
						const msgDnSec = (msgData[12] & 128) !== 0;
						const lenGreet =  msgData[12] & 127;
						const msgDane  = (msgData[13] & 128) !== 0;
						const lenRvDns =  msgData[13] & 127;
						const msgIpBlk = (msgData[14] & 128) !== 0;
						const msgHdrTz = (msgData[14] & 127) * 15 - 900; // Timezone offset in minutes; -900m..900m (-15h..+15h)

						const msgHdrTs = new Uint16Array(msgData.slice(15, 17).buffer)[0] - 736;
						const msgCc = ((msgData[8] & 31) <= 26 && (msgData[9] & 31) <= 26) ? String.fromCharCode("A".charCodeAt(0) + (msgData[8] & 31)) + String.fromCharCode("A".charCodeAt(0) + (msgData[9] & 31)) : "??";

						let msgDkim = null;
						let lenDkimDomain = [];

						let extOffset = 17;

						if (dkimCount !== 0) {
							msgDkim = new _NewDkim();

							for (let i = 0; i < dkimCount; i++) {
								msgDkim.senderId   = [(msgData[extOffset + 1] & 128) !== 0];
								msgDkim.sgnAll     = [(msgData[extOffset + 1] &  64) !== 0];
								msgDkim.sgnDate    = [(msgData[extOffset + 1] &  32) !== 0];
								msgDkim.sgnFrom    = [(msgData[extOffset + 1] &  16) !== 0];
								msgDkim.sgnMsgId   = [(msgData[extOffset + 1] &   8) !== 0];
								msgDkim.sgnReplyTo = [(msgData[extOffset + 1] &   4) !== 0];
								msgDkim.sgnSubject = [(msgData[extOffset + 1] &   2) !== 0];
								msgDkim.sgnTo      = [(msgData[extOffset + 1] &   1) !== 0];

								lenDkimDomain.push((msgData[extOffset + 2] & 63) + 4);

								extOffset += 3;
							}
						}

						try {
							const msgBodyBr = new Int8Array(msgData.slice(extOffset));
							const msgBodyU8 = new Uint8Array(window.BrotliDecode(msgBodyBr));

							const d = new TextDecoder("utf-8");
							let o = 0;

							for (let i = 0; i < dkimCount; i++) {
								msgDkim.domain.push(d.decode(msgBodyU8.slice(o, o + lenDkimDomain[i])));
								o += lenDkimDomain[i];
							}

							const msgEnvTo = d.decode(msgBodyU8.slice(o, o + lenEnvTo)) + "@" + _AEM_DOMAIN_EML; o += lenEnvTo;
							const hdrTo    = d.decode(msgBodyU8.slice(o, o + lenHdrTo)); o+= lenHdrTo;
							const msgGreet = d.decode(msgBodyU8.slice(o, o + lenGreet)); o+= lenGreet;
							const msgRvDns = d.decode(msgBodyU8.slice(o, o + lenRvDns)); o+= lenRvDns;

							const msgParts = d.decode(msgBodyU8.slice(o)).split("\n");
							const msgEnvFr = msgParts[0];
							const hdrFr    = msgParts[1];
							const hdrRt    = msgParts[2];
							const msgHdrId = msgParts[3];
							const msgSbjct = msgParts[4];

							const msgHdrTo = hdrTo.includes("\r") ? hdrTo.slice(hdrTo.indexOf("\r") + 1) : hdrTo;
							const msgHdrFr = hdrFr.includes("\r") ? hdrFr.slice(hdrFr.indexOf("\r") + 1) : hdrFr;
							const msgHdrRt = hdrRt.includes("\r") ? hdrRt.slice(hdrRt.indexOf("\r") + 1) : hdrRt;

							const msgDnTo = hdrTo.includes("\r") ? hdrTo.slice(0, hdrTo.indexOf("\r")) : null;
							const msgDnFr = hdrFr.includes("\r") ? hdrFr.slice(0, hdrFr.indexOf("\r")) : null;
							const msgDnRt = hdrRt.includes("\r") ? hdrRt.slice(0, hdrRt.indexOf("\r")) : null;

							const body = msgParts.slice(5).join("\n");
							const headersEnd = body.indexOf("\r");
							const msgHeaders = (headersEnd > 0) ? body.slice(0, headersEnd) : "";
							const msgBody = body.slice(headersEnd + 1);

							_extMsg.push(new _NewExtMsg(validPad, validSig, msgId, msgTs, msgHdrTs, msgHdrTz, msgIp, msgCc, msgCs, msgTls, msgEsmtp, msgQuitR, msgProtV, msgInval, msgRares, msgAttach, msgGrDom, msgIpBlk, dkimFail, msgDkim, msgGreet, msgRvDns, msgEnvFr, msgHdrFr, msgDnFr, msgEnvTo, msgHdrTo, msgDnTo, msgHdrRt, msgDnRt, msgHdrId, msgHeaders, msgSbjct, msgBody));
						} catch(e) {
							_extMsg.push(new _NewExtMsg(validPad, validSig, msgId, msgTs, msgHdrTs, msgHdrTz, msgIp, msgCc, msgCs, msgTls, msgEsmtp, msgQuitR, msgProtV, msgInval, msgRares, msgAttach, msgGrDom, msgIpBlk, dkimFail, null, "", "", "", "", "", "", "", "", "", "", "", "", "Failed decompression", "Size: " + msgData.length));
						}
					break;}

					case 16: { // IntMsg
						const msgType = msgData[0] & 192;

						if (msgType >= 128) { // 192: System, 128: Public
							// 32/16/8/4/2/1 unused

							const bodyAndTitle = sodium.to_string(msgData.slice(1));
							const separator = bodyAndTitle.indexOf('\n');
							_intMsg.push(new _NewIntMsg(validPad, validSig, msgId, msgTs, false, 3, null, (msgType === 192) ? "system" : "public", "", bodyAndTitle.slice(0, separator), bodyAndTitle.slice(separator + 1)));
							break;
						}

						// User-to-user message; 64: E2EE, 0: Non-E2EE
						// 32/16 unused
						const msgEncrypted  = (msgData[0] & 64) !== 0;
						const msgFromShield = (msgData[0] &  8) !== 0;
						const msgToShield   = (msgData[0] &  4) !== 0;
						const msgFromLv = msgData[0] & 3;

						const msgFrom = _addr32_decode(msgData.slice( 1, 11), msgFromShield);
						const msgTo   = _addr32_decode(msgData.slice(11, 21), msgToShield);
						const msgFromPk = msgData.slice(21, 21 + sodium.crypto_kx_PUBLICKEYBYTES);

						const msgTitleLen = msgData[21 + sodium.crypto_kx_PUBLICKEYBYTES] & 127; // 128 unused
						const msgBox = msgData.slice(22 + sodium.crypto_kx_PUBLICKEYBYTES);

						let msgBin;
						let msgTitle;
						let msgBody;

						try {
							if (msgEncrypted) {
								const nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
								nonce.fill(0);
								nonce.set(msgTs_bin);

								const addr32_to = msgData.slice(11, 21);

								const kxKeys = sodium.crypto_kx_seed_keypair(sodium.crypto_generichash(sodium.crypto_kx_SEEDBYTES, addr32_to, _userKeyKxHash));
								const sessionKeys = sodium.crypto_kx_server_session_keys(kxKeys.publicKey, kxKeys.privateKey, msgFromPk);
								msgBin = sodium.crypto_secretbox_open_easy(msgBox, nonce, sessionKeys.sharedRx);
							} else {
								msgBin = msgBox;
							}

							msgTitle = sodium.to_string(msgBin.slice(0, msgTitleLen));
							msgBody = sodium.to_string(msgBin.slice(msgTitleLen));
						} catch(e) {
							msgTitle = "(error)";
							msgBody = e.message;
						}

						_intMsg.push(new _NewIntMsg(validPad, validSig, msgId, msgTs, msgEncrypted, msgFromLv, msgFromPk, msgFrom, msgTo, msgTitle, msgBody));
					break;}

					case 32: { // UplMsg (Email attachment, or uploaded file)
						let msgTitle;
						let msgBody;
						let msgParent = null;

						try {
							// Uploaded file, additional symmetric encryption
							const dec = sodium.crypto_secretbox_open_easy(msgData.slice(sodium.crypto_secretbox_NONCEBYTES), msgData.slice(0, sodium.crypto_secretbox_NONCEBYTES), _userKeySymmetric);
							msgTitle = sodium.to_string(dec.slice(1, 2 + dec[0]));
							msgBody = dec.slice(2 + dec[0]);
						} catch(e) {
							// Email attachment, no additional encryption
							msgParent = msgData.slice(1, 17);
							msgTitle = sodium.to_string(msgData.slice(17, 18 + msgData[0])); // +1
							msgBody = msgData.slice(18 + msgData[0]);
						}

						_uplMsg.push(new _NewUplMsg(msgId, msgTs, msgTitle, msgBody, msgParent, msgBytes / 16));
					break;}

					case 48: // OutMsg (Delivery report for sent message)
						_AddOutMsg(msgData, validPad, validSig, msgId, msgTs, msgTs_bin, false);
					break;
				}

				offset += msgBytes;
			}

			_extMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_intMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_uplMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_outMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);

			callback(privateFail? 0x09 : 0);
		});
	};

	this.Message_Create = function(title, body, addr_from, addr_to, replyId, to_pubkey, callback) {
		if (typeof(title) !== "string" || typeof(body) !== "string" || typeof(addr_from) !== "string" || typeof(addr_to) !== "string") {callback(0x01); return;}

		if (addr_to.indexOf("@") >= 0) { // Email
			if (replyId === null) {
				replyId = "";
			} else if (typeof(replyId) !== "string") {
				callback(0x01);
				return;
			}

			// First byte is title length for internal messages, values over 127 are treated as email
			const bin = sodium.from_string("x" + addr_from + "\n" + addr_to + "\n" + replyId + "\n" + title + "\n" + body);
			bin[0] = 0xFF;

			_FetchEncrypted(_AEM_API_MESSAGE_CREATE, bin, function(fetchErr, msgReport) {
				if (fetchErr === 0) _AddOutMsg(msgReport.slice(21), true, true, msgReport.slice(0, 16), new Uint32Array(msgReport.slice(17, 21).buffer)[0], null, true);
				callback(fetchErr);
			});
			return;
		}

		// Internal mail
		const isE2ee = (to_pubkey.constructor === Uint8Array && to_pubkey.length === sodium.crypto_kx_PUBLICKEYBYTES);
		const msgTs = new Uint8Array(isE2ee? (new Uint32Array([Math.round(Date.now() / 1000) + 2]).buffer) : [0,0,0,0]); // +2 to account for connection delay
		if (!isE2ee && (title.length + body.length) < 6) body = body.padEnd(6 - title.length, "\0"); // Minimum message size: 177-48-64-5-1-32-10-10-1 = 6

		const addr32_from = _addr32_encode(addr_from);
		if (!addr32_from) {callback(0x08); return;}

		const addr32_to = _addr32_encode(addr_to);
		if (!addr32_to) {callback(0x08); return;}

		const kxKeys = sodium.crypto_kx_seed_keypair(sodium.crypto_generichash(sodium.crypto_kx_SEEDBYTES, addr32_from, _userKeyKxHash));
		let msgBox;

		if (isE2ee) {
			const nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
			nonce.fill(0);
			nonce.set(msgTs);

			const sessionKeys = sodium.crypto_kx_client_session_keys(kxKeys.publicKey, kxKeys.privateKey, to_pubkey);
			msgBox = sodium.crypto_secretbox_easy(sodium.from_string(title + body), nonce, sessionKeys.sharedTx);
		} else {
			msgBox = sodium.from_string(title + body);
		}

		const final = new Uint8Array((sodium.crypto_kx_PUBLICKEYBYTES * 2) + 26 + msgBox.length); // 1+4+10+10+1=26
		final.fill(0);

		// 128/32/16 unused
		final[0] = isE2ee? 64 : 0;
		if (addr_from.length === 16) final[0] |= 8;
		if (addr_to.length   === 16) final[0] |= 4;
		// Server sets sender level (0-3)

		if (isE2ee) final.set(to_pubkey, 1);
		final.set(msgTs, 1 + sodium.crypto_kx_PUBLICKEYBYTES);

		final.set(addr32_from, sodium.crypto_kx_PUBLICKEYBYTES + 5);
		final.set(addr32_to, sodium.crypto_kx_PUBLICKEYBYTES + 15);
		final.set(kxKeys.publicKey, sodium.crypto_kx_PUBLICKEYBYTES + 25);

		final[(sodium.crypto_kx_PUBLICKEYBYTES * 2) + 25] = title.length;
		final.set(msgBox, (sodium.crypto_kx_PUBLICKEYBYTES * 2) + 26);

		_FetchEncrypted(_AEM_API_MESSAGE_CREATE, final, function(fetchErr) {callback(fetchErr);});
	};

	this.Message_Delete = function(hexIds, callback) {
		if (typeof(hexIds) === "string") {
			hexIds = [hexIds];
		} else if (typeof(hexIds) !== "object") {
			callback(0x01);
			return;
		}

		const delCount = hexIds.length;

		let data = new Uint8Array(delCount * 16);

		for (let i = 0; i < hexIds.length; i++) {
			const id = sodium.from_hex(hexIds[i]);
			if (id.length !== 16) {callback(0x01); return;}

			data.set(id, i * 16);
		}

		_FetchEncrypted(_AEM_API_MESSAGE_DELETE, data, function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			for (let i = 0; i < hexIds.length; i++) {
				const id = sodium.from_hex(hexIds[i]);

				[_extMsg, _intMsg, _uplMsg].forEach(function(msgSet) {
					for (let j = 0; j < msgSet.length; j++) {
						let matches = true;

						for (let k = 0; k < 16; k++) {
							if (id[k] !== msgSet[j].id[k]) {matches = false; break;}
						}

						if (matches) {msgSet.splice(j, 1); j--;}
					}
				});
			}

			callback(0);
		});
	};

	this.Message_Public = function(title, body, callback) {
		const binMsg = sodium.from_string(title + "\n" + body);
		if (binMsg.length < 59) {callback(0x10); return;} // 59 = 177-48-64-5-1

		_FetchEncrypted(_AEM_API_MESSAGE_PUBLIC, binMsg, function(fetchErr, newMsgId) {
			if (fetchErr) {callback(fetchErr); return;}

			_intMsg.unshift(new _NewIntMsg(true, true, newMsgId, Date.now() / 1000, false, 3, null, "public", "", title, body));

			let x = binMsg.length + 118; // 5 (BoxInfo + ts) + 1 (InfoByte) + 64 (sig) + 48 (sealed box)
			if (x % 16 !== 0) x+= (16 - (x % 16));
			_totalMsgBytes += x;
			_readyMsgBytes += x;

			callback(0);
		});
	};

	this.Message_Sender = function(hash, ts, callback) {
		if (typeof(hash) !== "string" || hash.length !== 64 || typeof(ts) !== "number" || ts < 1577836800 || ts > 4294967295) {callback(0x01); return;}

		const u8data = new Uint8Array(52);
		u8data.set(sodium.from_base64(hash, sodium.base64_variants.URLSAFE));
		u8data.set(new Uint8Array([
			(ts & 0x000000FF),
			(ts & 0x0000FF00) >>  8,
			(ts & 0x00FF0000) >> 16,
			(ts & 0xFF000000) >> 24
		]), 48);

		_FetchEncrypted(_AEM_API_MESSAGE_SENDER, u8data, function(fetchErr, result) {
			callback(fetchErr, result);
		});
	};

	this.Message_Upload = function(title, body, callback) {
		if (typeof(title) !== "string" || title.length < 1 || body.length < 1) {callback(0x01); return;}

		const u8title = sodium.from_string(title);
		if (u8title.length > 256) {callback(0x11); return;}
		const u8body = (typeof(body) === "string") ? sodium.from_string(body) : body;

		const lenData = 1 + u8title.length + u8body.length;
		if (lenData + sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES > _AEM_API_BOX_SIZE_MAX) {callback(0x12); return;}

		const u8data = new Uint8Array(lenData);
		u8data[0] = u8title.length - 1;

		u8data.set(u8title, 1);
		u8data.set(u8body, 1 + u8title.length);

		const nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
		window.crypto.getRandomValues(nonce);

		const sbox = sodium.crypto_secretbox_easy(u8data, nonce, _userKeySymmetric);

		const final = new Uint8Array(nonce.length + sbox.length);
		final.set(nonce);
		final.set(sbox, sodium.crypto_secretbox_NONCEBYTES);

		_FetchEncrypted(_AEM_API_MESSAGE_UPLOAD, final, function(fetchErr, newMsgId) {
			if (fetchErr) {callback(fetchErr); return;}

			_uplMsg.unshift(new _NewUplMsg(newMsgId, Date.now() / 1000, title, body, null, (final.length + sodium.crypto_box_SEALBYTES) / 16));

			let x = final.length + 117; // 5 (info + ts) + 64 (sig) + 48 (sealed box)
			if (x % 16 !== 0) x+= (16 - (x % 16));
			_totalMsgBytes += x;
			_readyMsgBytes += x;

			callback(0);
		});
	};

	this.Private_Update = function(callback) {
		const privData = new Uint8Array(_AEM_LEN_PRIVATE - sodium.crypto_secretbox_NONCEBYTES - sodium.crypto_secretbox_MACBYTES);
		privData[0] = _userAddress.length;

		let offset = 1;

		for (let i = 0; i < _userAddress.length; i++) {
			privData.set(_userAddress[i].hash, offset);
			privData.set(_userAddress[i].addr32, offset + 8);
			offset += 18;
		}

		privData[offset] = _contactMail.length;
		offset++;

		for (let i = 0; i < _contactMail.length; i++) {
			const cMail = sodium.from_string(_contactMail[i] + '\n');
			const cName = sodium.from_string(_contactName[i] + '\n');
			const cNote = sodium.from_string(_contactNote[i] + '\n');

			privData.set(cMail, offset);
			offset += cMail.length;

			privData.set(cName, offset);
			offset += cName.length;

			privData.set(cNote, offset);
			offset += cNote.length;
		}

		const nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
		window.crypto.getRandomValues(nonce);

		const sbox = sodium.crypto_secretbox_easy(privData, nonce, _userKeySymmetric);

		const final = new Uint8Array(nonce.length + sbox.length);
		final.set(nonce);
		final.set(sbox, sodium.crypto_secretbox_NONCEBYTES);

		_FetchEncrypted(_AEM_API_PRIVATE_UPDATE, final, function(fetchErr) {callback(fetchErr);});
	};

	// Extras
	this.ShieldMix = function(addr) {
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
		}

		return newAddr;
	};

	this.GetErrorMessage = function(err) {
		switch (err) {
			// 0x01-0x20	Client-side error codes
			case 0x01: return "Invalid input";
			case 0x02: return "Only administrators can perform this action";
			case 0x03: return "Failed connecting to server";
			case 0x04: return "Invalid input to _FetchEncrypted";
			case 0x05: return "Failed decrypting response from server";
			case 0x06: return "Invalid response length";
			case 0x07: return "Server responded with invalid data";
			case 0x08: return "Addr32 encoding failed";
			case 0x09: return "Private data field corrupted";

			case 0x10: return "Message too short";
			case 0x11: return "Name too long";
			case 0x12: return "File too large";

			case 0x17: return "Server failed decrypting the request"; // 400
			case 0x18: return "Account does not exist"; // 403
			case 0x19: return "Server failed checking account data"; // 500
			case 0x20: return "Invalid status code in response";

			// 0x21-0x2F	Generic
			case 0x21: return ["FORMAT",    "Invalid format"];
			case 0x22: return ["ADMINONLY", "Only administrators can perform this action"];
			case 0x23: return ["MISC",      "Unknown error"];
			case 0x24: return ["INTERNAL",  "Internal server error"];
			case 0x25: return ["TODO",      "Functionality missing - in development"];
			case 0x26: return ["FIXME",     "Unexpected error encountered"];
			case 0x27: return ["CMD",       "No such API command"];

			// 0x30-0x3F	Misc
			case 0x30: return ["ACCOUNT_CREATE_EXIST",     "Account already exists"];
			case 0x31: return ["ACCOUNT_DELETE_NOSTORAGE", "Account data was deleted, but deleting message data failed due to an internal error."];

			// 0xDA-0xDF	Address/Create|Delete|Update
			case 0xDA: return ["ADDRESS_CREATE_INUSE",     "Address already taken"];
			case 0xDB: return ["ADDRESS_CREATE_ATLIMIT",   "Limit reached - unable to register additional addresses"];
			case 0xDC: return ["ADDRESS_DELETE_SOMEFOUND", "Delete successful, but some addresses were not found"];
			case 0xDD: return ["ADDRESS_DELETE_NONEFOUND", "No such address(es)"];
			case 0xDE: return ["ADDRESS_UPDATE_SOMEFOUND", "Partial success - some addresses not found"];
			case 0xDF: return ["ADDRESS_UPDATE_NONEFOUND", "No update performed - address(es) not found"];

			// 0xE0-0xEF	Message/Create
			case 0xE0: return ["MESSAGE_CREATE_EXT_MINLEVEL",        "Account level too low"];
			case 0xE1: return ["MESSAGE_CREATE_EXT_FORMAT_FROM",     "Malformed from-address"];
			case 0xE2: return ["MESSAGE_CREATE_EXT_FORMAT_TO",       "Malformed to-address"];
			case 0xE3: return ["MESSAGE_CREATE_EXT_FORMAT_REPLYID",  "Malformed reply-id"];
			case 0xE4: return ["MESSAGE_CREATE_EXT_FORMAT_SUBJECT",  "Malformed subject"];
			case 0xE5: return ["MESSAGE_CREATE_EXT_INVALID_REPLYID", "Invalid reply-id"];
			case 0xE6: return ["MESSAGE_CREATE_EXT_INVALID_FROM",    "Invalid from-address"];
			case 0xE7: return ["MESSAGE_CREATE_EXT_INVALID_TO",      "Invalid to-address"];
			case 0xE8: return ["MESSAGE_CREATE_EXT_BODY_SIZE",       "Body too long or short"];
			case 0xE9: return ["MESSAGE_CREATE_EXT_BODY_UTF8",       "Body not UTF-8"];
			case 0xEA: return ["MESSAGE_CREATE_EXT_BODY_CONTROL",    "Body contains control characters"];
			case 0xEB: return ["MESSAGE_CREATE_EXT_LINE_TOOLONG",    "Body exceeds line-length limit"];
			case 0xEC: return ["MESSAGE_CREATE_EXT_BODY_FORMAT",     "Malformed body"];
			case 0xED: return ["MESSAGE_CREATE_EXT_BODY_TOOSHORT",   "Body too short"];
			case 0xEE: return ["MESSAGE_CREATE_EXT_TODOMAIN",        "Invalid to-address domain"];
	//		case 0xEF: return ["", ""];

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
