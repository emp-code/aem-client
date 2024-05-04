# All-Ears Mail - Clients #

## Status ##

[![CodeFactor](https://www.codefactor.io/repository/github/emp-code/aem-client/badge)](https://www.codefactor.io/repository/github/emp-code/aem-client)

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/47c25a7e9599408b97460648999c016e)](https://www.codacy.com/gh/emp-code/aem-client/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=emp-code/aem-client&amp;utm_campaign=Badge_Grade)

[![Scrutinizer Code Quality](https://scrutinizer-ci.com/g/emp-code/aem-client/badges/quality-score.png?b=master)](https://scrutinizer-ci.com/g/emp-code/aem-client/?branch=master)

[![Codiga](https://api.codiga.io/project/11148/score/svg)](https://app.codiga.io/public/project/11148/aem-client/dashboard)

## Web ##

The JavaScript library, *all-ears.js*, is made for web clients.

The `<meta>` tag aem.url.api specifies the URL of the All-Ears Mail API. If left blank, the library assumes the API operates at the current domain with the default port.

--

*Modern* and *Original* are web clients using the library, with the former being in more active development. As single-page web apps, each has three files: main.js, main.css, and index.html.

*Local.sh* can be used to create a single-file standalone web app that can be run locally.

*Keygen.html* is for new account creation.

## APIs ##

All APIs require an account, and use a custom binary format. Only a timestamp and the user's ID (0-4095) in the request is in plaintext. Everything else about requests is encrypted, and responses are entirely encrypted.

| Name             | Description      |
| ---------------- | ---------------- |
| `Account/Browse` | Get information about accounts. Admin only. |
| `Account/Create` | Create a new account. Admin only. |
| `Account/Delete` | Delete an account. Users may delete their own accounts, while admins can delete any account. Deletes all the user's data. |
| `Account/Update` | Set account level. Users may decrease their account level, while admins can set anyone's level to any value. |
| `Address/Create` | Register a new address. Normal addresses are hashed client-side. Shield addresses are generated by the server. |
| `Address/Delete` | Delete an address. Deleted addresses become immediately available for registration. |
| `Address/Update` | Set settings for the addresses. |
| `Message/Browse` | Get messages. Optionally, also gets information about the user's account and the service. |
| `Message/Create` | Send a message (either an internal message to another user on the platform, or an email). |
| `Message/Delete` | Delete a message. |
| `Message/Public` | Send a message to all users. Admin only. |
| `Message/Upload` | Upload a file (stored together with messages). Uses client-side encryption. |
| `Private/Update` | Update the user's private data field. Uses client-side encryption. |
| `Setting/Limits` | Set limits. Admin only. |
