"use strict";

sodium.ready.then(function() {

const ae = new AllEars(function(ok) {
	if (!ok) {
		document.getElementById("greeting").textContent = "Failed loading All-Ears";
		return;
	}

	if (localStorage.greeting) {
		document.getElementById("greeting").textContent = localStorage.greeting;
		document.getElementById("txt_pg").value = localStorage.greeting;
	} else localStorage.greeting = document.getElementById("greeting").textContent;

	document.getElementById("txt_skey").maxLength = "64";
});

function TabState(cur, max, btnDele, btnUpdt) {
	this.cur = cur;
	this.max = max;
	this.btnDele = btnDele;
	this.btnUpdt = btnUpdt;
}

const tabs = [
	new TabState(0, 0, false, true), // Inbox
	new TabState(0, 0, false, true), // Outbx
	new TabState(0, 1, true, false), // Write
	new TabState(0, 2, false, false), // Notes
	new TabState(0, 2, false, true) // Tools
];

let showHeaders = false;

let tab = 0;
const TAB_INBOX = 0;
const TAB_DRBOX = 1;
const TAB_WRITE = 2;
const TAB_NOTES = 3;
const TAB_TOOLS = 4;

// Helper functions
function errorDialog(err) {
	if (typeof(err) !== "number" || err < 1) return;

	let btnDisable = [];
	const buttons = document.querySelectorAll("nav > button");
	buttons.forEach(function(btn) {
		btnDisable.push(btn.disabled);
		btn.disabled = true;
	});

	const errMsg = ae.GetErrorMessage(err);

	const dlg = document.querySelector("dialog");
	dlg.children[0].style.height = getComputedStyle(document.querySelector("#main1 > div[class='mid']")).height;
	dlg.querySelector("h1").textContent = "ERROR 0x" + err.toString(16).padStart(2, "0").toUpperCase();
	dlg.querySelector("p").textContent = (typeof(errMsg) === "string") ? errMsg : errMsg[1];
	dlg.show();

	document.querySelector("dialog > div").onclick = function() {
		buttons.forEach(function(btn, i) {btn.disabled = btnDisable[i];});
		dlg.close();
	};
}

function getCountryFlag(countryCode) {
	return (!countryCode || countryCode.length !== 2 || countryCode == "??") ? "❔" : sodium.to_string(new Uint8Array([
		240, 159, 135, 166 + countryCode.codePointAt(0) - 65,
		240, 159, 135, 166 + countryCode.codePointAt(1) - 65
	]));
}

function getClockIcon(d) {
	const h24 = d.getUTCHours();
	let h12 = (h24 === 0 ? 12 : ((h24 > 12) ? h24 - 12 : h24));

	const m60 = (d.getUTCMinutes() * 60) + d.getUTCSeconds();
	let m30 = 0;
	if (m60 <= 900) { // <= 15: round down to this hour
		m30 = 0;
	} else if (m60 > 900 && m60 < 2700) { // 15..45: round to half-past this hour
		m30 = 12;
	} else { // >= 45: round up to next hour
		h12++;
		m30 = 0;
	}

	return String.fromCodePoint((128335 + h12) + m30);
}

function downloadFile(num) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer]));
	a.download = ae.GetUplMsgTitle(num);
	a.click();

	URL.revokeObjectURL(a.href);
	a.href = "";
	a.download = "";
}

function clearDisplay() {
	const el = document.querySelector("article > img, article > audio, article > video, article > embed, article > iframe");
	if (!el) return;
	if (el.src) URL.revokeObjectURL(el.src);
	el.remove();
}

function clearMsgFlags() {
	document.getElementById("readmsg_flags").children[0].replaceChildren();
}

function addMsgFlag(abbr, abbrTitle) {
	const parent = document.getElementById("readmsg_flags").children[0];

	const el = document.createElement("abbr");
	el.title = abbrTitle;
	el.textContent = abbr;

	parent.appendChild(document.createTextNode(" "));
	parent.appendChild(el);
}

function displayFile(num) {
	const fileType = ae.GetUplMsgType(num);
	if (!fileType) {downloadFile(num); return;}

	clearDisplay();
	document.querySelector("article").scroll(0, 0);
	document.querySelector("article").setAttribute("data-msgid", ae.GetUplMsgIdHex(num));

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = false;
	document.getElementById("btn_reply").disabled = true;

	document.getElementById("btn_msave").onclick = function() {downloadFile(num);};

	document.querySelector("article > table").hidden = true;
	document.querySelector("article > h1").textContent = ae.GetUplMsgTitle(num);

	if (fileType === "text") {
		document.querySelector("article > pre").hidden = false;
		document.querySelector("article > pre").textContent = sodium.to_string(ae.GetUplMsgBody(num));
		return;
	}

	document.querySelector("article > pre").hidden = true;
	let el;

	switch (fileType) {
		case "image": {
			el = document.createElement("img");
			el.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer]));
			el.onclick = function() {
				if (!document.fullscreen)
					this.requestFullscreen();
				else
					document.exitFullscreen();
			};
		break;}

		case "audio":
		case "video": {
			el = document.createElement(fileType);
			el.controls = "controls";
			el.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer]));
		break;}

		case "pdf": {
			el = document.createElement("embed");
			el.type = "application/pdf";
			el.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer], {type: "application/pdf"}));
		break;}

		case "html": {
			el = document.createElement("iframe");
			el.allow = "";
			el.sandbox = "";
			el.referrerPolicy = "no-referrer";

			try {
				el.srcdoc =
					"<html><head><style>html, body {background: #080a08; color: #fff; scrollbar-color: #222 #333;} body {opacity:0.55;} body > *:first-child {margin-top: 0; padding-top: 0;} a {color: #fff;} button, input, select, textarea {background: #000; color: #fff;}</style></head>"
					+ sodium.to_string(ae.GetUplMsgBody(num).buffer)
						.replace(/.*<body/s, "<body")
						.replaceAll(/<head.*\/head>/gs, "")
						.replaceAll("<head", "<ignore")
						.replaceAll(/<style.*\/style>/gs, "")
						.replaceAll("<style", "<ignore")
						.replaceAll(/style=".[^"]*"/gs, "")
						.replaceAll(/style='.[^']*'/gs, "")
						.replaceAll(/style=[^ >]*/gs, "");
			} catch(e) {
				el.srcdoc = "<!doctype html><html><head><style>body {background: #080a08; color: #fff; opacity:0.55;} h1 {margin: 0;}</style><body><h1>Error</h1><p>" + e.message + "</p></body></html>";
			}
		break;}

		case "svg": {
			el = document.createElement("iframe");
			el.allow = "";
			el.sandbox = "";
			el.referrerPolicy = "no-referrer";
			el.srcdoc = "<!doctype><html><head><style>body,html,svg {margin: 0; padding: 0; border: 0; height: 100%; width: 100%; display: block; background: #080a08;}</style></head><body>" + sodium.to_string(ae.GetUplMsgBody(num).buffer) + "</body></html>";
		break;}

		default: return;
	}

	document.querySelector("article").appendChild(el);
}

function displayMsg(isInt, num) {
	clearDisplay();
	document.getElementById("btn_mdele").disabled = false;

	document.querySelector("article").scroll(0, 0);
	document.querySelector("article").setAttribute("data-msgid", isInt? ae.GetIntMsgIdHex(num) : ae.GetExtMsgIdHex(num));

	document.getElementById("btn_msave").disabled = false;
	document.getElementById("btn_msave").onclick = function() {
		this.blur();

		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([isInt? ae.ExportIntMsg(num) : ae.ExportExtMsg(num)]));
		a.download = (isInt? ae.GetIntMsgTitle(num) : ae.GetExtMsgTitle(num)) + ".eml";
		a.click();

		URL.revokeObjectURL(a.href);
		a.href = "";
		a.download = "";
	};

	const ts = isInt? ae.GetIntMsgTime(num) : ae.GetExtMsgTime(num);

	if (!isInt || (ae.GetIntMsgFrom(num) !== "public" && ae.GetIntMsgFrom(num) !== "system")) {
		document.getElementById("btn_reply").disabled = false;

		document.getElementById("btn_reply").onclick = function() {
			document.getElementById("write_recv").value = isInt? ae.GetIntMsgFrom(num) : ae.GetExtMsgReplyAddress(num);
			document.getElementById("write_subj").value = isInt? ae.GetIntMsgTitle(num) : ae.GetExtMsgTitle(num);
			if (!document.getElementById("write_subj").value.startsWith("Re:")) document.getElementById("write_subj").value = "Re: " + document.getElementById("write_subj").value;
			document.querySelector("#write2_pkey > input").value = isInt? ae.GetIntMsgFromPk(num) : "";

			document.getElementById("write_recv").readOnly = !isInt;
			document.getElementById("write_subj").readOnly = !isInt;
			document.getElementById("write_subj").setAttribute("data-replyid", isInt? "" : ae.GetExtMsgHdrId(num));

			tabs[TAB_WRITE].cur = 0;
			document.getElementById("btn_write").disabled = false;
			document.getElementById("btn_write").click();
			document.getElementById("write_body").focus();

			for (const opt of document.getElementById("write_from").options) {
				if (opt.value === (isInt ? ae.GetIntMsgTo(num) : ae.GetExtMsgEnvTo(num).split("@")[0].toLowerCase())) {
					opt.selected = true;
				}
			}
		};
	} else {
		document.getElementById("btn_reply").disabled = true;
	}

	document.querySelector("article > table").hidden = false;
	document.querySelector("article > pre").hidden = false;

	document.getElementById("readmsg_envto").textContent = isInt ? "" : ae.GetExtMsgEnvTo(num);
	document.getElementById("readmsg_hdrto").textContent = isInt ? ae.GetIntMsgTo(num) : (ae.GetExtMsgHdrTo(num));
	if(!isInt && ae.GetExtMsgDnTo(num)) {
		const span = document.createElement("span");
		span.className = "sans";
		span.textContent = " • " + ae.GetExtMsgDnTo(num);
		document.getElementById("readmsg_hdrto").appendChild(span);
	}

	const tzOs = new Date().getTimezoneOffset();
	const msgDate = new Date((ts * 1000) + (tzOs * -60000));
	document.getElementById("readmsg_date").children[0].textContent = getClockIcon(msgDate);
	document.getElementById("readmsg_date").children[1].dateTime = new Date(ts * 1000).toISOString();

	if (isInt) {
		document.querySelector("article > h1").textContent = ae.GetIntMsgTitle(num);
		document.querySelector("article > pre").textContent = ae.GetIntMsgBody(num);

		document.getElementById("readmsg_date").children[1].textContent = msgDate.toISOString().slice(0, 19).replace("T", " ");

		document.getElementById("readmsg_ip").style.visibility = "hidden";
		document.getElementById("readmsg_rdns").style.visibility = "hidden";
		document.getElementById("readmsg_dkim").style.visibility = "hidden";
		document.getElementById("readmsg_greet").style.visibility = "hidden";
		document.getElementById("readmsg_cert").style.visibility = "hidden";
		document.getElementById("readmsg_envfrom").style.visibility = "hidden";
		document.getElementById("readmsg_envto").style.visibility = "hidden";

		if (ae.GetIntMsgFrom(num) !== "system" && ae.GetIntMsgFrom(num) !== "public") {
			document.getElementById("readmsg_tls").style.visibility = "visible";
			document.getElementById("readmsg_tls").children[0].textContent = ae.GetIntMsgFromPk(num);
		} else document.getElementById("readmsg_tls").style.visibility = "hidden";

		let symbol = document.createElement("span");
		if      (ae.GetIntMsgLevel(num) === 3 && ae.GetIntMsgFrom(num) === "system") {symbol.title = "System message"; symbol.textContent = "🅢";}
		else if (ae.GetIntMsgLevel(num) === 3 && ae.GetIntMsgFrom(num) === "public") {symbol.title = "Public announcement"; symbol.textContent = "🅟";}
		else if (ae.GetIntMsgLevel(num) === 3) {symbol.title = "Administrator"; symbol.textContent = "🅐";}
		else if (ae.GetIntMsgLevel(num) === 2) {symbol.title = "Level 2";  symbol.textContent = "➋";}
		else if (ae.GetIntMsgLevel(num) === 1) {symbol.title = "Level 1";  symbol.textContent = "➊";}
		else if (ae.GetIntMsgLevel(num) === 0) {symbol.title = "Level 0";  symbol.textContent = "🄌";}
		else {symbol.title = "Invalid level"; symbol.textContent = "⚠";}

		document.getElementById("readmsg_hdrfrom").replaceChildren(symbol, document.createTextNode(" " + ae.GetIntMsgFrom(num)));

		clearMsgFlags();
		if (!ae.GetIntMsgFlagVPad(num)) addMsgFlag("PAD", "Invalid padding");
		if (!ae.GetIntMsgFlagVSig(num)) addMsgFlag("SIG", "Invalid signature");
		if ( ae.GetIntMsgFlagE2ee(num)) addMsgFlag("E2EE", "End-to-end encrypted");
	} else {
		const headers = document.createElement("p");
		headers.textContent = ae.GetExtMsgHeaders(num);
		headers.className = "mono";
		headers.hidden = !showHeaders;

		const body = document.createElement("p");
		body.innerHTML = ae.GetExtMsgBody(num);

		document.querySelector("article > pre").replaceChildren(headers, body);

		const h1 = document.querySelector("article > h1");
		h1.textContent = ae.GetExtMsgTitle(num);
		h1.style.cursor = headers.textContent? "pointer" : "";
		h1.onclick = function() {
			if (!headers.textContent) return;
			showHeaders = !showHeaders;
			headers.hidden = !showHeaders;
		};

		let hdrSecs = Math.abs(ae.GetExtMsgHdrTime(num));
		let hdrTime = "";
		if (hdrSecs >= 3600) {
			const hdrHours = Math.floor(hdrSecs / 3600);
			hdrTime += hdrHours.toString() + "h ";
			hdrSecs -= hdrHours * 3600;
		}
		if (hdrSecs >= 60) {
			const hdrMins = Math.floor(hdrSecs / 60);
			hdrTime += hdrMins.toString() + "m ";
			hdrSecs -= hdrMins * 60;
		}
		hdrTime += hdrSecs + "s";

		const hdrTz = (ae.GetExtMsgHdrTz(num) >= 0 ? "+" : "-") + Math.floor(Math.abs(ae.GetExtMsgHdrTz(num)) / 60).toString().padStart(2, "0") + (Math.abs(ae.GetExtMsgHdrTz(num)) % 60).toString().padStart(2, "0");
		document.getElementById("readmsg_date").children[1].textContent = msgDate.toISOString().slice(0, 19).replace("T", " ") + "; " + hdrTz + " " + ((ae.GetExtMsgHdrTime(num) >= 0) ? "+" : "-") + hdrTime;

		document.getElementById("readmsg_ip").style.visibility = "visible";
		document.getElementById("readmsg_rdns").style.visibility = "visible";
		document.getElementById("readmsg_dkim").style.visibility = "visible";
		document.getElementById("readmsg_greet").style.visibility = "visible";
		document.getElementById("readmsg_tls").style.visibility = "visible";
		document.getElementById("readmsg_cert").style.visibility = "visible";
		document.getElementById("readmsg_envfrom").style.visibility = "visible";
		document.getElementById("readmsg_envto").style.visibility = "visible";

		// DKIM
		let dkim = "";
		if (ae.GetExtMsgDkim(num)) {
			[ // Look for a matching domain in this order
				ae.GetExtMsgHdrFrom(num).split("@")[1],
				ae.GetExtMsgEnvFrom(num).split("@")[1],
				ae.GetExtMsgRdns(num),
				ae.GetExtMsgGreet(num),
				ae.GetExtMsgTlsDomain(num)
			].forEach(function(dom) {
				if (dkim) return;
				for (let i = 0; i < ae.GetExtMsgDkim(num).domain.length; i++) {
					if (ae.GetExtMsgDkim(num).domain[i] === dom) {
						dkim = dom + " ✓";
						return;
					}
				}
			});

			if (!dkim) dkim = ae.GetExtMsgDkim(num).domain[0]; // Default to first signature domain
		}

		if (ae.GetExtMsgFlagDkFl(num)) dkim += " (fail)";

		// Left side
		document.getElementById("readmsg_country").textContent = getCountryFlag(ae.GetExtMsgCcode(num));
		document.getElementById("readmsg_country").title = ae.GetExtMsgCname(num);
		document.getElementById("readmsg_ip").children[1].textContent = ae.GetExtMsgIp(num) + (ae.GetExtMsgFlagIpBl(num) ? " ❗" : "");
		document.getElementById("readmsg_tls").children[0].textContent = ae.GetExtMsgTLS(num);

		// Right side
		document.getElementById("readmsg_greet").children[0].textContent = ae.GetExtMsgGreet(num) + (ae.GetExtMsgFlagGrDm(num) ? " ✓" : "");
		document.getElementById("readmsg_rdns").children[0].textContent = ae.GetExtMsgRdns(num) + (ae.GetExtMsgGreet(num) === ae.GetExtMsgRdns(num) ? " ✓" : "");
		document.getElementById("readmsg_cert").children[0].textContent = ae.GetExtMsgTlsDomain(num) ? (ae.GetExtMsgTlsDomain(num) + " ✓") : "";
		document.getElementById("readmsg_dkim").children[0].textContent = dkim;
		document.getElementById("readmsg_envfrom").textContent = ae.GetExtMsgEnvFrom(num);
		document.getElementById("readmsg_hdrfrom").textContent = ae.GetExtMsgHdrFrom(num);
		if (ae.GetExtMsgDnFrom(num)) {
			const span = document.createElement("span");
			span.className = "sans";
			span.textContent = " • " + ae.GetExtMsgDnFrom(num);
			document.getElementById("readmsg_hdrfrom").appendChild(span);
		}

		clearMsgFlags();
		if (!ae.GetExtMsgFlagVPad(num)) addMsgFlag("PAD", "Invalid padding");
		if (!ae.GetExtMsgFlagVSig(num)) addMsgFlag("SIG", "Invalid signature");
		if (!ae.GetExtMsgFlagPExt(num)) addMsgFlag("SMTP", "The sender did not use the Extended (ESMTP) protocol");
		if (!ae.GetExtMsgFlagQuit(num)) addMsgFlag("QUIT", "The sender did not issue the required QUIT command");
		if ( ae.GetExtMsgFlagRare(num)) addMsgFlag("RARE", "The sender issued unusual command(s)");
		if ( ae.GetExtMsgFlagFail(num)) addMsgFlag("FAIL", "The sender issued invalid command(s)");
		if ( ae.GetExtMsgFlagPErr(num)) addMsgFlag("PROT", "The sender violated the protocol");
	}
}

function displayOutMsg(num) {
	clearDisplay();
	document.querySelector("article").scroll(0, 0);
	document.querySelector("article").setAttribute("data-msgid", ae.GetOutMsgIdHex(num));

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = true;
	document.getElementById("btn_reply").disabled = true;

	document.querySelector("article > table").hidden = false;
	document.querySelector("article > pre").hidden = false;

	document.querySelector("article > h1").textContent = ae.GetOutMsgSubj(num);
	document.querySelector("article > pre").textContent = ae.GetOutMsgBody(num);

	document.getElementById("readmsg_dkim").style.visibility    = "hidden";
	document.getElementById("readmsg_hdrto").style.visibility   = "visible";
	document.getElementById("readmsg_hdrfrom").style.visibility = "visible";
	document.getElementById("readmsg_envto").style.visibility   = "visible";
	document.getElementById("readmsg_envfrom").style.visibility = "hidden";

	document.getElementById("readmsg_hdrfrom").textContent = ae.GetOutMsgFrom(num);

	document.getElementById("readmsg_envto").textContent = ae.GetOutMsgMxDom(num);
	document.getElementById("readmsg_hdrto").textContent = ae.GetOutMsgTo(num);

	const ts = ae.GetOutMsgTime(num);
	const tzOs = new Date().getTimezoneOffset();
	document.getElementById("readmsg_date").children[1].textContent = new Date((ts * 1000) + (tzOs * -60000)).toISOString().slice(0, 19).replace("T", " ");

	const isInt = ae.GetOutMsgIsInt(num);
	document.getElementById("readmsg_ip").style.visibility    = isInt? "hidden" : "visible";
	document.getElementById("readmsg_rdns").style.visibility  = /*isInt?*/ "hidden" /*: "visible"*/; // TODO
	document.getElementById("readmsg_tls").style.visibility   = /*isInt?*/ "hidden" /*: "visible"*/; // TODO
	document.getElementById("readmsg_cert").style.visibility  = /*isInt?*/ "hidden" /*: "visible"*/; // TODO
	document.getElementById("readmsg_greet").style.visibility = isInt? "hidden" : "visible";

	if (!isInt) {
		document.getElementById("readmsg_ip").children[1].textContent = ae.GetOutMsgIp(num);
//		document.getElementById("readmsg_country").textContent = getCountryFlag(cc) + " " + getCountryName(cc);
//		document.getElementById("readmsg_tls").children[0].textContent = ae.GetOutMsgTLS(num);
		document.getElementById("readmsg_greet").children[0].textContent = ae.GetOutMsgGreet(num);
	}

	clearMsgFlags();
	if (!ae.GetOutMsgFlagVPad(num)) addMsgFlag("PAD", "Invalid padding");
	if (!ae.GetOutMsgFlagVSig(num)) addMsgFlag("SIG", "Invalid signature");
	if ( ae.GetOutMsgFlagE2ee(num)) addMsgFlag("E2EE", "End-to-end encrypted");
}

function updateAddressButtons() {
	const limitReached = (ae.GetAddressCountNormal() + ae.GetAddressCountShield() >= 31);
	document.getElementById("btn_address_create_normal").disabled = (limitReached || ae.GetAddressCountNormal() >= ae.GetLimitNormalA(ae.GetUserLevel()));
	document.getElementById("btn_address_create_shield").disabled = (limitReached || ae.GetAddressCountShield() >= ae.GetLimitShieldA(ae.GetUserLevel()));
}

function updateAddressCounts() {
	document.querySelector("#tbd_accs > tr > td:nth-child(3)").textContent = ae.GetAddressCountNormal();
	document.querySelector("#tbd_accs > tr > td:nth-child(4)").textContent = ae.GetAddressCountShield();

	document.getElementById("limit_normal").textContent = (ae.GetAddressCountNormal() + "/" + ae.GetLimitNormalA(ae.GetUserLevel())).padStart(ae.GetLimitNormalA(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_shield").textContent = (ae.GetAddressCountShield() + "/" + ae.GetLimitShieldA(ae.GetUserLevel())).padStart(ae.GetLimitShieldA(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_total").textContent = ((ae.GetAddressCountNormal() + ae.GetAddressCountShield()) + "/" + ae.GetAddrPerUser()).padStart(5);

	updateAddressButtons();
}

function adjustLevel(pubkey, level, c) {
	const fs = document.getElementById("tbl_accs");
	fs.disabled = true;

	ae.Account_Update(pubkey, level, function(error) {
		fs.disabled = false;

		if (error === 0) {
			c[4].textContent = level;
			c[5].children[0].disabled = (level === 3);
			c[6].children[0].disabled = (level === 0);
		} else errorDialog(error);
	});
}

function addMsg(isInt, i) {
	const row = document.getElementById("tbl_inbox").insertRow(-1);
	row.setAttribute("data-msgid", isInt? ae.GetIntMsgIdHex(i) : ae.GetExtMsgIdHex(i));

	const ts = isInt? ae.GetIntMsgTime(i) : ae.GetExtMsgTime(i);
	const el = document.createElement("time");
	el.dateTime = new Date(ts * 1000).toISOString();
	el.textContent = new Date((ts * 1000) + (new Date().getTimezoneOffset() * -60000)).toISOString().slice(0, 10);
	let cell = row.insertCell(-1);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	cell.textContent = isInt? ae.GetIntMsgTitle(i) : ae.GetExtMsgTitle(i);

	if (isInt) {
		cell = row.insertCell(-1);
		cell.textContent = ae.GetIntMsgFrom(i);
		cell.className = (ae.GetIntMsgFrom(i).length === 16) ? "mono" : "";
	} else {
		const from1 = ae.GetExtMsgHdrFrom(i);
		const from2 = from1.substring(from1.indexOf("@") + 1);
		cell = row.insertCell(-1);
		cell.textContent = from1.substring(0, from1.indexOf("@"));

		const flag = document.createElement("abbr");
		flag.textContent = getCountryFlag(ae.GetExtMsgCcode(i));
		flag.title = ae.GetExtMsgCname(i);

		const fromText = document.createElement("span");
		fromText.textContent = " " + from2;

		cell = row.insertCell(-1);
		cell.appendChild(flag);
		cell.appendChild(fromText);
	}

	row.onclick = function() {
		displayMsg(isInt, i);
	};
}

function getRowsPerPage(tbl) {
	tbl.replaceChildren();
	const row = tbl.insertRow(-1);
	const cell = row.insertCell(-1);
	cell.textContent = "0";
	const rowsPerPage = Math.floor(getComputedStyle(tbl).height.replace("px", "") / getComputedStyle(tbl.getElementsByTagName("tr")[0]).height.replace("px", ""));
	tbl.replaceChildren();
	return rowsPerPage;
}

function showInbox() {
	const tbl = document.getElementById("tbl_inbox");
	const rowsPerPage = getRowsPerPage(tbl);

	const maxExt = ae.GetExtMsgCount();
	const maxInt = ae.GetIntMsgCount();
	const loadMore = ae.GetReadyMsgBytes() < ae.GetTotalMsgBytes();

	if (maxExt + maxInt > 0) {
		tabs[TAB_INBOX].max = Math.floor((maxExt + maxInt - (loadMore? 0 : 1)) / rowsPerPage);
		document.getElementById("btn_rght").disabled = (tabs[TAB_INBOX].cur >= tabs[TAB_INBOX].max);
		tbl.replaceChildren();

		let skipMsgs = rowsPerPage * tabs[TAB_INBOX].cur;
		let numExt = 0;
		let numInt = 0;
		let numAdd = 0;

		while (numAdd < rowsPerPage) {
			const tsInt = (numInt < maxInt) ? ae.GetIntMsgTime(numInt) : -1;
			const tsExt = (numExt < maxExt) ? ae.GetExtMsgTime(numExt) : -1;
			if (tsInt === -1 && tsExt === -1) break;

			if (tsInt !== -1 && (tsExt === -1 || tsInt > tsExt)) {
				if (skipMsgs > 0) skipMsgs--; else {addMsg(true, numInt); numAdd++;}
				numInt++;
			} else if (tsExt !== -1) {
				if (skipMsgs > 0) skipMsgs--; else {addMsg(false, numExt); numAdd++;}
				numExt++;
			}
		}
	} else {
		tabs[TAB_INBOX].max = 0;
	}

	if (loadMore && tabs[TAB_INBOX].cur >= tabs[TAB_INBOX].max) {
		const row = tbl.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + Math.round((ae.GetTotalMsgBytes() - ae.GetReadyMsgBytes()) / 1024) + " KiB left)";

		row.onclick = function() {
			tbl.style.opacity = 0.5;

			ae.Message_Browse(false, false, function(errorBrowse) {
				tbl.style.opacity = 1;

				if (errorBrowse !== 0) {
					errorDialog(errorBrowse);
					return;
				}

				showInbox();
			});
		};
	}
}

function showDrbox() {
	const tbl = document.getElementById("tbl_drbox");
	const rowsPerPage = getRowsPerPage(tbl);

	const drCount = ae.GetOutMsgCount();
	const loadMore = ae.GetReadyMsgBytes() < ae.GetTotalMsgBytes();

	if (drCount > 0) {
		tabs[TAB_DRBOX].max = Math.floor((drCount - (loadMore? 0 : 1)) / rowsPerPage);
		document.getElementById("btn_rght").disabled = (tabs[TAB_DRBOX].cur >= tabs[TAB_DRBOX].max);
		tbl.replaceChildren();

		let skipMsgs = rowsPerPage * tabs[TAB_DRBOX].cur;
		let numAdd = 0;

		for (let i = 0; numAdd < rowsPerPage && i < drCount; i++) {
			if (skipMsgs > 0) {
				skipMsgs--;
				continue;
			}

			const row = tbl.insertRow(-1);
			row.setAttribute("data-msgid", ae.GetOutMsgIdHex(i));

			let cell;
			cell = row.insertCell(-1); cell.textContent = new Date(ae.GetOutMsgTime(i) * 1000).toISOString().slice(0, 10);
			cell = row.insertCell(-1); cell.textContent = ae.GetOutMsgSubj(i);
			row.onclick = function() {displayOutMsg(i);};

			numAdd++;
		}
	} else {
		tabs[TAB_DRBOX].max = 0;
	}

	if (loadMore && tabs[TAB_DRBOX].cur >= tabs[TAB_DRBOX].max) {
		const row = tbl.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + Math.round((ae.GetTotalMsgBytes() - ae.GetReadyMsgBytes()) / 1024) + " KiB left)";

		row.onclick = function() {
			tbl.style.opacity = 0.5;

			ae.Message_Browse(false, false, function(errorBrowse) {
				tbl.style.opacity = 1;

				if (errorBrowse !== 0) {
					errorDialog(errorBrowse);
					return;
				}

				showDrbox();
			});
		};
	}
}

function showFiles() {
	const tbl = document.getElementById("tbl_files");
	const rowsPerPage = getRowsPerPage(tbl);

	const msgCount = ae.GetUplMsgCount();
	const loadMore = ae.GetReadyMsgBytes() < ae.GetTotalMsgBytes();

	if (msgCount > 0) {
		tabs[TAB_NOTES].max = 2 + Math.floor((msgCount - (loadMore? 0 : 1)) / rowsPerPage);
		document.getElementById("btn_rght").disabled = (tabs[TAB_NOTES].cur >= tabs[TAB_NOTES].max);
		tbl.replaceChildren();

		let skipMsgs = rowsPerPage * (tabs[TAB_NOTES].cur - 2);
		let numAdd = 0;

		for (let i = 0; numAdd < rowsPerPage && i < msgCount; i++) {
			if (skipMsgs > 0) {
				skipMsgs--;
				continue;
			}

			const row = tbl.insertRow(-1);
			row.setAttribute("data-msgid", ae.GetUplMsgIdHex(i));
			row.onclick = function() {displayFile(i);};

			let cell = row.insertCell(-1);
			cell.textContent = new Date(ae.GetUplMsgTime(i) * 1000).toISOString().slice(0, 10);

			cell = row.insertCell(-1);
			cell.textContent = ae.GetUplMsgTitle(i);

			cell = row.insertCell(-1);
			cell.textContent = (ae.GetUplMsgBytes(i) / 1024).toFixed(1);

			cell = row.insertCell(-1);
			const btn = document.createElement("button");
			btn.setAttribute("data-msgid", ae.GetUplMsgIdHex(i));
			btn.type = "button";
			btn.textContent = "X";
			btn.onclick = function() {
				const tr = this.parentElement.parentElement;
				ae.Message_Delete(this.getAttribute("data-msgid"), function(error) {
					if (error === 0) tr.remove();
					else errorDialog(error);
				});
			};
			cell.appendChild(btn);

			numAdd++;
		}
	} else {
		tabs[TAB_NOTES].max = 2;
	}

	if (loadMore && tabs[TAB_NOTES].cur >= tabs[TAB_NOTES].max) {
		const row = tbl.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + Math.round((ae.GetTotalMsgBytes() - ae.GetReadyMsgBytes()) / 1024) + " KiB left)";

		row.onclick = function() {
			tbl.style.opacity = 0.5;

			ae.Message_Browse(false, false, function(errorBrowse) {
				tbl.style.opacity = 1;

				if (errorBrowse !== 0) {
					errorDialog(errorBrowse);
					return;
				}

				showFiles();
			});
		};
	}
}

function addAccountToTable(i) {
	const row = document.getElementById("tbd_accs").insertRow(-1);
	let cell;
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserPkHex(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserSpace(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserNAddr(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserSAddr(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserLevel(i);

	cell = row.insertCell(-1);
	let btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "+";
	btn.disabled = (ae.Admin_GetUserLevel(i) === 3);
	btn.onclick = function() {const c = this.parentElement.parentElement.cells; adjustLevel(c[0].textContent, parseInt(c[4].textContent, 10) + 1, c);};
	cell.appendChild(btn);

	cell = row.insertCell(-1);
	btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "−";
	btn.disabled = (ae.Admin_GetUserLevel(i) === 0);
	btn.onclick = function() {const c = this.parentElement.parentElement.cells; adjustLevel(c[0].textContent, parseInt(c[4].textContent, 10) - 1, c);};
	cell.appendChild(btn);

	cell = row.insertCell(-1);
	btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "X";
	btn.onclick = function() {
		const tr = this.parentElement.parentElement;
		ae.Account_Delete(tr.cells[0].textContent, function(error) {
			if (error === 0) tr.remove(); else errorDialog(error);
		});
	};
	cell.appendChild(btn);
}

function reloadAccount() {
	// Limits
	const tblLimits = document.getElementById("tbl_limits");
	if (ae.IsUserAdmin()) {
		for (let i = 0; i < 4; i++) {
			tblLimits.rows[i].cells[1].children[0].disabled = false;
			tblLimits.rows[i].cells[2].children[0].disabled = false;
			tblLimits.rows[i].cells[3].children[0].disabled = false;

			tblLimits.rows[i].cells[1].children[0].value = ae.GetLimitStorage(i) + 1;
			tblLimits.rows[i].cells[2].children[0].value = ae.GetLimitNormalA(i);
			tblLimits.rows[i].cells[3].children[0].value = ae.GetLimitShieldA(i);
		}
	} else {
		const lvl = ae.GetUserLevel();
		tblLimits.rows[lvl].cells[1].children[0].value = ae.GetLimitStorage(lvl) + 1;
		tblLimits.rows[lvl].cells[2].children[0].value = ae.GetLimitNormalA(lvl);
		tblLimits.rows[lvl].cells[3].children[0].value = ae.GetLimitShieldA(lvl);
	}

	// Our account details
	const row = document.getElementById("tbd_accs").insertRow(-1);

	let cell;
	cell = row.insertCell(-1); cell.textContent = ae.GetUserPkHex();
	cell = row.insertCell(-1); cell.textContent = Math.round(ae.GetTotalMsgBytes() / 1048576); // MiB
	cell = row.insertCell(-1); cell.textContent = ae.GetAddressCountNormal();
	cell = row.insertCell(-1); cell.textContent = ae.GetAddressCountShield();
	cell = row.insertCell(-1); cell.textContent = ae.GetUserLevel();

	cell = row.insertCell(-1);
	let btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "+";
	btn.disabled = true;
	cell.appendChild(btn);

	cell = row.insertCell(-1);
	btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "−";
	btn.disabled = true;
	btn.id = "btn_lowme";
	btn.onclick = function() {
		const newLevel = parseInt(row.cells[4].textContent, 10) - 1;
		ae.Account_Update(ae.GetUserPkHex(), newLevel, function(error) {
			if (error === 0) {
				row.cells[4].textContent = newLevel;
				if (newLevel === 0) {
					document.getElementById("btn_lowme").disabled = true;
					document.getElementById("chk_lowme").disabled = true;
				}
			} else errorDialog(error);
		});
	};
	cell.appendChild(btn);

	cell = row.insertCell(-1);
	btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "X";
	btn.disabled = true;
	btn.id = "btn_delme";
	btn.onclick = function() {
		ae.Account_Delete(ae.GetUserPkHex(), function(error) {
			if (error === 0) {
				row.remove();
				document.getElementById("chk_delme").disabled = true;
			} else errorDialog(error);
		});
	};
	cell.appendChild(btn);

	document.getElementById("txt_reg").disabled = !ae.IsUserAdmin();
	document.getElementById("btn_reg").disabled = !ae.IsUserAdmin();
	document.getElementById("chk_lowme").disabled = (ae.GetUserLevel() === 0);

	// Contacts
	for (let i = 0; i < ae.GetContactCount(); i++) {
		addContact(
			ae.GetContactMail(i),
			ae.GetContactName(i),
			ae.GetContactNote(i)
		);
	}

	refreshContactList();

	// Addresses
	for (let i = 0; i < ae.GetAddressCount(); i++) {
		addAddress(i);
	}

	document.getElementById("txt_notepad").value = ae.GetPrivateExtra(true);
	updateAddressCounts();
	showInbox();
}

function deleteAddress(addr) {
	const buttons = document.querySelectorAll("#tbl_addrs button");
	buttons.forEach(function(btn) {btn.disabled = true;});

	let addressToDelete = -1;
	for (let i = 0; i < ae.GetAddressCount(); i++) {
		if (addr === ae.GetAddress(i)) {
			addressToDelete = i;
			break;
		}
	}

	if (addressToDelete === -1) return;

	ae.Address_Delete(addressToDelete, function(error1) {
		if (error1 !== 0) {
			buttons.forEach(function(btn) {btn.disabled = false;});
			errorDialog(error1);
			return;
		}

		document.getElementById("tbl_addrs").deleteRow(addressToDelete);
		document.getElementById("write_from").remove(addressToDelete);
		updateAddressCounts();

		ae.Private_Update(function(error2) {
			buttons.forEach(function(btn) {btn.disabled = false;});
			if (error2) errorDialog(error2);
		});
	});
}

function addAddress(num) {
	const addrTable = document.getElementById("tbl_addrs");
	const row = addrTable.insertRow(-1);
	const addr = ae.GetAddress(num);

	let cell = row.insertCell(-1);
	cell.textContent = addr;
	cell.onclick = function() {navigator.clipboard.writeText(((this.textContent.length === 16) ? ae.ShieldMix(this.textContent) : this.textContent) + "@" + ae.GetDomainEml());};

	cell = row.insertCell(-1);
	let el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.GetAddressAccExt(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.GetAddressAccInt(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("button");
	el.type = "button";
	el.textContent = "X";
	el.onclick = function() {deleteAddress(addr);};
	cell.appendChild(el);

	el = document.createElement("option");
	el.value = addr;
	el.textContent = addr + "@" + ae.GetDomainEml();
	document.getElementById("write_from").appendChild(el);
}

function clearWrite() {
	tabs[tab].cur = 0;
	updateTab();

	document.querySelector("#write2_pkey > input").value = "";
	document.getElementById("write_body").value = "";
	document.getElementById("write_subj").value = "";
	document.getElementById("write_subj").readOnly = false;
	document.getElementById("write_subj").setAttribute("data-replyid", "");
	document.getElementById("write_recv").value = "";
	document.getElementById("write_recv").readOnly = false;
	document.getElementById("write_recv").focus();
}

// Interface
document.getElementById("btn_dele").onclick = function() {
	this.blur();

	if (tab === TAB_WRITE) clearWrite();
};

document.getElementById("btn_updt").onclick = function() {
	const btn = this;
	btn.disabled = true;
	btn.blur();

	if (tab === TAB_INBOX) {
		document.getElementById("tbl_inbox").style.opacity = 0.5;

		ae.Message_Browse(true, false, function(error) {
			if (error === 0) {
				showInbox();
			} else {
				errorDialog(error);
			}

			document.getElementById("tbl_inbox").style.opacity = 1;
			btn.disabled = false;
		});
	}
};

document.getElementById("btn_mdele").onclick = function() {
	const delId = document.querySelector("article").getAttribute("data-msgid");
	if (!delId) return;

	const btn = this;
	btn.blur();
	btn.disabled = true;

	ae.Message_Delete(delId, function(error) {
		if (error !== 0) {
			btn.disabled = false;
			errorDialog(error);
			return;
		}

		switch (tab) {
			case TAB_INBOX: showInbox(); break;
			case TAB_DRBOX: showDrbox(); break;
			case TAB_NOTES: showFiles(); break;
		}
	});
};

function refreshContactList() {
	let opts = [];

	for (let i = 0; i < ae.GetContactCount(); i++) {
		const el = document.createElement("option");
		el.value = ae.GetContactMail(i);
		opts.push(el);
	}

	if (ae.IsUserAdmin()) {
		const el = document.createElement("option");
		el.value = "public";
		opts.push(el);
	}

	document.getElementById("contact_emails").replaceChildren(...opts);
}

function addContact(mail, name, note) {
	const tbl = document.getElementById("tbl_ctact");
	const row = tbl.insertRow(-1);

	let cell = row.insertCell(-1);
	cell.autocapitalize = "off";
	cell.contentEditable = true;
	cell.inputMode = "email";
	cell.spellcheck = false;
	cell.textContent = mail;

	cell = row.insertCell(-1);
	cell.autocapitalize = "words";
	cell.contentEditable = true;
	cell.spellcheck = false;
	cell.textContent = name;

	cell = row.insertCell(-1);
	cell.autocapitalize = "off";
	cell.contentEditable = true;
	cell.spellcheck = false;
	cell.textContent = note;

	cell = row.insertCell(-1);
	const el = document.createElement("button");
	el.type = "button";
	el.textContent = "X";
	el.onclick = function() {row.remove();};
	cell.appendChild(el);
}

document.getElementById("btn_newcontact").onclick = function() {
	addContact("", "", "");
};

document.getElementById("btn_savecontacts").onclick = function() {
	while (ae.GetContactCount() > 0) {
		ae.DeleteContact(0);
	}

	for (const row of document.getElementById("tbl_ctact").rows) {
		ae.AddContact(row.cells[0].textContent, row.cells[1].textContent, row.cells[2].textContent);
	}

	refreshContactList();

	const btn = this;
	btn.disabled = true;

	ae.Private_Update(function(error) {
		btn.disabled = false;
		if (error) errorDialog(error);
	});
};

function writeVerify() {
	if (
	   !document.getElementById("write_recv").reportValidity()
	|| !document.getElementById("write_subj").reportValidity()
	|| !document.getElementById("write_body").reportValidity()
	) {tabs[TAB_WRITE].cur = 0; return;}

	document.getElementById("div_write_1").hidden = true;
	document.getElementById("div_write_2").hidden = false;

	document.getElementById("write2_recv").textContent = document.getElementById("write_recv").value;
	document.getElementById("write2_subj").textContent = document.getElementById("write_subj").value;
	document.getElementById("write2_rply").textContent = document.getElementById("write_subj").getAttribute("data-replyid");
	document.getElementById("write2_body").textContent = document.getElementById("write_body").value;

	if (document.getElementById("write_recv").value.indexOf("@") >= 0) {
		document.getElementById("write2_from").textContent = document.getElementById("write_from").value + "@" + ae.GetDomainEml();
		document.getElementById("write2_pkey").hidden = true;
	} else {
		document.getElementById("write2_from").textContent = document.getElementById("write_from").value;
		document.getElementById("write2_pkey").hidden = (document.getElementById("write_recv").value === "public");
	}

	document.querySelector("#write2_send > button").disabled = false;
	document.getElementById("write2_btntxt").textContent = (document.getElementById("write_recv").value === "public") ? "Make" : "Send to";
}

function updateTab() {
	switch (tab) {
		case TAB_INBOX: showInbox(); break;
		case TAB_DRBOX: showDrbox(); break;

		case TAB_WRITE:
			if (tabs[tab].cur === 0) {
				document.getElementById("div_write_1").hidden = false;
				document.getElementById("div_write_2").hidden = true;
				document.getElementById("write_body").focus();
			} else {
				writeVerify();
			}
		break;

		case TAB_NOTES:
			switch (tabs[tab].cur) {
				case 0:
					document.getElementById("div_notes").children[0].hidden = false;
					document.getElementById("div_notes").children[1].hidden = true;
					document.getElementById("div_notes").children[2].hidden = true;
				break;

				case 1:
					document.getElementById("div_notes").children[0].hidden = true;
					document.getElementById("div_notes").children[1].hidden = false;
					document.getElementById("div_notes").children[2].hidden = true;
				break;

				case 2:
					document.getElementById("div_notes").children[0].hidden = true;
					document.getElementById("div_notes").children[1].hidden = true;
					document.getElementById("div_notes").children[2].hidden = false;

				default:
					showFiles();
			}
		break;

		case TAB_TOOLS:
			for (let i = 0; i <= tabs[tab].max; i++) {
				document.getElementById("div_tools").children[i].hidden = (i !== tabs[tab].cur);
			}
		break;
	}

	document.getElementById("btn_left").disabled = (tabs[tab].cur === 0);
	document.getElementById("btn_rght").disabled = (tabs[tab].cur === tabs[tab].max);
}

document.getElementById("btn_left").onclick = function() {
	tabs[tab].cur--;
	if (tabs[tab].cur === 0) this.disabled = true;
	if (tabs[tab].cur < tabs[tab].max) document.getElementById("btn_rght").disabled = false;
	updateTab();
	this.blur();
};

document.getElementById("btn_rght").onclick = function() {
	tabs[tab].cur++;
	if (tabs[tab].cur === tabs[tab].max) this.disabled = true;
	document.getElementById("btn_left").disabled = false;
	updateTab();
	this.blur();
};

const buttons = document.querySelectorAll("#main1 > nav:first-of-type > button");
for (let i = 0; i < buttons.length; i++) {
	buttons[i].onclick = function() {
		tab = i;

		for (let j = 0; j < buttons.length; j++) {
			document.querySelectorAll("#main1 > .mid > div")[j].hidden = (tab !== j);
			buttons[j].disabled = (tab === j);
		}

		document.getElementById("btn_left").disabled = (tabs[tab].cur === 0);
		document.getElementById("btn_rght").disabled = (tabs[tab].cur === tabs[tab].max);
		document.getElementById("btn_dele").disabled = !tabs[tab].btnDele;
		document.getElementById("btn_updt").disabled = !tabs[tab].btnUpdt;

		updateTab();
	};
}

function addressCreate(addr) {
	document.getElementById("btn_address_create_normal").disabled = true;
	document.getElementById("btn_address_create_shield").disabled = true;

	ae.Address_Create(addr, function(error1) {
		if (error1 !== 0) {
			updateAddressButtons();
			errorDialog(error1);
			return;
		}

		ae.Private_Update(function(error2) {
			updateAddressCounts();

			addAddress(ae.GetAddressCount() - 1);
			if (addr !== "SHIELD") {
				document.getElementById("txt_address_create_normal").value = "";
				document.getElementById("txt_address_create_normal").focus();
			}

			if (error2 !== 0) errorDialog(error2);
		});
	});
}

document.getElementById("btn_address_create_normal").onclick = function() {
	if (ae.GetAddressCountNormal() >= ae.GetLimitNormalA(ae.GetUserLevel()) || ae.GetAddressCountNormal() + ae.GetAddressCountShield() >= 31) return;

	const txtNewAddr = document.getElementById("txt_address_create_normal");
	if (!txtNewAddr.reportValidity()) return;

	addressCreate(txtNewAddr.value);
};

document.getElementById("txt_address_create_normal").onkeyup = function() {
	if (event.key !== "Enter") return;
	event.preventDefault();
	document.getElementById("btn_address_create_normal").click();
};

document.getElementById("btn_address_create_shield").onclick = function() {
	if (ae.GetAddressCountShield() >= ae.GetLimitShieldA(ae.GetUserLevel()) || ae.GetAddressCountNormal() + ae.GetAddressCountShield() >= 31) return;

	addressCreate("SHIELD");
};

document.getElementById("btn_address_update").onclick = function() {
	const btn = this;
	btn.disabled = true;

	const rows = document.getElementById("tbl_addrs").rows;

	for (let i = 0; i < rows.length; i++) {
		ae.SetAddressAccExt(i, rows[i].getElementsByTagName("input")[0].checked);
		ae.SetAddressAccInt(i, rows[i].getElementsByTagName("input")[1].checked);
	}

	ae.Address_Update(function(error) {
		btn.disabled = false;
		if (error) errorDialog(error);
	});
};


document.getElementById("txt_reg").onkeyup = function(event) {
	if (event.key !== "Enter") return;
	event.preventDefault();
	document.getElementById("btn_reg").click();
};

document.getElementById("btn_reg").onclick = function() {
	const btn = document.getElementById("btn_reg");
	const txt = document.getElementById("txt_reg");
	if (!txt.reportValidity()) return;
	btn.disabled = true;

	ae.Account_Create(txt.value, function(error) {
		if (error === 0) {
			addAccountToTable(ae.Admin_GetUserCount() - 1);
			txt.value = "";
		} else errorDialog(error);

		btn.disabled = false;
	});
};

document.getElementById("chk_delme").onclick = function() {document.getElementById("btn_delme").disabled = !this.checked;};
document.getElementById("chk_lowme").onclick = function() {document.getElementById("btn_lowme").disabled = !this.checked;};

document.getElementById("btn_notepad_restore").onclick = function() {
	document.getElementById("txt_notepad").value = ae.GetPrivateExtra(true);
};

document.getElementById("btn_notepad_savepad").onclick = function() {
	const btn = this;
	btn.disabled = true;

	const error = ae.SetPrivateExtra(document.getElementById("txt_notepad").value);
	if (error !== 0) {
		btn.disabled = false;
		errorDialog(error);
		return;
	}

	ae.Private_Update(function(error2) {
		btn.disabled = false;
		if (error2) errorDialog(error2);
	});
};

document.getElementById("btn_notepad_saveupl").onclick = function() {
	const np = document.getElementById("txt_notepad");
	np.disabled = true;

	let fname = prompt("Save as...", "Untitled");
	if (!fname.endsWith(".txt")) fname += ".txt";

	ae.Message_Upload(fname, np.value, function(error) {
		if (error === 0) {
			np.value = "";
			showFiles();
			document.getElementById("tbd_accs").children[0].children[1].textContent = Math.round(ae.GetTotalMsgBytes() / 1024 / 1024);
		} else errorDialog(error);

		np.disabled = false;
	});
};

document.getElementById("btn_upload").onclick = function() {
	const btn = this;
	const fileSelector = document.createElement("input");
	fileSelector.type = "file";
	fileSelector.click();

	fileSelector.onchange = function() {
		btn.disabled = true;

		const reader = new FileReader();
		reader.onload = function() {
			ae.Message_Upload(fileSelector.files[0].name, new Uint8Array(reader.result), function(error) {
				if (error === 0) {
					showFiles();
					document.getElementById("tbd_accs").children[0].children[1].textContent = Math.round(ae.GetTotalMsgBytes() / 1024 / 1024);
				} else errorDialog(error);

				btn.disabled = false;
			});
		};

		reader.readAsArrayBuffer(fileSelector.files[0]);
	};
};

document.getElementById("btn_pg").onclick = function() {
	localStorage.greeting = document.getElementById("txt_pg").value;
};

document.querySelector("#write2_send > button").onclick = function() {
	const btn = this;
	btn.disabled = true;

	// Public announcement
	if (document.getElementById("write2_recv").textContent === "public") {
		ae.Message_Public(document.getElementById("write_subj").value, document.getElementById("write_body").value, function(error) {
			if (error !== 0) {
				document.getElementById("write2_btntxt").textContent = "Retry making";
				btn.disabled = false;
				errorDialog(error);
				return;
			}

			clearWrite();
			displayMsg(true, 0);
		});

		return;
	}

	// Email or internal message
	document.getElementById("write2_btntxt").textContent = "Sending to";

	ae.Message_Create(
		document.getElementById("write_subj").value,
		document.getElementById("write_body").value,
		document.getElementById("write_from").value,
		document.getElementById("write_recv").value,
		document.getElementById("write_subj").getAttribute("data-replyid"),
		(document.getElementById("write2_recv").textContent.indexOf("@") > 0) ? null : sodium.from_base64(document.querySelector("#write2_pkey > input").value, sodium.base64_variants.ORIGINAL_NO_PADDING),
		function(error) {
			if (error !== 0) {
				errorDialog(error);
				document.getElementById("write2_btntxt").textContent = "Retry sending to";
				btn.disabled = false;
				return;
			}

			showDrbox();
			clearWrite();
			displayOutMsg(0);
		}
	);
};

document.getElementById("btn_sender").onclick = function() {
	ae.Message_Sender(document.getElementById("txt_sender_hash").value, Date.parse(document.getElementById("txt_sender_date").value) / 1000, function(error, result) {
		if (error !== 0) {
			errorDialog(error);
			return;
		}

		document.getElementById("txt_sender_res").value = result;
	});
};

document.getElementById("txt_skey").onfocus = function() {
	document.getElementById("greeting").textContent = localStorage.greeting;
};

document.getElementById("txt_skey").onkeyup = function(event) {
	if (event.key !== "Enter") return;
	event.preventDefault();
	document.getElementById("btn_enter").click();
};

document.getElementById("btn_enter").onclick = function() {
	const txtSkey = document.getElementById("txt_skey");

	if (txtSkey.value === "") {
		ae.Reset();
		document.getElementById("greeting").textContent = "Data cleared";
		return;
	}

	if (!txtSkey.reportValidity()) return;

	const btn = this;
	btn.disabled = true;

	document.getElementById("txt_skey").disabled = true;

	ae.SetKeys(txtSkey.value, function(successSetKeys) {
		if (!successSetKeys) {
			document.getElementById("txt_skey").disabled = false;
			txtSkey.focus();

			document.getElementById("greeting").textContent = "SetKeys failed";
			btn.disabled = false;
			return;
		}

		document.body.style.cursor = "wait";
		document.getElementById("greeting").textContent = "Connecting...";

		ae.Message_Browse(false, true, function(statusBrowse) {
			document.body.style.cursor = "";

			if (statusBrowse !== 0 && statusBrowse !== 0x09) {
				document.getElementById("greeting").textContent = ae.GetErrorMessage(statusBrowse) + " (0x" + statusBrowse.toString(16).padStart(2, "0").toUpperCase() + ")";
				document.getElementById("txt_skey").disabled = false;
				btn.disabled = false;
				btn.focus();
				return;
			}

			txtSkey.value = "";
			document.getElementById("div_begin").hidden = true;
			document.getElementById("div_main").hidden = false;
			reloadAccount();

			if (statusBrowse !== 0) errorDialog(statusBrowse);
			if (!ae.IsUserAdmin()) return;

			ae.Account_Browse(function(statusAcc) {
				if (statusAcc === 0) {
					for (let i = 0; i < ae.Admin_GetUserCount(); i++) {addAccountToTable(i);}
				} else {
					errorDialog(statusAcc);
				}
			});
		});
	});
};

});
