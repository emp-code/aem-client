"use strict";

sodium.ready.then(function() {

const ae = new AllEars(function(ok) {
	if (ok) {
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
	new TabState(0, 2, true, false), // Write
	new TabState(0, 0, false, false), // Notes
	new TabState(0, 2, false, true) // Admin
];

let tab = 0;
const TAB_INBOX = 0;
const TAB_OUTBX = 1;
const TAB_WRITE = 2;
const TAB_NOTES = 3;
const TAB_ADMIN = 4;

// Helper functions
function getCountryName(countryCode) {
	const opts = document.getElementById("gatekeeper_country");

	for (let i = 0; i < opts.length; i++) {
		if (opts[i].value === countryCode) {
			return opts[i].textContent;
		}
	}

	return "Unknown countrycode: " + countryCode;
}

function getCountryFlag(countryCode) {
	return sodium.to_string(new Uint8Array([
		240, 159, 135, 166 + countryCode.codePointAt(0) - 65,
		240, 159, 135, 166 + countryCode.codePointAt(1) - 65
	]));
}

function getMsgId(num) {
	let i;
	if (ae.GetExtMsgHeaders(num).toLowerCase().slice(0, 11) === "message-id:") {
		i = 0;
	} else {
		i = ae.GetExtMsgHeaders(num).toLowerCase().indexOf("\nmessage-id:");
		if (i < 1) return "ERR";
		i++;
	}

	const x = ae.GetExtMsgHeaders(num).slice(i + 11).trim();
	if (x[0] !== "<") return "ERR2";
	return x.slice(1, x.indexOf(">"));
}

function displayMsg(isInt, num) {
	document.getElementById("midright").scroll(0, 0);

	const ts = isInt? ae.GetIntMsgTime(num) : ae.GetExtMsgTime(num);

	document.getElementById("btn_reply").disabled = false;
	document.getElementById("btn_reply").onclick = function() {
		document.getElementById("write_recv").value = isInt? ae.GetIntMsgFrom(num) : ae.GetExtMsgFrom(num);
		document.getElementById("write_subj").value = "Re: " + (isInt ? ae.GetIntMsgTitle(num) : ae.GetExtMsgTitle(num));
		document.getElementById("write_rply").textContent = (isInt? "" : getMsgId(num));
		document.getElementById("btn_write").click();
		document.getElementById("div_write_1").hidden = false;
		document.getElementById("div_write_2").hidden = true;
		document.getElementById("write_body").focus();
		for (const opt of document.getElementById("write_from").options) {
			if (opt.value === (isInt ? ae.GetIntMsgTo(num) : ae.GetExtMsgTo(num))) {
				opt.selected = true;
			}
		}
	};

	document.getElementById("msg").hidden = false;
	document.getElementById("msg").getElementsByTagName("h1")[0].textContent = isInt ? ae.GetIntMsgTitle(num) : ae.GetExtMsgTitle(num);
	document.getElementById("msg").getElementsByTagName("pre")[0].textContent = isInt ? ae.GetIntMsgBody(num) : ae.GetExtMsgBody(num);

	document.getElementById("readmsg_to").textContent = isInt ? ae.GetIntMsgTo(num) : ae.GetExtMsgTo(num);
	document.getElementById("readmsg_date").children[0].textContent = new Date(ts * 1000).toISOString().slice(0, 19).replace("T", " ");

	if (!isInt) {
		document.getElementById("readmsg_ip").hidden = false;
		document.getElementById("readmsg_country").hidden = false;
		document.getElementById("readmsg_tls").hidden = false;
		document.getElementById("readmsg_greet").hidden = false;
		document.getElementById("readmsg_timing").hidden = false;
		document.getElementById("readmsg_envfrom").hidden = false;

		const cc = ae.GetExtMsgCountry(num);

		document.getElementById("readmsg_ip").children[0].textContent = ae.GetExtMsgIp(num);
		document.getElementById("readmsg_country").textContent = getCountryFlag(cc) + " " + getCountryName(cc);
		document.getElementById("readmsg_tls").children[0].textContent = ae.GetExtMsgTLS(num);
		document.getElementById("readmsg_greet").children[0].textContent = ae.GetExtMsgGreet(num);
		document.getElementById("readmsg_envfrom").textContent = ae.GetExtMsgFrom(num);

		let flagText = "";
		if (!ae.GetExtMsgFlagVPad(num)) flagText += "<abbr title=\"Invalid padding\">PAD</abbr> ";
		if (!ae.GetExtMsgFlagVSig(num)) flagText += "<abbr title=\"Invalid signature\">SIG</abbr> ";
		if (!ae.GetExtMsgFlagPExt(num)) flagText += "<abbr title=\"The sender did not use the Extended (ESMTP) protocol\">SMTP</abbr> ";
		if (!ae.GetExtMsgFlagQuit(num)) flagText += "<abbr title=\"The sender did not issue the required QUIT command\">QUIT</abbr> ";
		if (ae.GetExtMsgFlagRare(num)) flagText += "<abbr title=\"The sender issued unusual command(s)\">RARE</abbr> ";
		if (ae.GetExtMsgFlagFail(num)) flagText += "<abbr title=\"The sender issued invalid command(s)\">FAIL</abbr> ";
		if (ae.GetExtMsgFlagPErr(num)) flagText += "<abbr title=\"The sender violated the protocol\">PROT</abbr> ";
		document.getElementById("readmsg_flags").children[0].innerHTML = flagText.trim();
	} else {
		document.getElementById("readmsg_ip").hidden = true;
		document.getElementById("readmsg_country").hidden = true;
		document.getElementById("readmsg_tls").hidden = true;
		document.getElementById("readmsg_greet").hidden = true;
		document.getElementById("readmsg_timing").hidden = true;
		document.getElementById("readmsg_envfrom").hidden = true;

		let symbol = "<span title=\"Invalid level\">&#x26a0;</span>";
		if (ae.GetIntMsgFrom(num) === "system") {if (ae.GetIntMsgLevel(num) === 3) symbol = "<span title=\"System\">&#x1f162;</span>";} // S (System)
		else if (ae.GetIntMsgLevel(num) === 0) symbol = "<span title=\"Level 0 User\">&#x1f10c;</span>"; // 0
		else if (ae.GetIntMsgLevel(num) === 1) symbol = "<span title=\"Level 1 User\">&#x278a;</span>"; // 1
		else if (ae.GetIntMsgLevel(num) === 2) symbol = "<span title=\"Level 2 User\">&#x278b;</span>"; // 2
		else if (ae.GetIntMsgLevel(num) === 3) symbol = "<span title=\"Administrator\">&#x1f150;</span>"; // A (Admin)
		document.getElementById("readmsg_from").innerHTML = symbol + " " + ae.GetIntMsgFrom(num);

		let flagText = "";
		if (!ae.GetIntMsgFlagVPad(num)) flagText += "<abbr title=\"Invalid padding\">PAD</abbr> ";
		if (!ae.GetIntMsgFlagVSig(num)) flagText += "<abbr title=\"Invalid signature\">SIG</abbr> ";
		document.getElementById("readmsg_flags").children[0].innerHTML = flagText.trim();
	}
}

// Interface
function addMsg(isInt, i) {
	const inbox = document.getElementById("tbl_inbox");
	const sent = document.getElementById("tbl_outbx");

	const isSent = false; //TODO
	const table = isSent ? sent : inbox;

	const row = table.insertRow(-1);
	const cellTime = row.insertCell(-1);
	const cellSubj = row.insertCell(-1);
	const cellSnd1 = row.insertCell(-1);
	const cellSnd2 = row.insertCell(-1);

	const ts = isInt? ae.GetIntMsgTime(i) : ae.GetExtMsgTime(i);
	cellTime.setAttribute("data-ts", ts);
	cellTime.textContent = new Date(ts * 1000).toISOString().slice(0, 10);

	cellSubj.textContent = isInt? ae.GetIntMsgTitle(i) : ae.GetExtMsgTitle(i);

	if (isInt) {
		cellSnd1.textContent = ae.GetIntMsgFrom(i);
		cellSnd1.className = (ae.GetIntMsgFrom(i).length === 16) ? "mono" : "";
	} else {
		const from1 = ae.GetExtMsgFrom(i);
		const from2 = from1.substring(from1.indexOf("@") + 1);
		const cc = ae.GetExtMsgCountry(i);

		cellSnd1.textContent = from1.substring(0, from1.indexOf("@"));

		const flag = document.createElement("abbr");
		flag.textContent = getCountryFlag(cc);
		flag.title = getCountryName(cc);
		cellSnd2.appendChild(flag);

		const fromText = document.createElement("span");
		fromText.textContent = " " + from2;
		cellSnd2.appendChild(fromText);
	}

//	divDel.innerHTML = "<input class=\"delMsg\" type=\"checkbox\" data-id=\"" + ae.GetIntMsgIdHex(i) + "\">";

	row.onclick = function() {
		displayMsg(isInt, i);
	};
/*
	cellDel.children[0].onchange = function() {
		if (!divDel.children[0].checked) {
			const checkboxes = elmt.getElementsByTagName("input");
			let checked = false;

			for (let j = 0; j < checkboxes.length; j++) {
				if (checkboxes[j].checked) {
					checked = true;
					break;
				}
			}

			if (!checked) {
				document.getElementById(isSent ? "btn_sentdel" : "btn_msgdel").hidden = true;
				return;
			}
		}

		document.getElementById(isSent? "btn_sentdel" : "btn_msgdel").hidden = false;
	};
*/
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
	const rowsPerPage = getRowsPerPage();
	let skipMsgs = rowsPerPage * tabs[TAB_INBOX].cur;

	const maxExt = ae.GetExtMsgCount();
	const maxInt = ae.GetIntMsgCount();

	tabs[TAB_INBOX].max = Math.floor((maxExt + maxInt) / rowsPerPage);

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

	if (ae.GetReadyMsgKilos() < ae.GetTotalMsgKilos()) {
		const inbox = document.getElementById("tbl_inbox");
		const row = inbox.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + (ae.GetTotalMsgKilos() - ae.GetReadyMsgKilos()) + " KiB left)";

		row.onclick = function() {
			this.onclick = "";

			ae.Message_Browse(false, function(successBrowse) {
				document.getElementById("tbl_inbox").style.opacity = 1;

				if (successBrowse) {
					addMessages();
					if (tabs[tab].cur < tabs[tab].max) document.getElementById("btn_rght").disabled = false;
				}
			});
		};
	}
}

function updateAddressCounts() {
	document.getElementById("limit_normal").textContent = (ae.GetAddressCountNormal() + "/" + ae.GetAddressLimitNormal(ae.GetUserLevel())).padStart(ae.GetAddressLimitNormal(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_shield").textContent = (ae.GetAddressCountShield() + "/" + ae.GetAddressLimitShield(ae.GetUserLevel())).padStart(ae.GetAddressLimitShield(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_total").textContent = ((ae.GetAddressCountNormal() + ae.GetAddressCountShield()) + "/" + ae.GetAddrPerUser()).padStart(5);
}

function reloadAccount() {
	// Contacts
	for (let i = 0; i < ae.GetContactCount(); i++) {
		addContact(
			ae.GetContactMail(i),
			ae.GetContactName(i),
			ae.GetContactNote(i)
		);
	}

	// Addresses
	for (let i = 0; i < ae.GetAddressCount(); i++) {
		addAddress(i);
	}

	document.getElementById("table_addrs").getElementsByTagName("caption")[0].textContent = "Level " + ae.GetUserLevel() + " User";
	updateAddressCounts();
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

	ae.Address_Delete(addressToDelete, function(success) {
		if (success) {
			document.getElementById("tbl_addrs").deleteRow(addressToDelete);
			document.getElementById("write_from").remove(addressToDelete);
			updateAddressCounts();

			if (ae.GetAddressCountNormal() < ae.GetAddressLimitNormal(ae.GetUserLevel())) document.getElementById("btn_address_create_normal").disabled = false;
			if (ae.GetAddressCountShield() < ae.GetAddressLimitShield(ae.GetUserLevel())) document.getElementById("btn_address_create_shield").disabled = false;

			ae.Private_Update(function(success2) {
				if (!success2) console.log("Failed to update the Private field");

				btns = document.getElementById("tbl_addrs").getElementsByTagName("button");
				for (let i = 0; i < btns.length; i++) btns[i].disabled = false;
			});
		} else {
			console.log("Failed to delete address");

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
	const cellChk3 = row.insertCell(-1);
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
	cellChk3.innerHTML = ae.GetAddressUse_Gk(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";

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

		document.getElementById("write_recv").value = "";
		document.getElementById("write_subj").value = "";
		document.getElementById("write_body").value = "";

		document.getElementById("write_recv").focus();
	}
};

document.getElementById("btn_updt").onclick = function() {
	const btn = this;
	btn.disabled = true;
	btn.blur();

	if (tab === TAB_INBOX) {
		document.getElementById("tbl_inbox").style.opacity = 0.5;

		ae.Message_Browse(true, function(successBrowse) {
			document.getElementById("tbl_inbox").style.opacity = 1;

			if (successBrowse) {
				addMessages();
				btn.disabled = false;
			} else {
				console.log("Failed to refresh");
				btn.disabled = false;
			}
		});
	}
};

function addContact(mail, name, note) {
	const tbl = document.getElementById("tbl_ctact");
	const row = tbl.insertRow(-1);
	const cellMail = row.insertCell(-1);
	const cellName = row.insertCell(-1);
	const cellNote = row.insertCell(-1);
	const cellBtnD = row.insertCell(-1);

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

	const btn = this;
	btn.disabled = true;

	ae.Private_Update(function(success) {
		btn.disabled = false;

		if (!success) {
			console.log("Failed contacts update");
		}
	});
};

function updateTab() {
	switch (tab) {
		case TAB_INBOX:
			addMessages();
		break;

		case TAB_WRITE:
			switch (tabs[tab].cur) {
				case 0: // Write
					document.getElementById("div_write_1").hidden = false;
					document.getElementById("div_write_2").hidden = true;
					document.getElementById("write_body").focus();
				break;

				case 1: // Verify
					ae.Address_Lookup(document.getElementById("write_recv").value, function(pk) {
						if (pk) {
							document.getElementById("div_write_1").hidden = true;
							document.getElementById("div_write_2").hidden = false;

							document.getElementById("write2_from").textContent = document.getElementById("write_from").value + "@" + ae.GetDomainEml();
							document.getElementById("write2_recv").textContent = document.getElementById("write_recv").value;
							document.getElementById("write2_pkey").textContent = sodium.to_hex(pk);

							document.getElementById("write2_subj").textContent = document.getElementById("write_subj").value;
							document.getElementById("write2_rply").textContent = document.getElementById("write_rply").textContent;
							document.getElementById("write2_body").textContent = document.getElementById("write_body").value;
						} else {
							console.log("Failed lookup");
						}
					});
				break;

				case 2: // Send
					ae.Message_Create(
						document.getElementById("write_subj").value,
						document.getElementById("write_body").value,
						document.getElementById("write_from").value,
						document.getElementById("write_recv").value,
						document.getElementById("write_rply").textContent,
						(document.getElementById("write2_recv").textContent.indexOf("@") > 0) ? null : sodium.from_hex(document.getElementById("write2_pkey").textContent),
						function(success) {
							if (success) {
								console.log("Sent ok");
							} else {
								console.log("Failed sending");
							}
						}
					);
				break;
			}
		break;

		case TAB_ADMIN:
			for (let i = 0; i < 3; i++) {
				document.getElementById("div_admin").children[i].hidden = (i !== tabs[tab].cur);
			}
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
	};
}

function addressCreate(addr) {
	const btnN = document.getElementById("btn_address_create_normal");
	const btnS = document.getElementById("btn_address_create_shield");
	btnN.disabled = true;
	btnS.disabled = true;

	ae.Address_Create(addr, function(success1) {
		if (success1) {
			ae.Private_Update(function(success2) {
				addAddress(ae.GetAddressCount() - 1);
				if (addr !== "SHIELD") document.getElementById("txt_address_create_normal").value = "";
				updateAddressCounts();

				if (!success2) console.log("Failed to update the Private field");

				if (ae.GetAddressCountNormal() < ae.GetAddressLimitNormal(ae.GetUserLevel())) btnN.disabled = false;
				if (ae.GetAddressCountShield() < ae.GetAddressLimitShield(ae.GetUserLevel())) btnS.disabled = false;
			});
		} else {
			console.log("Failed to add address");

			if (ae.GetAddressCountNormal() < ae.GetAddressLimitNormal(ae.GetUserLevel())) btnN.disabled = false;
			if (ae.GetAddressCountShield() < ae.GetAddressLimitShield(ae.GetUserLevel())) btnS.disabled = false;
		}
	});
}

document.getElementById("btn_address_create_normal").onclick = function() {
	if (ae.GetAddressCountNormal() >= ae.GetAddressLimitNormal(ae.GetUserLevel())) return;

	const txtNewAddr = document.getElementById("txt_address_create_normal");
	if (!txtNewAddr.reportValidity()) return;

	addressCreate(txtNewAddr.value);
};

document.getElementById("btn_address_create_shield").onclick = function() {
	if (ae.GetAddressCountShield() >= ae.GetAddressLimitShield(ae.GetUserLevel())) return;

	addressCreate("SHIELD");
};

document.getElementById("txt_skey").onkeyup = function(event) {
	if (event.key === "Enter") {
		event.preventDefault();
		document.getElementById("btn_enter").click();
	}
};

document.getElementById("btn_enter").onclick = function() {
	const txtSkey = document.getElementById("txt_skey");
	if (!txtSkey.reportValidity()) return;

	const btn = this;
	btn.disabled = true;
	document.getElementById("txt_skey").style.background = "#233";

	ae.SetKeys(txtSkey.value, function(successSetKeys) {
		if (successSetKeys) {
			ae.Account_Browse(0, function(successBrowse) {
				if (successBrowse) {
					txtSkey.value = "";

					reloadAccount();
					document.getElementById("div_begin").hidden = true;
					document.getElementById("div_main").style.display = "grid";

					document.getElementById("btn_updt").click();
				} else {
					console.log("Failed to enter");
					btn.disabled = false;
					document.getElementById("txt_skey").style.background = "#466";
					txtSkey.focus();
				}
			});
		} else {
			console.log("Invalid format for key");
			btn.disabled = false;
			document.getElementById("txt_skey").style.background = "#466";
			txtSkey.focus();
		}
	});
};

});
