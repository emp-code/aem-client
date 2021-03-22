"use strict";

sodium.ready.then(function() {

const ae = new AllEars(function(ok) {
	if (ok) {
		if (localStorage.greeting) {
			document.getElementById("greeting").textContent = localStorage.greeting;
			document.getElementById("txt_pg").value = localStorage.greeting;
		} else localStorage.greeting = document.getElementById("greeting").textContent;

		document.getElementById("txt_skey").style.background = "#466";
		document.getElementById("txt_skey").maxLength = "64";
	} else {
		console.log("Failed to load All-Ears");
	}
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
function getCountryName(countryCode) {
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

	return "&#" + ((128335 + h12) + m30) + ";";
}

function clearDisplay() {
	let el = document.getElementById("midright").getElementsByTagName("img");
	if (el.length !== 1) el = document.getElementById("midright").getElementsByTagName("audio");
	if (el.length !== 1) el = document.getElementById("midright").getElementsByTagName("video");
	if (el.length !== 1) el = document.getElementById("midright").getElementsByTagName("embed");
	if (el.length !== 1) el = document.getElementById("midright").getElementsByTagName("iframe");
	if (el.length !== 1) return;

	URL.revokeObjectURL(el[0].src);
	el[0].remove();
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

function displayFile(num) {
	const fileType = ae.GetUplMsgType(num);
	if (!fileType) {downloadFile(num); return;}

	clearDisplay();
	document.getElementById("midright").scroll(0, 0);
	document.getElementById("midright").setAttribute("data-msgid", ae.GetUplMsgIdHex(num));

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = false;
	document.getElementById("btn_reply").disabled = true;

	document.getElementById("btn_msave").onclick = function() {downloadFile(num);};

	document.getElementById("midright").children[0].hidden = true;
	document.getElementById("midright").children[1].textContent = ae.GetUplMsgTitle(num);

	switch (fileType) {
		case "text": {
			document.getElementById("midright").children[2].hidden = false;
			document.getElementById("midright").children[2].textContent = sodium.to_string(ae.GetUplMsgBody(num));
		break;}

		case "image": {
			document.getElementById("midright").children[2].hidden = true;
			const img = document.createElement("img");
			img.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer]));
			document.getElementById("midright").appendChild(img);

			img.onclick = function() {
				if (!document.fullscreen)
					img.requestFullscreen();
				else
					document.exitFullscreen();
			};
		break;}

		case "audio": {
			document.getElementById("midright").children[2].hidden = true;
			const el = document.createElement("audio");
			el.controls = "controls";
			el.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer]));
			document.getElementById("midright").appendChild(el);
		break;}

		case "video": {
			document.getElementById("midright").children[2].hidden = true;
			const el = document.createElement("video");
			el.controls = "controls";
			el.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer]));
			document.getElementById("midright").appendChild(el);
		break;}

		case "pdf": {
			document.getElementById("midright").children[2].hidden = true;
			const el = document.createElement("embed");
			el.type = "application/pdf";
			el.src = URL.createObjectURL(new Blob([ae.GetUplMsgBody(num).buffer], {type: "application/pdf"}));
			document.getElementById("midright").appendChild(el);
		break;}

		case "html": {
			document.getElementById("midright").children[2].hidden = true;
			const el = document.createElement("iframe");
			el.allow = "";
			el.sandbox = "";
			el.referrerPolicy = "no-referrer";
			el.csp = "base-uri 'none'; child-src 'none'; connect-src 'none'; default-src 'none'; font-src 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; img-src 'none'; manifest-src 'none'; media-src 'none'; object-src 'none'; script-src 'none'; style-src 'none'; worker-src 'none';";
			el.srcdoc = sodium.to_string(ae.GetUplMsgBody(num).buffer);
			document.getElementById("midright").appendChild(el);
		break;}
	}
}

function displayMsg(isInt, num) {
	clearDisplay();

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = isInt;

	document.getElementById("midright").scroll(0, 0);
	document.getElementById("midright").setAttribute("data-msgid", isInt? ae.GetIntMsgIdHex(num) : ae.GetExtMsgIdHex(num));

	const ts = isInt? ae.GetIntMsgTime(num) : ae.GetExtMsgTime(num);

	if (!isInt) {
		document.getElementById("btn_msave").onclick = function() {
			this.blur();

			const a = document.createElement("a");
			a.href = URL.createObjectURL(new Blob([ae.ExportExtMsg(num)]));
			a.download = ae.GetExtMsgTitle(num);
			a.click();

			URL.revokeObjectURL(a.href);
			a.href = "";
			a.download = "";
		};
	}

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

	document.getElementById("midright").children[0].hidden = false;
	document.getElementById("midright").children[2].hidden = false;

	document.getElementById("readmsg_envto").textContent = isInt ? "" : ae.GetExtMsgEnvTo(num);
	document.getElementById("readmsg_hdrto").textContent = isInt ? ae.GetIntMsgTo(num) : (ae.GetExtMsgHdrTo(num) + (ae.GetExtMsgDnTo(num) ? " (" + ae.GetExtMsgDnTo(num) + ")" : ""));

	const tzOs = new Date().getTimezoneOffset();
	const msgDate = new Date((ts * 1000) + (tzOs * -60000));
	document.getElementById("readmsg_date").children[0].innerHTML = getClockIcon(msgDate);
	document.getElementById("readmsg_date").children[1].dateTime = new Date(ts * 1000).toISOString();

	if (isInt) {
		document.getElementById("midright").children[1].textContent = ae.GetIntMsgTitle(num);
		document.getElementById("midright").children[2].textContent = ae.GetIntMsgBody(num);

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

		let symbol = "<span title=\"Invalid level\">&#x26a0;</span>";
		if      (ae.GetIntMsgFrom(num) === "system") {if (ae.GetIntMsgLevel(num) === 3) symbol = "<span title=\"System message\">&#x1f162;</span>";} // (S)
		else if (ae.GetIntMsgFrom(num) === "public") {if (ae.GetIntMsgLevel(num) === 3) symbol = "<span title=\"Public announcement\">&#x1f15f;</span>";} // (P)
		else if (ae.GetIntMsgLevel(num) === 0) symbol = "<span title=\"Level 0 User\">&#x1f10c;</span>"; // 0
		else if (ae.GetIntMsgLevel(num) === 1) symbol = "<span title=\"Level 1 User\">&#x278a;</span>"; // 1
		else if (ae.GetIntMsgLevel(num) === 2) symbol = "<span title=\"Level 2 User\">&#x278b;</span>"; // 2
		else if (ae.GetIntMsgLevel(num) === 3) symbol = "<span title=\"Administrator\">&#x1f150;</span>"; // A (Admin)
		document.getElementById("readmsg_hdrfrom").innerHTML = symbol + " " + ae.GetIntMsgFrom(num);

		let flagText = "";
		if (!ae.GetIntMsgFlagVPad(num)) flagText += "<abbr title=\"Invalid padding\">PAD</abbr> ";
		if (!ae.GetIntMsgFlagVSig(num)) flagText += "<abbr title=\"Invalid signature\">SIG</abbr> ";
		if (ae.GetIntMsgFlagE2ee(num)) flagText += "<abbr title=\"End-to-end encrypted\">E2EE</abbr> ";
		document.getElementById("readmsg_flags").children[0].innerHTML = flagText.trim();
	} else {
		document.getElementById("midright").children[2].innerHTML = "";

		const headers = document.createElement("p");
		headers.textContent = ae.GetExtMsgHeaders(num);
		headers.className = "mono";
		headers.hidden = !showHeaders;
		document.getElementById("midright").children[2].appendChild(headers);

		const body = document.createElement("p");
		body.innerHTML = ae.GetExtMsgBody(num);
		document.getElementById("midright").children[2].appendChild(body);

		document.getElementById("midright").children[1].textContent = ae.GetExtMsgTitle(num);
		document.getElementById("midright").children[1].style.cursor = headers.textContent? "pointer" : "";
		document.getElementById("midright").children[1].onclick = function() {
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

		const cc = ae.GetExtMsgCountry(num);

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
		document.getElementById("readmsg_country").textContent = getCountryFlag(cc);
		document.getElementById("readmsg_country").title = getCountryName(cc);
		document.getElementById("readmsg_ip").children[1].textContent = ae.GetExtMsgIp(num) + (ae.GetExtMsgFlagIpBl(num) ? " ❗" : "");
		document.getElementById("readmsg_tls").children[0].textContent = ae.GetExtMsgTLS(num);

		// Right side
		document.getElementById("readmsg_greet").children[0].textContent = ae.GetExtMsgGreet(num) + (ae.GetExtMsgFlagGrDm(num) ? " ✓" : "");
		document.getElementById("readmsg_rdns").children[0].textContent = ae.GetExtMsgRdns(num) + (ae.GetExtMsgGreet(num) === ae.GetExtMsgRdns(num) ? " ✓" : "");
		document.getElementById("readmsg_cert").children[0].textContent = ae.GetExtMsgTlsDomain(num) ? (ae.GetExtMsgTlsDomain(num) + " ✓") : "";
		document.getElementById("readmsg_dkim").children[0].textContent = dkim;
		document.getElementById("readmsg_envfrom").textContent = ae.GetExtMsgEnvFrom(num);
		document.getElementById("readmsg_hdrfrom").textContent = ae.GetExtMsgHdrFrom(num) + (ae.GetExtMsgDnFrom(num) ? " (" + ae.GetExtMsgDnFrom(num) + ")" : "");

		let flagText = "";
		if (!ae.GetExtMsgFlagVPad(num)) flagText += "<abbr title=\"Invalid padding\">PAD</abbr> ";
		if (!ae.GetExtMsgFlagVSig(num)) flagText += "<abbr title=\"Invalid signature\">SIG</abbr> ";
		if (!ae.GetExtMsgFlagPExt(num)) flagText += "<abbr title=\"The sender did not use the Extended (ESMTP) protocol\">SMTP</abbr> ";
		if (!ae.GetExtMsgFlagQuit(num)) flagText += "<abbr title=\"The sender did not issue the required QUIT command\">QUIT</abbr> ";
		if (ae.GetExtMsgFlagRare(num)) flagText += "<abbr title=\"The sender issued unusual command(s)\">RARE</abbr> ";
		if (ae.GetExtMsgFlagFail(num)) flagText += "<abbr title=\"The sender issued invalid command(s)\">FAIL</abbr> ";
		if (ae.GetExtMsgFlagPErr(num)) flagText += "<abbr title=\"The sender violated the protocol\">PROT</abbr> ";
		document.getElementById("readmsg_flags").children[0].innerHTML = flagText.trim();
	}
}

// Interface
function addMsg(isInt, i) {
	const row = document.getElementById("tbl_inbox").insertRow(-1);
	row.setAttribute("data-msgid", isInt? ae.GetIntMsgIdHex(i) : ae.GetExtMsgIdHex(i));

	const ts = isInt? ae.GetIntMsgTime(i) : ae.GetExtMsgTime(i);
	const el = document.createElement("time");
	el.dateTime = new Date(ts * 1000).toISOString();
	el.textContent = new Date((ts * 1000) + (new Date().getTimezoneOffset() * -60000)).toISOString().slice(0, 10);

	const cellTime = row.insertCell(-1);
	cellTime.appendChild(el);

	const cellSubj = row.insertCell(-1);
	cellSubj.textContent = isInt? ae.GetIntMsgTitle(i) : ae.GetExtMsgTitle(i);

	if (isInt) {
		const cellSnd = row.insertCell(-1);
		cellSnd.textContent = ae.GetIntMsgFrom(i);
		cellSnd.className = (ae.GetIntMsgFrom(i).length === 16) ? "mono" : "";
	} else {
		const from1 = ae.GetExtMsgHdrFrom(i);
		const from2 = from1.substring(from1.indexOf("@") + 1);
		const cc = ae.GetExtMsgCountry(i);
		const cellSnd1 = row.insertCell(-1);
		cellSnd1.textContent = from1.substring(0, from1.indexOf("@"));

		const flag = document.createElement("abbr");
		flag.textContent = getCountryFlag(cc);
		flag.title = getCountryName(cc);

		const fromText = document.createElement("span");
		fromText.textContent = " " + from2;

		const cellSnd2 = row.insertCell(-1);
		cellSnd2.appendChild(flag);
		cellSnd2.appendChild(fromText);
	}

	row.onclick = function() {
		displayMsg(isInt, i);
	};
}

function getRowsPerPage() {
	const tbl = document.getElementById("tbl_inbox");
	tbl.innerHTML = "";
	const row = tbl.insertRow(-1);
	const cell = row.insertCell(-1);
	cell.textContent = "0";

	const rowsPerPage = Math.floor(getComputedStyle(document.getElementById("div_inbox")).height.replace("px", "") / getComputedStyle(document.querySelector("#tbl_inbox > tbody > tr:first-child")).height.replace("px", "")) - 1; // -1 allows space for 'load more'
	tbl.innerHTML = "";
	return rowsPerPage;
}

function addMessages() {
	const maxExt = ae.GetExtMsgCount();
	const maxInt = ae.GetIntMsgCount();

	if (maxExt + maxInt < 1) {
		tabs[TAB_INBOX].max = 0;
		return;
	}

	const rowsPerPage = getRowsPerPage();
	let skipMsgs = rowsPerPage * tabs[TAB_INBOX].cur;

	tabs[TAB_INBOX].max = Math.floor((maxExt + maxInt - 1) / rowsPerPage);

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

	if (ae.GetReadyMsgBytes() < ae.GetTotalMsgBytes()) {
		const inbox = document.getElementById("tbl_inbox");
		const row = inbox.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + Math.round((ae.GetTotalMsgBytes() - ae.GetReadyMsgBytes()) / 1024) + " KiB left)";

		row.onclick = function() {
			this.onclick = "";

			ae.Message_Browse(false, false, function(errorBrowse) {
				document.getElementById("tbl_inbox").style.opacity = 1;

				if (!errorBrowse) {
					addMessages();
					addUploads();
					addSent();
					if (tabs[tab].cur < tabs[tab].max) document.getElementById("btn_rght").disabled = false;
				} // else TODO
			});
		};
	}
}

function addUploads() {
	const tbl = document.getElementById("tbd_uploads");
	tbl.innerHTML = "";

	for (let i = 0; i < ae.GetUplMsgCount(); i++) {
		const row = tbl.insertRow(-1);
		row.setAttribute("data-msgid", ae.GetUplMsgIdHex(i));

		let cell;
		cell = row.insertCell(-1); cell.textContent = new Date(ae.GetUplMsgTime(i) * 1000).toISOString().slice(0, 10);

		cell = row.insertCell(-1); cell.textContent = ae.GetUplMsgTitle(i);
		cell.onclick = function() {displayFile(this.parentElement.rowIndex - 1);};

		cell = row.insertCell(-1); cell.textContent = (ae.GetUplMsgBytes(i) / 1024).toFixed(1);

		cell = row.insertCell(-1);
		if (ae.GetUplMsgIdHex(i)) {
			cell.innerHTML = "<button data-msgid=\"" + ae.GetUplMsgIdHex(i) + "\" type=\"button\">X</button>";

			cell.children[0].onclick = function() {
				const tr = this.parentElement.parentElement;
				ae.Message_Delete(this.getAttribute("data-msgid"), function(error) {
					if (!error) tr.remove();
					else console.log("Error " + error);
				});
			};
		}
	}
}

function displayOutMsg(num) {
	clearDisplay();
	document.getElementById("midright").scroll(0, 0);
	document.getElementById("midright").setAttribute("data-msgid", ae.GetOutMsgIdHex(num));

	document.getElementById("btn_mdele").disabled = false;
	document.getElementById("btn_msave").disabled = true;
	document.getElementById("btn_reply").disabled = true;

	document.getElementById("midright").children[0].hidden = false;
	document.getElementById("midright").children[2].hidden = false;

	document.getElementById("midright").children[1].textContent = ae.GetOutMsgSubj(num);
	document.getElementById("midright").children[2].textContent = ae.GetOutMsgBody(num);

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
//		const cc = ae.GetExtMsgCountry(num);

		document.getElementById("readmsg_ip").children[1].textContent = ae.GetOutMsgIp(num);
//		document.getElementById("readmsg_country").textContent = getCountryFlag(cc) + " " + getCountryName(cc);
//		document.getElementById("readmsg_tls").children[0].textContent = ae.GetOutMsgTLS(num);
		document.getElementById("readmsg_greet").children[0].textContent = ae.GetOutMsgGreet(num);
	}

	let flagText = "";
	if (!ae.GetOutMsgFlagVPad(num)) flagText += "<abbr title=\"Invalid padding\">PAD</abbr> ";
	if (!ae.GetOutMsgFlagVSig(num)) flagText += "<abbr title=\"Invalid signature\">SIG</abbr> ";
	if (ae.GetOutMsgFlagE2ee(num)) flagText += "<abbr title=\"End-to-end encrypted\">E2EE</abbr> ";
	document.getElementById("readmsg_flags").children[0].innerHTML = flagText.trim();
}

function addSent() {
	const tbl = document.getElementById("tbl_drbox");
	tbl.innerHTML = "";

	for (let i = 0; i < ae.GetOutMsgCount(); i++) {
		const row = tbl.insertRow(-1);
		row.setAttribute("data-msgid", ae.GetOutMsgIdHex(i));

		let cell;
		cell = row.insertCell(-1); cell.textContent = new Date(ae.GetOutMsgTime(i) * 1000).toISOString().slice(0, 10);
		cell = row.insertCell(-1); cell.textContent = ae.GetOutMsgSubj(i);
		row.onclick = function() {displayOutMsg(i);};
	}
}

function updateAddressCounts() {
	document.querySelector("#tbd_accs > tr > td:nth-child(3)").textContent = ae.GetAddressCountNormal();
	document.querySelector("#tbd_accs > tr > td:nth-child(4)").textContent = ae.GetAddressCountShield();

	document.getElementById("limit_normal").textContent = (ae.GetAddressCountNormal() + "/" + ae.GetLimitNormalA(ae.GetUserLevel())).padStart(ae.GetLimitNormalA(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_shield").textContent = (ae.GetAddressCountShield() + "/" + ae.GetLimitShieldA(ae.GetUserLevel())).padStart(ae.GetLimitShieldA(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_total").textContent = ((ae.GetAddressCountNormal() + ae.GetAddressCountShield()) + "/" + ae.GetAddrPerUser()).padStart(5);

	const limitReached = (ae.GetAddressCountNormal() + ae.GetAddressCountShield() >= 31);
	document.getElementById("btn_address_create_normal").disabled = (limitReached || ae.GetAddressCountNormal() >= ae.GetLimitNormalA(ae.GetUserLevel()));
	document.getElementById("btn_address_create_shield").disabled = (limitReached || ae.GetAddressCountShield() >= ae.GetLimitShieldA(ae.GetUserLevel()));
}

function adjustLevel(pubkey, level, c) {
	const fs = document.getElementById("tbl_accs");
	fs.disabled = true;

	ae.Account_Update(pubkey, level, function(error) {
		fs.disabled = false;

		if (!error) {
			c[4].textContent = level;
			c[5].children[0].disabled = (level === 3);
			c[6].children[0].disabled = (level === 0);
		} else console.log("Error " + error)
	});
}

function addAccountToTable(i) {
	const tblAccs = document.getElementById("tbd_accs");
	const row = tblAccs.insertRow(-1);
	let cell;
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserPkHex(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserSpace(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserNAddr(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserSAddr(i);
	cell = row.insertCell(-1); cell.textContent = ae.Admin_GetUserLevel(i);

	cell = row.insertCell(-1); cell.innerHTML = "<button type=\"button\" autocomplete=\"off\">+</button>";
	cell.children[0].onclick = function() {const c = this.parentElement.parentElement.cells; adjustLevel(c[0].textContent, parseInt(c[4].textContent, 10) + 1, c);};
	cell.children[0].disabled = (ae.Admin_GetUserLevel(i) === 3);

	cell = row.insertCell(-1); cell.innerHTML = "<button type=\"button\" autocomplete=\"off\">&minus;</button>";
	cell.children[0].onclick = function() {const c = this.parentElement.parentElement.cells; adjustLevel(c[0].textContent, parseInt(c[4].textContent, 10) - 1, c);};
	cell.children[0].disabled = (ae.Admin_GetUserLevel(i) === 0);

	cell = row.insertCell(-1); cell.innerHTML = "<button type=\"button\" autocomplete=\"off\">X</button>";
	cell.children[0].onclick = function() {
		const tr = this.parentElement.parentElement;
		ae.Account_Delete(tr.cells[0].textContent, function(error) {
			if (!error) tr.remove();
			else console.log("Error " + error);
		});
	};
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

	// Accounts
	const tblAccs = document.getElementById("tbd_accs");

	// All: Our account
	const row = tblAccs.insertRow(-1);
	let cell;
	cell = row.insertCell(-1); cell.textContent = ae.GetUserPkHex();
	cell = row.insertCell(-1); cell.textContent = Math.round(ae.GetTotalMsgBytes() / 1048576); // MiB
	cell = row.insertCell(-1); cell.textContent = ae.GetAddressCountNormal();
	cell = row.insertCell(-1); cell.textContent = ae.GetAddressCountShield();
	cell = row.insertCell(-1); cell.textContent = ae.GetUserLevel();
	cell = row.insertCell(-1); cell.innerHTML = "<button type=\"button\" autocomplete=\"off\" disabled=\"disabled\">+</button>";

	cell = row.insertCell(-1); cell.innerHTML = "<button id=\"btn_lowme\" type=\"button\" autocomplete=\"off\" disabled=\"disabled\">&minus;</button>";
	cell.children[0].onclick = function() {
		const newLevel = parseInt(row.cells[4].textContent, 10) - 1;
		ae.Account_Update(ae.GetUserPkHex(), newLevel, function(error) {
			if (!error) {
				row.cells[4].textContent = newLevel;
				if (newLevel === 0) {
					document.getElementById("btn_lowme").disabled = true;
					document.getElementById("chk_lowme").disabled = true;
				}
			}
			else console.log("Error " + error);
		});
	};

	cell = row.insertCell(-1); cell.innerHTML = "<button id=\"btn_delme\" type=\"button\" autocomplete=\"off\" disabled=\"disabled\">X</button>";
	cell.children[0].onclick = function() {
		ae.Account_Delete(ae.GetUserPkHex(), function(error) {
			if (!error) {
				row.remove();
				document.getElementById("chk_delme").disabled = true;
			} else console.log("Error " + error);
		});
	};

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

	updateAddressCounts();
	addMessages();
	addUploads();
	addSent();

	document.getElementById("btn_rght").disabled = (tabs[tab].cur === tabs[tab].max);
}

function deleteAddress(addr) {
	let btns = document.getElementById("tbl_addrs").getElementsByTagName("button");
	for (let i = 0; i < btns.length; i++) btns[i].disabled = true;

	let addressToDelete = -1;

	for (let i = 0; i < ae.GetAddressCount(); i++) {
		if (addr === ae.GetAddress(i)) {
			addressToDelete = i;
			break;
		}
	}

	if (addressToDelete === -1) return;

	ae.Address_Delete(addressToDelete, function(error1) {
		if (!error1) {
			document.getElementById("tbl_addrs").deleteRow(addressToDelete);
			document.getElementById("write_from").remove(addressToDelete);
			updateAddressCounts();

			const limitReached = (ae.GetAddressCountNormal() + ae.GetAddressCountShield() >= 31);
			document.getElementById("btn_address_create_normal").disabled = (limitReached || ae.GetAddressCountNormal() > ae.GetLimitNormalA(ae.GetUserLevel()));
			document.getElementById("btn_address_create_shield").disabled = (limitReached || ae.GetAddressCountShield() > ae.GetLimitShieldA(ae.GetUserLevel()));

			ae.Private_Update(function(error2) {
				if (error2) console.log("Failed to update the Private field: " + error2);

				btns = document.getElementById("tbl_addrs").getElementsByTagName("button");
				for (let i = 0; i < btns.length; i++) btns[i].disabled = false;
			});
		} else {
			console.log("Failed to delete address: " + error1);

			btns = document.getElementById("tbl_addrs").getElementsByTagName("button");
			for (let i = 0; i < btns.length; i++) btns[i].disabled = false;
		}
	});
}

function shieldMix(addr) {
	let newAddr = "";

	for (let i = 0; i < 16; i++) {
		switch (addr.charAt(i)) {
			case '1':
				newAddr += "1iIlL".charAt(Math.floor(Math.random() * 5));
				break;
			case '0':
				newAddr += "0oO".charAt(Math.floor(Math.random() * 3));
				break;
			case 'w':
				newAddr += "VvWw".charAt(Math.floor(Math.random() * 4));
				break;
			default:
				newAddr += (Math.random() > 0.5) ? addr.charAt(i) : addr.charAt(i).toUpperCase();
		}
	}

	return newAddr;
}

function addAddress(num) {
	const addrTable = document.getElementById("tbl_addrs");
	const row = addrTable.insertRow(-1);
	const cellAddr = row.insertCell(-1);
	const cellChk1 = row.insertCell(-1);
	const cellChk2 = row.insertCell(-1);
	const cellBtnD = row.insertCell(-1);

	cellAddr.textContent = ae.GetAddress(num);
	cellAddr.onclick = function() {
		if (cellAddr.textContent.length === 16)
			navigator.clipboard.writeText(shieldMix(cellAddr.textContent) + "@" + ae.GetDomainEml());
		else
			navigator.clipboard.writeText(cellAddr.textContent + "@" + ae.GetDomainEml());
	};

	cellChk1.innerHTML = ae.GetAddressAccExt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";
	cellChk2.innerHTML = ae.GetAddressAccInt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";

	cellBtnD.innerHTML = "<button type=\"button\">X</button>";
	cellBtnD.onclick = function() {deleteAddress(cellAddr.textContent);};

	const opt = document.createElement("option");
	opt.value = cellAddr.textContent;
	opt.textContent = cellAddr.textContent + "@" + ae.GetDomainEml();
	document.getElementById("write_from").appendChild(opt);
}

document.getElementById("btn_dele").onclick = function() {
	this.blur();

	if (tab === TAB_WRITE) {
		tabs[tab].cur = 0;
		updateTab();

		document.querySelector("#write2_pkey > input").value = "";

		document.getElementById("write_recv").value = "";
		document.getElementById("write_subj").value = "";
		document.getElementById("write_body").value = "";

		document.getElementById("write_recv").readOnly = false;
		document.getElementById("write_subj").readOnly = false;
		document.getElementById("write_subj").setAttribute("data-replyid", "");

		document.getElementById("write_recv").focus();
	}
};

document.getElementById("btn_updt").onclick = function() {
	const btn = this;
	btn.disabled = true;
	btn.blur();

	if (tab === TAB_INBOX) {
		document.getElementById("tbl_inbox").style.opacity = 0.5;

		ae.Message_Browse(true, false, function(error) {
			document.getElementById("tbl_inbox").style.opacity = 1;

			if (!error) {
				addMessages();
				addUploads();
				btn.disabled = false;
			} else {
				console.log("Failed to refresh: " + error);
				btn.disabled = false;
			}
		});
	}
};

document.getElementById("btn_mdele").onclick = function() {
	const btn = this;
	btn.blur();
	btn.disabled = true;

	const delId = document.getElementById("midright").getAttribute("data-msgid");
	if (!delId) return;

	ae.Message_Delete(delId, function(error) {
		if (!error) {
			["tbl_inbox", "tbl_drbox", "tbd_uploads"].forEach(function(tbl_name) {
				const tbl = document.getElementById(tbl_name);
				for (let i = 0; i < tbl.rows.length; i++) {if (tbl.rows[i].getAttribute("data-msgid") === delId) tbl.deleteRow(i);}
			});

			addMessages();
			addUploads();
			addSent();
		} else btn.disabled = false; // TODO display error
	});
};

function refreshContactList() {
	const lst = document.getElementById("contact_emails");
	lst.innerHTML = "";

	for (let i = 0; i < ae.GetContactCount(); i++) {
		const el = document.createElement("option");
		el.value = ae.GetContactMail(i);
		lst.appendChild(el);
	}

	if (ae.IsUserAdmin()) {
		const el = document.createElement("option");
		el.value = "public";
		lst.appendChild(el);
	}
}

function addContact(mail, name, note) {
	const tbl = document.getElementById("tbl_ctact");
	const row = tbl.insertRow(-1);
	const cellMail = row.insertCell(-1);
	const cellName = row.insertCell(-1);
	const cellNote = row.insertCell(-1);
	const cellBtnD = row.insertCell(-1);

	cellMail.autocapitalize = "off";
	cellMail.spellcheck = false;
	cellMail.inputMode = "email";

	cellName.autocapitalize = "words";
	cellName.spellcheck = false;

	cellNote.autocapitalize = "off";
	cellNote.spellcheck = false;

	cellMail.textContent = mail;
	cellName.textContent = name;
	cellNote.textContent = note;
	cellBtnD.innerHTML = "<button type=\"button\">X</button>";

	cellMail.contentEditable = true;
	cellName.contentEditable = true;
	cellNote.contentEditable = true;

	cellBtnD.onclick = function() {row.remove();};
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

		if (error) {
			console.log("Failed contacts update: " + error);
		}
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
		case TAB_INBOX:
			addMessages();
		break;

		case TAB_DRBOX:
			addSent();
		break;

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
			for (let i = 0; i <= tabs[tab].max; i++) {
				document.getElementById("div_notes").children[i].hidden = (i !== tabs[tab].cur);
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

const buttons = document.querySelector("#main1 > .top").getElementsByTagName("button");
for (let i = 0; i < buttons.length; i++) {
	buttons[i].onclick = function() {
		tab = i;

		for (let j = 0; j < buttons.length; j++) {
			document.querySelector("#main1 > .mid").children[j].hidden = (tab !== j);
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
		if (!error1) {
			ae.Private_Update(function(error2) {
				updateAddressCounts();

				if (!error2) {
					addAddress(ae.GetAddressCount() - 1);
					if (addr !== "SHIELD") {
						document.getElementById("txt_address_create_normal").value = "";
						document.getElementById("txt_address_create_normal").focus();
					}
				} else {
					console.log("Failed to update the Private field: " + error2);
				}
			});
		} else {
			console.log("Failed to add address: " + error1);
			updateAddressCounts();
		}
	});
}

document.getElementById("btn_address_create_normal").onclick = function() {
	if (ae.GetAddressCountNormal() >= ae.GetLimitNormalA(ae.GetUserLevel()) || ae.GetAddressCountNormal() + ae.GetAddressCountShield() >= 31) return;

	const txtNewAddr = document.getElementById("txt_address_create_normal");
	if (!txtNewAddr.reportValidity()) return;

	addressCreate(txtNewAddr.value);
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
		if (error) console.log("Address/Update failed: " + error);
		btn.disabled = false;
	});
};


document.getElementById("txt_reg").onkeyup = function(event) {
	if (event.key === "Enter") {
		event.preventDefault();
		document.getElementById("btn_reg").click();
	}
};

document.getElementById("btn_reg").onclick = function() {
	const btn = document.getElementById("btn_reg");
	const txt = document.getElementById("txt_reg");
	if (!txt.reportValidity()) return;
	btn.disabled = true;

	ae.Account_Create(txt.value, function(error) {
		if (!error) {
			addAccountToTable(ae.Admin_GetUserCount() - 1);
			txt.value = "";
		} // else TODO

		btn.disabled = false;
	});
};

document.getElementById("chk_delme").onclick = function() {document.getElementById("btn_delme").disabled = !this.checked;};
document.getElementById("chk_lowme").onclick = function() {document.getElementById("btn_lowme").disabled = !this.checked;};

document.getElementById("btn_notepad_saveupl").onclick = function() {
	const np = document.getElementById("txt_notepad");
	np.disabled = true;

	let fname = prompt("Save as...", "Untitled");
	if (!fname.endsWith(".txt")) fname += ".txt";

	ae.Message_Upload(fname, np.value, function(error) {
		if (!error) {
			np.value = "";
			addUploads();
			document.getElementById("tbd_accs").children[0].children[1].textContent = Math.round(ae.GetTotalMsgBytes() / 1024 / 1024);
		} else {
			console.log("Failed to add text: " + error);
		}

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
				if (!error) {
					addUploads();
					document.getElementById("tbd_accs").children[0].children[1].textContent = Math.round(ae.GetTotalMsgBytes() / 1024 / 1024);
				} else {
					console.log("Failed upload: " + error);
				}

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
			if (!error) {
				document.getElementById("write2_btntxt").textContent = "Announced to";
				document.getElementById("write_recv").value = "";
				document.getElementById("write_subj").value = "";
				document.getElementById("write_body").value = "";
			} else {
				// TODO display error
				document.getElementById("write2_btntxt").textContent = "Retry making";
				btn.disabled = false;
			}
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
			if (!error) {
				document.getElementById("write2_btntxt").textContent = "Delivered to";
				document.getElementById("write_recv").value = "";
				document.getElementById("write_subj").value = "";
				document.getElementById("write_body").value = "";
			} else {
				// TODO display error
				document.getElementById("write2_btntxt").textContent = "Retry sending to";
				btn.disabled = false;
			}
		}
	);
};

document.getElementById("txt_skey").onfocus = function() {
	document.getElementById("greeting").textContent = localStorage.greeting;
};

document.getElementById("txt_skey").onkeyup = function(event) {
	if (event.key === "Enter") {
		event.preventDefault();
		document.getElementById("btn_enter").click();
	}
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
	document.getElementById("txt_skey").style.background = "#233";

	ae.SetKeys(txtSkey.value, function(successSetKeys) {
		if (successSetKeys) {
			document.body.style.cursor = "wait";

			ae.Message_Browse(false, true, function(errorBrowse) {
				document.body.style.cursor = "auto";

				if (!errorBrowse) {
					txtSkey.value = "";
					document.getElementById("div_begin").hidden = true;
					document.getElementById("div_main").hidden = false;
					reloadAccount();

					if (ae.IsUserAdmin()) {
						ae.Account_Browse(function(errorAcc) {
							if (!errorAcc) {
								for (let i = 0; i < ae.Admin_GetUserCount(); i++) {addAccountToTable(i);}
							} else {
								console.log("Failed to Account_Browse: " + errorAcc);
							}
						});
					}
				} else {
					document.getElementById("txt_skey").disabled = false;
					document.getElementById("txt_skey").style.background = "#466";
					btn.focus();

					document.getElementById("greeting").textContent = "Error " + errorBrowse;
					btn.disabled = false;
				}
			});
		} else {
			document.getElementById("txt_skey").disabled = false;
			document.getElementById("txt_skey").style.background = "#466";
			txtSkey.focus();

			document.getElementById("greeting").textContent = "SetKeys failed";
			btn.disabled = false;
		}
	});
};

});
