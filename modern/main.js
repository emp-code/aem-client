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
	document.getElementById("msg").hidden = false;
	document.getElementById("msg").getElementsByTagName("h1")[0].textContent = isInt ? ae.GetIntMsgTitle(num) : ae.GetExtMsgTitle(num);
	document.getElementById("msg").getElementsByTagName("pre")[0].textContent = isInt ? ae.GetIntMsgBody(num) : ae.GetExtMsgBody(num);

	document.getElementById("readmsg_to").textContent = isInt ? ae.GetIntMsgTo(num) : ae.GetExtMsgTo(num);

	const ts = isInt? ae.GetIntMsgTime(num) : ae.GetExtMsgTime(num);
	document.getElementById("readmsg_date").textContent = new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");

	if (!isInt) {
		const cc = ae.GetExtMsgCountry(num);

		document.getElementById("readmsg_greet").textContent = ae.GetExtMsgGreet(num);
		document.getElementById("readmsg_ip").textContent = ae.GetExtMsgIp(num);
		document.getElementById("readmsg_tls").textContent = ae.GetExtMsgTLS(num);
		document.getElementById("readmsg_country").innerHTML = getCountryFlag(cc) + " " + getCountryName(cc);
		document.getElementById("readmsg_envfrom").textContent = ae.GetExtMsgFrom(num);

		let flagText = "";
		if (!ae.GetExtMsgFlagPExt(num)) flagText += "<abbr title=\"The sender did not use the Extended (ESMTP) protocol\">SMTP</abbr> ";
		if (!ae.GetExtMsgFlagQuit(num)) flagText += "<abbr title=\"The sender did not issue the required QUIT command\">QUIT</abbr> ";
		if (ae.GetExtMsgFlagRare(num)) flagText += "<abbr title=\"The sender issued unusual command(s)\">RARE</abbr> ";
		if (ae.GetExtMsgFlagFail(num)) flagText += "<abbr title=\"The sender issued invalid command(s)\">FAIL</abbr> ";
		if (ae.GetExtMsgFlagPErr(num)) flagText += "<abbr title=\"The sender violated the protocol\">PROT</abbr> ";
		document.getElementById("readmsg_flags").innerHTML = flagText.trim();
	} else {
		document.getElementById("readmsg_from").textContent = ae.GetIntMsgFrom(num);
	}

}

// Interface
function addMsg(isInt, i) {
	const inbox = document.getElementById("tbl_inbox");
	const sent = document.getElementById("tbl_sent");

	const isSent = isInt? ae.GetIntMsgIsSent(i) : false;
	const table = isSent ? sent : inbox;

	const row = table.insertRow(-1);
	const cellTime = row.insertCell(-1);
	const cellSubj = row.insertCell(-1);
	const cellSnd1 = row.insertCell(-1);
	const cellSnd2 = row.insertCell(-1);

	const ts = isInt? ae.GetIntMsgTime(i) : ae.GetExtMsgTime(i);
	cellTime.setAttribute("data-ts", ts);
	cellTime.textContent = new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");

	cellSubj.textContent = isInt? ae.GetIntMsgTitle(i) : ae.GetExtMsgTitle(i);

	if (isInt) {
		cellSnd1.textContent = ae.GetIntMsgFrom(i);
		cellSnd1.className = (ae.GetIntMsgFrom(i).length === 24) ? "mono" : "";
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

	for (let i = 0; i < (page * 20) + 20; i++) {
		const tsInt = (numInt < maxInt) ? ae.GetIntMsgTime(numInt) : 0;
		const tsExt = (numExt < maxExt) ? ae.GetExtMsgTime(numExt) : 0;
		if (tsInt === 0 && tsExt === 0) break;

		if (tsInt !== 0 && (tsExt === 0 || tsInt > tsExt)) {
			if (i < (page * 20)) {
				numInt++;
				continue;
			}

			addMsg(true, numInt);
			numInt++;
		} else if (tsExt !== 0) {
			if (i < (page * 20)) {
				numExt++;
				continue;
			}

			addMsg(false, numExt);
			numExt++;
		}
	}
}

function clearMessages() {
	document.getElementById("tbl_inbox").innerHTML = "";
//	document.getElementById("tbl_sentm").innerHTML = "";
//	document.getElementById("tbl_notes").innerHTML = "";
//	document.getElementById("tbl_files").innerHTML = "";
}

function reloadInterface() {
	document.getElementById("div_begin").hidden = true;
	document.getElementById("div_main").style.display = "grid";
}

document.getElementById("btn_refresh").onclick = function() {
	const btn = this;
	btn.disabled = true;
	btn.blur();

	ae.Message_Browse(0, function(successBrowse) {
		if (successBrowse) {
			clearMessages();
			addMessages();
			btn.disabled = false;
		} else {
			console.log("Failed to refresh");
			btn.disabled = false;
		}
	});
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
					document.getElementById("btn_refresh").click();
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
