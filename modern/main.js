"use strict";

sodium.ready.then(function() {

let isReady = true;
let vaultOk = null;

const vault = new PostVault(function(ok) {
	if (ok) vaultOk = false;
});

const ae = new AllEars(function(ok) {
	if (!ok) {
		document.getElementById("greeting").textContent = "Failed loading All-Ears";
		return;
	}

	try {
		if (localStorage.greeting) {
			document.getElementById("greeting").textContent = localStorage.greeting;
			document.getElementById("txt_pg").value = localStorage.greeting;
		} else localStorage.greeting = document.getElementById("greeting").textContent;
	} catch(e) {
		document.getElementById("btn_pg").disabled = true;
		document.getElementById("txt_pg").disabled = true;
		document.getElementById("txt_pg").className = "ita";
		document.getElementById("txt_pg").value = "LocalStorage inaccessible";
	}

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
	new TabState(0, 0, false, false), // Outbx
	new TabState(0, 1, true,  false), // Write
	new TabState(0, 2, false, false), // Notes
	new TabState(0, 2, false, false) // Tools
];

function MsgInfo(msgIdHex, msgType, msgNum) {
	this.idHex = msgIdHex;
	this.type = msgType;
	this.num = msgNum;
}

let msgDisplay = new MsgInfo(null, null, null);
let showHeaders = false;
let rowsPerPage = 0;

let tab = 0;
const TAB_INBOX = 0;
const TAB_DRBOX = 1;
const TAB_WRITE = 2;
const TAB_NOTES = 3;
const TAB_TOOLS = 4;

// Helper functions
function errorDialog(err, focusAfter) {
	if (typeof(err) !== "number" || err < 1) return;

	let btnDisable = [];
	const buttons = document.querySelectorAll("nav > button");
	buttons.forEach(function(btn) {
		btnDisable.push(btn.disabled);
		btn.disabled = true;
	});

	const errMsg = ae.getErrorMessage(err);

	const dlg = document.querySelector("dialog");
	dlg.children[0].style.height = getComputedStyle(document.querySelector("#main1 > div[class='mid']")).height;
	dlg.querySelector("h1").textContent = "ERROR 0x" + err.toString(16).padStart(2, "0").toUpperCase();
	dlg.querySelector("p").textContent = (typeof(errMsg) === "string") ? errMsg : errMsg[1];
	dlg.show();

	document.querySelector("dialog > div").onclick = function() {
		buttons.forEach(function(btn, i) {btn.disabled = btnDisable[i];});
		dlg.close();
		if (focusAfter) focusAfter.focus();
	};

	document.onkeyup = function(event) {
		document.onkeyup = null;
		event.preventDefault();

		buttons.forEach(function(btn, i) {btn.disabled = btnDisable[i];});
		dlg.close();
		if (focusAfter) focusAfter.focus();
	};
}

function getCountryFlag(countryCode) {
	return (!countryCode || countryCode.length !== 2 || countryCode === "??") ? "❔" : sodium.to_string(new Uint8Array([
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

function clearDisplay() {
	document.getElementById("btn_mnext").disabled = true;
	document.getElementById("btn_mprev").disabled = true;
	document.getElementById("readmsg_export").hidden = true;

	const el = document.querySelector("#readmsg_main > img, #readmsg_main > audio, #readmsg_main > video, #readmsg_main > embed, #readmsg_main > iframe");
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

function displayFile(isHistory, num, showNext) {
	if (num < 0 || num >= ae.getUplMsgCount()) return;

	const fileType = ae.getUplMsgType(num);
	if (!fileType) {
		if (isHistory) return;
		if (showNext === true) return displayFile(false, num + 1, true);
		if (showNext === false) return displayFile(false, num - 1, false);
		ae.downloadUplMsg(num); return;
	}

	clearDisplay();
	document.querySelector("article").scroll(0, 0);
	document.querySelector("article").setAttribute("data-msgid", ae.getUplMsgIdHex(num));

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = false;
	document.getElementById("btn_reply").disabled = true;

	document.getElementById("btn_msave").onclick = function() {ae.downloadUplMsg(num);};

	document.getElementById("readmsg_info").hidden = true;
	document.querySelector("#readmsg_main > h1").textContent = ae.getUplMsgTitle(num);

	msgDisplay = new MsgInfo(ae.getUplMsgIdHex(num), "upl", num);
	if (!isHistory) history.pushState({tab: tab, page: tabs[tab].cur, msg: msgDisplay}, null);

	document.getElementById("main2").hidden = false;
	document.getElementById("main1").hidden = !window.matchMedia("(min-width: 80em)").matches;

	document.getElementById("btn_mnext").disabled = (num === ae.getUplMsgCount() - 1);
	document.getElementById("btn_mprev").disabled = (num === 0);
	document.getElementById("btn_mnext").onclick = function() {displayFile(false, num + 1, true);};
	document.getElementById("btn_mprev").onclick = function() {displayFile(false, num - 1, false);};

	if (fileType === "text") {
		document.querySelector("#readmsg_main > pre").hidden = false;
		try {
			document.querySelector("#readmsg_main > pre").textContent = sodium.to_string(ae.getUplMsgBody(num));
		} catch(e) {
			document.querySelector("#readmsg_main > pre").textContent = "Failed decoding body: " + e.message;
		}
		return;
	}

	document.querySelector("#readmsg_main > pre").hidden = true;
	let el;

	switch (fileType) {
		case "image": {
			el = document.createElement("img");
			el.src = URL.createObjectURL(new Blob([ae.getUplMsgBody(num).buffer]));
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
			el.src = URL.createObjectURL(new Blob([ae.getUplMsgBody(num).buffer]));
		break;}

		case "pdf": {
			el = document.createElement("embed");
			el.type = "application/pdf";
			el.src = URL.createObjectURL(new Blob([ae.getUplMsgBody(num).buffer], {type: "application/pdf"}));
		break;}

		case "html": {
			el = document.createElement("iframe");
			el.allow = "vertical-scroll";
			el.sandbox = "";
			el.referrerPolicy = "no-referrer";

			try {
				el.srcdoc =
					"<html><head><style>html, body {background: #080a08; color: #fff; scrollbar-color: #222 #333;} body {opacity:0.55;} body > *:first-child {margin-top: 0; padding-top: 0;} a {color: #fff;} button, input, select, textarea {background: #000; color: #fff;}</style></head>"
					+ sodium.to_string(ae.getUplMsgBody(num).buffer)
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
			el.srcdoc = "<!doctype><html><head><style>body,html,svg {margin: 0; padding: 0; border: 0; height: 100%; width: 100%; display: block; background: #080a08;}</style></head><body>" + sodium.to_string(ae.getUplMsgBody(num).buffer) + "</body></html>";
		break;}

		default: return;
	}

	document.getElementById("readmsg_main").appendChild(el);
}

document.getElementById("btn_leave").onclick = function() {
	document.getElementById("main2").hidden = true;
	document.getElementById("main1").hidden = false;
};

function displayMsg(isHistory, isInt, num) {
	clearDisplay();
	document.getElementById("btn_mdele").disabled = false;

	document.querySelector("article").scroll(0, 0);
	document.querySelector("article").setAttribute("data-msgid", isInt? ae.getIntMsgIdHex(num) : ae.getExtMsgIdHex(num));

	document.getElementById("btn_msave").disabled = false;
	document.getElementById("btn_msave").onclick = function() {displayExport(false, isInt, num);};

	const ts = isInt? ae.getIntMsgTime(num) : ae.getExtMsgTime(num);

	if (!isInt || (ae.getIntMsgFrom(num) !== "public" && ae.getIntMsgFrom(num) !== "system")) {
		document.getElementById("btn_reply").disabled = false;

		document.getElementById("btn_reply").onclick = function() {
			document.getElementById("write_recv").value = isInt? ae.getIntMsgFrom(num) : ae.getExtMsgReplyAddress(num);
			document.getElementById("write_subj").value = isInt? ae.getIntMsgTitle(num) : ae.getExtMsgTitle(num);
			if (!document.getElementById("write_subj").value.startsWith("Re:")) document.getElementById("write_subj").value = "Re: " + document.getElementById("write_subj").value;
			document.querySelector("#write2_pkey > input").value = isInt? ae.getIntMsgApk(num) : "";

			document.getElementById("write_recv").readOnly = !isInt;
			document.getElementById("write_subj").readOnly = !isInt;
			document.getElementById("write_subj").setAttribute("data-replyid", isInt? "" : ae.getExtMsgHdrId(num));

			tabs[TAB_WRITE].cur = 0;
			document.getElementById("btn_write").disabled = false;
			document.getElementById("btn_write").click();
			document.getElementById("write_body").focus();

			for (const opt of document.getElementById("write_from").options) {
				if (opt.value === (isInt ? ae.getIntMsgTo(num) : ae.getExtMsgEnvTo(num).split("@")[0].toLowerCase())) {
					opt.selected = true;
				}
			}
		};
	} else {
		document.getElementById("btn_reply").disabled = true;
	}

	document.getElementById("readmsg_info").hidden = false;
	document.querySelector("#readmsg_main > pre").hidden = false;

	document.getElementById("readmsg_envto").textContent = isInt ? "" : ae.getExtMsgEnvTo(num);
	document.getElementById("readmsg_hdrto").textContent = isInt ? ae.getIntMsgTo(num) : (ae.getExtMsgHdrTo(num));
	if(!isInt && ae.getExtMsgDnTo(num)) {
		const span = document.createElement("span");
		span.className = "sans";
		span.textContent = " • " + ae.getExtMsgDnTo(num);
		document.getElementById("readmsg_hdrto").appendChild(span);
	}

	const tzOs = new Date().getTimezoneOffset();
	const msgDate = new Date((ts * 1000) + (tzOs * -60000));
	document.getElementById("readmsg_date").children[0].textContent = getClockIcon(msgDate);
	document.getElementById("readmsg_date").children[1].dateTime = new Date(ts * 1000).toISOString();

	if (isInt) {
		document.querySelector("#readmsg_main > h1").textContent = ae.getIntMsgTitle(num);
		document.querySelector("#readmsg_main > pre").textContent = ae.getIntMsgBody(num);

		document.getElementById("readmsg_date").children[1].textContent = msgDate.toISOString().slice(0, 19).replace("T", " ");

		document.getElementById("readmsg_ip").style.visibility = "hidden";
		document.getElementById("readmsg_rdns").style.visibility = "hidden";
		document.getElementById("readmsg_dkim").style.visibility = "hidden";
		document.getElementById("readmsg_greet").style.visibility = "hidden";
		document.getElementById("readmsg_cert").style.visibility = "hidden";
		document.getElementById("readmsg_envfrom").style.visibility = "hidden";
		document.getElementById("readmsg_envto").style.visibility = "hidden";

		if (ae.getIntMsgFrom(num) !== "system" && ae.getIntMsgFrom(num) !== "public") {
			document.getElementById("readmsg_tls").style.visibility = "visible";
			document.getElementById("readmsg_tls").children[0].textContent = ae.getIntMsgApk(num);
		} else document.getElementById("readmsg_tls").style.visibility = "hidden";

		let symbol = document.createElement("span");
		if      (ae.getIntMsgLevel(num) === 3 && ae.getIntMsgFrom(num) === "system") {symbol.title = "System message"; symbol.textContent = "🅢";}
		else if (ae.getIntMsgLevel(num) === 3 && ae.getIntMsgFrom(num) === "public") {symbol.title = "Public announcement"; symbol.textContent = "🅟";}
		else if (ae.getIntMsgLevel(num) === 3) {symbol.title = "Administrator"; symbol.textContent = "🅐";}
		else if (ae.getIntMsgLevel(num) === 2) {symbol.title = "Level 2";  symbol.textContent = "➋";}
		else if (ae.getIntMsgLevel(num) === 1) {symbol.title = "Level 1";  symbol.textContent = "➊";}
		else if (ae.getIntMsgLevel(num) === 0) {symbol.title = "Level 0";  symbol.textContent = "🄌";}
		else {symbol.title = "Invalid level"; symbol.textContent = "⚠";}

		document.getElementById("readmsg_hdrfrom").replaceChildren(symbol, document.createTextNode(" " + ae.getIntMsgFrom(num)));

		clearMsgFlags();
		if (!ae.getIntMsgFlagVPad(num)) addMsgFlag("PAD", "Invalid padding");
		if (!ae.getIntMsgFlagVSig(num)) addMsgFlag("SIG", "Invalid signature");
		if ( ae.getIntMsgFlagE2ee(num)) addMsgFlag("E2EE", "End-to-end encrypted");
	} else {
		const headers = document.createElement("p");
		headers.textContent = ae.getExtMsgHeaders(num);
		headers.className = "mono";
		headers.hidden = !showHeaders;

		const body = document.createElement("p");
		body.innerHTML = ae.getExtMsgBody(num, false);

		document.querySelector("#readmsg_main > pre").replaceChildren(headers, body);

		const h1 = document.querySelector("#readmsg_main > h1");
		h1.textContent = ae.getExtMsgTitle(num);
		h1.style.cursor = headers.textContent? "pointer" : "";
		h1.onclick = function() {
			if (!headers.textContent) return;
			showHeaders = !showHeaders;
			headers.hidden = !showHeaders;
		};

		let hdrSecs = Math.abs(ae.getExtMsgHdrTime(num));
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

		const hdrTz = (ae.getExtMsgHdrTz(num) >= 0 ? "+" : "-") + Math.floor(Math.abs(ae.getExtMsgHdrTz(num)) / 60).toString().padStart(2, "0") + (Math.abs(ae.getExtMsgHdrTz(num)) % 60).toString().padStart(2, "0");

		let spans = [document.createElement("span"), document.createElement("span"), document.createElement("span")];
		spans[0].textContent = msgDate.toISOString().slice(0, 19).replace("T", " ");
		spans[1].className = "sans";
		spans[1].textContent = " • ";
		spans[2].textContent = hdrTz + " " + ((ae.getExtMsgHdrTime(num) >= 0) ? "+" : "-") + hdrTime;
		document.getElementById("readmsg_date").children[1].replaceChildren(...spans);

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
		if (ae.getExtMsgDkim(num)) {
			[ // Look for a matching domain in this order
				ae.getExtMsgHdrFrom(num).split("@")[1],
				ae.getExtMsgEnvFrom(num).split("@")[1],
				ae.getExtMsgRdns(num),
				ae.getExtMsgGreet(num),
				ae.getExtMsgTlsDomain(num)
			].forEach(function(dom) {
				if (dkim) return;
				for (let i = 0; i < ae.getExtMsgDkim(num).domain.length; i++) {
					if (ae.getExtMsgDkim(num).domain[i] === dom) {
						dkim = dom + " ✓";
						return;
					}
				}
			});

			if (!dkim) dkim = ae.getExtMsgDkim(num).domain[0]; // Default to first signature domain
		}

		if (ae.getExtMsgFlagDkFl(num)) dkim += " (fail)";

		// Left side
		document.getElementById("readmsg_country").textContent = getCountryFlag(ae.getExtMsgCcode(num));
		document.getElementById("readmsg_country").title = ae.getExtMsgCname(num);
		document.getElementById("readmsg_ip").children[1].textContent = ae.getExtMsgIp(num) + (ae.getExtMsgFlagIpBl(num) ? " ❗" : "");
		document.getElementById("readmsg_ip").children[2].textContent = " • " + ae.getExtMsgAuSys(num);
		document.getElementById("readmsg_tls").children[0].textContent = ae.getExtMsgTLS(num);

		// Right side
		document.getElementById("readmsg_greet").children[0].textContent = ae.getExtMsgGreet(num) + (ae.getExtMsgFlagGrDm(num) ? " ✓" : "");
		document.getElementById("readmsg_rdns").children[0].textContent = ae.getExtMsgRdns(num) + (ae.getExtMsgGreet(num).toLowerCase() === ae.getExtMsgRdns(num).toLowerCase() ? " ✓" : "");
		document.getElementById("readmsg_cert").children[0].textContent = ae.getExtMsgTlsDomain(num) ? (ae.getExtMsgTlsDomain(num) + " ✓") : "";
		document.getElementById("readmsg_dkim").children[0].textContent = dkim;
		document.getElementById("readmsg_envfrom").textContent = ae.getExtMsgEnvFrom(num);
		document.getElementById("readmsg_hdrfrom").textContent = ae.getExtMsgHdrFrom(num);
		if (ae.getExtMsgDnFrom(num)) {
			const span = document.createElement("span");
			span.className = "sans";
			span.textContent = " • " + ae.getExtMsgDnFrom(num);
			document.getElementById("readmsg_hdrfrom").appendChild(span);
		}

		clearMsgFlags();
		if (!ae.getExtMsgFlagVPad(num)) addMsgFlag("PAD", "Invalid padding");
		if (!ae.getExtMsgFlagVSig(num)) addMsgFlag("SIG", "Invalid signature");
		if (!ae.getExtMsgFlagPExt(num)) addMsgFlag("SMTP", "The sender did not use the Extended (ESMTP) protocol");
		if ( ae.getExtMsgFlagRare(num)) addMsgFlag("RARE", "The sender issued unusual command(s)");
		if ( ae.getExtMsgFlagFail(num)) addMsgFlag("FAIL", "The sender issued invalid command(s)");
		if ( ae.getExtMsgFlagPErr(num)) addMsgFlag("PROT", "The sender violated the protocol");
	}

	document.getElementById("readmsg_main").hidden = false;
	document.getElementById("main2").hidden = false;
	document.getElementById("main1").hidden = !window.matchMedia("(min-width: 80em)").matches;

	msgDisplay = new MsgInfo(isInt? ae.getIntMsgIdHex(num) : ae.getExtMsgIdHex(num), isInt? "int" : "ext", num);
	if (!isHistory) history.pushState({tab: tab, page: tabs[tab].cur, msg: msgDisplay}, null);
}

function displayExport(isHistory, isInt, num) {
	clearDisplay();
	document.getElementById("readmsg_main").hidden = true;
	document.getElementById("readmsg_export").hidden = false;
	document.getElementById("btn_msave").blur();
	document.getElementById("btn_msave").disabled = true;
	document.getElementById("btn_reply").disabled = true;
	document.getElementById("btn_mdele").disabled = true;

//	document.querySelector("#readmsg_export > div:nth-child(1)").onclick = function() {};
	document.querySelector("#readmsg_export > div:nth-child(2)").onclick = function() {if (isInt) {ae.downloadIntMsg(num);} else {ae.downloadExtMsg(num);} displayMsg(false, isInt, num);};
	document.querySelector("#readmsg_export > div:nth-child(3)").onclick = function() {if (isInt) {ae.htmlIntMsg(num, true);} else {ae.htmlExtMsg(num, true);} displayMsg(false, isInt, num);};
	document.querySelector("#readmsg_export > div:nth-child(4)").onclick = function() {if (isInt) {ae.txtIntMsg(num, true);} else {ae.txtExtMsg(num, true);} displayMsg(false, isInt, num);};
	document.querySelector("#readmsg_export > div:nth-child(5)").onclick = function() {if (isInt) {ae.printIntMsg(num);} else {ae.printExtMsg(num);} displayMsg(false, isInt, num);};
	document.querySelector("#readmsg_export > div:nth-child(6)").onclick = function() {navigator.clipboard.writeText(isInt? ae.txtIntMsg(num, false) : ae.txtExtMsg(num, false)); displayMsg(false, isInt, num);};

	msgDisplay = new MsgInfo(isInt? ae.getIntMsgIdHex(num) : ae.getExtMsgIdHex(num), isInt? "int_exp" : "ext_exp", num);
	if (!isHistory) history.pushState({tab: tab, page: tabs[tab].cur, msg: msgDisplay}, null);
}

function displayOutMsg(isHistory, num) {
	clearDisplay();
	document.querySelector("article").scroll(0, 0);
	document.querySelector("article").setAttribute("data-msgid", ae.getOutMsgIdHex(num));

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = true;
	document.getElementById("btn_reply").disabled = true;

	document.getElementById("readmsg_info").hidden = false;
	document.querySelector("#readmsg_main > pre").hidden = false;

	document.querySelector("#readmsg_main > h1").textContent = ae.getOutMsgSubj(num);
	document.querySelector("#readmsg_main > pre").textContent = ae.getOutMsgBody(num);

	document.getElementById("readmsg_dkim").style.visibility    = "hidden";
	document.getElementById("readmsg_hdrto").style.visibility   = "visible";
	document.getElementById("readmsg_hdrfrom").style.visibility = "visible";
	document.getElementById("readmsg_envto").style.visibility   = "visible";
	document.getElementById("readmsg_envfrom").style.visibility = "hidden";

	document.getElementById("readmsg_hdrfrom").textContent = ae.getOutMsgFrom(num);

	document.getElementById("readmsg_envto").textContent = ae.getOutMsgMxDom(num);
	document.getElementById("readmsg_hdrto").textContent = ae.getOutMsgTo(num);

	const ts = ae.getOutMsgTime(num);
	const tzOs = new Date().getTimezoneOffset();
	document.getElementById("readmsg_date").children[1].textContent = new Date((ts * 1000) + (tzOs * -60000)).toISOString().slice(0, 19).replace("T", " ");

	const isInt = ae.getOutMsgIsInt(num);
	document.getElementById("readmsg_ip").style.visibility    = isInt? "hidden" : "visible";
	document.getElementById("readmsg_rdns").style.visibility  = /*isInt?*/ "hidden" /*: "visible"*/; // TODO
	document.getElementById("readmsg_tls").style.visibility   = /*isInt?*/ "hidden" /*: "visible"*/; // TODO
	document.getElementById("readmsg_cert").style.visibility  = /*isInt?*/ "hidden" /*: "visible"*/; // TODO
	document.getElementById("readmsg_greet").style.visibility = isInt? "hidden" : "visible";

	if (!isInt) {
		document.getElementById("readmsg_ip").children[1].textContent = ae.getOutMsgIp(num);
		document.getElementById("readmsg_country").textContent = getCountryFlag(ae.getOutMsgCcode(num));
		document.getElementById("readmsg_country").title = ae.getOutMsgCname(num);
//		document.getElementById("readmsg_tls").children[0].textContent = ae.getOutMsgTLS(num);
		document.getElementById("readmsg_greet").children[0].textContent = ae.getOutMsgGreet(num);
	}

	clearMsgFlags();
	if (!ae.getOutMsgFlagVPad(num)) addMsgFlag("PAD", "Invalid padding");
	if (!ae.getOutMsgFlagVSig(num)) addMsgFlag("SIG", "Invalid signature");
	if ( ae.getOutMsgFlagE2ee(num)) addMsgFlag("E2EE", "End-to-end encrypted");

	document.getElementById("main2").hidden = false;
	document.getElementById("main1").hidden = !window.matchMedia("(min-width: 80em)").matches;

	msgDisplay = new MsgInfo(ae.getOutMsgIdHex(num), "out", num);
	if (!isHistory) history.pushState({tab: tab, page: tabs[tab].cur, msg: msgDisplay}, null);
}

function updateAddressButtons() {
	const limitReached = (ae.getAddressCountNormal() + ae.getAddressCountShield() >= 31);
	document.getElementById("btn_address_create_normal").disabled = (limitReached || ae.getAddressCountNormal() >= ae.getLimitNormalA(ae.getOwnLevel()));
	document.getElementById("btn_address_create_shield").disabled = (limitReached || ae.getAddressCountShield() >= ae.getLimitShieldA(ae.getOwnLevel()));
}

function updateAddressCounts() {
	document.querySelector("#tbd_accs > tr > td:nth-child(3)").textContent = ae.getAddressCountNormal();
	document.querySelector("#tbd_accs > tr > td:nth-child(4)").textContent = ae.getAddressCountShield();

	document.getElementById("limit_normal").textContent = (ae.getAddressCountNormal() + "/" + ae.getLimitNormalA(ae.getOwnLevel())).padStart(ae.getLimitNormalA(ae.getOwnLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_shield").textContent = (ae.getAddressCountShield() + "/" + ae.getLimitShieldA(ae.getOwnLevel())).padStart(ae.getLimitShieldA(ae.getOwnLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_total").textContent = ((ae.getAddressCountNormal() + ae.getAddressCountShield()) + "/" + ae.getAddrPerUser()).padStart(5);

	updateAddressButtons();
}

function addOwnAccount() {
	const row = document.getElementById("tbd_accs").insertRow(-1);

	let cell;
	cell = row.insertCell(-1); cell.textContent = ae.getOwnUpk();
	cell = row.insertCell(-1); cell.textContent = Math.round(ae.getTotalMsgBytes() / 1048576); // MiB
	cell = row.insertCell(-1); cell.textContent = ae.getAddressCountNormal();
	cell = row.insertCell(-1); cell.textContent = ae.getAddressCountShield();

	cell = row.insertCell(-1);
	let btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "+";
	btn.disabled = true;
	cell.appendChild(btn);

	cell = row.insertCell(-1); cell.textContent = ae.getOwnLevel();

	cell = row.insertCell(-1);
	btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "−";
	btn.disabled = true;
	btn.id = "btn_lowme";
	btn.onclick = function() {
		const newLevel = parseInt(row.cells[5].textContent, 10) - 1;
		ae.Account_Update(ae.getOwnUpk(), newLevel, function(error) {
			if (error === 0) {
				row.cells[5].textContent = newLevel;
				if (newLevel === 0) {document.getElementById("btn_lowme").disabled = true;}
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
		ae.Account_Delete(ae.getOwnUpk(), function(error) {
			if (error === 0) {
				row.remove();
				document.getElementById("fs_users").disabled = true;
			} else errorDialog(error);
		});
	};
	cell.appendChild(btn);
}

function adjustLevel(pubkey, level, c) {
	const fs = document.getElementById("tbl_accs");
	fs.disabled = true;

	ae.Account_Update(pubkey, level, function(error) {
		fs.disabled = false;

		if (error === 0) {
			c[4].children[0].disabled = (level === 3);
			c[5].textContent = level;
			c[6].children[0].disabled = (level === 0);
		} else errorDialog(error);
	});
}

function addMsg(isInt, i) {
	const row = document.getElementById("tbl_inbox").insertRow(-1);
	row.setAttribute("data-msgid", isInt? ae.getIntMsgIdHex(i) : ae.getExtMsgIdHex(i));

	const ts = isInt? ae.getIntMsgTime(i) : ae.getExtMsgTime(i);
	const el = document.createElement("time");
	el.dateTime = new Date(ts * 1000).toISOString();
	el.textContent = new Date((ts * 1000) + (new Date().getTimezoneOffset() * -60000)).toISOString().slice(0, 10);
	let cell = row.insertCell(-1);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	cell.textContent = isInt? ae.getIntMsgTitle(i) : ae.getExtMsgTitle(i);
	if (!cell.textContent) cell.textContent = "(fail)";

	if (isInt) {
		cell = row.insertCell(-1);
		cell.textContent = ae.getIntMsgFrom(i);
		cell.className = (ae.getIntMsgFrom(i).length === 16) ? "mono" : "";
	} else {
		let from1 = ae.getExtMsgHdrFrom(i);
		if (!from1) from1 = ae.getExtMsgEnvFrom(i);
		const from2 = from1.substring(from1.indexOf("@") + 1);
		cell = row.insertCell(-1);
		cell.textContent = from1.substring(0, from1.indexOf("@"));

		const flag = document.createElement("abbr");
		flag.textContent = getCountryFlag(ae.getExtMsgCcode(i));
		flag.title = ae.getExtMsgCname(i);

		const fromText = document.createElement("span");
		fromText.textContent = " " + from2;

		cell = row.insertCell(-1);
		cell.appendChild(flag);
		cell.appendChild(fromText);
	}

	row.onclick = function() {
		displayMsg(false, isInt, i);
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
	if (!document.getElementById("main1").hidden) rowsPerPage = getRowsPerPage(tbl);

	const maxExt = ae.getExtMsgCount();
	const maxInt = ae.getIntMsgCount();
	const loadMore = ae.getReadyMsgBytes() < ae.getTotalMsgBytes();

	if (maxExt + maxInt > 0) {
		tabs[TAB_INBOX].max = Math.floor((maxExt + maxInt - (loadMore? 0 : 1)) / rowsPerPage);
		document.getElementById("btn_rght").disabled = (tabs[TAB_INBOX].cur >= tabs[TAB_INBOX].max);
		tbl.replaceChildren();

		let skipMsgs = rowsPerPage * tabs[TAB_INBOX].cur;
		let numExt = 0;
		let numInt = 0;
		let numAdd = 0;

		while (numAdd < rowsPerPage) {
			const tsInt = (numInt < maxInt) ? ae.getIntMsgTime(numInt) : -1;
			const tsExt = (numExt < maxExt) ? ae.getExtMsgTime(numExt) : -1;
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
		cell.textContent = "Load more (" + Math.round((ae.getTotalMsgBytes() - ae.getReadyMsgBytes()) / 1024) + " KiB left)";

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
	if (!document.getElementById("main1").hidden) rowsPerPage = getRowsPerPage(tbl);

	const drCount = ae.getOutMsgCount();
	const loadMore = ae.getReadyMsgBytes() < ae.getTotalMsgBytes();

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
			row.setAttribute("data-msgid", ae.getOutMsgIdHex(i));

			let cell;
			cell = row.insertCell(-1); cell.textContent = new Date(ae.getOutMsgTime(i) * 1000).toISOString().slice(0, 10);
			cell = row.insertCell(-1); cell.textContent = ae.getOutMsgSubj(i);
			row.onclick = function() {displayOutMsg(false, i);};

			numAdd++;
		}
	} else {
		tabs[TAB_DRBOX].max = 0;
	}

	if (loadMore && tabs[TAB_DRBOX].cur >= tabs[TAB_DRBOX].max) {
		const row = tbl.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + Math.round((ae.getTotalMsgBytes() - ae.getReadyMsgBytes()) / 1024) + " KiB left)";

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
	if (!document.getElementById("main1").hidden) rowsPerPage = getRowsPerPage(tbl);

	const msgCount = ae.getUplMsgCount() + (vaultOk? vault.getFileCount() : 0);
	const loadMore = (ae.getReadyMsgBytes() < ae.getTotalMsgBytes()) || (vaultOk === false);

	if (msgCount > 0) {
		tabs[TAB_NOTES].max = 2 + Math.floor((msgCount - (loadMore? 0 : 1)) / rowsPerPage);
		document.getElementById("btn_rght").disabled = (tabs[TAB_NOTES].cur >= tabs[TAB_NOTES].max);
		tbl.replaceChildren();

		let skipMsgs = rowsPerPage * (tabs[TAB_NOTES].cur - 2);
		let numAdd = 0;

		for (let i = 0; numAdd < rowsPerPage && i < ae.getUplMsgCount(); i++) {
			if (skipMsgs > 0) {
				skipMsgs--;
				continue;
			}

			const row = tbl.insertRow(-1);
			row.setAttribute("data-msgid", ae.getUplMsgIdHex(i));
			row.className = "rowfile";

			let cell = row.insertCell(-1);
			cell.textContent = new Date(ae.getUplMsgTime(i) * 1000).toISOString().slice(0, 10);
			cell.onclick = function() {displayFile(false, i, null);};

			cell = row.insertCell(-1);
			cell.textContent = (ae.getUplMsgBytes(i) / 1024).toFixed(0).padStart(4, " ");
			cell.onclick = function() {displayFile(false, i, null);};

			cell = row.insertCell(-1);
			const parentNum = ae.getUplMsgParent(i);
			if (typeof(parentNum) === "number") {
				cell.textContent = ae.getExtMsgTitle(parentNum);
				cell.onclick = function() {displayMsg(false, false, parentNum);};
			} else if (parentNum === false) {
				cell.textContent = "Upload";
			} else {
				cell.textContent = "Unknown";
			}

			cell = row.insertCell(-1);
			cell.textContent = ae.getUplMsgTitle(i);
			cell.onclick = function() {displayFile(false, i, null);};

			cell = row.insertCell(-1);
			const btn = document.createElement("button");
			btn.setAttribute("data-msgid", ae.getUplMsgIdHex(i));
			btn.type = "button";
			btn.textContent = "X";
			btn.onclick = function() {
				ae.Message_Delete(this.getAttribute("data-msgid"), function(error) {
					if (error === 0) showFiles();
					else errorDialog(error);
				});
			};
			cell.appendChild(btn);

			numAdd++;
		}

		if (vaultOk) {
			for (let i = 0; numAdd < rowsPerPage && i < 256; i++) {
				if (vault.getFileSize(i) < 1) continue;

				if (skipMsgs > 0) {
					skipMsgs--;
					continue;
				}

				const row = tbl.insertRow(-1);
				row.setAttribute("data-msgid", i);
				row.className = "rowfile";

				let cell = row.insertCell(-1);
				cell.textContent = new Date(vault.getFileTime(i) * 1000).toISOString().slice(0, 10);

				cell = row.insertCell(-1);
				cell.textContent = (vault.getFileSize(i) / 1024).toFixed(0).padStart(4, " ");

				cell = row.insertCell(-1);
				cell.textContent = "Vault";

				cell = row.insertCell(-1);
				cell.textContent = vault.getFileName(i);
				cell.onclick = function() {vault.downloadFile(i);};

				cell = row.insertCell(-1);
				const btn = document.createElement("button");
				btn.type = "button";
				btn.textContent = "X";
				btn.onclick = function() {
					vault.deleteFile(i, function(error) {
						if (error === 0) showFiles();
						else errorDialog(error);
					});
				};
				cell.appendChild(btn);

				numAdd++;
			}
		}
	} else {
		tabs[TAB_NOTES].max = (vaultOk === false) ? 3 : 2;
	}

	if (loadMore && tabs[TAB_NOTES].cur >= tabs[TAB_NOTES].max) {
		const row = tbl.insertRow(-1);
		row.className = "rowfilex";

		let cell = row.insertCell(-1);
		if (ae.getReadyMsgBytes() < ae.getTotalMsgBytes()) {
			cell.textContent = "Load more (" + Math.round((ae.getTotalMsgBytes() - ae.getReadyMsgBytes()) / 1024) + " KiB left)";
			cell.onclick = function() {
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

		cell = row.insertCell(-1);
		if (vaultOk === false) {
			cell.textContent = "Open PostVault";
			cell.onclick = function() {
				tbl.style.opacity = 0.5;

				vault.getInfo(function() {
					tbl.style.opacity = 1;

					// TODO check for error

					vaultOk = true;
					showFiles();
				});
			};
		}
	}
}

function addAccountToTable(i) {
	const row = document.getElementById("tbd_accs").insertRow(-1);
	let cell;
	cell = row.insertCell(-1); cell.textContent = ae.admin_getUserUpk(i);
	cell = row.insertCell(-1); cell.textContent = Math.round(ae.admin_getUserKib(i) / 1024);
	cell = row.insertCell(-1); cell.textContent = ae.admin_getUserNrm(i);
	cell = row.insertCell(-1); cell.textContent = ae.admin_getUserShd(i);

	cell = row.insertCell(-1);
	let btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "+";
	btn.disabled = (ae.admin_getUserLvl(i) === 3);
	btn.onclick = function() {const c = this.parentElement.parentElement.cells; adjustLevel(c[0].textContent, parseInt(c[5].textContent, 10) + 1, c);};
	cell.appendChild(btn);

	cell = row.insertCell(-1); cell.textContent = ae.admin_getUserLvl(i);

	cell = row.insertCell(-1);
	btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = "−";
	btn.disabled = (ae.admin_getUserLvl(i) === 0);
	btn.onclick = function() {const c = this.parentElement.parentElement.cells; adjustLevel(c[0].textContent, parseInt(c[5].textContent, 10) - 1, c);};
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

function updateLimits() {
	const tbl = document.querySelector("#tbl_limits > tbody");

	if (ae.isUserAdmin()) {
		for (let i = 0; i < 4; i++) {
			tbl.rows[i].cells[1].children[0].value = ae.getLimitStorage(i);
			tbl.rows[i].cells[2].children[0].value = ae.getLimitNormalA(i);
			tbl.rows[i].cells[3].children[0].value = ae.getLimitShieldA(i);
		}
	} else {
		const lvl = ae.getOwnLevel();
		tbl.rows[lvl].cells[1].children[0].value = ae.getLimitStorage(lvl);
		tbl.rows[lvl].cells[2].children[0].value = ae.getLimitNormalA(lvl);
		tbl.rows[lvl].cells[3].children[0].value = ae.getLimitShieldA(lvl);
	}
}

function deleteAddress(addr) {
	const buttons = document.querySelectorAll("#tbl_addrs button");
	buttons.forEach(function(btn) {btn.disabled = true;});

	let addressToDelete = -1;
	for (let i = 0; i < ae.getAddressCount(); i++) {
		if (addr === ae.getAddress(i)) {
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

		if (ae.getAddressCountNormal() > 0) {
			const apkList = document.getElementById("getapk_addr");
			for (let i = 0; i < apkList.children.length; i++) {
				if (apkList.children[i].value === addr) {
					apkList.remove(i);
					break;
				}
			}
		} else {
			document.getElementById("getapk_addr").replaceChildren();
			document.getElementById("btn_getapk").disabled = true;
		}

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
	const addr = ae.getAddress(num);

	let cell = row.insertCell(-1);
	cell.textContent = addr;
	cell.onclick = function() {navigator.clipboard.writeText(((this.textContent.length === 16) ? ae.shieldMix(this.textContent) : this.textContent) + "@" + ae.getDomainEml());};

	cell = row.insertCell(-1);
	let el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.getAddressAccInt(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.getAddressAccExt(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.getAddressAllVer(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.getAddressAttach(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.getAddressSecure(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.type = "checkbox";
	el.checked = ae.getAddressOrigin(num);
	cell.appendChild(el);

	cell = row.insertCell(-1);
	el = document.createElement("button");
	el.type = "button";
	el.textContent = "X";
	el.onclick = function() {deleteAddress(addr);};
	cell.appendChild(el);

	el = document.createElement("option");
	el.value = addr;
	el.textContent = addr + "@" + ae.getDomainEml();
	document.getElementById("write_from").appendChild(el);

	if (addr.length !== 16) {
		el = document.createElement("option");
		el.value = addr;
		el.textContent = addr;
		document.getElementById("getapk_addr").appendChild(el);
	}
}

function clearWrite() {
	setTab(false, TAB_WRITE, 0);

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
if (window.matchMedia("(prefers-color-scheme: light)").matches) document.querySelector("head > meta[name='theme-color']").content = "#eef";
window.matchMedia("(prefers-color-scheme: light)").onchange = function() {document.querySelector("head > meta[name='theme-color']").content = window.matchMedia("(prefers-color-scheme: light)").matches? "#eef" : "#001";};

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
			btn.disabled = false;
			document.getElementById("tbl_inbox").style.opacity = 1;

			if (error === 0) {
				showInbox();
			} else {
				errorDialog(error);
			}
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

	for (let i = 0; i < ae.getContactCount(); i++) {
		const el = document.createElement("option");
		el.value = ae.getContactMail(i);
		opts.push(el);
	}

	if (ae.isUserAdmin()) {
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

function addContacts() {
	for (let i = 0; i < ae.getContactCount(); i++) {
		addContact(
			ae.getContactMail(i),
			ae.getContactName(i),
			ae.getContactNote(i)
		);
	}

	refreshContactList();
}

function addAddresses() {
	for (let i = 0; i < ae.getAddressCount(); i++) {
		addAddress(i);
	}

	document.getElementById("btn_getapk").disabled = (ae.getAddressCountNormal() < 1);
}

function reloadAccount() {
	updateLimits();
	addOwnAccount();
	addContacts();
	addAddresses();
	updateAddressCounts();

	document.getElementById("fs_admin").disabled = !ae.isUserAdmin();
	document.getElementById("txt_notepad").value = ae.getPrivateExtra();
}

document.getElementById("btn_newcontact").onclick = function() {
	addContact("", "", "");
};

document.getElementById("btn_savecontacts").onclick = function() {
	while (ae.getContactCount() > 0) {
		ae.deleteContact(0);
	}

	for (const row of document.getElementById("tbl_ctact").rows) {
		ae.addContact(row.cells[0].textContent, row.cells[1].textContent, row.cells[2].textContent);
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
	) return false;

	document.getElementById("div_write_1").hidden = true;
	document.getElementById("div_write_2").hidden = false;

	document.getElementById("write2_recv").textContent = document.getElementById("write_recv").value;
	document.getElementById("write2_subj").textContent = document.getElementById("write_subj").value;
	document.getElementById("write2_rply").textContent = document.getElementById("write_subj").getAttribute("data-replyid");
	document.getElementById("write2_body").textContent = document.getElementById("write_body").value;

	if (document.getElementById("write_recv").value.indexOf("@") >= 0) {
		document.getElementById("write2_from").textContent = document.getElementById("write_from").value + "@" + ae.getDomainEml();
		document.getElementById("write2_pkey").hidden = true;
	} else {
		document.getElementById("write2_from").textContent = document.getElementById("write_from").value;
		document.getElementById("write2_pkey").hidden = (document.getElementById("write_recv").value === "public");
	}

	document.querySelector("#write2_send > button").disabled = false;
	document.getElementById("write2_btntxt").textContent = (document.getElementById("write_recv").value === "public") ? "Make" : "Send to";
	return true;
}

function setTab(isHistory, tabNum, pageNum) {
	tab = tabNum;
	if (pageNum !== -1) tabs[tab].cur = pageNum;

	document.querySelectorAll("#main1 > nav:first-of-type > button").forEach(function(btn, i) {
		document.querySelectorAll("#main1 > .mid > div")[i].hidden = (tab !== i);
		btn.disabled = (tab === i);
	});

	const bigScreen = window.matchMedia("(min-width: 80em)").matches;
	document.getElementById("main2").hidden = !bigScreen;
	document.getElementById("btn_leave").disabled = bigScreen;

	switch (tab) {
		case TAB_INBOX: showInbox(); break;
		case TAB_DRBOX: showDrbox(); break;

		case TAB_WRITE:
			if (tabs[tab].cur === 0) {
				document.getElementById("div_write_1").hidden = false;
				document.getElementById("div_write_2").hidden = true;
				document.getElementById("write_recv").focus();
			} else if (!writeVerify()) {
				tabs[TAB_WRITE].cur = 0;
				return;
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

					document.querySelector("#div_notepad meter").value = ae.getPrivateExtraSpace() / ae.getPrivateExtraSpaceMax();
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

	document.getElementById("btn_dele").disabled = !tabs[tab].btnDele;
	document.getElementById("btn_left").disabled = (tabs[tab].cur === 0);
	document.getElementById("btn_rght").disabled = (tabs[tab].cur === tabs[tab].max);
	document.getElementById("btn_updt").disabled = !tabs[tab].btnUpdt;

	if (!isHistory) history.pushState({tab: tab, page: tabs[tab].cur, msg: msgDisplay}, null);
}

window.onpopstate = function(event) {
	if (!isReady || !event.state) return;
	setTab(true, event.state.tab, event.state.page);
	msgDisplay = event.state.msg;

	if (msgDisplay) {
		switch (msgDisplay.type) {
			case "ext": displayMsg(true, false, msgDisplay.num); break;
			case "int": displayMsg(true, true, msgDisplay.num); break;
			case "out": displayOutMsg(true, msgDisplay.num); break;
			case "upl": displayFile(true, msgDisplay.num, null); break;
			case "ext_exp": displayExport(true, false, msgDisplay.num); break;
			case "int_exp": displayExport(true, true, msgDisplay.num); break;
		}
	}
};

document.querySelectorAll("#main1 > nav:first-of-type > button").forEach(function(btn, i) {
	btn.onclick = function() {setTab(false, i, -1);};
});

document.getElementById("btn_left").onclick = function() {
	setTab(false, tab, tabs[tab].cur - 1);
};

document.getElementById("btn_rght").onclick = function() {
	setTab(false, tab, tabs[tab].cur + 1);
};

function addressCreate(addr) {
	document.getElementById("btn_address_create_normal").disabled = true;
	document.getElementById("btn_address_create_shield").disabled = true;

	ae.Address_Create(addr, function(error1) {
		if (error1 !== 0) {
			updateAddressButtons();
			errorDialog(error1, (addr !== "SHIELD") ? document.getElementById("txt_address_create_normal") : null);
			return;
		}

		ae.Private_Update(function(error2) {
			updateAddressCounts();

			addAddress(ae.getAddressCount() - 1);
			if (addr !== "SHIELD") {
				document.getElementById("btn_getapk").disabled = false;
				document.getElementById("txt_address_create_normal").value = "";
				document.getElementById("txt_address_create_normal").focus();
			}

			if (error2 !== 0) errorDialog(error2, (addr !== "SHIELD") ? document.getElementById("txt_address_create_normal") : null);
		});
	});
}

document.getElementById("btn_address_create_normal").onclick = function() {
	if (ae.getAddressCountNormal() >= ae.getLimitNormalA(ae.getOwnLevel()) || ae.getAddressCountNormal() + ae.getAddressCountShield() >= 31) return;

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
	if (ae.getAddressCountShield() >= ae.getLimitShieldA(ae.getOwnLevel()) || ae.getAddressCountNormal() + ae.getAddressCountShield() >= 31) return;

	addressCreate("SHIELD");
};

document.getElementById("btn_address_update").onclick = function() {
	const btn = this;
	btn.disabled = true;

	const rows = document.getElementById("tbl_addrs").rows;

	for (let i = 0; i < rows.length; i++) {
		ae.setAddressAccInt(i, rows[i].getElementsByTagName("input")[0].checked);
		ae.setAddressAccExt(i, rows[i].getElementsByTagName("input")[1].checked);
		ae.setAddressAllVer(i, rows[i].getElementsByTagName("input")[2].checked);
		ae.setAddressAttach(i, rows[i].getElementsByTagName("input")[3].checked);
		ae.setAddressSecure(i, rows[i].getElementsByTagName("input")[4].checked);
		ae.setAddressOrigin(i, rows[i].getElementsByTagName("input")[5].checked);
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
			addAccountToTable(ae.admin_getUserNum() - 1);
			txt.value = "";
		} else errorDialog(error);

		btn.disabled = false;
	});
};

document.getElementById("chk_dng_usr").onclick = function() {
	document.getElementById("btn_lowme").disabled = !this.checked || (ae.getOwnLevel() === 0);
	document.getElementById("btn_erame").disabled = !this.checked;
	document.getElementById("btn_delme").disabled = !this.checked;
};

document.getElementById("btn_erame").onclick = function() {
	ae.Message_Delete("ALL", function(error) {
		if (error === 0) {
			document.getElementById("chk_dng_usr").checked = false;
			document.getElementById("chk_dng_usr").onclick();
		} else errorDialog(error);
	});
};

document.getElementById("btn_notepad_restore").onclick = function() {
	document.getElementById("txt_notepad").value = ae.getPrivateExtra();
	document.getElementById("btn_notepad_savepad").disabled = true;
	document.getElementById("txt_notepad").oninput = function() {
		this.oninput = null;
		document.getElementById("btn_notepad_savepad").disabled = false;
		document.getElementById("btn_notepad_savepad").textContent = "Save";
	};
};

document.getElementById("txt_notepad").oninput = function() {
	document.getElementById("btn_notepad_savepad").disabled = false;
};

document.getElementById("btn_notepad_savepad").onclick = function() {
	const btn = this;
	btn.disabled = true;

	const error = ae.setPrivateExtra(document.getElementById("txt_notepad").value);
	if (error !== 0) {
		btn.disabled = false;
		errorDialog(error);
		return;
	}

	ae.Private_Update(function(error2) {
		if (error2 !== 0) {
			btn.disabled = false;
			errorDialog(error2);
		} else {
			document.querySelector("#div_notepad meter").value = ae.getPrivateExtraSpace() / ae.getPrivateExtraSpaceMax();
			btn.textContent = "Saved";
			document.getElementById("txt_notepad").oninput = function() {
				this.oninput = null;
				btn.textContent = "Save";
				btn.disabled = false;
			};
		}
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
			document.getElementById("tbd_accs").children[0].children[1].textContent = Math.round(ae.getTotalMsgBytes() / 1024 / 1024);
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
			if (vaultOk) { // Vault opened -> upload to PostVault
				vault.uploadFile(fileSelector.files[0].name, new Uint8Array(reader.result), function(status) {
					if (status === 0) {
						showFiles();
					} // TODO else show error

					btn.disabled = false;
				});
			} else { // No vault access -> upload to All-Ears
				ae.Message_Upload(fileSelector.files[0].name, new Uint8Array(reader.result), function(status) {
					if (status === 0) {
						showFiles();
						document.getElementById("tbd_accs").children[0].children[1].textContent = Math.round(ae.getTotalMsgBytes() / 1024 / 1024);
					} else errorDialog(error);

					btn.disabled = false;
				});
			}
		};

		reader.readAsArrayBuffer(fileSelector.files[0]);
	};
};

document.getElementById("btn_pg").onclick = function() {
//	localStorage.greeting = document.getElementById("txt_pg").value;
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
			displayMsg(false, true, 0);
		});

		return;
	}

	// Email or internal message
	let apk = null;
	if (document.getElementById("write2_recv").textContent.indexOf("@") === -1) {
		const elApk = document.querySelector("#write2_pkey > input");
		if (!elApk.reportValidity()) {
			btn.disabled = false;
			return;
		}

		try {apk = sodium.from_base64(elApk.value, sodium.base64_variants.ORIGINAL_NO_PADDING);}
		catch(e) {
			errorDialog(1); // Invalid input
			btn.disabled = false;
			return;
		}
	}

	document.getElementById("write2_btntxt").textContent = "Sending to";

	ae.Message_Create(
		document.getElementById("write_subj").value,
		document.getElementById("write_body").value,
		document.getElementById("write_from").value,
		document.getElementById("write_recv").value,
		document.getElementById("write_subj").getAttribute("data-replyid"),
		apk,
		function(error) {
			if (error !== 0) {
				errorDialog(error);
				document.getElementById("write2_btntxt").textContent = "Retry sending to";
				btn.disabled = false;
				return;
			}

			showDrbox();
			clearWrite();
			displayOutMsg(false, 0);
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

document.getElementById("btn_limits").onclick = function() {
	const btn = this;
	btn.disabled = true;

	const mib = [parseInt(document.getElementById("lim_mib0").value, 10), parseInt(document.getElementById("lim_mib1").value, 10), parseInt(document.getElementById("lim_mib2").value, 10), parseInt(document.getElementById("lim_mib3").value, 10)];
	const nrm = [parseInt(document.getElementById("lim_nrm0").value, 10), parseInt(document.getElementById("lim_nrm1").value, 10), parseInt(document.getElementById("lim_nrm2").value, 10), parseInt(document.getElementById("lim_nrm3").value, 10)];
	const shd = [parseInt(document.getElementById("lim_shd0").value, 10), parseInt(document.getElementById("lim_shd1").value, 10), parseInt(document.getElementById("lim_shd2").value, 10), parseInt(document.getElementById("lim_shd3").value, 10)];

	ae.Setting_Update(mib, nrm, shd, function(error) {
		btn.disabled = false;

		if (error !== 0) {
			errorDialog(error);
		} else {
			updateAddressCounts();
		}
	});
};

document.getElementById("btn_getapk").onclick = function() {
	document.getElementById("getapk_result").textContent = ae.getOwnApk(document.getElementById("getapk_addr").value);
};

document.getElementById("txt_skey").onfocus = function() {
//	document.getElementById("greeting").textContent = localStorage.greeting;
};

document.getElementById("txt_skey").onkeyup = function(event) {
	if (event.key !== "Enter") return;
	event.preventDefault();
	document.getElementById("btn_enter").click();
};

document.getElementById("btn_enter").onclick = function() {
	const txtSkey = document.getElementById("txt_skey");

	if (txtSkey.value === "") {
		ae.reset();
		document.getElementById("greeting").textContent = "Data cleared";
		return;
	}

	if (!txtSkey.reportValidity()) return;

	const btn = this;
	btn.disabled = true;

	document.getElementById("txt_skey").disabled = true;

	ae.setKeys(txtSkey.value, function(successSetKeys) {
		if (!successSetKeys) {
			document.getElementById("txt_skey").disabled = false;
			txtSkey.focus();

			document.getElementById("greeting").textContent = "SetKeys failed";
			btn.disabled = false;
			return;
		}

		if (vaultOk === false) {
			vault.setKeys(txtSkey.value, function(successPv) {
				if (!successPv) vaultOk = null;
			});
		}

		document.body.style.cursor = "wait";
		document.getElementById("greeting").textContent = "Connecting...";

		ae.Message_Browse(false, true, function(statusBrowse) {
			document.body.style.cursor = "";

			if (statusBrowse !== 0 && statusBrowse !== 0x09) {
				document.getElementById("greeting").textContent = ae.getErrorMessage(statusBrowse) + " (0x" + statusBrowse.toString(16).padStart(2, "0").toUpperCase() + ")";
				document.getElementById("txt_skey").disabled = false;
				btn.disabled = false;
				btn.focus();
				return;
			}

			txtSkey.value = "";
			document.getElementById("div_begin").hidden = true;
			document.getElementById("div_main").hidden = false;
			isReady = true;
			reloadAccount();
			history.replaceState({tab: 0, page: 0, msg: msgDisplay}, null);
			setTab(true, 0, 0);

			if (statusBrowse !== 0) errorDialog(statusBrowse);
			if (!ae.isUserAdmin()) return;

			ae.Account_Browse(function(statusAcc) {
				if (statusAcc === 0) {
					for (let i = 0; i < ae.admin_getUserNum(); i++) {addAccountToTable(i);}
					updateLimits();
				} else {
					errorDialog(statusAcc);
				}
			});
		});
	});
};

});
