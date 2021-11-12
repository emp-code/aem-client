"use strict";

function AllEars(readyCallback) {
	if (typeof(readyCallback)!=="function") return;

	try {
		if ((!window.isSecureContext && !(/^[2-7a-z]{56}\.onion$/.test(document.domain)))
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

	if (docDomApi !== "" || docDomEml !== "") {
		const domainRegex = new RegExp(/(?=^.{4,253}$)(^((?!-)[0-9a-z-]{1,63}(?<!-)\.)+[a-z]{2,63}$)/);
		if ((docDomApi !== "" && !domainRegex.test(docDomApi)) || (docDomEml !== "" && !domainRegex.test(docDomEml))) {
			readyCallback(false);
			return;
		}
	}

	if (
	   !docPubApi || !(new RegExp("^[0-9A-f]{" + (sodium.crypto_box_PUBLICKEYBYTES * 2).toString() + "}$").test(docPubApi))
	|| !docPubSig || !(new RegExp("^[0-9A-f]{" + (sodium.crypto_sign_PUBLICKEYBYTES * 2).toString() + "}$").test(docPubSig))
	|| !docSltNrm || !(new RegExp("^[0-9A-f]{" + (sodium.crypto_pwhash_SALTBYTES * 2).toString() + "}$").test(docSltNrm))
	) {
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
	// 64 unused
	const _AEM_ADDR_FLAG_ORIGIN =  32;
	const _AEM_ADDR_FLAG_SECURE =  16;
	const _AEM_ADDR_FLAG_ATTACH =   8;
	const _AEM_ADDR_FLAG_ALLVER =   4;
	const _AEM_ADDR_FLAG_ACCEXT =   2;
	const _AEM_ADDR_FLAG_ACCINT =   1;
	const _AEM_ADDR_FLAGS_DEFAULT = (_AEM_ADDR_FLAG_ACCEXT | _AEM_ADDR_FLAG_ALLVER | _AEM_ADDR_FLAG_ATTACH);

	const _AEM_FLAG_UINFO = 2;
	const _AEM_FLAG_NEWER = 1;

	const _AEM_ADDR32_CHARS = "0123456789abcdefghjkmnpqrstuwxyz";
	const _AEM_ADDRESSES_PER_USER = 31;
	const _AEM_LEN_PRIVATE = 4096 - sodium.crypto_box_PUBLICKEYBYTES - 1 - (_AEM_ADDRESSES_PER_USER * 9);
	const _AEM_MSG_MINBLOCKS = 12;
	const _AEM_MSG_MINSIZE = _AEM_MSG_MINBLOCKS * 16;
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
	let _newestMsgId = null;
	let _newestMsgTs = 0;

	let _totalMsgCount = 0;
	let _totalMsgBytes = 0;
	let _readyMsgBytes = 0;

	const _contactMail = [];
	const _contactName = [];
	const _contactNote = [];
	let _privateExtra = "";

	const _admin_userPkHex = [];
	const _admin_userSpace = [];
	const _admin_userNaddr = [];
	const _admin_userSaddr = [];
	const _admin_userLevel = [];

// Private functions
	function _Dkim() {
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

	function _ExtMsg(validPad, validSig, id, ts, hdrTs, hdrTz, ip, cc, cs, tls, esmtp, protV, inval, rares, attach, greetDomainIp, ipBlacklisted, dkimFail, dkim, greet, rdns, auSys, envFrom, hdrFrom, dnFrom, envTo, hdrTo, dnTo, hdrRt, dnRt, hdrId, headers, subj, body) {
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

	function _IntMsg(validPad, validSig, id, ts, isE2ee, fromLv, fromPk, from, to, title, body) {
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

	function _OutMsg_Ext(validPad, validSig, id, ts, ip, cc, to, from, subj, body, mxDom, greet, tlsCs, tlsVer, attach) {
		this.isInt = false;
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.ip = ip;
		this.countryCode = cc;
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

	function _OutMsg_Int(validPad, validSig, id, ts, isE2ee, to, from, subj, body) {
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

	function _UplMsg(id, ts, title, body, parent, blocks) {
		this.id = id;
		this.ts = ts;
		this.title = title;
		this.body = body;
		this.parent = parent;
		this.blocks = blocks;
	}

	function _Address(hash, addr32, flags) {
		this.hash = hash;
		this.addr32 = addr32;
		this.flags = flags;
	}

	const _fetchBinary = function(postData, callback) {
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
			switch ((response.statusText === "aem") ? response.status : -1) {
				case 200: return response.arrayBuffer();
				case 400: callback(0x16); return null;
				case 403: callback(0x17); return null;
				case 499: callback(0x18); return null;
				case 500: callback(0x19); return null;
				default:  callback(0x20); return null;
			}
		}).then(function(ab) {
			if (ab) callback(0, new Uint8Array(ab));
		}).catch(() => {
			callback(0x03);
		});
	};

	const _fetchEncrypted = function(apiCmd, clearU8, callback) {
		if (typeof(apiCmd) !== "number" || apiCmd < 0 || apiCmd > 255 || typeof(clearU8) !== "object" || clearU8.length > _AEM_API_BOX_SIZE_MAX) {
			callback(0x04);
			return;
		}

		// postBox: clearU8 encrypted
		const nonce = new Uint8Array(sodium.crypto_box_NONCEBYTES);
		window.crypto.getRandomValues(nonce);
		nonce.set(new Uint8Array(new Uint32Array([Math.round(Date.now() / 1000)]).buffer));

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

		_fetchBinary(postMsg, function(ret, encData) {
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

	const _getBit = function(src, bitNum) {
		const bit = bitNum % 8;
		const byte = (bitNum - bit) / 8;

		return ((1 & (src[byte] >> (7 - bit))) === 1);
	};

	const _setBit = function(src, bitNum) {
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

			if (_getBit(byteArray, skipBits + 0)) num += 16;
			if (_getBit(byteArray, skipBits + 1)) num +=  8;
			if (_getBit(byteArray, skipBits + 2)) num +=  4;
			if (_getBit(byteArray, skipBits + 3)) num +=  2;
			if (_getBit(byteArray, skipBits + 4)) num +=  1;

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
			if (num >= 16) {_setBit(encoded, skipBits + 0); num -= 16;}
			if (num >=  8) {_setBit(encoded, skipBits + 1); num -=  8;}
			if (num >=  4) {_setBit(encoded, skipBits + 2); num -=  4;}
			if (num >=  2) {_setBit(encoded, skipBits + 3); num -=  2;}
			if (num >=  1) {_setBit(encoded, skipBits + 4); num -=  1;}
		}

		return encoded;
	};

	const _getAddressCount = function(isShield) {
		let count = 0;

		for (let i = 0; i < _userAddress.length; i++) {
			if (
			   ( isShield && (_userAddress[i].flags & _AEM_ADDR_FLAG_SHIELD) !== 0)
			|| (!isShield && (_userAddress[i].flags & _AEM_ADDR_FLAG_SHIELD) === 0)
			) count++;
		}

		return count;
	};

	const _arraysEqual = function(a, b) {
		try {return a.every((el, ix) => el === b[ix]);}
		catch(e) {return false;}
	};

	const _msgExists = function(id) {
		let found = false;

		_extMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_intMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_uplMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_outMsg.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;

		return false;
	};

	const _getOldestMsgId = function() {
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

	const _parseUinfo = function(browseData) {
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
			_userAddress.push(new _Address(hash, null, browseData[offset + 8]));
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

		const extra = privData.slice(privOffset);
		const zeroIndex = extra.indexOf(0);
		_privateExtra = sodium.to_string((zeroIndex === -1) ? extra : extra.slice(0, zeroIndex));

		return offset;
	};

	const _addOutMsg = function(msgData, validPad, validSig, msgId, msgTs, msgTs_bin, newest) {
		const lenSb = msgData[0] & 127;

		let newMsg;

		if ((msgData[0] & 128) === 0) { // Email
			const msgIp = msgData.slice(1, 5);
			const msgCs = new Uint16Array(msgData.slice(5, 7).buffer)[0];
			const msgTlsVer = msgData[7] >> 5;
			const msgAttach = msgData[7] & 31;
			// msgData[8]: TLS_InfoByte

			const msgCc = ((msgData[8] & 31) <= 26 && (msgData[9] & 31) <= 26) ? String.fromCharCode("A".charCodeAt(0) + (msgData[8] & 31)) + String.fromCharCode("A".charCodeAt(0) + (msgData[9] & 31)) : "??";
			const lenTo = msgData[10];
			const lenFr = msgData[11];
			const lenMx = msgData[12];
			const lenGr = msgData[13];

			let os = 14;
			const msgTo = sodium.to_string(msgData.slice(os, os + lenTo)); os += lenTo;
			const msgFr = sodium.to_string(msgData.slice(os, os + lenFr)); os += lenFr;
			const msgMx = sodium.to_string(msgData.slice(os, os + lenMx)); os += lenMx;
			const msgGr = sodium.to_string(msgData.slice(os, os + lenGr)); os += lenGr;
			const msgSb = sodium.to_string(msgData.slice(os, os + lenSb)); os += lenSb;
			const msgBd = sodium.to_string(msgData.slice(os));

			newMsg = new _OutMsg_Ext(validPad, validSig, msgId, msgTs, msgIp, msgCc, msgTo, msgFr, msgSb, msgBd, msgMx, msgGr, msgCs, msgTlsVer, msgAttach);
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

			let msgSb;
			let msgBd;

			try {
				msgBin = sodium.to_string(msgBin);
				msgSb = msgBin.slice(0, lenSb);
				msgBd = msgBin.slice(lenSb);
			} catch(e) {
				msgSb = "(fail)";
				msgBd= "Message failed to decode.\n\n" + e + "\n\nBasic decode:\n\n";

				for (let i = 0; i < msgBin.length; i++) {
					if ((msgBin[i] != 10 && msgBin[i] <= 31) || msgBin[i] >= 127)
						msgBd += "[" + msgBin[i] + "]";
					else
						msgBd += String.fromCharCode(msgBin[i]);
				}
			}

			newMsg = new _OutMsg_Int(validPad, validSig, msgId, msgTs, isE2ee, msgTo, msgFr, msgSb, msgBd);
		}

		if (newest) {
			_outMsg.unshift(newMsg);
		} else {
			_outMsg.push(newMsg);
		}
	};

	const _downloadFile = function(title, body) {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([body]));
		a.download = title;
		a.click();

		URL.revokeObjectURL(a.href);
		a.href = "";
		a.download = "";
	};

	// CET: Control-Enriched Text
	const _isValidCet = function(html) {
		return (
		   ((html.match(/\x0C/g) || []).length & 1) === 0
		&& ((html.match(/\x0D/g) || []).length & 1) === 0
		&& ((html.match(/\x0E/g) || []).length & 1) === 0
		&& ((html.match(/\x0F/g) || []).length & 1) === 0
		);
	};

	const _replaceLinks = function(str, protocol, linkByte) {
		let skip = 0;

		while(1) {
			const x = str.slice(skip).indexOf(protocol);
			if (x < 1) break;
			x += skip;

			let y = 0;
			const lnk = str.slice(x);
			for (let i = protocol.length; i < lnk.length; i++) {
				if (lnk.charCodeAt(i) === 10 || lnk.charCodeAt(i) === 32) {
					y = i;
					break;
				} else if (lnk.charCodeAt(i) < 32) {
					skip = x + protocol.length;
					break;
				}
			}
			if (y < 1) continue;

			const url = str.slice(x + protocol.length, x + y);
			str = str.slice(0, x) + linkByte + url + linkByte + str.slice(x + y);
			skip = 0;
		}

		return str;
	};

	const _htmlCetLinks = function(body, needle, isSecure, linkIcon, fullUrl) {
		while(1) {
			const begin = body.indexOf(needle);
			if (begin === -1) break;
			const end = body.slice(begin + 1).indexOf(needle);
			if (end === -1) break;

			let url = body.slice(begin + 1, begin + 1 + end);

			if (!fullUrl) {
				const domainEnd = url.search("[/?]");
				const linkDomain = (domainEnd === -1) ? url : url.slice(0, domainEnd);
				body = body.slice(0, begin) + (isSecure? "<a href=\"https://" : "<a href=\"http://") + url + "\">" + linkIcon + "&NoBreak;" + linkDomain + "</a> " + body.slice(begin + end + 2);
			} else {
				body = body.slice(0, begin) + (isSecure? "<a href=\"https://" : "<a href=\"http://") + url + "\">" + linkIcon + "&NoBreak;" + url + "</a> " + body.slice(begin + end + 2);
			}
		}

		return body;
	};

	const _textCetLinks = function(body, needle, isSecure) {
		while (body.indexOf(needle) >= 0) {
			body = body.replace(needle, isSecure? "https://" : "http://").replace(needle, " ");
		}

		return body;
	};

	const getPlainExtBody = function(num) {
		let textBody = _extMsg[num].body;

		if (_isValidCet(textBody)) {
			textBody = _textCetLinks(textBody, "\x0C", false);
			textBody = _textCetLinks(textBody, "\x0D", true);
			textBody = _textCetLinks(textBody, "\x0E", false);
			textBody = _textCetLinks(textBody, "\x0F", true);
		} else textBody = textBody.replaceAll("\x0C", " ").replaceAll("\x0D", " ").replaceAll("\x0E", " ").replaceAll("\x0F", " ");

		return textBody;
	};

	const _addMessage = function(msgData, msgSize, msgId) {
		const msgInfo = msgData[0];
		const padAmount = msgInfo & 15;

		const padA = msgData.slice(msgData.length - sodium.crypto_sign_BYTES - padAmount, msgData.length - sodium.crypto_sign_BYTES);
		const padB = sodium.randombytes_buf_deterministic(padAmount, msgData.slice(0, 32), null); // 32=sodium.randombytes_SEEDBYTES
		const validPad = (padA && padB && padA.length === padB.length && _arraysEqual(padA, padB));
		const validSig = sodium.crypto_sign_verify_detached(msgData.slice(msgData.length - sodium.crypto_sign_BYTES), msgData.slice(0, msgData.length - sodium.crypto_sign_BYTES), _AEM_SIG_PUBKEY);

		const msgTs_bin = msgData.slice(1, 5);
		const msgTs = new Uint32Array(msgTs_bin.buffer)[0];
		if (msgTs > _newestMsgTs) {
			_newestMsgId = msgId;
			_newestMsgTs = msgTs;
		}

		msgData = msgData.slice(5, msgData.length - padAmount - sodium.crypto_sign_BYTES);

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
				// [10] & 32 unused
				const lenEnvTo = msgData[10] &  31;
				const msgDmarc = msgData[11] & 192;
				const lenHdrTo = msgData[11] &  63;
				const msgDnSec = msgData[12] & 192;
				const lenGreet = msgData[12] &  63;
				const msgDane  = msgData[13] & 192;
				const lenRvDns = msgData[13] &  63;
				// [14] & 192 unused
				const lenAuSys = msgData[14] & 63;
				const dkimFail = (msgData[15] & 128) !== 0;
				const msgHdrTz = (msgData[15] & 127) * 15 - 900; // Timezone offset in minutes; -900m..900m (-15h..+15h)

				const msgHdrTs = new Uint16Array(msgData.slice(16, 18).buffer)[0] - 736;
				const msgCc = ((msgData[8] & 31) <= 26 && (msgData[9] & 31) <= 26) ? String.fromCharCode("A".charCodeAt(0) + (msgData[8] & 31)) + String.fromCharCode("A".charCodeAt(0) + (msgData[9] & 31)) : "??";

				let msgDkim = null;
				let lenDkimDomain = [];

				let extOffset = 18;

				if (dkimCount !== 0) {
					msgDkim = new _Dkim();

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
					const msgAuSys = d.decode(msgBodyU8.slice(o, o + lenAuSys)); o+= lenAuSys;

					const msgParts = d.decode(msgBodyU8.slice(o)).split("\n");
					const msgEnvFr = msgParts[0];
					const hdrFr    = msgParts[1];
					const hdrRt    = msgParts[2];
					const msgHdrId = msgParts[3];
					const msgSbjct = msgParts[4];

					const msgHdrTo = hdrTo.includes("\x0B") ? hdrTo.slice(hdrTo.indexOf("\x0B") + 1) : hdrTo;
					const msgHdrFr = hdrFr.includes("\x0B") ? hdrFr.slice(hdrFr.indexOf("\x0B") + 1) : hdrFr;
					const msgHdrRt = hdrRt.includes("\x0B") ? hdrRt.slice(hdrRt.indexOf("\x0B") + 1) : hdrRt;

					const msgDnTo = hdrTo.includes("\x0B") ? hdrTo.slice(0, hdrTo.indexOf("\x0B")) : null;
					const msgDnFr = hdrFr.includes("\x0B") ? hdrFr.slice(0, hdrFr.indexOf("\x0B")) : null;
					const msgDnRt = hdrRt.includes("\x0B") ? hdrRt.slice(0, hdrRt.indexOf("\x0B")) : null;

					const body = msgParts.slice(5).join("\n");
					const headersEnd = body.indexOf("\x0B");
					const msgHeaders = (headersEnd > 0) ? body.slice(0, headersEnd) : "";
					const msgBody = body.slice(headersEnd + 1);

					_extMsg.push(new _ExtMsg(validPad, validSig, msgId, msgTs, msgHdrTs, msgHdrTz, msgIp, msgCc, msgCs, msgTls, msgEsmtp, msgProtV, msgInval, msgRares, msgAttach, msgGrDom, msgIpBlk, dkimFail, msgDkim, msgGreet, msgRvDns, msgAuSys, msgEnvFr, msgHdrFr, msgDnFr, msgEnvTo, msgHdrTo, msgDnTo, msgHdrRt, msgDnRt, msgHdrId, msgHeaders, msgSbjct, msgBody));
				} catch(e) {
					_extMsg.push(new _ExtMsg(validPad, validSig, msgId, msgTs, msgHdrTs, msgHdrTz, msgIp, msgCc, msgCs, msgTls, msgEsmtp, msgProtV, msgInval, msgRares, msgAttach, msgGrDom, msgIpBlk, dkimFail, null, "", "", "", "", "", "", "", "", "", "", "", "", "Failed decompression", "Size: " + msgData.length));
				}
			break;}

			case 16: { // IntMsg
				const msgType = msgData[0] & 192;

				if (msgType >= 128) { // 192: System, 128: Public
					// 32/16/8/4/2/1 unused

					const bodyAndTitle = sodium.to_string(msgData.slice(1));
					const separator = bodyAndTitle.indexOf("\n");
					_intMsg.push(new _IntMsg(validPad, validSig, msgId, msgTs, false, 3, null, (msgType === 192) ? "system" : "public", "", bodyAndTitle.slice(0, separator), bodyAndTitle.slice(separator + 1)));
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

				_intMsg.push(new _IntMsg(validPad, validSig, msgId, msgTs, msgEncrypted, msgFromLv, msgFromPk, msgFrom, msgTo, msgTitle, msgBody));
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

				if (msgTitle.endsWith(".br")) {
					try {
						msgBody = new Uint8Array(window.BrotliDecode(new Int8Array(msgBody)));
						msgTitle = msgTitle.replace(/\.br$/, "");
					} catch(e) {
						msgBody = "Failed decompression";
					}
				}

				_uplMsg.push(new _UplMsg(msgId, msgTs, msgTitle, msgBody, msgParent, msgSize));
			break;}

			case 48: // OutMsg (Delivery report for sent message)
				_addOutMsg(msgData, validPad, validSig, msgId, msgTs, msgTs_bin, false);
			break;
		}

		return msgTs;
	};

// Public
	this.reset = function() {
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

	this.getDomainApi = function() {return _AEM_DOMAIN_API;};
	this.getDomainEml = function() {return _AEM_DOMAIN_EML;};
	this.getLevelMax = function() {return _AEM_USER_MAXLEVEL;};
	this.getAddrPerUser = function() {return _AEM_ADDRESSES_PER_USER;};

	this.getAddress = function(num) {if(typeof(num)!=="number"){return;} return _addr32_decode(_userAddress[num].addr32, (_userAddress[num].flags & _AEM_ADDR_FLAG_SHIELD) !== 0);};
	this.getAddressOrigin = function(num) {if(typeof(num)!=="number"){return;} return (_userAddress[num].flags & _AEM_ADDR_FLAG_ORIGIN) !== 0;};
	this.getAddressSecure = function(num) {if(typeof(num)!=="number"){return;} return (_userAddress[num].flags & _AEM_ADDR_FLAG_SECURE) !== 0;};
	this.getAddressAttach = function(num) {if(typeof(num)!=="number"){return;} return (_userAddress[num].flags & _AEM_ADDR_FLAG_ATTACH) !== 0;};
	this.getAddressAllVer = function(num) {if(typeof(num)!=="number"){return;} return (_userAddress[num].flags & _AEM_ADDR_FLAG_ALLVER) !== 0;};
	this.getAddressAccExt = function(num) {if(typeof(num)!=="number"){return;} return (_userAddress[num].flags & _AEM_ADDR_FLAG_ACCEXT) !== 0;};
	this.getAddressAccInt = function(num) {if(typeof(num)!=="number"){return;} return (_userAddress[num].flags & _AEM_ADDR_FLAG_ACCINT) !== 0;};

	this.setAddressOrigin = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_userAddress[num].flags |= _AEM_ADDR_FLAG_ORIGIN;} else {_userAddress[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ORIGIN);}};
	this.setAddressSecure = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_userAddress[num].flags |= _AEM_ADDR_FLAG_SECURE;} else {_userAddress[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_SECURE);}};
	this.setAddressAttach = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_userAddress[num].flags |= _AEM_ADDR_FLAG_ATTACH;} else {_userAddress[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ATTACH);}};
	this.setAddressAllVer = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_userAddress[num].flags |= _AEM_ADDR_FLAG_ALLVER;} else {_userAddress[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ALLVER);}};
	this.setAddressAccExt = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_userAddress[num].flags |= _AEM_ADDR_FLAG_ACCEXT;} else {_userAddress[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ACCEXT);}};
	this.setAddressAccInt = function(num, val) {if(typeof(num)!=="number"){return;} if (val) {_userAddress[num].flags |= _AEM_ADDR_FLAG_ACCINT;} else {_userAddress[num].flags &= (0xFF & ~_AEM_ADDR_FLAG_ACCINT);}};

	this.getAddressCount = function() {return _userAddress.length;};
	this.getAddressCountNormal = function() {return _getAddressCount(false);};
	this.getAddressCountShield = function() {return _getAddressCount(true);};

	this.isUserAdmin = function() {return (_userLevel === _AEM_USER_MAXLEVEL);};
	this.getUserPkHex = function() {return sodium.to_hex(_userKeyPublic);};
	this.getUserLevel = function() {return _userLevel;};
	this.getLimitStorage = function(lvl) {if(typeof(lvl)!=="number"){return;} return _maxStorage[lvl];};
	this.getLimitNormalA = function(lvl) {if(typeof(lvl)!=="number"){return;} return _maxNormalA[lvl];};
	this.getLimitShieldA = function(lvl) {if(typeof(lvl)!=="number"){return;} return _maxShieldA[lvl];};

	this.getTotalMsgCount = function() {return _totalMsgCount;};
	this.getTotalMsgBytes = function() {return _totalMsgBytes;};
	this.getReadyMsgBytes = function() {return _readyMsgBytes;};

	this.getExtMsgCount = function() {return _extMsg.length;};
	this.getExtMsgIdHex   = function(num) {if(typeof(num)!=="number"){return;} return sodium.to_hex(_extMsg[num].id);};
	this.getExtMsgTime    = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].ts;};
	this.getExtMsgHdrTime = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrTs;};
	this.getExtMsgHdrTz   = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].hdrTz;};
	this.getExtMsgTLS     = function(num) {if(typeof(num)!=="number"){return;} return (_extMsg[num].cs === 0) ? "" : "TLS v1." + (_extMsg[num].tls & 3) + " " + _getCiphersuite(_extMsg[num].cs);};
	this.getExtMsgIp      = function(num) {if(typeof(num)!=="number"){return;} return String(_extMsg[num].ip[0] + "." + _extMsg[num].ip[1] + "." + _extMsg[num].ip[2] + "." + _extMsg[num].ip[3]);};
	this.getExtMsgDkim    = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].dkim;};
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

		let html = _extMsg[num].body.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").split("\x0B").reverse().join("<br><hr>");

		if (_isValidCet(html)) {
			html = _replaceLinks(html, "http://", "\x0C");
			html = _replaceLinks(html, "https://", "\x0D");

			html = _htmlCetLinks(html, "\x0C", false, "🔗", fullUrl);
			html = _htmlCetLinks(html, "\x0D", true,  "🔒", fullUrl);
			html = _htmlCetLinks(html, "\x0E", false, "👁", fullUrl);
			html = _htmlCetLinks(html, "\x0F", true,  "🖼", fullUrl);
		} else html = html.replaceAll("\x0C", " ").replaceAll("\x0D", " ").replaceAll("\x0E", " ").replaceAll("\x0F", " ");

		return html.replaceAll("\x11", "\n---\n").replaceAll("\x10", " ").replaceAll("\n ", "\n").replaceAll("  ", " ").trim();
	};

	this.getExtMsgFlagVPad = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].validPad;};
	this.getExtMsgFlagVSig = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].validSig;};
	this.getExtMsgFlagPExt = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].esmtp;};
	this.getExtMsgFlagRare = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].rares;};
	this.getExtMsgFlagFail = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].inval;};
	this.getExtMsgFlagPErr = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].protV;};
	this.getExtMsgFlagGrDm = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].greetDomainIp;};
	this.getExtMsgFlagIpBl = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].ipBlacklisted;};
	this.getExtMsgFlagDkFl = function(num) {if(typeof(num)!=="number"){return;} return _extMsg[num].dkimFail;};

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

	this.exportExtMsg = function(num) {if(typeof(num)!=="number"){return;}
		return "Received: from " + _extMsg[num].greet +" (" + this.getExtMsgRdns(num) + " [" + this.getExtMsgIp(num) + "])"
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
		+ "\r\n\r\n" + getPlainExtBody(num).replaceAll("\x0B", "\n---\n").replaceAll("\n", "\r\n")
		+ "\r\n";
	};

	this.exportIntMsg = function(num) {if(typeof(num)!=="number"){return;}
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

	this.downloadExtMsg = function(num) {if(typeof(num)!=="number"){return;}
		_downloadFile(_extMsg[num].subj + ".eml", new Blob([this.exportExtMsg(num)]));
	};

	this.downloadIntMsg = function(num) {if(typeof(num)!=="number"){return;}
		_downloadFile(_intMsg[num].title + ".eml", new Blob([this.exportIntMsg(num)]));
	};

	this.downloadUplMsg = function(num) {if(typeof(num)!=="number"){return;}
		_downloadFile(_uplMsg[num].title, _uplMsg[num].body.buffer);
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
		el.contentWindow.print();
		document.body.removeChild(el);
	};

	this.printIntMsg = function(num) {if(typeof(num)!=="number"){return;}
		const msgDate = new Date((_intMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");

		const el = document.createElement("iframe");
		el.hidden = true;
		document.body.appendChild(el);
		el.contentWindow.document.body.innerHTML = "<pre>Date: " + msgDate + "\nFrom: " + _intMsg[num].from + "@" + _AEM_DOMAIN_EML + "\n  To: " + _intMsg[num].to + "@" + _AEM_DOMAIN_EML + "</pre><h1>" + _intMsg[num].title + "</h1>" + this.getIntMsgBody(num).replaceAll("\n", "<br>");
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
		const msg = "<html><body><pre>Date: " + msgDate + "\nFrom: " + _intMsg[num].from + "@" + _AEM_DOMAIN_EML + "\n  To: " + _intMsg[num].to + "@" + _AEM_DOMAIN_EML + "</pre><h1>" + _intMsg[num].title + "</h1><p>" + this.getIntMsgBody(num).replaceAll("\n", "<br>") + "</p></body></html>";
		_downloadFile(_extMsg[num].subj + ".html", new Blob([msg]));
	};

	this.txtExtMsg = function(num, dl) {if(typeof(num)!=="number" || typeof(dl)!=="boolean"){return;}
		const msgDate = new Date((_extMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");
		const msg = "Date: " + msgDate + "\nFrom: " + _extMsg[num].hdrFrom + "\nTo: " + _extMsg[num].hdrTo + "\nSubject: " + _extMsg[num].subj + "\n\n" + getPlainExtBody(num);
		if (dl) {_downloadFile(_extMsg[num].subj + ".txt", new Blob([msg]));} else return msg;
	};

	this.txtIntMsg = function(num, dl) {if(typeof(num)!=="number" || typeof(dl)!=="boolean"){return;}
		const msgDate = new Date((_intMsg[num].ts * 1000) + ((new Date().getTimezoneOffset()) * -60000)).toISOString().slice(0, 19).replace("T", " ");
		const msg = "Date: " + msgDate + "\nFrom: " + _intMsg[num].from + "@" + _AEM_DOMAIN_EML + "\nTo: " + _intMsg[num].to + "@" + _AEM_DOMAIN_EML + "\nSubject: " + _intMsg[num].title + "\n\n" + this.getIntMsgBody(num, true);
		if (dl) {_downloadFile(_intMsg[num].title + ".txt", new Blob([msg]));} else return msg;
	};

	this.getExtMsgReplyAddress = function(num) {if(typeof(num)!=="number"){return;}
		if (_extMsg[num].hdrRt)   return _extMsg[num].hdrRt;
		if (_extMsg[num].hdrFrom) return _extMsg[num].hdrFrom;
		if (_extMsg[num].envFrom) return _extMsg[num].envFrom;
		return null;
	};

	this.getIntMsgCount = function() {return _intMsg.length;};
	this.getIntMsgIdHex  = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].id? sodium.to_hex(_intMsg[num].id) : null;};
	this.getIntMsgTime   = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].ts;};
	this.getIntMsgLevel  = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].fromLv;};
	this.getIntMsgFromPk = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].fromPk? sodium.to_base64(_intMsg[num].fromPk, sodium.base64_variants.ORIGINAL_NO_PADDING) : "";};
	this.getIntMsgFrom   = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].from;};
	this.getIntMsgTo     = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].to;};
	this.getIntMsgTitle  = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].title;};
	this.getIntMsgBody   = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].body;};

	this.getIntMsgFlagVPad = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].validPad;};
	this.getIntMsgFlagVSig = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].validSig;};
	this.getIntMsgFlagE2ee = function(num) {if(typeof(num)!=="number"){return;} return _intMsg[num].isE2ee;};

	this.getUplMsgCount = function() {return _uplMsg.length;};
	this.getUplMsgIdHex = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].id? sodium.to_hex(_uplMsg[num].id) : null;};
	this.getUplMsgTime  = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].ts;};
	this.getUplMsgTitle = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].title;};
	this.getUplMsgBody  = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].body;};
	this.getUplMsgBytes = function(num) {if(typeof(num)!=="number"){return;} return _uplMsg[num].blocks * 16;};
	this.getUplMsgType  = function(num) {if(typeof(num)!=="number"){return;} return _getFileType(_uplMsg[num].title);};
	this.getUplMsgParent = function(num) {if(typeof(num)!=="number"){return;}
		for (let i = 0; i < _extMsg.length; i++) {
			if (_arraysEqual(_uplMsg[num].parent), _extMsg[num].id) {
				return i;
			}
		}

		return null;
	};

	this.getOutMsgCount = function() {return _outMsg.length;};
	this.getOutMsgIdHex = function(num) {if(typeof(num)!=="number"){return;} return sodium.to_hex(_outMsg[num].id);};
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
	this.getOutMsgFlagVPad = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].validPad;};
	this.getOutMsgFlagVSig = function(num) {if(typeof(num)!=="number"){return;} return _outMsg[num].validSig;};

	this.admin_getUserCount = function() {return _admin_userPkHex.length;};
	this.admin_getUserPkHex = function(num) {if(typeof(num)!=="number"){return;} return _admin_userPkHex[num];};
	this.admin_getUserSpace = function(num) {if(typeof(num)!=="number"){return;} return _admin_userSpace[num];};
	this.admin_getUserNAddr = function(num) {if(typeof(num)!=="number"){return;} return _admin_userNaddr[num];};
	this.admin_getUserSAddr = function(num) {if(typeof(num)!=="number"){return;} return _admin_userSaddr[num];};
	this.admin_getUserLevel = function(num) {if(typeof(num)!=="number"){return;} return _admin_userLevel[num];};

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
		let lenPriv = 2 + _userAddress.length * 18;

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
		if (sodium.from_string(newData).length > this.getPrivateExtraSpaceMax()) return 0x13;
		_privateExtra = newData;
		return 0;
	};

	this.setKeys = function(skey_hex, callback) {if(typeof(skey_hex)!=="string" || typeof(callback)!=="function"){return;}
		if (skey_hex.length !== sodium.crypto_box_SECRETKEYBYTES * 2) {
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

	// API functions
	this.Account_Browse = function(callback) {if(typeof(callback)!=="function"){return;}
		if (_userLevel !== _AEM_USER_MAXLEVEL) {callback(0x02); return;}

		_fetchEncrypted(_AEM_API_ACCOUNT_BROWSE, new Uint8Array([0]), function(fetchErr, browseData) {
			if (fetchErr !== 0 || browseData === null) {callback(fetchErr); return;}
			if (!browseData || browseData.length < 35) {callback(0x07); return;}

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

				const newSpace = (s[2] | ((u16 >> 4) & 3840)) * 64; // in KiB
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

	this.Account_Create = function(pk_hex, callback) {if(typeof(pk_hex)!=="string" || typeof(callback)!=="function"){return;}
		if (_userLevel !== _AEM_USER_MAXLEVEL) {callback(0x02); return;}

		_fetchEncrypted(_AEM_API_ACCOUNT_CREATE, sodium.from_hex(pk_hex), function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			_admin_userPkHex.push(pk_hex);
			_admin_userLevel.push(0);
			_admin_userSpace.push(0);
			_admin_userNaddr.push(0);
			_admin_userSaddr.push(0);

			callback(0);
		});
	};

	this.Account_Delete = function(pk_hex, callback) {if(typeof(pk_hex)!=="string" || typeof(callback)!=="function"){return;}
		_fetchEncrypted(_AEM_API_ACCOUNT_DELETE, sodium.from_hex(pk_hex), function(fetchErr) {
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

	this.Account_Update = function(pk_hex, level, callback) {if(typeof(pk_hex)!=="string" || typeof(level)!=="number" || typeof(callback)!=="function"){return;}
		if (level < 0 || level > _AEM_USER_MAXLEVEL) {callback(0x02); return;}

		const upData = new Uint8Array(33);
		upData[0] = level;
		upData.set(sodium.from_hex(pk_hex), 1);

		_fetchEncrypted(_AEM_API_ACCOUNT_UPDATE, upData, function(fetchErr) {
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

	this.Address_Create = function(addr, callback) {if(typeof(addr)!=="string" || typeof(callback)!=="function"){return;}
		if (this.getPrivateExtraSpaceMax() - this.getPrivateExtraSpace() < 18) {callback(0x14); return;}

		if (addr === "SHIELD") {
			_fetchEncrypted(_AEM_API_ADDRESS_CREATE, sodium.from_string("SHIELD"), function(fetchErr, byteArray) {
				if (fetchErr) {callback(fetchErr); return;}
				_userAddress.push(new _Address(byteArray.slice(0, 8), byteArray.slice(8, 18), _AEM_ADDR_FLAG_SHIELD | _AEM_ADDR_FLAGS_DEFAULT));
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

			_fetchEncrypted(_AEM_API_ADDRESS_CREATE, hash, function(fetchErr) {
				if (fetchErr) {callback(fetchErr); return;}

				_userAddress.push(new _Address(hash, addr32, _AEM_ADDR_FLAGS_DEFAULT));
				callback(0);
			});
		}
	};

	this.Address_Delete = function(num, callback) {if(typeof(num)!=="number" || typeof(callback)!=="function"){return;}
		_fetchEncrypted(_AEM_API_ADDRESS_DELETE, _userAddress[num].hash, function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			_userAddress.splice(num, 1);
			callback(0);
		});
	};

	this.Address_Lookup = function(addr, callback) {if(typeof(addr)!=="string" || typeof(callback)!=="function"){return;}
		_fetchEncrypted(_AEM_API_ADDRESS_LOOKUP, sodium.from_string(addr), function(fetchErr, result) {
			callback(fetchErr? fetchErr : result);
		});
	};

	this.Address_Update = function(callback) {if(typeof(callback)!=="function"){return;}
		const data = new Uint8Array(_userAddress.length * 9);

		for (let i = 0; i < _userAddress.length; i++) {
			data.set(_userAddress[i].hash, (i * 9));
			data[(i * 9) + 8] = _userAddress[i].flags;
		}

		_fetchEncrypted(_AEM_API_ADDRESS_UPDATE, data, function(fetchErr) {callback(fetchErr);});
	};

	this.Message_Browse = function(newest, u_info, callback) {if(typeof(newest)!=="boolean" || typeof(u_info)!=="boolean" || typeof(callback)!=="function"){return;}
		let fetchId;
		if (_extMsg.length > 0 || _intMsg.length > 0 || _uplMsg.length > 0 || _outMsg.length > 0) {
			fetchId = new Uint8Array(17);
			fetchId[0] = 0;
			if (newest) fetchId[0] |= _AEM_FLAG_NEWER;
			if (u_info) fetchId[0] |= _AEM_FLAG_UINFO;
			fetchId.set(newest? _newestMsgId : _getOldestMsgId(), 1);
		} else fetchId = new Uint8Array([u_info? _AEM_FLAG_UINFO : 0]);

		let privateFail = false;
		_fetchEncrypted(_AEM_API_MESSAGE_BROWSE, fetchId, function(fetchErr, browseData) {
			if (fetchErr !== 0) {callback(fetchErr); return;}

			if (u_info) {
				if (browseData.length < 1000) {callback(0x07); return;}
				const uinfo_bytes = _parseUinfo(browseData);
				browseData = browseData.slice(Math.abs(uinfo_bytes));
				if (uinfo_bytes < 0) privateFail = true;
			}

			if (browseData.length <= 6) {callback(0); return;} // No messages or error getting messages

			_totalMsgCount = new Uint16Array(browseData.slice(0, 2).buffer)[0];
			_totalMsgBytes = new Uint32Array(browseData.slice(2, 6).buffer)[0] * 16;

			let offset = 6;
			let prevTs = 1577836800; // 2020-01-01

			while (offset < browseData.length) {
				const msgBytes = (new Uint16Array(browseData.slice(offset, offset + 2).buffer)[0] + _AEM_MSG_MINBLOCKS) * 16;
				offset += 2;

				const msgEnc = browseData.slice(offset, offset + msgBytes);

				const msgId = msgEnc.slice(0, 16);
				if (_msgExists(msgId)) {
					offset += msgBytes;
					continue;
				}

				_readyMsgBytes += msgBytes;

				let msgData;
				try {msgData = sodium.crypto_box_seal_open(msgEnc, _userKeyPublic, _userKeySecret);}
				catch(e) {
					prevTs--; // The server sends messages from newest to oldest -> this message is older than the previous one -> lower timestamp
					_intMsg.push(new _IntMsg(true, true, msgId, prevTs, false, 3, null, "system", "", "Failed decrypting: " + offset + "/" + browseData.length + " (size: " + msgEnc.length + ")", e));
					offset += msgBytes;
					continue;
				}

				prevTs = _addMessage(msgData, msgBytes, msgId);
				offset += msgBytes;
			}

			_extMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_intMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_uplMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_outMsg.sort((a, b) => (a.ts < b.ts) ? 1 : -1);

			callback(privateFail? 0x09 : 0);
		});
	};

	this.Message_Create = function(title, body, addr_from, addr_to, replyId, to_pubkey, callback) {if(typeof(title)!=="string" || typeof(body)!=="string" || typeof(addr_from)!=="string" || typeof(addr_to)!=="string" || typeof(callback)!=="function"){return;}
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

			_fetchEncrypted(_AEM_API_MESSAGE_CREATE, bin, function(fetchErr, msgReport) {
				if (fetchErr === 0 && (msgReport[16] & 48) === 48) _addOutMsg(msgReport.slice(21), true, true, msgReport.slice(0, 16), new Uint32Array(msgReport.slice(17, 21).buffer)[0], msgReport.slice(17, 21), true);
				callback(fetchErr);
			});
			return;
		}

		// Internal mail
		const isE2ee = (to_pubkey.constructor === Uint8Array && to_pubkey.length === sodium.crypto_kx_PUBLICKEYBYTES);
		const msgTs = new Uint8Array(isE2ee? (new Uint32Array([Math.round(Date.now() / 1000) + 2]).buffer) : [0,0,0,0]); // +2 to account for connection delay
		if (!isE2ee && (title.length + body.length) < 38) body = body.padEnd(38 - title.length, "\0"); // Minimum message size: 177-48-64-5-1-32-10-10-1 = 6; -32 does not apply for DR, hence 38

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

		_fetchEncrypted(_AEM_API_MESSAGE_CREATE, final, function(fetchErr, msgReport) {
			if (fetchErr === 0 && (msgReport[16] & 48) === 48) _addOutMsg(msgReport.slice(21), true, true, msgReport.slice(0, 16), new Uint32Array(msgReport.slice(17, 21).buffer)[0], msgReport.slice(17, 21), true);
			callback(fetchErr);
		});
	};

	this.Message_Delete = function(hexIds, callback) {if(typeof(callback)!=="function"){return;}
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

		_fetchEncrypted(_AEM_API_MESSAGE_DELETE, data, function(fetchErr) {
			if (fetchErr) {callback(fetchErr); return;}

			for (let i = 0; i < hexIds.length; i++) {
				const id = sodium.from_hex(hexIds[i]);

				[_extMsg, _intMsg, _uplMsg, _outMsg].forEach(function(msgSet) {
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

	this.Message_Public = function(title, body, callback) {if(typeof(title)!=="string" || typeof(body)!=="string" || typeof(callback)!=="function"){return;}
		const binMsg = sodium.from_string(title + "\n" + body);
		if (binMsg.length < 59) {callback(0x10); return;} // 59 = 177-48-64-5-1

		_fetchEncrypted(_AEM_API_MESSAGE_PUBLIC, binMsg, function(fetchErr, newMsgId) {
			if (fetchErr) {callback(fetchErr); return;}

			_intMsg.unshift(new _IntMsg(true, true, newMsgId, Date.now() / 1000, false, 3, null, "public", "", title, body));

			let x = binMsg.length + 118; // 5 (BoxInfo + ts) + 1 (InfoByte) + 64 (sig) + 48 (sealed box)
			if (x % 16 !== 0) x+= (16 - (x % 16));
			_totalMsgBytes += x;
			_readyMsgBytes += x;

			callback(0);
		});
	};

	this.Message_Sender = function(hash, ts, callback) {if(typeof(hash)!=="string" || typeof(ts)!=="number" || typeof(callback)!=="function"){return;}
		if (hash.length !== 64 || ts < 1577836800 || ts > 4294967295) {callback(0x01); return;}

		const u8data = new Uint8Array(52);
		u8data.set(sodium.from_base64(hash, sodium.base64_variants.URLSAFE));
		u8data.set(new Uint8Array([
			(ts & 0x000000FF),
			(ts & 0x0000FF00) >>  8,
			(ts & 0x00FF0000) >> 16,
			(ts & 0xFF000000) >> 24
		]), 48);

		_fetchEncrypted(_AEM_API_MESSAGE_SENDER, u8data, function(fetchErr, result) {
			callback(fetchErr, (fetchErr === 0 && result) ? sodium.to_hex(result) : null);
		});
	};

	this.Message_Upload = function(title, body, callback) {if(typeof(title)!=="string" || (typeof(body)!=="string" && body.constructor!==Uint8Array) || typeof(callback)!=="function"){return;}
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

		_fetchEncrypted(_AEM_API_MESSAGE_UPLOAD, final, function(fetchErr, newMsgId) {
			if (fetchErr) {callback(fetchErr); return;}

			_uplMsg.unshift(new _UplMsg(newMsgId, Date.now() / 1000, title, u8body, null, (final.length + sodium.crypto_box_SEALBYTES) / 16));

			let x = final.length + 117; // 5 (info + ts) + 64 (sig) + 48 (sealed box)
			if (x % 16 !== 0) x+= (16 - (x % 16));
			_totalMsgBytes += x;
			_readyMsgBytes += x;

			callback(0);
		});
	};

	this.Private_Update = function(callback) {if(typeof(callback)!=="function"){return;}
		const privData = new Uint8Array(_AEM_LEN_PRIVATE - sodium.crypto_secretbox_NONCEBYTES - sodium.crypto_secretbox_MACBYTES);
		privData.fill(0);
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
			const cMail = sodium.from_string(_contactMail[i] + "\n");
			const cName = sodium.from_string(_contactName[i] + "\n");
			const cNote = sodium.from_string(_contactNote[i] + "\n");

			privData.set(cMail, offset);
			offset += cMail.length;

			privData.set(cName, offset);
			offset += cName.length;

			privData.set(cNote, offset);
			offset += cNote.length;
		}

		privData.set(sodium.from_string(_privateExtra), offset);

		const nonce = new Uint8Array(sodium.crypto_secretbox_NONCEBYTES);
		window.crypto.getRandomValues(nonce);

		const sbox = sodium.crypto_secretbox_easy(privData, nonce, _userKeySymmetric);

		const final = new Uint8Array(nonce.length + sbox.length);
		final.set(nonce);
		final.set(sbox, sodium.crypto_secretbox_NONCEBYTES);

		_fetchEncrypted(_AEM_API_PRIVATE_UPDATE, final, function(fetchErr) {callback(fetchErr);});
	};

	this.Setting_Update = function(mib, nrm, shd, callback) {if(typeof(mib)!=="object" || typeof(nrm)!=="object" || typeof(shd)!=="object" || typeof(callback)!=="function"){return;}
		const data = new Uint8Array([
			mib[0], nrm[0], shd[0],
			mib[1], nrm[1], shd[1],
			mib[2], nrm[2], shd[2],
			mib[3], nrm[3], shd[3]
		]);

		_fetchEncrypted(_AEM_API_SETTING_LIMITS, data, function(fetchErr) {
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
	this.shieldMix = function(addr) {if(typeof(addr)!=="string"){return;}
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

		const n = Math.floor(Math.random() * 16);
		if (n === 0) return newAddr;
		newAddr = newAddr.slice(0, n) + ((Math.random() > 0.5) ? "." : "-") + newAddr.slice(n);

		const m = Math.floor(Math.random() * 17);
		return (m === 0 || m === n || m === n + 1) ? newAddr : newAddr.slice(0, m) + ((Math.random() > 0.5) ? "." : "-") + newAddr.slice(m);
	};

	this.getErrorMessage = function(err) {if(typeof(err)!=="number"){return;}
		switch (err) {
			// 0x01-0x20	Client-side error codes
			case 0x01: return "Invalid input";
			case 0x02: return "Only administrators may perform this action";
			case 0x03: return "Failed connecting to server";
			case 0x04: return "Invalid input to _fetchEncrypted";
			case 0x05: return "Failed decrypting response from server";
			case 0x06: return "Invalid response length";
			case 0x07: return "Server responded with invalid data";
			case 0x08: return "Addr32 encoding failed";
			case 0x09: return "Private data field corrupted";

			case 0x10: return "Message too short";
			case 0x11: return "Name too long";
			case 0x12: return "File too large";
			case 0x13: return "Private-field extra content too long";
			case 0x14: return "Private-field out of space";

			case 0x16: return "Server failed decrypt"; // 400
			case 0x17: return "No such account"; // 403
			case 0x18: return "Time mismatch"; // 499
			case 0x19: return "Server error"; // 500
			case 0x20: return "Response code invalid";

			// 0x21-0x2F	Generic
			case 0x21: return ["FORMAT",    "Invalid format"];
			case 0x22: return ["ADMINONLY", "Only administrators can perform this action"];
			case 0x23: return ["MISC",      "Unknown error"];
			case 0x24: return ["INTERNAL",  "Internal server error"];
			case 0x25: return ["TODO",      "Functionality missing - in development"];
			case 0x26: return ["FIXME",     "Unexpected error encountered"];
			case 0x27: return ["CMD",       "No such API command"];
			case 0x28: return ["ENC_RESP",  "Server failed encrypting response"];

			// 0x30-0x3F	Misc
			case 0x30: return ["ACCOUNT_CREATE_EXIST",     "Account already exists"];
			case 0x31: return ["ACCOUNT_DELETE_NOSTORAGE", "Account data was deleted, but deleting message data failed due to an internal error"];

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
			case 0xEE: return ["MESSAGE_CREATE_EXT_OURDOMAIN",       "Remove @" + _AEM_DOMAIN_EML + " to send internally"];
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
