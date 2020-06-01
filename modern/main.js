"use strict";

sodium.ready.then(function() {

const ae = new AllEars(function(ok) {
	if (ok) {
		document.getElementById("txt_skey").style.background = "#404b41";
		document.getElementById("txt_skey").maxLength = "64";
	} else {
		console.log("Failed to load All-Ears");
	}
});

let tab="inbox";
let page=0;

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
	const regionalIndicator1 = 127462 + countryCode.codePointAt(0) - 65;
	const regionalIndicator2 = 127462 + countryCode.codePointAt(1) - 65;
	return "&#" + regionalIndicator1 + ";&#" + regionalIndicator2 + ";";
}

function displayMsg(isInt, num) {
	document.getElementById("midright").scroll(0, 0);

	const ts = isInt? ae.GetIntMsgTime(num) : ae.GetExtMsgTime(num);

	document.getElementById("btn_reply").disabled = false;
	document.getElementById("btn_reply").onclick = function() {
		document.getElementById("write_recv").value = isInt ? ae.GetIntMsgFrom(num) : ae.GetExtMsgFrom(num);
		document.getElementById("write_subj").value = "Re: " + (isInt ? ae.GetIntMsgTitle(num) : ae.GetExtMsgTitle(num));
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
		document.getElementById("readmsg_flags").hidden = false;
		document.getElementById("readmsg_country").hidden = false;
		document.getElementById("readmsg_tls").hidden = false;
		document.getElementById("readmsg_greet").hidden = false;
		document.getElementById("readmsg_timing").hidden = false;
		document.getElementById("readmsg_envfrom").hidden = false;

		const cc = ae.GetExtMsgCountry(num);

		document.getElementById("readmsg_ip").children[0].textContent = ae.GetExtMsgIp(num);
		document.getElementById("readmsg_country").innerHTML = getCountryFlag(cc) + " " + getCountryName(cc);
		document.getElementById("readmsg_tls").children[0].textContent = ae.GetExtMsgTLS(num);
		document.getElementById("readmsg_greet").children[0].textContent = ae.GetExtMsgGreet(num);
		document.getElementById("readmsg_envfrom").textContent = ae.GetExtMsgFrom(num);

		let flagText = "";
		if (!ae.GetExtMsgFlagPExt(num)) flagText += "<abbr title=\"The sender did not use the Extended (ESMTP) protocol\">SMTP</abbr> ";
		if (!ae.GetExtMsgFlagQuit(num)) flagText += "<abbr title=\"The sender did not issue the required QUIT command\">QUIT</abbr> ";
		if (ae.GetExtMsgFlagRare(num)) flagText += "<abbr title=\"The sender issued unusual command(s)\">RARE</abbr> ";
		if (ae.GetExtMsgFlagFail(num)) flagText += "<abbr title=\"The sender issued invalid command(s)\">FAIL</abbr> ";
		if (ae.GetExtMsgFlagPErr(num)) flagText += "<abbr title=\"The sender violated the protocol\">PROT</abbr> ";
		document.getElementById("readmsg_flags").children[0].innerHTML = flagText.trim();
	} else {
		document.getElementById("readmsg_ip").hidden = true;
		document.getElementById("readmsg_flags").hidden = true;
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
	}
}

// Interface
function addMsg(isInt, i) {
	const inbox = document.getElementById("tbl_inbox");
	const sent = document.getElementById("tbl_sent");

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
		cellSnd2.innerHTML = "<abbr title=\"" + getCountryName(cc) + "\">" + getCountryFlag(cc) + "</abbr>";

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

function addMessages() {
	const maxExt = ae.GetExtMsgCount();
	const maxInt = ae.GetIntMsgCount();

	let numExt = 0;
	let numInt = 0;

	while(1) {
		const tsInt = (numInt < maxInt) ? ae.GetIntMsgTime(numInt) : 0;
		const tsExt = (numExt < maxExt) ? ae.GetExtMsgTime(numExt) : 0;
		if (tsInt === 0 && tsExt === 0) break;

		if (tsInt !== 0 && (tsExt === 0 || tsInt > tsExt)) {
			addMsg(true, numInt);
			numInt++;
		} else if (tsExt !== 0) {
			addMsg(false, numExt);
			numExt++;
		}
	}

	if (ae.GetReadyMsgKilos() < ae.GetTotalMsgKilos()) {
		const inbox = document.getElementById("tbl_inbox");
		const row = inbox.insertRow(-1);
		const cell = row.insertCell(-1);
		cell.textContent = "Load more (" + (ae.GetTotalMsgKilos() - ae.GetReadyMsgKilos()) + " KiB left)"

		row.onclick = function() {
			this.onclick = "";

			ae.Message_Browse(false, function(successBrowse) {
				document.getElementById("tbl_inbox").style.opacity = 1;

				if (successBrowse) {
					clearMessages();
					addMessages();
				}
			});
		};
	}
}

function clearMessages() {
	document.getElementById("tbl_inbox").innerHTML = "";
//	document.getElementById("tbl_sentm").innerHTML = "";
//	document.getElementById("tbl_notes").innerHTML = "";
//	document.getElementById("tbl_files").innerHTML = "";
}

function updateAddressCounts() {
	document.getElementById("limit_normal").textContent = (ae.GetAddressCountNormal() + "/" + ae.GetAddressLimitNormal(ae.GetUserLevel())).padStart(ae.GetAddressLimitNormal(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_shield").textContent = (ae.GetAddressCountShield() + "/" + ae.GetAddressLimitShield(ae.GetUserLevel())).padStart(ae.GetAddressLimitShield(ae.GetUserLevel()) > 9 ? 5 : 1);
	document.getElementById("limit_total").textContent = ((ae.GetAddressCountNormal() + ae.GetAddressCountShield()) + "/" + ae.GetAddrPerUser()).padStart(5);
}

function reloadInterface() {
	document.getElementById("div_begin").hidden = true;
	document.getElementById("div_main").style.display = "grid";

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
			navigator.clipboard.writeText(shieldMix(cellAddr.textContent) + "@" + ae.GetDomain());
		else
			navigator.clipboard.writeText(cellAddr.textContent + "@" + ae.GetDomain());
	};

	cellChk1.innerHTML = ae.GetAddressAccExt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";
	cellChk2.innerHTML = ae.GetAddressAccInt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";
	cellChk3.innerHTML = ae.GetAddressUse_Gk(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";

	cellBtnD.innerHTML = "<button type=\"button\">X</button>";
	cellBtnD.onclick = function() {deleteAddress(cellAddr.textContent);};

	const opt = document.createElement("option");
	opt.value = cellAddr.textContent;
	opt.textContent = cellAddr.textContent + "@" + ae.GetDomain();
	document.getElementById("write_from").appendChild(opt);
}

document.getElementById("btn_updt").onclick = function() {
	const btn = this;
	btn.disabled = true;
	btn.blur();

	if (tab === "inbox") {
		document.getElementById("tbl_inbox").style.opacity = 0.5;

		ae.Message_Browse(true, function(successBrowse) {
			document.getElementById("tbl_inbox").style.opacity = 1;

			if (successBrowse) {
				clearMessages();
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
}

// Tabs
function setupButtons() {
	switch(tab) {
		case "inbox":
		case "snbox":
			document.getElementById("btn_dele").disabled = false;
			document.getElementById("btn_left").disabled = false; // depends
			document.getElementById("btn_cent").disabled = true;
			document.getElementById("btn_rght").disabled = false;
			document.getElementById("btn_updt").disabled = false;
		break;
		case "write":
			document.getElementById("btn_dele").disabled = false; // depends
			document.getElementById("btn_left").disabled = false; // depends
			document.getElementById("btn_cent").disabled = true;
			document.getElementById("btn_rght").disabled = false;
			document.getElementById("btn_updt").disabled = true;
		break;
		case "notes":
			document.getElementById("btn_dele").disabled = true;
			document.getElementById("btn_left").disabled = false; // depends
			document.getElementById("btn_cent").disabled = true;
			document.getElementById("btn_rght").disabled = false; // depends
			document.getElementById("btn_updt").disabled = true; // depends
		break;
		case "prefs":
			document.getElementById("btn_dele").disabled = true;
			document.getElementById("btn_left").disabled = false; // depends
			document.getElementById("btn_cent").disabled = true;
			document.getElementById("btn_rght").disabled = false; // depends
			document.getElementById("btn_updt").disabled = true; // depends
		break;
	}
}

document.getElementById("btn_left").onclick = function() {
	switch (tab) {
		case "write":
			document.getElementById("div_write_1").hidden = false;
			document.getElementById("div_write_2").hidden = true;
			document.getElementById("write_body").focus();
		break;
	}

	this.blur();
};

document.getElementById("btn_rght").onclick = function() {
	switch (tab) {
		case "write":
			if (!document.getElementById("div_write_1").hidden) {
				ae.Address_Lookup(document.getElementById("write_recv").value, function(pk) {
					if (pk) {
						document.getElementById("div_write_1").hidden = true;
						document.getElementById("div_write_2").hidden = false;

						document.getElementById("write2_from").textContent = document.getElementById("write_from").value + "@" + ae.GetDomain();
						document.getElementById("write2_recv").textContent = document.getElementById("write_recv").value;
						document.getElementById("write2_pkey").textContent = sodium.to_hex(pk);

						document.getElementById("write2_subj").textContent = document.getElementById("write_subj").value;
						document.getElementById("write2_body").textContent = document.getElementById("write_body").value;
					} else {
						console.log("Failed lookup");
					}
				});
			} else if (!document.getElementById("div_write_2").hidden) {
				ae.Message_Create(document.getElementById("write_subj").value, document.getElementById("write_body").value, document.getElementById("write_from").value, document.getElementById("write_recv").value, sodium.from_hex(document.getElementById("write2_pkey").textContent), function(success) {
					if (success) {
						console.log("Sent ok");
					} else {
						console.log("Failed sending");
					}
				});
			}
		break;
	}

	this.blur();
};

for (const btn1 of document.getElementById("main1").getElementsByClassName("top")[0].getElementsByTagName("button")) {
	btn1.onclick = function() {
		for (const btn2 of document.getElementById("main1").getElementsByClassName("top")[0].getElementsByTagName("button")) {
			const isMatch = (btn1 === btn2);
			btn2.disabled = isMatch;
			document.getElementById("div_" + btn2.id.slice(4)).hidden = !isMatch;

			if (isMatch) {
				tab = btn2.id.slice(4);
				setupButtons();
			}
		}
	};
};

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
}

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
	document.getElementById("txt_skey").style.background = "#111";

	ae.SetKeys(txtSkey.value, function(successSetKeys) {
		if (successSetKeys) {
			ae.Account_Browse(0, function(successBrowse) {
				if (successBrowse) {
					txtSkey.value = "";
					reloadInterface();
					document.getElementById("btn_updt").click();
				} else {
					console.log("Failed to enter");
					btn.disabled = false;
					document.getElementById("txt_skey").style.background = "#404b41";
					txtSkey.focus();
				}
			});
		} else {
			console.log("Invalid format for key");
			btn.disabled = false;
			document.getElementById("txt_skey").style.background = "#404b41";
			txtSkey.focus();
		}
	});
};

});
