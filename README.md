# All-Ears Mail - Clients #

## Status ##

[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/emp-code/aem-client.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/emp-code/aem-client/context:javascript)

[![Language grade: C/C++](https://img.shields.io/lgtm/grade/cpp/g/emp-code/aem-client.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/emp-code/aem-client/context:cpp)

[![CodeFactor](https://www.codefactor.io/repository/github/emp-code/aem-client/badge)](https://www.codefactor.io/repository/github/emp-code/aem-client)

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/4b18ae1da10d40759732e4c63644a6fd)](https://www.codacy.com/gh/emp-code/aem-client/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=emp-code/aem-client&amp;utm_campaign=Badge_Grade)

[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/emp-code/aem-client/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/emp-code/aem-client/?branch=master)

[![Code Inspector](https://www.code-inspector.com/project/11148/score/svg)](https://frontend.code-inspector.com/public/project/11148/aem-client/dashboard)

[![deepcode](https://www.deepcode.ai/api/gh/badge?key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF0Zm9ybTEiOiJnaCIsIm93bmVyMSI6ImVtcC1jb2RlIiwicmVwbzEiOiJhZW0tY2xpZW50IiwiaW5jbHVkZUxpbnQiOmZhbHNlLCJhdXRob3JJZCI6MjIxMjgsImlhdCI6MTYwNTQzMDUzN30.5tP-JY5i3U0PjiMdSYhf3CRqQBqmx8br55Q9sVYQ_98)](https://www.deepcode.ai/app/gh/emp-code/aem-client/_/dashboard?utm_content=gh%2Femp-code%2Faem-client)

## Web ##

The JavaScript library, *all-ears.js*, is made for web clients.

The library loads data from five `<meta>` tags:
* aem.domain.api (API domain; if blank, uses current domain)
* aem.domain.eml (Email domain; if blank, uses current domain)
* aem.pubkey.api (API public key, hex)
* aem.pubkey.sig (Signature public key, hex)
* aem.adrslt.nrm (Normal address salt, hex)

To use the library, create a new AllEars object:

```
const ae = new AllEars(function(ok) {
	if (ok) {
		// Success
	} else {
		// Failure
	}
});
```

Then, set the user's keys with the SetKeys() function:

```
ae.SetKeys(keyInHex, function(ok) {
	if (ok) {
		// Success
	} else {
		// Failure
	}
});
```

The APIs can now be used.

---

*Modern* and *Original* are web clients using the library, with the former being in more active development. As single-page web apps, each has three files: main.js, main.css, and index.html.

*Local.sh* can be used to create a single-file standalone web app that can be run locally.

## C Library ##

The C library, *all-ears.c*, is designed for security and privacy. It uses the onion service (requires Tor), and only sends the minimum required HTTP headers.

The library is designed to be simple to use, and similar to the JS library.

All functions return zero or positive on success, and negative on failure.

To use the library, first call the `allears_init()` function, which takes five parameters:
* the 56 characters of the .onion domain (`char [56]`)
* the server's public API key (`unsigned char [crypto_box_PUBLICKEYBYTES]`)
* the server's public signature key (`unsigned char [crypto_sign_PUBLICKEYBYTES]`)
* the normal-address salt (`crypto_pwhash_SALTBYTES`)
* the user's key (`unsigned char [crypto_kdf_KEYBYTES]`)

The APIs may now be used. The library keeps its own copies of all data.

To end, call the `allears_free()` function. To use the library again, simply call `allears_init()` again.

### Tester ###

Tester is a testing utility using the library. It checks the functionality of the server APIs.

## APIs ##

The APIs are numbered. The names are only for reference.

All APIs use a custom binary format. Both requests and responses are fully encrypted.

All APIs require a valid, registered account. Any other connections are dropped without response.

| Name             | Description      |
| ---------------- | ---------------- |
| `Account/Browse` | Get information about accounts. Admin only. |
| `Account/Create` | Create a new account. Admin only. |
| `Account/Delete` | Delete an account. Users may delete their own accounts, while admins can delete any account. Immediately **destroys all data.** |
| `Account/Update` | Set account level. Users may decrease their account level, while admins can set anyone's level to any value. |
| `Address/Create` | Register a new address. Normal addresses are hashed client-side. Shield addresses are generated by the server. |
| `Address/Delete` | Delete an address. Deleted addresses become **immediately available** for anyone to register. |
| `Address/Update` | Set settings for an address (accept/reject email, accept/reject internal messages). |
| `Message/Browse` | Get messages. Optionally, also gets information about the user's account. |
| `Message/Create` | Send a message (either an internal message to another user on the platform, or an email). |
| `Message/Delete` | Delete a message. |
| `Message/Public` | Send a message to all users. Admin only. |
| `Message/Upload` | Upload a file (stored together with messages). Uses client-side encryption. |
| `Private/Update` | Update the user's private data field. Uses client-side encryption. |
| `Setting/Limits` | Set limits. Admin only. |
