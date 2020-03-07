"use strict";

sodium.ready.then(function() {

const aeDomain = document.domain;
const aeApiPubkey = "";
const aeSaltNormal = "";

const ae = new AllEars(aeDomain, aeApiPubkey, aeSaltNormal, function(ok) {
	if (ok) {
		document.getElementById("btn_enter").disabled = false;
	} else {
		console.log("Failed to load All-Ears");
	}
});

let page=0;

function navMenu(num) {
	document.getElementById("div_readmsg").hidden = true;

	const b = document.getElementsByTagName("nav")[0].getElementsByTagName("button");
	const d = document.getElementsByClassName("maindiv");

	for (let i = 0; i < 5; i++) {
		if (i === num) {
			b[i].disabled = true;
			d[i].hidden = false;
		} else {
			b[i].disabled = false;
			d[i].hidden = true;
		}
	}
}

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

function addMessages() {
	const maxExt = ae.GetExtMsgCount();
	const maxInt = ae.GetIntMsgCount();

	let numExt = 0;
	let numInt = 0;

	//TODO handle sent messages separately

	for (let i = 0; i < (page * 20) + 20; i++) {
		const tsInt = (numInt < maxInt) ? ae.GetIntMsgTime(numInt) : 0;
		const tsExt = (numExt < maxExt) ? ae.GetExtMsgTime(numExt) : 0;
		if (tsInt === 0 && tsExt === 0) break;

		if (tsInt != 0 && (tsExt == 0 || tsInt > tsExt)) {
			if (i < (page * 20)) {
				numInt++;
				continue;
			}

			addIntMessage(numInt);
			numInt++;
		} else if (tsExt != 0) {
			if (i < (page * 20)) {
				numExt++;
				continue;
			}

			addExtMessage(numExt);
			numExt++;
		}
	}
}

function addExtMessage(i) {
	const inbox = document.getElementById("list_inbox");
	const sent = document.getElementById("list_sent");

	const isSent = false;//ae.GetExtMsgIsSent(i);
	const elmt = isSent ? sent : inbox;

	const divTime  = document.createElement("div");
	const divSubj  = document.createElement("div");
	const divFrom1 = document.createElement("div");
	const divFrom2 = document.createElement("div");
	const divTo    = document.createElement("div");
	const divDel   = document.createElement("div");

	const ts = ae.GetExtMsgTime(i);
	divTime.setAttribute("data-ts", ts);
	divTime.textContent = new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
	divTime.className = "mono";

	divSubj.textContent = ae.GetExtMsgTitle(i);

	const from = ae.GetExtMsgFrom(i);
	const from2 = from.substring(from.indexOf("@") + 1);
	const cc = ae.GetExtMsgCountry(i);

	divFrom1.textContent = from.substring(0, from.indexOf("@"));
	divFrom2.innerHTML = "<abbr title=\"" + getCountryName(cc) + "\">" + getCountryFlag(cc) + "</abbr>";

	const fromText = document.createElement("span");
	fromText.textContent = " " + from2;
	divFrom2.appendChild(fromText);

	divTo.textContent = ae.GetExtMsgTo(i);
	divTo.className = (ae.GetExtMsgTo(i).length === 24) ? "mono" : "";

	divDel.innerHTML = "<input class=\"delMsg\" type=\"checkbox\" data-id=\"" + ae.GetExtMsgIdHex(i) + "\">";

	elmt.appendChild(divTime);
	elmt.appendChild(divSubj);
	elmt.appendChild(divFrom1);
	elmt.appendChild(divFrom2);
	elmt.appendChild(divTo);
	elmt.appendChild(divDel);

	divSubj.onclick = function() {
		navMenu(-1);
		document.getElementById("div_readmsg").hidden = false;
		document.getElementById("readmsg_head").hidden = false;
		document.getElementById("readmsg_levelinfo").hidden = true;
		document.getElementById("readmsg_extmsg").hidden = false;
		document.getElementById("readmsg_greet").textContent = ae.GetExtMsgGreet(i);
		document.getElementById("readmsg_tls").textContent = ae.GetExtMsgTLS(i);
		document.getElementById("readmsg_ip").textContent = ae.GetExtMsgIp(i);

		document.getElementById("readmsg_country").innerHTML = getCountryName(cc) + " " + getCountryFlag(cc);

		let flagText = "";
		if (!ae.GetExtMsgFlagPExt(i)) flagText += "<abbr title=\"The sender did not use the Extended (ESMTP) protocol\">SMTP</abbr> ";
		if (!ae.GetExtMsgFlagQuit(i)) flagText += "<abbr title=\"The sender did not issue the required QUIT command\">QUIT</abbr> ";
		if (ae.GetExtMsgFlagRare(i)) flagText += "<abbr title=\"The sender issued unusual command(s)\">RARE</abbr> ";
		if (ae.GetExtMsgFlagFail(i)) flagText += "<abbr title=\"The sender issued invalid command(s)\">FAIL</abbr> ";
		if (ae.GetExtMsgFlagPErr(i)) flagText += "<abbr title=\"The sender violated the protocol\">PROT</abbr> ";
		document.getElementById("readmsg_flags").innerHTML = flagText.trim();

		document.getElementById("readmsg_title").textContent = ae.GetExtMsgTitle(i);
		document.getElementById("readmsg_from").textContent = ae.GetExtMsgFrom(i);
		document.getElementById("readmsg_to").textContent = ae.GetExtMsgTo(i);
		document.getElementById("readmsg_body").textContent = ae.GetExtMsgBody(i);
		document.getElementById("readmsg_headers").textContent = ae.GetExtMsgHeaders(i);

		document.getElementById("readmsg_from").className = "";
		document.getElementById("readmsg_to").className = (ae.GetExtMsgTo(i).length === 24) ? "mono" : "";
	};

	divDel.children[0].onchange = function() {
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

		document.getElementById(isSent ? "btn_sentdel" : "btn_msgdel").hidden = false;
	};
}

function addIntMessage(i) {
	const inbox = document.getElementById("list_inbox");
	const sent = document.getElementById("list_sent");

	const isSent = ae.GetIntMsgIsSent(i);
	const elmt = isSent ? sent : inbox;

	const divTime  = document.createElement("div");
	const divSubj  = document.createElement("div");
	const divFrom1 = document.createElement("div");
	const divFrom2 = document.createElement("div");
	const divTo    = document.createElement("div");
	const divDel   = document.createElement("div");

	const ts = ae.GetIntMsgTime(i);
	divTime.setAttribute("data-ts", ts);
	divTime.textContent = new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
	divTime.className = "mono";

	divSubj.textContent = ae.GetIntMsgTitle(i);

	divFrom1.textContent = ae.GetIntMsgFrom(i);
	divTo.textContent = ae.GetIntMsgTo(i);

	divTo.className = (ae.GetIntMsgTo(i).length === 24) ? "mono" : "";
	divFrom1.className = (ae.GetIntMsgFrom(i).length === 24) ? "mono" : "";

	divDel.innerHTML = "<input class=\"delMsg\" type=\"checkbox\" data-id=\"" + ae.GetIntMsgIdHex(i) + "\">";

	elmt.appendChild(divTime);
	elmt.appendChild(divSubj);
	elmt.appendChild(divFrom1);
	if (!isSent) elmt.appendChild(divFrom2);
	elmt.appendChild(divTo);
	elmt.appendChild(divDel);

	divSubj.onclick = function() {
		navMenu(-1);
		document.getElementById("div_readmsg").hidden = false;
		document.getElementById("readmsg_head").hidden = false;
		document.getElementById("readmsg_levelinfo").hidden = false;
		document.getElementById("readmsg_extmsg").hidden = true;

		document.getElementById("readmsg_title").textContent = ae.GetIntMsgTitle(i);
		document.getElementById("readmsg_from").textContent  = ae.GetIntMsgFrom(i);
		document.getElementById("readmsg_to").textContent    = ae.GetIntMsgTo(i);
		document.getElementById("readmsg_body").textContent  = ae.GetIntMsgBody(i);
		document.getElementById("readmsg_level").textContent = ae.GetIntMsgLevel(i);

		document.getElementById("readmsg_from").className = (ae.GetIntMsgFrom(i).length === 24) ? "mono" : "";
		document.getElementById("readmsg_to").className = (ae.GetIntMsgTo(i).length === 24) ? "mono" : "";
	};

	divDel.children[0].onchange = function() {
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
}

function addFile(num) {
	const table = document.getElementById("tbody_filenotes");

	const row = table.insertRow(-1);
	const cellTime = row.insertCell(-1);
	const cellSize = row.insertCell(-1);
	const cellName = row.insertCell(-1);
	const cellBtnD = row.insertCell(-1);
	const cellBtnX = row.insertCell(-1);

	let kib = ae.GetFileSize(num);
	if (kib > 1023) kib = Math.round(kib / 1024); else kib = 1;

	cellTime.textContent = new Date(ae.GetFileTime(num) * 1000).toISOString().slice(0, 16).replace("T", " ");

	cellSize.textContent = kib;
	cellName.textContent = ae.GetFileName(num);
	cellBtnD.innerHTML = "<button type=\"button\">D</button>";
	cellBtnX.innerHTML = "<button type=\"button\">X</button>";

	cellBtnD.children[0].onclick = function() {
		const parentRow = this.parentElement.parentElement;
		const fileBlob = ae.GetFileBlob(parentRow.rowIndex - 1);

		const a = document.getElementById("a_filedl");
		const objectUrl = URL.createObjectURL(fileBlob);
		a.href = objectUrl;
		a.download = ae.GetFileName(parentRow.rowIndex - 1);
		a.click();

		a.href = "";
		a.download = "";
		URL.revokeObjectURL(objectUrl);
	};

	cellBtnX.children[0].onclick = function() {
		const parentRow = this.parentElement.parentElement;
		ae.Message_Delete([ae.GetFileIdHex(parentRow.rowIndex - 1)], function(success) {
			if (success) {
				table.deleteRow(parentRow.rowIndex - 1);
			} else {
				console.log("Failed to delete note");
			}
		});
	};
}

function addNote(num) {
	const table = document.getElementById("tbody_textnotes");

	const row = table.insertRow(-1);
	const cellTime = row.insertCell(-1);
	const cellTitle = row.insertCell(-1);
	const cellBtnDe = row.insertCell(-1);

	cellTime.textContent = new Date(ae.GetNoteTime(num) * 1000).toISOString().slice(0, 16).replace("T", " ");
	cellTitle.textContent = ae.GetNoteTitle(num);
	cellBtnDe.innerHTML = "<button type=\"button\">X</button>";

	cellBtnDe.children[0].onclick = function() {
		const parentRow = this.parentElement.parentElement;

		ae.Message_Delete([ae.GetNoteIdHex(parentRow.rowIndex - 1)], function(success) {
			if (success) {
				table.deleteRow(parentRow.rowIndex - 1);
			} else {
				console.log("Failed to delete note");
			}
		});
	};

	cellTitle.onclick = function() {
		navMenu(-1);
		document.getElementById("div_readmsg").hidden = false;
		document.getElementById("readmsg_head").hidden = true;

		document.getElementById("readmsg_title").textContent = ae.GetNoteTitle(num);
		document.getElementById("readmsg_body").textContent = ae.GetNoteBody(num);
	};
}

function destroyAccount(upk_hex) {
	const tbl = document.getElementById("tbody_admin");

	let rowid = -1;

	for (let i = 0; i < tbl.rows.length; i++) {
		if (upk_hex === tbl.rows[i].cells[0].textContent) {
			rowid = i;
			break;
		}
	}

	if (rowid === -1) return;

	ae.Account_Delete(upk_hex, function(success) {
		if (success) {
			tbl.deleteRow(rowid);
		} else {
			console.log("Failed to destroy account");
		}
	});
}

function setAccountLevel(upk_hex, level) {
	const tbl = document.getElementById("tbody_admin");

	let rowid = -1;

	for (let i = 0; i < tbl.rows.length; i++) {
		if (tbl.rows[i].cells[0].textContent === upk_hex) {
			rowid = i;
			break;
		}
	}

	if (rowid === -1) return;

	ae.Account_Update(upk_hex, level, function(success) {
		if (!success) {
			console.log("Failed to set account level");
			return;
		}

		tbl.rows[rowid].cells[4].textContent = level;

		if (level === 0) {
			tbl.rows[rowid].cells[5].children[0].disabled = false;
			tbl.rows[rowid].cells[6].children[0].disabled = true;
		} else if (level === ae.GetLevelMax()) {
			tbl.rows[rowid].cells[5].children[0].disabled = true;
			tbl.rows[rowid].cells[6].children[0].disabled = false;
		} else {
			tbl.rows[rowid].cells[5].children[0].disabled = false;
			tbl.rows[rowid].cells[6].children[0].disabled = false;
		}

		const pkHex = ae.Admin_GetUserPkHex(rowid);
		const currentLevel = ae.Admin_GetUserLevel(rowid);
		tbl.rows[rowid].cells[5].children[0].onclick = function() {setAccountLevel(pkHex, currentLevel + 1);};
		tbl.rows[rowid].cells[6].children[0].onclick = function() {setAccountLevel(pkHex, currentLevel - 1);};
	});
}

function deleteAddress(addr) {
	let btns = document.getElementById("tbody_opt_addr").getElementsByTagName("button");
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
			document.getElementById("tbody_opt_addr").deleteRow(addressToDelete);
			document.getElementById("send_from").remove(addressToDelete);

			document.getElementById("addr_use_normal").textContent = ae.GetAddressCountNormal();
			document.getElementById("addr_use_shield").textContent = ae.GetAddressCountShield();

			if (ae.GetAddressCountNormal() < ae.GetAddressLimitNormal(ae.GetUserLevel())) document.getElementById("btn_newaddress").disabled = false;
			if (ae.GetAddressCountShield() < ae.GetAddressLimitShield(ae.GetUserLevel())) document.getElementById("btn_newshieldaddress").disabled = false;

			ae.Private_Update(function(success2) {
				if (!success2) console.log("Failed to update the Private field");
			});
		} else {
			console.log("Failed to delete address");
		}

		btns = document.getElementById("tbody_opt_addr").getElementsByTagName("button");
		for (let i = 0; i < btns.length; i++) btns[i].disabled = false;
	});
}

function shieldMix(addr) {
	let newAddr = "";

	for (let i = 0; i < 24; i++) {
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
	const addrTable = document.getElementById("tbody_opt_addr");
	const row = addrTable.insertRow(-1);
	const cellAddr = row.insertCell(-1);
	const cellChk1 = row.insertCell(-1);
	const cellChk2 = row.insertCell(-1);
	const cellChk3 = row.insertCell(-1);
	const cellBtnD = row.insertCell(-1);

	cellAddr.textContent = ae.GetAddress(num);
	if (cellAddr.textContent.length == 24) cellAddr.className = "mono";
	cellAddr.onclick = function() {
		if (cellAddr.textContent.length == 24)
			navigator.clipboard.writeText(shieldMix(cellAddr.textContent) + "@" + aeDomain);
		else
			navigator.clipboard.writeText(cellAddr.textContent + "@" + aeDomain);
	};

	cellChk1.innerHTML = ae.GetAddressAccExt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";
	cellChk2.innerHTML = ae.GetAddressAccInt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";
	cellChk3.innerHTML = ae.GetAddressUse_Gk(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";

	cellChk1.onchange = function() {document.getElementById("btn_saveaddrdata").hidden = false;};
	cellChk2.onchange = function() {document.getElementById("btn_saveaddrdata").hidden = false;};
	cellChk3.onchange = function() {document.getElementById("btn_saveaddrdata").hidden = false;};

	cellBtnD.innerHTML = "<button type=\"button\">X</button>";
	cellBtnD.onclick = function() {deleteAddress(cellAddr.textContent);};

	const opt = document.createElement("option");
	opt.value = cellAddr.textContent;
	opt.textContent = cellAddr.textContent + "@" + aeDomain;
	document.getElementById("send_from").appendChild(opt);
}

function clearMessages() {
	document.getElementById("list_inbox").innerHTML = "<div>Received</div><div>Subject</div><div>Sender</div><div></div><div>Receiver</div><div>Delete</div>";
	document.getElementById("list_sent").innerHTML = "<div>Sent</div><div>Subject</div><div>From</div><div>Receiver</div><div>Delete</div>";
}

function delMsgs(tblName, btnName) {
	const cbs = document.getElementsByClassName("delMsg");
	const ids = [];

	for (let i = 0; i < cbs.length; i++) {
		if (cbs[i].checked) ids.push(cbs[i].getAttribute("data-id"));
	}

	if (ids.length > 0) ae.Message_Delete(ids, function(success) {
		if (success) {
			clearMessages();
			addMessages();
			document.getElementById(btnName).hidden = true;
		} else {
			console.log("Failed to delete messages");
		}
	});
}

function deleteContact(email) {
	const tbl = document.getElementById("tbody_notes_contact");
	const rows = tbl.rows;

	for (let i = 0; i < rows.length; i++) {
		if (email === rows[i].cells[0].textContent) {
			ae.DeleteContact(i);
			tbl.deleteRow(i);
			break;
		}
	}

	document.getElementById("btn_savenotes").hidden = false;
}

function addContactToTable(mail, name, note) {
	const contactTable = document.getElementById("tbody_notes_contact");
	const row = contactTable.insertRow(-1);
	const cellMail = row.insertCell(-1);
	const cellName = row.insertCell(-1);
	const cellNote = row.insertCell(-1);
	const cellBtnD = row.insertCell(-1);

	cellMail.className = "left";
	cellName.className = "left";
	cellNote.className = "left";

	cellMail.textContent = mail;
	cellName.textContent = name;
	cellNote.textContent = note;
	cellBtnD.innerHTML = "<button type=\"button\">X</button>";

	cellBtnD.onclick = function() {deleteContact(mail);};
}

function addRowAdmin(num) {
	const table = document.getElementById("tbody_admin");

	const row = table.insertRow(-1);
	const cellPk = row.insertCell(-1);
	const cellMb = row.insertCell(-1);
	const cellNa = row.insertCell(-1);
	const cellSa = row.insertCell(-1);
	const cellLv = row.insertCell(-1);
	const cellBtnPl = row.insertCell(-1);
	const cellBtnMn = row.insertCell(-1);
	const cellBtnDe = row.insertCell(-1);

	cellPk.textContent = ae.Admin_GetUserPkHex(num);
	cellMb.textContent = ae.Admin_GetUserSpace(num);
	cellNa.textContent = ae.Admin_GetUserNAddr(num);
	cellSa.textContent = ae.Admin_GetUserSAddr(num);
	cellLv.textContent = ae.Admin_GetUserLevel(num);
	cellBtnPl.innerHTML = "<button type=\"button\">+</button>";
	cellBtnMn.innerHTML = "<button type=\"button\">-</button>";
	cellBtnDe.innerHTML = "<button type=\"button\">X</button>";

	cellPk.className = "mono";
	if (ae.Admin_GetUserLevel(num) === ae.GetLevelMax()) cellBtnPl.children[0].disabled = true;
	if (ae.Admin_GetUserLevel(num) === 0) cellBtnMn.children[0].disabled = true;

	const pkHex = ae.Admin_GetUserPkHex(num);
	const currentLevel = ae.Admin_GetUserLevel(num);
	cellBtnPl.children[0].onclick = function() {setAccountLevel(pkHex, currentLevel + 1);};
	cellBtnMn.children[0].onclick = function() {setAccountLevel(pkHex, currentLevel - 1);};
	cellBtnDe.children[0].onclick = function() {destroyAccount(pkHex);};
}

function addOpt(select, val) {
	const opt = document.createElement("option");
	opt.value = val;
	opt.textContent = val;
	select.appendChild(opt);
}

function reloadInterface() {
	if (!ae.IsUserAdmin()) document.getElementById("btn_toadmin").hidden = true;
	document.getElementById("div_begin").hidden = true;
	document.getElementById("div_allears").hidden = false;

	clearMessages();
	document.getElementById("tbody_admin").innerHTML = "";
	document.getElementById("tbody_filenotes").innerHTML = "";
	document.getElementById("tbody_notes_contact").innerHTML = "";
	document.getElementById("tbody_opt_addr").innerHTML = "";
	document.getElementById("tbody_textnotes").innerHTML = "";

	// Contacts
	for (let i = 0; i < ae.GetContactCount(); i++) {
		addContactToTable(
			ae.GetContactMail(i),
			ae.GetContactName(i),
			ae.GetContactNote(i)
		);
	}

	// Addresses
	for (let i = 0; i < ae.GetAddressCount(); i++) {
		addAddress(i);
	}

	document.getElementById("addr_use_normal").textContent = ae.GetAddressCountNormal();
	document.getElementById("addr_use_shield").textContent = ae.GetAddressCountShield();
	document.getElementById("addr_max_normal").textContent = ae.GetAddressLimitNormal(ae.GetUserLevel());
	document.getElementById("addr_max_shield").textContent = ae.GetAddressLimitShield(ae.GetUserLevel());

	if (ae.GetAddressCountNormal() >= ae.GetAddressLimitNormal(ae.GetUserLevel())) document.getElementById("btn_newaddress").disabled = true;
	if (ae.GetAddressCountShield() >= ae.GetAddressLimitShield(ae.GetUserLevel())) document.getElementById("btn_newshieldaddress").disabled = true;

	// Gatekeeper data
	let gkList = ae.GetGatekeeperAddress();
	for (let i = 0; i < gkList.length; i++) addOpt(document.getElementById("gatekeeper_addr"), gkList[i]);

	gkList = ae.GetGatekeeperDomain();
	for (let i = 0; i < gkList.length; i++) addOpt(document.getElementById("gatekeeper_domain"), gkList[i]);

	let gkCountryCount = 0;
	gkList = ae.GetGatekeeperCountry();
	for (let i = 0; i < gkList.length; i++) {
		const opts = document.getElementById("gatekeeper_country");

		for (let j = 0; j < opts.length; j++) {
			if (opts[j].value === gkList[i]) {
				opts[j].selected = "selected";
				gkCountryCount++;
				break;
			}
		}
	}

	document.getElementById("gk_countrycount").textContent = gkCountryCount;

	addMessages();

	for (let i = ae.GetNoteCount() - 1; i >= 0; i--) {addNote(i);}
	for (let i = ae.GetFileCount() - 1; i >= 0; i--) {addFile(i);}

	if (ae.IsUserAdmin()) {
		const tblLimits = document.getElementById("tbl_limits");
		for (let i = 0; i < 4; i++) {
			tblLimits.rows[i].cells[1].children[0].value = ae.GetStorageLimit(i);
			tblLimits.rows[i].cells[2].children[0].value = ae.GetAddressLimitNormal(i);
			tblLimits.rows[i].cells[3].children[0].value = ae.GetAddressLimitShield(i);
		}

		document.getElementById("btn_admin_savelimits").onclick = function() {
			const storageLimit = [];
			const addrNrmLimit = [];
			const addrShdLimit = [];

			for (let i = 0; i < 4; i++) {
				storageLimit[i] = tblLimits.rows[i].cells[1].children[0].value;
				addrNrmLimit[i] = tblLimits.rows[i].cells[2].children[0].value;
				addrShdLimit[i] = tblLimits.rows[i].cells[3].children[0].value;
			}

			ae.SetLimits(storageLimit, addrNrmLimit, addrShdLimit, function(success) {
				if (!success) {
					console.log("Failed to update limits");
				}
			});
		};

		for (let i = 0; i < ae.Admin_GetUserCount(); i++) {
			addRowAdmin(i);
		}
	}
}

function genKeys() {
	ae.NewKeys(function(pk, sk) {
		console.log("Public=" + pk);
		console.log("Secret=" + sk);
	});
}

document.getElementById("btn_inbox_prev").onclick = function() {
	if (page > 0) {
		page--;
		clearMessages();
		addMessages();
		this.disabled = (page === 0);
	}
};

document.getElementById("btn_inbox_next").onclick = function() {
// TODO: Check if page too high
//	if (page > 0) {
		page++;
		clearMessages();
		addMessages();
		document.getElementById("btn_inbox_prev").disabled = false;
//	}
};

document.getElementById("btn_enter").onclick = function() {
	const txtSkey = document.getElementById("txt_skey");
	if (!txtSkey.reportValidity()) return;

	const btn = this;
	btn.disabled = true;

	ae.SetKeys(txtSkey.value, function(successSetKeys) {
		if (successSetKeys) {
			ae.Account_Browse(0, function(successBrowse) {
				if (successBrowse) {
					txtSkey.value = "";
					reloadInterface();
					document.getElementById("btn_refresh").click();
				} else {
					console.log("Failed to enter");
					btn.disabled = false;
				}
			});
		} else {
			console.log("Invalid format for key");
			btn.disabled = false;
		}
	});
};

document.getElementById("btn_refresh").onclick = function() {
	const btn = this;
	btn.disabled = true;

	ae.Message_Browse(0, function(successBrowse) {
		if (successBrowse) {
			clearMessages();
			addMessages();
			btn.disabled = false;
		} else {
			console.log("Failed to refresh");
			document.getElementById("div_begin").hidden = false;
			document.getElementById("div_allears").hidden = true;
			document.getElementById("btn_enter").disabled = false;
			btn.disabled = false;
		}
	});
};

document.getElementById("btn_contact_add").onclick = function() {
	const txtMail = document.getElementById("txt_newcontact_mail");
	const txtName = document.getElementById("txt_newcontact_name");
	const txtNote = document.getElementById("txt_newcontact_note");

	addContactToTable(txtMail.value, txtName.value, txtNote.value);
	ae.AddContact(txtMail.value, txtName.value, txtNote.value);

	txtMail.value = "";
	txtName.value = "";
	txtNote.value = "";

	document.getElementById("btn_savenotes").hidden = false;
};

document.getElementById("btn_savenotes").onclick = function() {
	ae.Private_Update(function(success) {
		if (success) {
			document.getElementById("btn_savenotes").hidden = true;
		} else {
			console.log("Failed to save note data");
		}
	});
};

document.getElementById("btn_msgdel").onclick = function() {
	delMsgs("tbody_inbox", "btn_msgdel");
};

document.getElementById("btn_sentdel").onclick = function() {
	delMsgs("tbody_sentbox", "btn_sentdel");
};

document.getElementById("btn_send").onclick = function() {
	const btn = this;
	btn.disabled = true;

	const scopy = document.getElementById("send_copy");
	const sfrom = document.getElementById("send_from");
	const stitle = document.getElementById("send_title");
	const sto = document.getElementById("send_to");
	const sbody = document.getElementById("send_body");

	if (!stitle.reportValidity() || !sto.reportValidity() || !sbody.reportValidity()) return;

	ae.Address_Lookup(sto.value, function(to_pubkey) {
		if (to_pubkey) {
			console.log("Lookup ok, trying to send");

			ae.Message_Create(stitle.value, sbody.value, sfrom.value, sto.value, to_pubkey, function(success) {
				if (success) {
					stitle.value = "";
					sto.value = "";
					sbody.value = "";
				} else {
					console.log("Failed sending message");
				}

				btn.disabled = false;
			});
		} else {
			console.log("Failed looking up address");
			btn.disabled = false;
		}
	});
};

document.getElementById("btn_notenew").onclick = function() {
	document.getElementById("div_notes_texts").hidden = true;
	document.getElementById("div_newtextnote").hidden = false;
};

document.getElementById("btn_newnote_cancel").onclick = function() {
	document.getElementById("txt_newnote_title").value = "";
	document.getElementById("txt_newnote_body").value = "";
	document.getElementById("div_notes_texts").hidden = false;
	document.getElementById("div_newtextnote").hidden = true;
};

document.getElementById("btn_newnote_save").onclick = function() {
	const txtTitle = document.getElementById("txt_newnote_title");
	const txtBody = document.getElementById("txt_newnote_body");

	if (!txtTitle.reportValidity() || !txtBody.reportValidity()) return;

	ae.Message_Assign(false, txtTitle.value, sodium.from_string(txtBody.value), function(success) {
		if (success) {
			addNote(ae.GetNoteCount() - 1);

			document.getElementById("txt_newnote_title").value = "";
			document.getElementById("txt_newnote_body").value = "";
			document.getElementById("div_notes_texts").hidden = false;
			document.getElementById("div_newtextnote").hidden = true;
		} else {
			console.log("Failed to save note");
		}
	});
};

document.getElementById("btn_newaddress").onclick = function() {
	if (ae.GetAddressCountNormal() >= ae.GetAddressLimitNormal(ae.GetUserLevel())) return;

	const txtNewAddr = document.getElementById("txt_newaddress");
	if (!txtNewAddr.reportValidity()) return;

	const btnN = document.getElementById("btn_newaddress");
	const btnS = document.getElementById("btn_newshieldaddress");
	btnN.disabled = true;
	btnS.disabled = true;

	ae.Address_Create(txtNewAddr.value, function(success1) {
		if (success1) {
			ae.Private_Update(function(success2) {
				document.getElementById("addr_use_normal").textContent = ae.GetAddressCountNormal();
				addAddress(ae.GetAddressCount() - 1);
				txtNewAddr.value = "";

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
};

document.getElementById("btn_newshieldaddress").onclick = function() {
	if (ae.GetAddressCountShield() >= ae.GetAddressLimitShield(ae.GetUserLevel())) return;

	const btnN = document.getElementById("btn_newaddress");
	const btnS = document.getElementById("btn_newshieldaddress");
	btnN.disabled = true;
	btnS.disabled = true;

	ae.Address_Create("SHIELD", function(success1) {
		if (success1) {
			ae.Private_Update(function(success2) {
				document.getElementById("addr_use_shield").textContent = ae.GetAddressCountShield();
				addAddress(ae.GetAddressCount() - 1);

				if (!success2) console.log("Failed to update the Private field");

				if (ae.GetAddressCountNormal() < ae.GetAddressLimitNormal(ae.GetUserLevel())) btnN.disabled = false;
				if (ae.GetAddressCountShield() < ae.GetAddressLimitShield(ae.GetUserLevel())) btnS.disabled = false;
			});
		} else {
			console.log("Failed to add Shield address");

			if (ae.GetAddressCountNormal() < ae.GetAddressLimitNormal(ae.GetUserLevel())) btnN.disabled = false;
			if (ae.GetAddressCountShield() < ae.GetAddressLimitShield(ae.GetUserLevel())) btnS.disabled = false;
		}
	});
};

document.getElementById("btn_saveaddrdata").onclick = function() {
	const tbl = document.getElementById("tbody_opt_addr");

	for (let i = 0; i < tbl.rows.length; i++) {
		ae.SetAddressAccExt(i, tbl.rows[i].cells[1].firstChild.checked);
		ae.SetAddressAccInt(i, tbl.rows[i].cells[2].firstChild.checked);
		ae.SetAddressUse_Gk(i, tbl.rows[i].cells[3].firstChild.checked);
	}

	ae.Address_Update(function(success) {
		if (success) {
			document.getElementById("btn_saveaddrdata").hidden = true;
		} else {
			console.log("Failed to save address data");
		}
	});
};

document.getElementById("btn_gkdomain_add").onclick = function() {
	const select = document.getElementById("gatekeeper_domain");
	const txt = document.getElementById("txt_gkdomain");

	if (!txt.reportValidity()) return;

	addOpt(select, txt.value);
	txt.value = "";
	document.getElementById("btn_savegkdata").hidden = false;
};

document.getElementById("btn_gkaddr_add").onclick = function() {
	const select = document.getElementById("gatekeeper_addr");
	const txt = document.getElementById("txt_gkaddr");

	if (!txt.reportValidity()) return;

	addOpt(select, txt.value);
	txt.value = "";
	document.getElementById("btn_savegkdata").hidden = false;
};

document.getElementById("btn_gkdomain_del").onclick = function() {
	const select = document.getElementById("gatekeeper_domain");
	if (select.selectedIndex >= 0) select.remove(select.selectedIndex);
	document.getElementById("btn_savegkdata").hidden = false;
};

document.getElementById("btn_gkaddr_del").onclick = function() {
	const select = document.getElementById("gatekeeper_addr");
	if (select.selectedIndex >= 0) select.remove(select.selectedIndex);
	document.getElementById("btn_savegkdata").hidden = false;
};

document.getElementById("btn_savegkdata").onclick = function() {
	const blocklist = [];

	let opts = document.getElementById("gatekeeper_country").selectedOptions;
	for (let i = 0; i < opts.length; i++) blocklist.push(opts[i].value);

	opts = document.getElementById("gatekeeper_domain").options;
	for (let i = 0; i < opts.length; i++) blocklist.push(opts[i].value);

	opts = document.getElementById("gatekeeper_addr").options;
	for (let i = 0; i < opts.length; i++) blocklist.push(opts[i].value);

	ae.SaveGatekeeperData(blocklist, function(success) {
		if (success) {
			document.getElementById("btn_savegkdata").hidden = true;
		} else {
			console.log("Failed to update Gatekeeper data");
		}
	});
};

document.getElementById("btn_admin_addaccount").onclick = function() {
	const txtPkey = document.getElementById("txt_newacc_pkey");

	if (!txtPkey.reportValidity()) return;

	const btn = document.getElementById("btn_admin_addaccount");
	btn.disabled = true;

	ae.Account_Create(txtPkey.value, function(success) {
		if (success) {
			addRowAdmin(ae.Admin_GetUserCount() - 1);
			txtPkey.value = "";
		} else {
			console.log("Failed to add account");
		}
	});

	btn.disabled = false;
};

document.getElementById("btn_uploadfile").onclick = function() {
	const fileSelector = document.getElementById("upfile");
	const f = fileSelector.files[0];

	if (f.name.length + f.size > 8138) {
		console.log("Too large");
		fileSelector.value = null;
		return;
	}

	const btn = this;
	btn.disabled = true;

	const reader = new FileReader();
	reader.onload = function(e) {
		const u8data = new Uint8Array(reader.result);

		ae.Message_Assign(true, f.name, u8data, function(success) {
			if (success) {
				addFile(ae.GetFileCount() - 1);
				fileSelector.value = null;
			} else {
				console.log("Failed to upload file");
			}

			btn.disabled = false;
		});
	};

	reader.readAsArrayBuffer(f);
};

function navNotesMenu(num) {
	document.getElementById("div_newtextnote").hidden = true;

	for (let i = 0; i < 4; i++) {
		if (i === num) {
			document.getElementById("div_notes").children[0].children[i].disabled = true;
			document.getElementById("div_notes").children[1 + i].hidden = false;
		} else {
			document.getElementById("div_notes").children[0].children[i].disabled = false;
			document.getElementById("div_notes").children[1 + i].hidden = true;
		}
	}
}

document.getElementById("btn_prefs_gatekeeper").onclick = function() {
	document.getElementById("btn_prefs_addresses").disabled = false;
	document.getElementById("btn_prefs_gatekeeper").disabled = true;
	document.getElementById("div_prefs_gatekeeper").hidden = false;
	document.getElementById("div_prefs_addresses").hidden = true;

	document.getElementById("div_prefs_gatekeeper").style.width = getComputedStyle(document.getElementById("gatekeeper_country")).width;
};

document.getElementById("btn_prefs_addresses").onclick = function() {
	document.getElementById("btn_prefs_addresses").disabled = true;
	document.getElementById("btn_prefs_gatekeeper").disabled = false;
	document.getElementById("div_prefs_gatekeeper").hidden = true;
	document.getElementById("div_prefs_addresses").hidden = false;
};

let btns = document.getElementsByTagName("nav")[0].getElementsByTagName("button");
btns[0].onclick = function() {navMenu(0);};
btns[1].onclick = function() {navMenu(1);};
btns[2].onclick = function() {navMenu(2);};
btns[3].onclick = function() {navMenu(3);};
btns[4].onclick = function() {navMenu(4);};

btns = document.getElementById("div_notes").getElementsByTagName("button");
btns[0].onclick = function() {navNotesMenu(0);};
btns[1].onclick = function() {navNotesMenu(1);};
btns[2].onclick = function() {navNotesMenu(2);};
btns[3].onclick = function() {navNotesMenu(3);};

document.getElementById("gatekeeper_country").onchange = function() {
	document.getElementById("btn_savegkdata").hidden = false;
};

document.getElementById("txt_skey").onkeyup = function(e) {
	if (e.key === "Enter") document.getElementById("btn_enter").click();
};

navMenu(0);

});