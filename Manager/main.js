"use strict";

const _AEM_TS_BEGIN = 1735689600000n; // 2025-01-01 00:00:00 UTC
const _AEM_KDF_KEYID_SMK_LCH = 2;
const _AEM_KDF_KEYID_SMK_MPK = 3;
const _AEM_KDF_KEYID_SMK_ACC = 10;
const _AEM_KDF_KEYID_SMK_STO = 13;
const _AEM_KDF_KEYID_SMK_API = 14;
const _AEM_KDF_SUB_KEYLEN = 40;

let _AEM_SERVER = null;
let _AEM_KEY_MPK = null;
let _AEM_KEY_LCH = null;
let _AEM_KEY_ACC = null;
let _AEM_KEY_STO = null;
let _AEM_KEY_API = null;

const _AEM_MNG_CMD_NOOP  = 0
const _AEM_MNG_CMD_SPAWN = 1
const _AEM_MNG_CMD_TERM  = 2

const _mp = async function(cmd, data, callback) {
	const urlBase = new Uint8Array(42);

	const t = (BigInt(Date.now()) - _AEM_TS_BEGIN) << 6n;
	urlBase.set(
		new Uint8Array([
			Number(t & 3n),
			Number((t >> 8n) & 255n),
			Number((t >> 16n) & 255n),
			Number((t >> 24n) & 255n),
			Number((t >> 32n) & 255n),
			Number((t >> 40n) & 255n)
		])
	);
	let aead_nonce = urlBase.slice(0, sodium.crypto_aead_aegis256_NPUBBYTES);
	urlBase.set(sodium.crypto_aead_aegis256_encrypt(new Uint8Array([cmd & 31 | ((data & 7) << 5), (data >> 3) & 255, (data >> 11) & 255, (data >> 19) & 255]), null, null, aead_nonce, _AEM_KEY_MPK), 6);

	let post = null;
	if (cmd === _AEM_MNG_CMD_SPAWN) {
		const src = new Uint8Array(257);
		src.set(_AEM_KEY_LCH, 1);
		if (data === 0) {src.set(_AEM_KEY_ACC, 33); src[0] = 184;}
		else if (data === 3) {src.set(_AEM_KEY_STO, 33); src[0] = 184;}
		else if ((data & 15) === 6) {src.set(_AEM_KEY_API, 33); src[0] = 184;}
		else src[0] = 224;

		aead_nonce[0] |= 64;
		post = sodium.crypto_aead_aegis256_encrypt(src, null, null, aead_nonce, _AEM_KEY_MPK);
		aead_nonce[0] ^= 64;
	}

	let r;
	try {
		r = await fetch("https://" + _AEM_SERVER + "/~" + sodium.to_base64(urlBase, sodium.base64_variants.URLSAFE).slice(1), {
			method: post? "POST" : "GET",
			credentials: "omit",
			headers: new Headers({
				"Accept": "",
				"Accept-Language": ""
			}),
			mode: (document.URL == _AEM_SERVER) ? "same-origin" : "cors",
			redirect: "error",
			referrer: "",
			referrerPolicy: "no-referrer",
			body: post
		});
	} catch(e) {callback(0x02); return;}

	if (!r) {callback(0x02); return;}
	if (r.status !== 200) {callback(r.status); return;}

	aead_nonce[0] |= 128; // Response
	let dec;
	try {dec = sodium.crypto_aead_aegis256_decrypt(null, await r.bytes(), null, aead_nonce, _AEM_KEY_MPK);}
	catch(e) {callback(0x05); return;}

	if (dec[0] !== 191) {callback(0x06); return;}

	const bl = document.querySelectorAll("#fs_proc > div > button:first-of-type");
	const br = document.querySelectorAll("#fs_proc > div > button:last-of-type");
	bl[0].disabled = (dec[1] & 128) != 0;
	br[0].disabled = (dec[1] & 128) == 0;
	bl[1].disabled = (dec[1] &  64) != 0;
	br[1].disabled = (dec[1] &  64) == 0;
	bl[2].disabled = (dec[1] &  32) != 0;
	br[2].disabled = (dec[1] &  32) == 0;
	bl[3].disabled = (dec[1] &  16) != 0;
	br[3].disabled = (dec[1] &  16) == 0;
	bl[4].disabled = (dec[1] &   8) != 0;
	br[4].disabled = (dec[1] &   8) == 0;
	bl[5].disabled = (dec[1] &   4) != 0;
	br[5].disabled = (dec[1] &   4) == 0;

	let bt = dec.slice(2, 34);
	let count = 0;
	for (let i = 0; i < 256; i++) {
		if ((bt[Math.floor((i - (i % 8)) / 8)] & (1 << (i % 8))) != 0) {
			count++;
		}
	}
	document.querySelectorAll("#fs_proc input[type=range]")[0].value = count;
	document.querySelectorAll("#fs_proc input[type=range]")[0].onchange();

	bt = dec.slice(34, 66);
	count = 0;
	for (let i = 0; i < 256; i++) {
		if ((bt[Math.floor((i - (i % 8)) / 8)] & (1 << (i % 8))) != 0) {
			count++;
		}
	}
	document.querySelectorAll("#fs_proc input[type=range]")[1].value = count;
	document.querySelectorAll("#fs_proc input[type=range]")[1].onchange();

	callback(0);
};

// Use the 368-bit SMK with a 8-bit Nonce to generate up to 16 KiB
const _aem_kdf_smk = function(size, n, smk) {
	return sodium.crypto_stream_chacha20_ietf_xor_ic(new Uint8Array(size),
		/* Nonce   */ smk.slice(32, 44),
		/* Counter */ new Uint32Array([(smk[44] << 24) | (smk[45] << 16) | (n << 8)])[0],
		/* Key     */ smk.slice(0, 32));
}

if (window.isSecureContext
&& window.self === window.top
&& window.opener === null
&& document.compatMode != "BackCompat"
& document.characterSet === "UTF-8") {
	document.getElementById("fs_entry").disabled = false;
	document.getElementById("fs_entry").inert = false;
	document.getElementById("txt_server").focus();
}

document.querySelectorAll("#fs_proc > div > button:first-of-type").forEach(function(btn, i) {
	btn.onclick = function() {
		this.disabled = true;
		document.querySelectorAll("#fs_proc > div > button:last-of-type")[i].disabled = false;
		_mp(_AEM_MNG_CMD_SPAWN, i, function(status) {
			if (status !== 0) {
				document.querySelectorAll("#fs_proc > div > button:first-of-type")[i].disabled = false;
				document.querySelectorAll("#fs_proc > div > button:last-of-type")[i].disabled = true;
			}
		});
	};
});

document.querySelectorAll("#fs_proc input[type=range]").forEach(function(rng, i) {
	rng.onchange = function() {
		const v = document.querySelectorAll("#fs_proc input[type=range]")[i].value;
		document.querySelectorAll("#fs_proc div div button:nth-of-type(2)")[i].textContent = (v + "").padStart(3, " ");
		document.querySelectorAll("#fs_proc div div button:first-of-type")[i].disabled = (v == 0);
		document.querySelectorAll("#fs_proc div div button:last-of-type")[i].disabled = (v == 256);
	}
});

document.querySelectorAll("#fs_proc div div button:first-of-type").forEach(function(btn, i) {
	btn.onclick = function() {
		const el = document.querySelectorAll("#fs_proc input[type=range]")[i];
		el.value = Number(el.value) - 1;
		el.onchange();
	}
});

document.querySelectorAll("#fs_proc div div button:last-of-type").forEach(function(btn, i) {
	btn.onclick = function() {
		const el = document.querySelectorAll("#fs_proc input[type=range]")[i];
		el.value = Number(el.value) + 1;
		el.onchange();
	}
});

document.querySelectorAll("#fs_proc div div button:nth-of-type(2)").forEach(function(btn, i) {
	btn.onclick = function() {
		btn.disabled = true;
		_mp(_AEM_MNG_CMD_SPAWN, (6 + i) | (btn.textContent << 4), function(status) {
			if (status === 0) btn.disabled = false;
		});
	};
});

document.getElementById("btn_enter").onclick = function() {
	const txtServer = document.getElementById("txt_server");
	const txtSmk = document.getElementById("txt_smk");
	if (!txtServer.reportValidity() || !txtSmk.reportValidity()) return;

	document.getElementById("fs_entry").disabled = true;

	_AEM_SERVER = txtServer.value;
	_AEM_KEY_MPK = _aem_kdf_smk(sodium.crypto_aead_aegis256_KEYBYTES, _AEM_KDF_KEYID_SMK_MPK, sodium.from_hex(txtSmk.value));

	this.textContent = "Connecting...";
	_mp(_AEM_MNG_CMD_NOOP, 0, function(status) {
		_AEM_KEY_LCH = _aem_kdf_smk(sodium.crypto_aead_aegis256_KEYBYTES, _AEM_KDF_KEYID_SMK_LCH, sodium.from_hex(document.getElementById("txt_smk").value));
		_AEM_KEY_ACC = _aem_kdf_smk(_AEM_KDF_SUB_KEYLEN, _AEM_KDF_KEYID_SMK_ACC, sodium.from_hex(document.getElementById("txt_smk").value));
		_AEM_KEY_STO = _aem_kdf_smk(_AEM_KDF_SUB_KEYLEN, _AEM_KDF_KEYID_SMK_STO, sodium.from_hex(document.getElementById("txt_smk").value));
		_AEM_KEY_API = _aem_kdf_smk(_AEM_KDF_SUB_KEYLEN, _AEM_KDF_KEYID_SMK_API, sodium.from_hex(document.getElementById("txt_smk").value));

		if (status === 0) {
			txtSmk.value = "";
			txtServer.value = "";

			document.getElementById("fs_entry").disabled = true;
			document.getElementById("fs_entry").inert = true;
			document.getElementById("fs_entry").hidden = true;

			document.getElementById("fs_proc").disabled = false;
			document.getElementById("fs_proc").inert = false;
			document.getElementById("fs_proc").hidden = false;
		}
	});
}
