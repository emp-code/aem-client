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

	const docApiDom = document.documentElement.getAttribute("data-aeapidom");
	const docEmlDom = document.documentElement.getAttribute("data-aeemldom");
	const docApiPub = document.documentElement.getAttribute("data-aeapipub");
	const docSigPub = document.documentElement.getAttribute("data-aesigpub");
	const docSaltNm = document.documentElement.getAttribute("data-aesaltnm");

	if (!docApiPub || !docSaltNm || docApiPub.length !== sodium.crypto_box_SECRETKEYBYTES * 2 || docSigPub.length !== sodium.crypto_sign_PUBLICKEYBYTES * 2 || docSaltNm.length !== sodium.crypto_pwhash_SALTBYTES * 2) {
		readyCallback(false);
		return;
	}

// Private constants - must match server
	const _AEM_ADDR_FLAG_SHIELD = 128;
	const _AEM_ADDR_FLAG_USE_GK = 4;
	const _AEM_ADDR_FLAG_ACCINT = 2;
	const _AEM_ADDR_FLAG_ACCEXT = 1;

	const _AEM_ADDR32_CHARS = "0123456789abcdefghjkmnpqrstuwxyz";
	const _AEM_BYTES_POST = 8192;
	const _AEM_ADDRESSES_PER_USER = 31;
	const _AEM_BYTES_PRIVATE = 4096 - sodium.crypto_box_PUBLICKEYBYTES - 1 - (_AEM_ADDRESSES_PER_USER * 9);
	const _AEM_USER_MAXLEVEL = 3;

	const _AEM_ARGON2_MEMLIMIT = 67108864;
	const _AEM_ARGON2_OPSLIMIT = 3;

	const _AEM_DOMAIN_API = docApiDom? docApiDom : document.domain;
	const _AEM_DOMAIN_EML = docEmlDom? docEmlDom : document.domain;
	const _AEM_API_PUBKEY = sodium.from_hex(docApiPub);
	const _AEM_SIG_PUBKEY = sodium.from_hex(docSigPub);
	const _AEM_SALT_NORMAL = sodium.from_hex(docSaltNm);

// Private variables
	const _maxStorage = [];
	const _maxAddressNormal = [];
	const _maxAddressShield = [];

	let _userKeyPublic;
	let _userKeySecret;
	let _userKeySymmetric;

	let _userLevel = 0;
	const _userAddress = [];
	const _extMsg = [];
	const _intMsg = [];
	const _textNote = [];
	const _fileNote = [];
	const _lastMsgId = new Uint8Array(16);
	const _nullMsgId = new Uint8Array(16);

	let _totalMsgCount = 0;
	let _totalMsgKilos = 0;
	let _readyMsgKilos = 0;

	const _gkCountry = [];
	const _gkDomain  = [];
	const _gkAddress = [];

	const _contactMail = [];
	const _contactName = [];
	const _contactNote = [];

	const _admin_userPkHex = [];
	const _admin_userSpace = [];
	const _admin_userNaddr = [];
	const _admin_userSaddr = [];
	const _admin_userLevel = [];

// Private functions
	function _NewExtMsg(validPad, validSig, id, ts, ip, cc, cs, tlsver, esmtp, quitR, protV, inval, rares, attach, greet, rdns, charset, envFrom, to, headers, title, body) {
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.ip = ip;
		this.countryCode = cc;
		this.cs = cs;
		this.tlsver = tlsver;
		this.esmtp = esmtp;
		this.quitR = quitR;
		this.protV = protV;
		this.inval = inval;
		this.rares = rares;
		this.attach = attach;
		this.greet = greet;
		this.rdns = rdns;
		this.charset = charset;
		this.envFrom = envFrom;
		this.to = to;
		this.headers = headers;
		this.title = title;
		this.body = body;
	}

	function _NewIntMsg(validPad, validSig, id, ts, fromLv, fromPk, from, to, title, body) {
		this.validPad = validPad;
		this.validSig = validSig;
		this.id = id;
		this.ts = ts;
		this.fromLv = fromLv;
		this.fromPk = fromPk;
		this.from = from;
		this.to = to;
		this.title = title;
		this.body = body;
	}

	function _NewTextNote(id, ts, title, body) {
		this.id = id;
		this.timestamp = ts;
		this.title = title;
		this.body = body;
	}

	function _NewAddress(hash, addr32, is_shd, accExt, accInt, use_gk) {
		this.hash = hash;
		this.addr32 = addr32;
		this.is_shd = is_shd;
		this.accExt = accExt;
		this.accInt = accInt;
		this.use_gk = use_gk;
	}

	const _FetchBinary = function(url, postData, callback) {
		const nolang = new Headers();
		nolang.append("Accept-Language", "");
		nolang.append("Accept", "");

		fetch(url, {
			method: "POST",
			credentials: "omit",
			headers: nolang,
			redirect: "error",
			referrer: "no-referrer",
			body: postData
		}).then(function(response) {
			return response.ok ? response.arrayBuffer() : false;
		}).then(function(ab) {
			if (ab === false) {callback(false); return;}
			callback(true, new Uint8Array(ab));
		}).catch(() => {
			callback(false);
		});
	};

	const _FetchEncrypted = function(url, cleartext, callback) {
		if (cleartext.length > _AEM_BYTES_POST) return callback(false);

		// postBox: the encrypted data to be sent
		const clearU8 = new Uint8Array(_AEM_BYTES_POST);
		clearU8.set(cleartext);

		const nonce = new Uint8Array(sodium.crypto_box_NONCEBYTES);
		window.crypto.getRandomValues(nonce);
		const postBox = sodium.crypto_box_easy(clearU8, nonce, _AEM_API_PUBKEY, _userKeySecret);

		// sealBox: URL + Length + UPK + Nonce for postBox
		const sealClear = new Uint8Array(16 + sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES);
		sealClear.set(new Uint8Array(new Uint16Array([cleartext.length]).buffer));
		sealClear.set(sodium.from_string(url), 2);
		sealClear.set(nonce, 16);
		sealClear.set(_userKeyPublic, 16 + sodium.crypto_box_NONCEBYTES);
		const sealBox = sodium.crypto_box_seal(sealClear, _AEM_API_PUBKEY);

		// postMsg: sealBox + postBox
		const postMsg = new Uint8Array(sealBox.length + postBox.length);
		postMsg.set(sealBox);
		postMsg.set(postBox, sealBox.length);

		_FetchBinary((_AEM_DOMAIN_API.endsWith(".onion") ? "http://" : "https://") + _AEM_DOMAIN_API + ":302/api", postMsg, function(success, encData) {
			if (!success) {callback(false, null); return;}

			let decData;
			try {decData = sodium.crypto_box_open_easy(encData.slice(sodium.crypto_box_NONCEBYTES), encData.slice(0, sodium.crypto_box_NONCEBYTES), _AEM_API_PUBKEY, _userKeySecret);}
			catch(e) {return callback(false, null);}

			if (decData.length === 33) { // short response
				if (decData[0] === 255) return callback(false, null); // error
				else if (decData[0] === 0) return callback(true, null); // no-content ok
				else return callback(true, decData.slice(1, 1 + decData[0]));
			} else return callback(true, decData); // long response
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
			if (c == _AEM_ADDR32_CHARS[i]) return i;
		}

		if (c == 'o') return 0; // '0'
		if (c == 'i' || c == 'l') return 1; // '1'
		if (c == 'v') return 28; // 'w'

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
			if (isShield && _userAddress[i].is_shd) count++;
			else if (!isShield && ! _userAddress[i].is_shd) count++;
		}

		return count;
	};

	const _arraysEqual = function(a, b) {
		return a.every((el, ix) => el === b[ix]);
	};

	const _MsgExists = function(id) {
		let found = false;

		_extMsg.forEach(function(msg)   {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_intMsg.forEach(function(msg)   {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_textNote.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;
		_fileNote.forEach(function(msg) {if (_arraysEqual(msg.id, id)) found = true;}); if (found) return true;

		return false;
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

	const _GetTlsVersion = function(tlsver) {
		switch (tlsver) {
			case 0: return "(No TLS)";
			case 1: return "TLSv1.0";
			case 2: return "TLSv1.1";
			case 3: return "TLSv1.2";
			case 4: return "TLSv1.3";
			default: return "TLSv1.?"
		}
	};

// Public
	this.Reset = function() {
		_maxStorage.splice(0);
		_maxAddressNormal.splice(0);
		_maxAddressShield.splice(0);
		_userLevel = 0;
		_userAddress.splice(0);
		_extMsg.splice(0);
		_intMsg.splice(0);
		_textNote.splice(0);
		_fileNote.splice(0);

		_gkCountry.splice(0);
		_gkDomain .splice(0);
		_gkAddress.splice(0);

		_contactMail.splice(0);
		_contactName.splice(0);
		_contactNote.splice(0);

		_admin_userPkHex.splice(0);
		_admin_userSpace.splice(0);
		_admin_userNaddr.splice(0);
		_admin_userSaddr.splice(0);
		_admin_userLevel.splice(0);
	};

	this.GetDomainApi = function() {return _AEM_DOMAIN_API;};
	this.GetDomainEml = function() {return _AEM_DOMAIN_EML;};
	this.GetLevelMax = function() {return _AEM_USER_MAXLEVEL;};
	this.GetAddrPerUser = function() {return _AEM_ADDRESSES_PER_USER;};

	this.GetAddress = function(num) {return _addr32_decode(_userAddress[num].addr32, _userAddress[num].is_shd);};
	this.GetAddressAccExt = function(num) {return _userAddress[num].accExt;};
	this.GetAddressAccInt = function(num) {return _userAddress[num].accInt;};
	this.GetAddressUse_Gk = function(num) {return _userAddress[num].use_gk;};

	this.SetAddressAccExt = function(num, val) {_userAddress[num].accExt = val;};
	this.SetAddressAccInt = function(num, val) {_userAddress[num].accInt = val;};
	this.SetAddressUse_Gk = function(num, val) {_userAddress[num].use_gk = val;};

	this.GetAddressCount = function() {return _userAddress.length;};
	this.GetAddressCountNormal = function() {return _GetAddressCount(false);};
	this.GetAddressCountShield = function() {return _GetAddressCount(true);};

	this.IsUserAdmin = function() {return (_userLevel === _AEM_USER_MAXLEVEL);};
	this.GetUserPkHex = function() {return sodium.to_hex(_userKeyPublic);};
	this.GetUserLevel = function() {return _userLevel;};
	this.GetStorageLimit = function(lvl) {return _maxStorage[lvl];};
	this.GetAddressLimitNormal = function(lvl) {return _maxAddressNormal[lvl];};
	this.GetAddressLimitShield = function(lvl) {return _maxAddressShield[lvl];};

	this.GetTotalMsgCount = function() {return _totalMsgCount;};
	this.GetTotalMsgKilos = function() {return _totalMsgKilos;};
	this.GetReadyMsgKilos = function() {return _readyMsgKilos;};

	this.GetExtMsgCount = function() {return _extMsg.length;};
	this.GetExtMsgIdHex   = function(num) {return sodium.to_hex(_extMsg[num].id);};
	this.GetExtMsgTime    = function(num) {return _extMsg[num].ts;};
	this.GetExtMsgTLS     = function(num) {return _GetTlsVersion(_extMsg[num].tlsver) + " " + _GetCiphersuite(_extMsg[num].cs);};
	this.GetExtMsgGreet   = function(num) {return _extMsg[num].greet;};
	this.GetExtMsgIp      = function(num) {return String(_extMsg[num].ip[0] + "." + _extMsg[num].ip[1] + "." + _extMsg[num].ip[2] + "." + _extMsg[num].ip[3]);};
	this.GetExtMsgCountry = function(num) {return _extMsg[num].countryCode;};
	this.GetExtMsgFrom    = function(num) {return _extMsg[num].envFrom;};
	this.GetExtMsgTo      = function(num) {return _extMsg[num].to;};
	this.GetExtMsgTitle   = function(num) {return _extMsg[num].title;};
	this.GetExtMsgHeaders = function(num) {return _extMsg[num].headers;};
	this.GetExtMsgBody    = function(num) {return _extMsg[num].body;};

	this.GetExtMsgFlagVPad = function(num) {return _extMsg[num].validPad;};
	this.GetExtMsgFlagVSig = function(num) {return _extMsg[num].validSig;};
	this.GetExtMsgFlagPExt = function(num) {return _extMsg[num].esmtp;};
	this.GetExtMsgFlagQuit = function(num) {return _extMsg[num].quitR;};
	this.GetExtMsgFlagRare = function(num) {return _extMsg[num].rares;};
	this.GetExtMsgFlagFail = function(num) {return _extMsg[num].inval;};
	this.GetExtMsgFlagPErr = function(num) {return _extMsg[num].protV;};

	this.GetIntMsgCount = function() {return _intMsg.length;};
	this.GetIntMsgIdHex  = function(num) {return sodium.to_hex(_intMsg[num].id);};
	this.GetIntMsgTime   = function(num) {return _intMsg[num].ts;};
	this.GetIntMsgLevel  = function(num) {return _intMsg[num].fromLv;};
	this.GetIntMsgFromPk = function(num) {return _intMsg[num].fromPk;};
	this.GetIntMsgFrom   = function(num) {return _intMsg[num].from;};
	this.GetIntMsgTo     = function(num) {return _intMsg[num].to;};
	this.GetIntMsgTitle  = function(num) {return _intMsg[num].title;};
	this.GetIntMsgBody   = function(num) {return _intMsg[num].body;};

	this.GetIntMsgFlagVPad = function(num) {return _intMsg[num].validPad;};
	this.GetIntMsgFlagVSig = function(num) {return _intMsg[num].validSig;};

	this.GetNoteCount = function() {return _textNote.length;};
	this.GetNoteIdHex = function(num) {return sodium.to_hex(_textNote[num].id);};
	this.GetNoteTime  = function(num) {return _textNote[num].timestamp;};
	this.GetNoteTitle = function(num) {return _textNote[num].title;};
	this.GetNoteBody  = function(num) {return _textNote[num].body;};

	this.GetFileCount = function() {return _fileNote.length;};
	this.GetFileIdHex = function(num) {return sodium.to_hex(_fileNote[num].id);};
	this.GetFileTime = function(num) {return _fileNote[num].timestamp;};
	this.GetFileName = function(num) {return _fileNote[num].title;};
	this.GetFileSize = function(num) {return _fileNote[num].body.length;};
	this.GetFileBlob = function(num) {return new Blob([_fileNote[num].body.buffer]);};

	this.GetGatekeeperCountry = function() {return _gkCountry;};
	this.GetGatekeeperDomain  = function() {return _gkDomain;};
	this.GetGatekeeperAddress = function() {return _gkAddress;};

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
			_userKeySecret = null;
			_userKeyPublic = null;
			callback(false);
			return;
		}

		const boxSeed = sodium.crypto_kdf_derive_from_key(sodium.crypto_box_SEEDBYTES, 1, "AEM-Usr0", sodium.from_hex(skey_hex));
		const boxKeys = sodium.crypto_box_seed_keypair(boxSeed);

		_userKeyPublic = boxKeys.publicKey;
		_userKeySecret = boxKeys.privateKey;

		_userKeySymmetric = sodium.crypto_kdf_derive_from_key(sodium.crypto_secretbox_KEYBYTES, 5, "AEM-Usr0", sodium.from_hex(skey_hex));

		callback(true);
	};

	this.Account_Browse = function(page, callback) {
		if (typeof(page) !== "number" || page < 0 || page > 255) {callback(false); return;}

		_FetchEncrypted("account/browse", new Uint8Array([page]), function(fetchOk, browseData) {
			if (!fetchOk) {callback(false); return;}

			for (let i = 0; i < 4; i++) {
				_maxStorage.push(browseData[(i * 3) + 0]);
				_maxAddressNormal.push(browseData[(i * 3) + 1]);
				_maxAddressShield.push(browseData[(i * 3) + 2]);
			}

			_userLevel = browseData[12];

			// Addresses
			let offset = 14;
			for (let i = 0; i < browseData[13]; i++) {
				const hash = browseData.slice(offset, offset + 8);
				const accExt = (browseData[offset + 8] & _AEM_ADDR_FLAG_ACCEXT) > 0 ? true : false;
				const accInt = (browseData[offset + 8] & _AEM_ADDR_FLAG_ACCINT) > 0 ? true : false;
				const use_gk = (browseData[offset + 8] & _AEM_ADDR_FLAG_USE_GK) > 0 ? true : false;
				const is_shd = (browseData[offset + 8] & _AEM_ADDR_FLAG_SHIELD) > 0 ? true : false;

				_userAddress.push(new _NewAddress(hash, null, is_shd, accExt, accInt, use_gk));
				offset += 9;
			}

			// Private field
			const privNonce = browseData.slice(offset, offset + sodium.crypto_secretbox_NONCEBYTES);
			let privData;

			try {privData = sodium.crypto_secretbox_open_easy(browseData.slice(offset + sodium.crypto_secretbox_NONCEBYTES, offset + _AEM_BYTES_PRIVATE), privNonce, _userKeySymmetric);}
			catch {
				console.log("Private data field decryption failed");
				callback(true);
				return;
			}

			offset += _AEM_BYTES_PRIVATE;

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

			// Admin Data
			if (_userLevel === _AEM_USER_MAXLEVEL) {
				const userCount = new Uint32Array(browseData.slice(offset, offset + 4).buffer)[0];
				offset += 4;

				for (let i = 0; i < ((userCount > 1024) ? 1024 : userCount); i++) {
					const s = browseData.slice(offset, offset + 35);

					const newPkHex = sodium.to_hex(s.slice(3));
					const newLevel = s[0] & 3;
					const newSpace = s[0] >>> 2;
					const newNaddr = s[1];
					const newSaddr = s[2];

					_admin_userPkHex.push(newPkHex);
					_admin_userLevel.push(newLevel);
					_admin_userSpace.push(newSpace);
					_admin_userNaddr.push(newNaddr);
					_admin_userSaddr.push(newSaddr);

					offset += 35;
				}
			}

			callback(true);
		});
	};

	this.Account_Create = function(pk_hex, callback) {
		_FetchEncrypted("account/create", sodium.from_hex(pk_hex), function(fetchOk) {
			if (!fetchOk) {callback(false); return;}

			_admin_userPkHex.push(pk_hex);
			_admin_userLevel.push(0);
			_admin_userSpace.push(0);
			_admin_userNaddr.push(0);
			_admin_userSaddr.push(0);

			callback(true);
		});
	};

	this.Account_Delete = function(pk_hex, callback) {
		_FetchEncrypted("account/delete", sodium.from_hex(pk_hex), function(fetchOk) {
			if (!fetchOk) {callback(false); return;}

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

			callback(true);
		});
	};

	this.Account_Update = function(pk_hex, level, callback) {
		if (level < 0 || level > _AEM_USER_MAXLEVEL) {callback(false); return;}

		const upData = new Uint8Array(33);
		upData[0] = level;
		upData.set(sodium.from_hex(pk_hex), 1);

		_FetchEncrypted("account/update", upData, function(fetchOk) {
			if (!fetchOk) {callback(false); return;}

			let num = -1;
			for (let i = 0; i < _admin_userPkHex.length; i++) {
				if (pk_hex === _admin_userPkHex[i]) {
					num = i;
					break;
				}
			}

			if (num >= 0)
				_admin_userLevel[num] = level;

			callback(true);
		});
	};

	this.Address_Create = function(addr, callback) {
		if (addr == "SHIELD") {
			_FetchEncrypted("address/create", sodium.from_string("SHIELD"), function(fetchOk, byteArray) {
				if (!fetchOk) {callback(false); return;}

				_userAddress.push(new _NewAddress(byteArray.slice(0, 8), byteArray.slice(8, 18), true, true, false, false));
				callback(true);
			});
		} else {
			const addr32 = _addr32_encode(addr);
			if (addr32 === null) {callback(false); return;}

			const full = sodium.crypto_pwhash(16, addr32, _AEM_SALT_NORMAL, _AEM_ARGON2_OPSLIMIT, _AEM_ARGON2_MEMLIMIT, sodium.crypto_pwhash_ALG_ARGON2ID13);
			const hash = new Uint8Array(8);
			hash[0] = full[0] ^ full[8];
			hash[1] = full[1] ^ full[9];
			hash[2] = full[2] ^ full[10];
			hash[3] = full[3] ^ full[11];
			hash[4] = full[4] ^ full[12];
			hash[5] = full[5] ^ full[13];
			hash[6] = full[6] ^ full[14];
			hash[7] = full[7] ^ full[15];

			_FetchEncrypted("address/create", hash, function(fetchOk) {
				if (!fetchOk) {callback(false); return;}

				_userAddress.push(new _NewAddress(hash, addr32, false, true, false, false));
				callback(true);
			});
		}
	};

	this.Address_Delete = function(num, callback) {
		_FetchEncrypted("address/delete", _userAddress[num].hash, function(fetchOk) {
			if (!fetchOk) {
				callback(false);
				return;
			}

			_userAddress.splice(num, 1);
			callback(true);
		});
	};

	this.Address_Lookup = function(addr, callback) {
		_FetchEncrypted("address/lookup", sodium.from_string(addr), function(fetchOk, addr_pk) {
			callback(fetchOk? addr_pk : null);
		});
	};

	this.Address_Update = function(callback) {
		const data = new Uint8Array(_userAddress.length * 9);

		for (let i = 0; i < _userAddress.length; i++) {
			data.set(_userAddress[i].hash, (i * 9));

			let flags = 0;
			if (_userAddress[i].accExt) flags |= _AEM_ADDR_FLAG_ACCEXT;
			if (_userAddress[i].accInt) flags |= _AEM_ADDR_FLAG_ACCINT;
			if (_userAddress[i].use_gk) flags |= _AEM_ADDR_FLAG_USE_GK;

			data[(i * 9) + 8] = flags;
		}

		_FetchEncrypted("address/update", data, function(fetchOk) {callback(fetchOk);});
	};

	this.Message_Browse = function(newest, callback) {
		if (typeof(newest) !== "boolean") {callback(false); return;}

		if (_arraysEqual(_lastMsgId, _nullMsgId)) newest = false;

		_FetchEncrypted("message/browse", newest ? _nullMsgId : _lastMsgId, function(fetchOk, browseData) {
			if (!fetchOk) {callback(false); return;}

			_totalMsgCount = new Uint16Array(browseData.slice(browseData.length - 5, browseData.length - 3).buffer)[0];
			_totalMsgKilos = new Uint32Array(new Uint8Array([browseData[browseData.length - 3], browseData[browseData.length - 2], browseData[browseData.length - 1], 0]).buffer)[0];

			let offset = 128;

			for (let msgNum = 0; msgNum < 128; msgNum++) {
				const kib = browseData[msgNum];
				if (kib === 0) break;

				const msgEnc = browseData.slice(offset, offset + (kib * 1024));

				// Message ID: Every 64th byte of first kilo of encrypted data
				const msgId = new Uint8Array(16);
				for (let i = 0; i < 16; i++) msgId[i] = msgEnc[i * 64];

				if (_MsgExists(msgId)) {
					offset += (kib * 1024);
					continue;
				}

				_readyMsgKilos += kib;

				if (!newest) {
					for (let i = 0; i < 16; i++) _lastMsgId[i] = msgId[i];
				}

				let msgData;
				try {msgData = sodium.crypto_box_seal_open(msgEnc, _userKeyPublic, _userKeySecret);}
				catch(e) {
					_intMsg.push(new _NewIntMsg(true, true, msgId, Date.now() / 1000, 3, null, "system", "system", "(error)", e));
					offset += (kib * 1024);
					continue;
				}

				const msgInfo = new Uint16Array(msgData.slice(0, 2).buffer)[0];
				const padAmount = msgInfo >> 6;
				// msgInfo & 15 unused

				const padA = msgData.slice(msgData.length - sodium.crypto_sign_BYTES - padAmount, msgData.length - sodium.crypto_sign_BYTES);
				const padB = sodium.randombytes_buf_deterministic(padAmount, msgData.slice(0, sodium.randombytes_SEEDBYTES), null);
				const validPad = (padA && padB && padA.length === padB.length && _arraysEqual(padA, padB));
				const validSig = sodium.crypto_sign_verify_detached(msgData.slice(msgData.length - sodium.crypto_sign_BYTES), msgData.slice(0, msgData.length - sodium.crypto_sign_BYTES), _AEM_SIG_PUBKEY);

				const msgTs = new Uint32Array(msgData.slice(2, 6).buffer)[0];

				msgData = msgData.slice(6, msgData.length - padAmount - sodium.crypto_sign_BYTES);

				switch (msgInfo & 48) {
					case 0: { // ExtMsg
						const msgIp = msgData.slice(0, 4);
						const msgCs = new Uint16Array(msgData.slice(4, 6).buffer)[0];
						const msgTlsVer = msgData[6] >> 5;
						const msgAttach = msgData[6] & 31;

						const msgEsmtp = (msgData[7] & 128) > 0;
						const msgQuitR = (msgData[7] & 64) > 0;
						const msgProtV = (msgData[7] & 32) > 0;
						const msgInval = (msgData[8] & 128) > 0;
						const msgRares = (msgData[8] & 64) > 0;
						// [8] & 32 unused

						const msgCc = ((msgData[7] & 31) > 26 || (msgData[8] & 31) > 26) ? "??" : String.fromCharCode("A".charCodeAt(0) + (msgData[7] & 31)) + String.fromCharCode("A".charCodeAt(0) + (msgData[8] & 31));

						// Infobyte [9]

						const msgShield = (msgData[10] & 128) > 0;
						// & 128 unused: [11], [12], [13]

						const lenGreet = msgData[10] & 127;
						const lenRdns = msgData[11] & 127;
						const lenCharset = msgData[12] & 127;
						const lenEnvFrom = msgData[13] & 127;

						const msgTo = _addr32_decode(msgData.slice(14, 24), msgShield);

						const msgBodyBr = new Int8Array(msgData.slice(24));
						const msgBodyU8 = new Uint8Array(window.BrotliDecode(msgBodyBr));
						const msgBodyTx = new TextDecoder("utf-8").decode(msgBodyU8);

						const msgGreet   = msgBodyTx.slice(0,                               lenGreet);
						const msgRdns    = msgBodyTx.slice(lenGreet,                        lenGreet + lenRdns);
						const msgCharset = msgBodyTx.slice(lenGreet + lenRdns,              lenGreet + lenRdns + lenCharset);
						const msgEnvFrom = msgBodyTx.slice(lenGreet + lenRdns + lenCharset, lenGreet + lenRdns + lenCharset + lenEnvFrom);

						const body = msgBodyTx.slice(lenGreet + lenRdns + lenCharset + lenEnvFrom);

						const titleStart = body.indexOf("\nSubject:");
						const titleEnd = (titleStart < 0) ? -1 : body.slice(titleStart + 9).indexOf("\n");
						const msgTitle = (titleStart < 0) ? "(Missing title)" : body.substr(titleStart + 9, titleEnd).trim();

						const headersEnd = body.indexOf("\n\n");
						const msgHeaders = body.slice(0, headersEnd);
						const msgBody = body.slice(headersEnd + 2);

						_extMsg.push(new _NewExtMsg(validPad, validSig, msgId, msgTs, msgIp, msgCc, msgCs, msgTlsVer, msgEsmtp, msgQuitR, msgProtV, msgInval, msgRares, msgAttach, msgGreet, msgRdns, msgCharset, msgEnvFrom, msgTo, msgHeaders, msgTitle, msgBody));
					break;}

					case 16: { // IntMsg
						const msgFromLv = msgData[0] & 3;
						const msgFromPk = msgData.slice(1, 1 + sodium.crypto_box_PUBLICKEYBYTES);
						const msgFrom = _addr32_decode(msgData.slice(1 + sodium.crypto_box_PUBLICKEYBYTES, 11 + sodium.crypto_box_PUBLICKEYBYTES));
						const msgTo = _addr32_decode(msgData.slice(11 + sodium.crypto_box_PUBLICKEYBYTES, 21 + sodium.crypto_box_PUBLICKEYBYTES));

						const nonce = msgData.slice(21 + sodium.crypto_box_PUBLICKEYBYTES, 21 + sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES);
						const msgEnc = msgData.slice(21 + sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES);
						let msgBin;
						let msgTitle;
						let msgBody;

						try {msgBin = sodium.crypto_box_open_easy(msgEnc, nonce, msgFromPk, _userKeySecret, null);}
						catch(e) {
							msgTitle = "(error)";
							msgBody = e;
						} finally {
							if (msgBin) {
								const msgText = sodium.to_string(msgBin);
								msgTitle = msgText.slice(0, msgText.indexOf("\n"));
								msgBody = msgText.slice(msgText.indexOf("\n"));
							}

							_intMsg.push(new _NewIntMsg(validPad, validSig, msgId, msgTs, msgFromLv, msgFromPk, msgFrom, msgTo, msgTitle, msgBody));
						}
					break;}

					case 32: { // Text
//						if ((msgData[0] & 128) === 128) {
							// TODO: Brotli decompress
//						}

						// (msgData[0] & 64) --> format

						const msgTitle = sodium.to_string(msgData.slice(1, msgData[0] & 63));
						const msgBody = sodium.to_string(msgData.slice(msgData[0] & 63));

						_textNote.push(new _NewTextNote(msgId, msgTs, msgTitle, msgBody));
					break;}

					case 48: // File
						// TODO
					break;
				}

				offset += (kib * 1024);
			}

			_extMsg.sort((a, b)   => (a.ts < b.ts) ? 1 : -1);
			_intMsg.sort((a, b)   => (a.ts < b.ts) ? 1 : -1);
			_fileNote.sort((a, b) => (a.ts < b.ts) ? 1 : -1);
			_textNote.sort((a, b) => (a.ts < b.ts) ? 1 : -1);

			callback(true);
		});
	};

	this.Message_Create = function(title, body, addr_from, addr_to, replyId, to_pubkey, callback) {
		if (typeof(title) !== "string" || typeof(body) !== "string" || typeof(addr_from) !== "string" || typeof(addr_to) !== "string") {callback(false); return;}

		if (!to_pubkey) { // Email
			if (typeof(replyId) !== "string") {callback(false); return;}

			// 'x' is 01111000 in ASCII. Addr32 understands this as a length of 16, which is higher than the maximum 15.
			_FetchEncrypted("message/create", sodium.from_string("x" + addr_from + "\n" + addr_to + "\n" + replyId + "\n" + title + "\n" + body), function(fetchOk) {callback(fetchOk);});
			return;
		}

		// Internal mail
		if (to_pubkey.constructor !== Uint8Array || to_pubkey.length !== sodium.crypto_box_PUBLICKEYBYTES) {callback(false); return;}

		const nonce = new Uint8Array(sodium.crypto_box_NONCEBYTES);
		window.crypto.getRandomValues(nonce);

		const msg = sodium.from_string(title + "\n" + body);
		const msgBox = sodium.crypto_box_easy(msg, nonce, to_pubkey, _userKeySecret, null);

		const addr32_from = _addr32_encode(addr_from);
		if (!addr32_from) {callback(false); return;}

		const addr32_to = _addr32_encode(addr_to);
		if (!addr32_to) {callback(false); return;}

		const final = new Uint8Array(20 + sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES + msgBox.length);
		final.set(addr32_from);
		final.set(addr32_to, 10);
		final.set(to_pubkey, 20);
		final.set(nonce, 20 + sodium.crypto_box_PUBLICKEYBYTES);
		final.set(msgBox, 20 + sodium.crypto_box_PUBLICKEYBYTES + sodium.crypto_box_NONCEBYTES);

		_FetchEncrypted("message/create", final, function(fetchOk) {callback(fetchOk);});
	};

	this.Message_Delete = function(hexIds, callback) {
		let data;

		if (typeof(hexIds) === "object") {
			const delCount = hexIds.length;

			data = new Uint8Array(delCount * 16);

			for (let i = 0; i < hexIds.length; i++) {
				const id = sodium.from_hex(hexIds[i]);
				if (id.length !== 16) {callback(false); return;}

				data.set(id, i * 16);
			}
		} else if (typeof(hexIds) === "string") {
			data = sodium.from_hex(hexIds);
		} else {
			callback(false);
			return;
		}

		_FetchEncrypted("message/delete", data, function(fetchOk) {
			if (!fetchOk) {callback(false); return;}

			for (let i = 0; i < hexIds.length; i++) {
				const id = sodium.from_hex(hexIds[i]);

				for (let j = 0; j < _extMsg.length; j++) {
					let matches = true;

					for (let k = 0; k < 16; k++) {
						if (id[k] !== _extMsg[j].id[k]) {matches = false; break;}
					}

					if (matches) {_extMsg.splice(j, 1); j--;}
				}

				for (let j = 0; j < _intMsg.length; j++) {
					let matches = true;

					for (let k = 0; k < 16; k++) {
						if (id[k] !== _intMsg[j].id[k]) {matches = false; break;}
					}

					if (matches) {_intMsg.splice(j, 1); j--;}
				}

				for (let j = 0; j < _textNote.length; j++) {
					let matches = true;

					for (let k = 0; k < 16; k++) {
						if (id[k] !== _textNote[j].id[k]) {matches = false; break;}
					}

					if (matches) {_textNote.splice(j, 1); j--;}
				}

				for (let j = 0; j < _fileNote.length; j++) {
					let matches = true;

					for (let k = 0; k < 16; k++) {
						if (id[k] !== _fileNote[j].id[k]) {matches = false; break;}
					}

					if (matches) {_fileNote.splice(j, 1); j--;}
				}
			}

			callback(true);
		});
	};


	this.Message_StoreF = function(callback) {
		// TODO
		callback(false);
	};

	this.Message_StoreT = function(title, body, format, callback) {
		if (typeof(title) !== "string" || typeof(body) !== "string" || title.length < 1 || body.length < 1) {callback(false); return;}

		const u8title = sodium.from_string(title);
		if (u8title.length > 64) {callback(false); return;}
		const u8body = sodium.from_string(body);

		const lenData = 1 + u8title.length + u8body.length;
		if (lenData > _AEM_BYTES_POST) {callback(false); return;}

		const u8data = new Uint8Array(lenData);
		u8data[0] = u8title.length + 1;
		if (format) u8data[0] += 64;
		// 128 set by server

		u8data.set(u8title, 1);
		u8data.set(u8body, 1 + u8title.length);

		_FetchEncrypted("message/storet", u8data, function(fetchOk) {
			if (!fetchOk) {callback(false); return;}

			_textNote.push(new _NewTextNote(null, Date.now() / 1000, title, body)); //TODO: msgId
			callback(true);
		});
	};

	this.Private_Update = function(callback) {
		const privData = new Uint8Array(_AEM_BYTES_PRIVATE - sodium.crypto_secretbox_NONCEBYTES - sodium.crypto_secretbox_MACBYTES);
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

		const sbox = sodium.crypto_secretbox_easy(privData, nonce, _userKeySymmetric)

		const final = new Uint8Array(nonce.length + sbox.length);
		final.set(nonce);
		final.set(sbox, sodium.crypto_secretbox_NONCEBYTES);

		_FetchEncrypted("private/update", final, function(fetchOk) {callback(fetchOk);});
	};

	readyCallback(true);
}
