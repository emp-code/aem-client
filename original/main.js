"use strict";

sodium.ready.then(function() {

const ae = new AllEars(function(ok) {
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

function getCountryFlag(countryCode) {
	return sodium.to_string(new Uint8Array([
		240, 159, 135, 166 + countryCode.codePointAt(0) - 65,
		240, 159, 135, 166 + countryCode.codePointAt(1) - 65
	]));
}

function deleteButtonShow(show) {
	if (show) {
		document.getElementById("btn_msgdel").hidden = false;
		return;
	}

	const checkboxes = document.getElementById("tbd_inbox").getElementsByTagName("input");
	let checked = false;

	for (let j = 0; j < checkboxes.length; j++) {
		if (checkboxes[j].checked) {
			checked = true;
			break;
		}
	}

	document.getElementById("btn_msgdel").hidden = !checked;
}

function addIntMessage(i) {
	const tbl = document.getElementById("tbd_inbox");
	const row = tbl.insertRow(-1);

	const ts = ae.getIntMsgTime(i);
	let cell = row.insertCell(-1);
	cell.setAttribute("data-ts", ts);
	cell.textContent = new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
	cell.className = "mono";

	cell = row.insertCell(-1);
	cell.textContent = ae.getIntMsgTitle(i);
	cell.onclick = function() {
		navMenu(-1);
		document.getElementById("div_readmsg").hidden = false;
		document.getElementById("readmsg_head").hidden = false;
		document.getElementById("readmsg_levelinfo").hidden = false;
		document.getElementById("readmsg_extmsg").hidden = true;

		document.getElementById("readmsg_title").textContent = ae.getIntMsgTitle(i);
		document.getElementById("readmsg_from").textContent  = ae.getIntMsgFrom(i);
		document.getElementById("readmsg_to").textContent    = ae.getIntMsgTo(i);
		document.getElementById("readmsg_body").textContent  = ae.getIntMsgBody(i);
		document.getElementById("readmsg_level").textContent = ae.getIntMsgLevel(i);

		document.getElementById("readmsg_from").className = (ae.getIntMsgFrom(i).length === 16) ? "mono" : "";
		document.getElementById("readmsg_to").className = (ae.getIntMsgTo(i).length === 16) ? "mono" : "";
	};

	// empty From1 cell
	row.insertCell(-1);

	cell = row.insertCell(-1);
	cell.textContent = ae.getIntMsgFrom(i);
	cell.className = (ae.getIntMsgFrom(i).length === 16) ? "mono" : "";

	cell = row.insertCell(-1);
	cell.textContent = ae.getIntMsgTo(i);
	cell.className = (ae.getIntMsgTo(i).length === 16) ? "mono" : "";

	cell = row.insertCell(-1);
	cell.innerHTML = "<input class=\"delMsg\" type=\"checkbox\" data-id=\"" + ae.getIntMsgIdHex(i) + "\">";
	cell.children[0].onchange = function() {deleteButtonShow(this.checked);};
}

function addExtMessage(i) {
	const tbl = document.getElementById("tbd_inbox");
	const row = tbl.insertRow(-1);

	const ts = ae.getExtMsgTime(i);
	let cell = row.insertCell(-1);
	cell.setAttribute("data-ts", ts);
	cell.textContent = new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
	cell.className = "mono";

	cell = row.insertCell(-1);
	cell.textContent = ae.getExtMsgTitle(i);
	cell.onclick = function() {
		navMenu(-1);
		document.getElementById("div_readmsg").hidden = false;
		document.getElementById("readmsg_head").hidden = false;
		document.getElementById("readmsg_levelinfo").hidden = true;
		document.getElementById("readmsg_extmsg").hidden = false;
		document.getElementById("readmsg_greet").textContent = ae.getExtMsgGreet(i);
		document.getElementById("readmsg_tls").textContent = ae.getExtMsgTLS(i);
		document.getElementById("readmsg_ip").textContent = ae.getExtMsgIp(i);

		document.getElementById("readmsg_country").textContent = ae.getExtMsgCname(i) + " " + getCountryFlag(ae.getExtMsgCcode(i));

		let flagText = "";
		if (!ae.getExtMsgFlagPExt(i)) flagText += "<abbr title=\"The sender did not use the Extended (ESMTP) protocol\">SMTP</abbr> ";
		if (!ae.getExtMsgFlagQuit(i)) flagText += "<abbr title=\"The sender did not issue the required QUIT command\">QUIT</abbr> ";
		if (ae.getExtMsgFlagRare(i)) flagText += "<abbr title=\"The sender issued unusual command(s)\">RARE</abbr> ";
		if (ae.getExtMsgFlagFail(i)) flagText += "<abbr title=\"The sender issued invalid command(s)\">FAIL</abbr> ";
		if (ae.getExtMsgFlagPErr(i)) flagText += "<abbr title=\"The sender violated the protocol\">PROT</abbr> ";
		document.getElementById("readmsg_flags").innerHTML = flagText.trim();

		document.getElementById("readmsg_title").textContent = ae.getExtMsgTitle(i);
		document.getElementById("readmsg_from").textContent = ae.getExtMsgEnvFrom(i);
		document.getElementById("readmsg_to").textContent = ae.getExtMsgEnvTo(i);
		document.getElementById("readmsg_body").innerHTML = ae.getExtMsgBody(i);
		document.getElementById("readmsg_headers").textContent = ae.getExtMsgHeaders(i);

		document.getElementById("readmsg_from").className = "";
		document.getElementById("readmsg_to").className = (ae.getExtMsgEnvTo(i).length === 16) ? "mono" : "";
	};

	const from = ae.getExtMsgHdrFrom(i);
	const from2 = from.substring(from.indexOf("@") + 1);

	cell = row.insertCell(-1);
	cell.textContent = from.substring(0, from.indexOf("@"));

	cell = row.insertCell(-1);

	let el = document.createElement("abbr");
	el.textContent = getCountryFlag(ae.getExtMsgCcode(i));
	el.title = ae.getExtMsgCname(i);
	cell.appendChild(el);

	el = document.createElement("span");
	el.textContent = " " + from2;
	cell.appendChild(el);

	cell = row.insertCell(-1);
	cell.textContent = ae.getExtMsgEnvTo(i);
	cell.className = (ae.getExtMsgEnvTo(i).length === 16) ? "mono" : "";

	cell = row.insertCell(-1);
	el = document.createElement("input");
	el.className = "delMsg";
	el.type = "checkbox";
	el.setAttribute("data-id", ae.getExtMsgIdHex(i));
	el.onchange = function() {deleteButtonShow(this.checked);};
	cell.appendChild(el);
}

function addMessages() {
	const maxExt = ae.getExtMsgCount();
	const maxInt = ae.getIntMsgCount();

	let numExt = 0;
	let numInt = 0;

	//TODO handle sent messages separately

	for (let i = 0; i < (page * 20) + 20; i++) {
		const tsInt = (numInt < maxInt) ? ae.getIntMsgTime(numInt) : 0;
		const tsExt = (numExt < maxExt) ? ae.getExtMsgTime(numExt) : 0;
		if (tsInt === 0 && tsExt === 0) break;

		if (tsInt !== 0 && (tsExt === 0 || tsInt > tsExt)) {
			if (i < (page * 20)) {
				numInt++;
				continue;
			}

			addIntMessage(numInt);
			numInt++;
		} else if (tsExt !== 0) {
			if (i < (page * 20)) {
				numExt++;
				continue;
			}

			addExtMessage(numExt);
			numExt++;
		}
	}
}

function addFile(num) {
	const table = document.getElementById("tbody_files");
	const row = table.insertRow(-1);

	let cell = row.insertCell(-1);
	cell.textContent = new Date(ae.getUplMsgTime(num) * 1000).toISOString().slice(0, 10);

	cell = row.insertCell(-1);
	cell.textContent = ae.getUplMsgBytes(num) / 1024;

	cell = row.insertCell(-1);
	cell.textContent = ae.getUplMsgTitle(num);

	cell = row.insertCell(-1);
	cell.innerHTML = "<button type=\"button\">D</button>";
	cell.children[0].onclick = function() {ae.downloadUplMsg(num);};

	cell = row.insertCell(-1);
	cell.innerHTML = "<button type=\"button\">X</button>";
	cell.children[0].onclick = function() {
		ae.Message_Delete([ae.getUplMsgIdHex(num)], function(error) {
			if (error === 0) {
				row.remove();
			} else {
				console.log("Failed deleting file");
			}
		});
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

	ae.Account_Delete(upk_hex, function(error) {
		if (error === 0) {
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

	ae.Account_Update(upk_hex, level, function(error) {
		if (error !== 0) {
			console.log("Failed to set account level");
			return;
		}

		tbl.rows[rowid].cells[4].textContent = level;

		if (level === 0) {
			tbl.rows[rowid].cells[5].children[0].disabled = false;
			tbl.rows[rowid].cells[6].children[0].disabled = true;
		} else if (level === ae.getLevelMax()) {
			tbl.rows[rowid].cells[5].children[0].disabled = true;
			tbl.rows[rowid].cells[6].children[0].disabled = false;
		} else {
			tbl.rows[rowid].cells[5].children[0].disabled = false;
			tbl.rows[rowid].cells[6].children[0].disabled = false;
		}

		const pkHex = ae.admin_getUserPkHex(rowid);
		const currentLevel = ae.admin_getUserLevel(rowid);
		tbl.rows[rowid].cells[5].children[0].onclick = function() {setAccountLevel(pkHex, currentLevel + 1);};
		tbl.rows[rowid].cells[6].children[0].onclick = function() {setAccountLevel(pkHex, currentLevel - 1);};
	});
}

function deleteAddress(addr) {
	let btns = document.getElementById("tbody_opt_addr").getElementsByTagName("button");
	for (let i = 0; i < btns.length; i++) btns[i].disabled = true;

	let addressToDelete = -1;

	for (let i = 0; i < ae.getAddressCount(); i++) {
		if (addr === ae.getAddress(i)) {
			addressToDelete = i;
			break;
		}
	}

	if (addressToDelete === -1) return;

	ae.Address_Delete(addressToDelete, function(error) {
		if (error !== 0) {
			console.log("Failed to delete address");
			return;
		}

		document.getElementById("tbody_opt_addr").deleteRow(addressToDelete);
		document.getElementById("send_from").remove(addressToDelete);

		document.getElementById("addr_use_normal").textContent = ae.getAddressCountNormal();
		document.getElementById("addr_use_shield").textContent = ae.getAddressCountShield();

		if (ae.getAddressCountNormal() < ae.getLimitNormalA(ae.getUserLevel())) document.getElementById("btn_newaddress").disabled = false;
		if (ae.getAddressCountShield() < ae.getLimitShieldA(ae.getUserLevel())) document.getElementById("btn_newshieldaddress").disabled = false;

		ae.Private_Update(function(error2) {
			if (error2 !== 0) console.log("Failed to update the Private field");

			btns = document.getElementById("tbody_opt_addr").getElementsByTagName("button");
			for (let i = 0; i < btns.length; i++) btns[i].disabled = false;
		});
	});
}

function addAddress(num) {
	const addrTable = document.getElementById("tbody_opt_addr");
	const row = addrTable.insertRow(-1);

	let cell = row.insertCell(-1);
	cell.textContent = ae.getAddress(num);
	if (cell.textContent.length === 16) cell.className = "mono";
	cell.onclick = function() {
		if (cell.textContent.length === 16)
			navigator.clipboard.writeText(ae.shieldMix(cell.textContent) + "@" + ae.getDomainEml());
		else
			navigator.clipboard.writeText(cell.textContent + "@" + ae.getDomainEml());
	};

	cell = row.insertCell(-1);
	cell.innerHTML = ae.getAddressAccExt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";

	cell = row.insertCell(-1);
	cell.innerHTML = ae.getAddressAccInt(num) ? "<input type=\"checkbox\" checked=\"checked\">" : "<input type=\"checkbox\">";

	cell = row.insertCell(-1);
	cell.innerHTML = "<button type=\"button\">X</button>";
	cell.children[0].onclick = function() {deleteAddress(ae.getAddress(num));};

	const opt = document.createElement("option");
	opt.value = ae.getAddress(num);
	opt.textContent = ae.getAddress(num) + "@" + ae.getDomainEml();
	document.getElementById("send_from").appendChild(opt);
}

function clearMessages() {
	document.getElementById("tbd_inbox").innerHTML = "";
	document.getElementById("tbd_snbox").innerHTML = "";
	document.getElementById("tbody_files").innerHTML = "";
}

function delMsgs(tblName, btnName) {
	const cbs = document.getElementsByClassName("delMsg");
	const ids = [];

	for (let i = 0; i < cbs.length; i++) {
		if (cbs[i].checked) ids.push(cbs[i].getAttribute("data-id"));
	}

	if (ids.length > 0) ae.Message_Delete(ids, function(error) {
		if (error === 0) {
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
			ae.deleteContact(i);
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

	cellPk.textContent = ae.admin_getUserPkHex(num);
	cellMb.textContent = ae.admin_getUserSpace(num);
	cellNa.textContent = ae.admin_getUserNAddr(num);
	cellSa.textContent = ae.admin_getUserSAddr(num);
	cellLv.textContent = ae.admin_getUserLevel(num);
	cellBtnPl.innerHTML = "<button type=\"button\">+</button>";
	cellBtnMn.innerHTML = "<button type=\"button\">-</button>";
	cellBtnDe.innerHTML = "<button type=\"button\">X</button>";

	cellPk.className = "mono";
	if (ae.admin_getUserLevel(num) === ae.getLevelMax()) cellBtnPl.children[0].disabled = true;
	if (ae.admin_getUserLevel(num) === 0) cellBtnMn.children[0].disabled = true;

	const pkHex = ae.admin_getUserPkHex(num);
	const currentLevel = ae.admin_getUserLevel(num);
	cellBtnPl.children[0].onclick = function() {setAccountLevel(pkHex, currentLevel + 1);};
	cellBtnMn.children[0].onclick = function() {setAccountLevel(pkHex, currentLevel - 1);};
	cellBtnDe.children[0].onclick = function() {destroyAccount(pkHex);};
}

function reloadInterface() {
	if (!ae.isUserAdmin()) document.getElementById("btn_toadmin").hidden = true;
	document.getElementById("div_begin").hidden = true;
	document.getElementById("div_allears").hidden = false;

	clearMessages();
	document.getElementById("tbody_admin").innerHTML = "";
	document.getElementById("tbody_files").innerHTML = "";
	document.getElementById("tbody_notes_contact").innerHTML = "";
	document.getElementById("tbody_opt_addr").innerHTML = "";

	// Contacts
	for (let i = 0; i < ae.getContactCount(); i++) {
		addContactToTable(
			ae.getContactMail(i),
			ae.getContactName(i),
			ae.getContactNote(i)
		);
	}

	// Addresses
	for (let i = 0; i < ae.getAddressCount(); i++) {
		addAddress(i);
	}

	document.getElementById("addr_use_normal").textContent = ae.getAddressCountNormal();
	document.getElementById("addr_use_shield").textContent = ae.getAddressCountShield();
	document.getElementById("addr_max_normal").textContent = ae.getLimitNormalA(ae.getUserLevel());
	document.getElementById("addr_max_shield").textContent = ae.getLimitShieldA(ae.getUserLevel());

	if (ae.getAddressCountNormal() >= ae.getLimitNormalA(ae.getUserLevel())) document.getElementById("btn_newaddress").disabled = true;
	if (ae.getAddressCountShield() >= ae.getLimitShieldA(ae.getUserLevel())) document.getElementById("btn_newshieldaddress").disabled = true;

	if (ae.isUserAdmin()) {
		const tblLimits = document.getElementById("tbl_limits");
		for (let i = 0; i < 4; i++) {
			tblLimits.rows[i].cells[1].children[0].value = ae.getStorageLimit(i);
			tblLimits.rows[i].cells[2].children[0].value = ae.getLimitNormalA(i);
			tblLimits.rows[i].cells[3].children[0].value = ae.getLimitShieldA(i);
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

			ae.setLimits(storageLimit, addrNrmLimit, addrShdLimit, function(error) {
				if (error !== 0) {
					console.log("Failed to update limits");
				}
			});
		};

		for (let i = 0; i < ae.admin_getUserCount(); i++) {
			addRowAdmin(i);
		}
	}
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

	ae.setKeys(txtSkey.value, function(success) {
		if (!success) {
			console.log("Invalid format for key");
			btn.disabled = false;
			return;
		}

		ae.Message_Browse(false, true, function(statusBrowse) {
			if (statusBrowse !== 0) {
				console.log("Failed to enter");
				btn.disabled = false;
				return;
			}

			txtSkey.value = "";
			reloadInterface();
			document.getElementById("btn_refresh").click();
		});
	});
};

document.getElementById("btn_refresh").onclick = function() {
	const btn = this;
	btn.disabled = true;

	ae.Message_Browse(true, false, function(error) {
		if (error === 0) {
			clearMessages();
			addMessages();
			for (let i = ae.getUplMsgCount() - 1; i >= 0; i--) {addFile(i);}
		} else {
			console.log("Failed to refresh");
		}

		btn.disabled = false;
	});
};

document.getElementById("btn_contact_add").onclick = function() {
	const txtMail = document.getElementById("txt_newcontact_mail");
	const txtName = document.getElementById("txt_newcontact_name");
	const txtNote = document.getElementById("txt_newcontact_note");

	addContactToTable(txtMail.value, txtName.value, txtNote.value);
	ae.addContact(txtMail.value, txtName.value, txtNote.value);

	txtMail.value = "";
	txtName.value = "";
	txtNote.value = "";

	document.getElementById("btn_savenotes").hidden = false;
};

document.getElementById("btn_savenotes").onclick = function() {
	ae.Private_Update(function(error) {
		if (error === 0) {
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

	const sfrom = document.getElementById("send_from");
	const stitle = document.getElementById("send_title");
	const sto = document.getElementById("send_to");
	const sbody = document.getElementById("send_body");

	if (!stitle.reportValidity() || !sto.reportValidity() || !sbody.reportValidity()) return;

	ae.Message_Create(stitle.value, sbody.value, sfrom.value, sto.value, null, function(error) {
		if (error === 0) {
			stitle.value = "";
			sto.value = "";
			sbody.value = "";
		} else {
			console.log("Failed sending message");
		}

		btn.disabled = false;
	});
};

document.getElementById("btn_newaddress").onclick = function() {
	if (ae.getAddressCountNormal() >= ae.getLimitNormalA(ae.getUserLevel())) return;

	const txtNewAddr = document.getElementById("txt_newaddress");
	if (!txtNewAddr.reportValidity()) return;

	const btnN = document.getElementById("btn_newaddress");
	const btnS = document.getElementById("btn_newshieldaddress");
	btnN.disabled = true;
	btnS.disabled = true;

	ae.Address_Create(txtNewAddr.value, function(error1) {
		if (error1 === 0) {
			ae.Private_Update(function(error2) {
				document.getElementById("addr_use_normal").textContent = ae.getAddressCountNormal();
				addAddress(ae.getAddressCount() - 1);
				txtNewAddr.value = "";

				if (error2 !== 0) console.log("Failed to update the Private field");
				if (ae.getAddressCountNormal() < ae.getLimitNormalA(ae.getUserLevel())) btnN.disabled = false;
				if (ae.getAddressCountShield() < ae.getLimitShieldA(ae.getUserLevel())) btnS.disabled = false;
			});
		} else {
			console.log("Failed to add address");
			if (ae.getAddressCountNormal() < ae.getLimitNormalA(ae.getUserLevel())) btnN.disabled = false;
			if (ae.getAddressCountShield() < ae.getLimitShieldA(ae.getUserLevel())) btnS.disabled = false;
		}
	});
};

document.getElementById("btn_newshieldaddress").onclick = function() {
	if (ae.getLimitShieldA() >= ae.getLimitShieldA(ae.getUserLevel())) return;

	const btnN = document.getElementById("btn_newaddress");
	const btnS = document.getElementById("btn_newshieldaddress");
	btnN.disabled = true;
	btnS.disabled = true;

	ae.Address_Create("SHIELD", function(error1) {
		if (error1 !== 0) {
			console.log("Failed to add Shield address");
			if (ae.getAddressCountNormal() < ae.getLimitNormalA(ae.getUserLevel())) btnN.disabled = false;
			if (ae.getAddressCountShield() < ae.getLimitShieldA(ae.getUserLevel())) btnS.disabled = false;
			return;
		}

		ae.Private_Update(function(error2) {
			document.getElementById("addr_use_shield").textContent = ae.getAddressCountShield();
			addAddress(ae.getAddressCount() - 1);

			if (error2 !== 0) console.log("Failed to update the Private field");
			if (ae.getAddressCountNormal() < ae.getLimitNormalA(ae.getUserLevel())) btnN.disabled = false;
			if (ae.getAddressCountShield() < ae.getLimitShieldA(ae.getUserLevel())) btnS.disabled = false;
		});
	});
};

document.getElementById("btn_saveaddrdata").onclick = function() {
	const tbl = document.getElementById("tbody_opt_addr");

	for (let i = 0; i < tbl.rows.length; i++) {
		ae.setAddressAccExt(i, tbl.rows[i].cells[1].firstChild.checked);
		ae.setAddressAccInt(i, tbl.rows[i].cells[2].firstChild.checked);
	}

	ae.Address_Update(function(error) {
		if (error === 0) {
			document.getElementById("btn_saveaddrdata").hidden = true;
		} else {
			console.log("Failed to save address data");
		}
	});
};

document.getElementById("btn_admin_addaccount").onclick = function() {
	const txtPkey = document.getElementById("txt_newacc_pkey");

	if (!txtPkey.reportValidity()) return;

	const btn = document.getElementById("btn_admin_addaccount");
	btn.disabled = true;

	ae.Account_Create(txtPkey.value, function(error) {
		if (error === 0) {
			addRowAdmin(ae.admin_getUserCount() - 1);
			txtPkey.value = "";
		} else {
			console.log("Failed to add account");
		}
	});

	btn.disabled = false;
};

document.getElementById("btn_uploadfile").onclick = function() {
	const fileSelector = document.getElementById("upfile");

	const btn = this;
	btn.disabled = true;

	const reader = new FileReader();
	reader.onload = function() {
		ae.Message_Upload(true, fileSelector.files[0].name, new Uint8Array(reader.result), function(error) {
			if (error === 0) {
				addFile(ae.getFileCount() - 1);
			} else {
				console.log("Failed to upload file");
			}

			btn.disabled = false;
		});
	};

	reader.readAsArrayBuffer(fileSelector.files[0]);
};

function navNotesMenu(num) {
	for (let i = 0; i < 3; i++) {
		if (i === num) {
			document.getElementById("div_notes").children[0].children[i].disabled = true;
			document.getElementById("div_notes").children[1 + i].hidden = false;
		} else {
			document.getElementById("div_notes").children[0].children[i].disabled = false;
			document.getElementById("div_notes").children[1 + i].hidden = true;
		}
	}
}

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

document.getElementById("txt_skey").onkeyup = function(e) {
	if (e.key === "Enter") document.getElementById("btn_enter").click();
};

navMenu(0);

});
