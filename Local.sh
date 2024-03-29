#!/bin/bash

echo 'Local.sh: Generate a standalone All-Ears Mail HTML client'

if ! hash 2>/dev/null curl && ! hash 2>/dev/null wget; then echo "Need curl or wget"; exit; fi
if ! hash openssl; then exit; fi

echo 'Enter API domain'
read -r apidom
if [ ! "$apidom" ]; then exit; fi

echo 'Enter email domain'
read -r emldom
if [ ! "$emldom" ]; then exit; fi

echo 'Enter the API public key (64 hex characters)'
read -r apiPubkey
if [ $(echo -n "$apiPubkey" | wc -c) -ne $(echo -n "$apiPubkey" | tr -d -c '[:xdigit:]' | wc -c) ] || [ $(echo -n "$apiPubkey" | wc -c) -ne 64 ]; then exit; fi

echo 'Enter the signature public key (64 hex characters)'
read -r sigPubkey
if [ $(echo -n "$sigPubkey" | wc -c) -ne $(echo -n "$sigPubkey" | tr -d -c '[:xdigit:]' | wc -c) ] || [ $(echo -n "$sigPubkey" | wc -c) -ne 64 ]; then exit; fi

echo 'Enter the normal address salt (32 hex characters)'
read -r saltNormal
if [ $(echo -n "$saltNormal" | wc -c) -ne $(echo -n "$saltNormal" | tr -d -c '[:xdigit:]' | wc -c) ] || [ $(echo -n "$saltNormal" | wc -c) -ne 32 ]; then exit; fi

echo "Enter page title"
read -r title
if [ ! "$title" ]; then exit; fi

echo 'Enter page subtitle (greeting)'
read -r subtitle
if [ ! "$subtitle" ]; then exit; fi

echo 'Enter filename'
read -r outname
if [ ! "$outname" ]; then exit; fi
if [ -f "$outname" ]; then echo "File exists"; exit; fi

readonly url_brotli="https://cdn.jsdelivr.net/gh/google/brotli@1.0.7/js/decode.min.js"
readonly url_sodium="https://cdn.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.10/dist/browsers/sodium.js"
readonly url_pvault="https://cdn.jsdelivr.net/gh/emp-code/PostVault@bfbad3ed7942e9c391346f12197a8ef088a2e3be/Client/PostVault.js"

readonly js_brotli=$(if hash 2>/dev/null curl; then curl --fail --silent --user-agent '' "$url_brotli"; else wget -4 -q -U '' -O - "$url_brotli"; fi)
readonly js_sodium=$(if hash 2>/dev/null curl; then curl --fail --silent --user-agent '' "$url_sodium"; else wget -4 -q -U '' -O - "$url_sodium"; fi)
readonly js_pvault=$(if hash 2>/dev/null curl; then curl --fail --silent --user-agent '' "$url_pvault"; else wget -4 -q -U '' -O - "$url_pvault"; fi)
readonly js_aem_js=$(cat all-ears.js)
readonly js_modern=$(cat modern/main.js)
readonly css_modern=$(cat modern/main.css)

if [ ! "$js_brotli" ] || [ ! "$js_sodium" ] || [ ! "$js_pvault" ]; then
	echo "Failed fetching JS libraries"
	exit
fi

if [ ! "$js_aem_js" ] || [ ! "$js_modern" ] || [ ! "$css_modern" ]; then exit; fi

readonly hash_js_brotli="D02d+8Zt5n4/7mnD+GctnXcW7NBcKHdgDsl3msmWdkOG3094pdP0ceN/4c/zChml"
readonly hash_js_sodium="GEJ3DUwTjXaoqVwjTaPCJN0gtk+mbUoJ7/QO/6IKrlO+P7QHrV9497Vy5q+JNp7j"
readonly hash_js_pvault="8SOIAsqDvlFNFwTTqqs3oZKyEqaThZ3bLsr+Uv4o+LBypJJvzmkmaq/v/py50wo+"
readonly hash_js_aem_js=$(echo -n "$js_aem_js" | openssl dgst -sha384 -binary | openssl base64 -A)
readonly hash_js_modern=$(echo -n "$js_modern" | openssl dgst -sha384 -binary | openssl base64 -A)

readonly favicon=$(grep -m 1 --no-filename --only-matching '<link.* rel="icon".*>' modern/index.html | sed 's~<link.* rel="icon".* href="data:image/[^,]*,~~' | sed 's~".*~~')
readonly hash_favicon=$(echo -n "$favicon" | openssl dgst -sha384 -binary | openssl base64 -A)

if [ $(echo -n "$js_brotli" | openssl dgst -sha384 -binary | openssl base64 -A) != "$hash_js_brotli" ]; then echo "Brotli hash mismatch"; exit; fi
if [ $(echo    "$js_sodium" | openssl dgst -sha384 -binary | openssl base64 -A) != "$hash_js_sodium" ]; then echo "Sodium hash mismatch"; exit; fi
if [ $(echo    "$js_pvault" | openssl dgst -sha384 -binary | openssl base64 -A) != "$hash_js_pvault" ]; then echo "PostVault hash mismatch"; exit; fi

readonly LineCss=$(grep -F 'main.css' -n -m 1 modern/index.html | sed 's/:.*//')
readonly LineJsFirst=$(grep -F '<script' -n -m 1 modern/index.html | sed 's/:.*//')
readonly LineJsLast=$(grep -F '<script' -n modern/index.html | tail -n 1 | sed 's/:.*//')

readonly apidom_sec=$(if [ $(echo "$apidom" | tail -c 7) != '.onion' ]; then echo "s"; fi)

readonly html=\
$(head -n $((LineCss - 1)) modern/index.html)\
$(echo -en '\n\t\t<meta charset="utf-8">')\
$(echo -en '\n\t\t<meta name="referrer" content="no-referrer">')\
$(echo -en '\n\t\t<meta http-equiv="content-security-policy" content="')\
$(echo -n "connect-src http$apidom_sec://$apidom:302/api data:; script-src 'unsafe-eval' 'sha384-$hash_js_brotli' 'sha384-$hash_js_sodium' 'sha384-$hash_js_pvault' 'sha384-$hash_js_aem_js' 'sha384-$hash_js_modern'; style-src 'unsafe-inline'; img-src 'sha384-$hash_favicon' blob:;")\
$(echo -n " frame-src blob:; media-src blob:; object-src blob:; base-uri 'none'; child-src 'none'; default-src 'none'; font-src 'none'; form-action 'none'; manifest-src 'none'; prefetch-src 'none'; worker-src 'none'; plugin-types application/pdf;\">")\
$(echo -en '\n\t\t<style>')$(echo -n "$css_modern")$(echo -en '</style>\n ')\
$(tail -n +$((LineCss + 2)) modern/index.html | head -n $((LineJsFirst - LineCss - 2)))\
$(echo -en '\n\t\t<script>')$(echo -n "$js_brotli")$(echo -en '</script>')\
$(echo -en '\n\t\t<script>')$(echo -n "$js_sodium")$(echo -en '\n</script>')\
$(echo -en '\n\t\t<script>')$(echo -n "$js_pvault")$(echo -en '\n</script>')\
$(echo -en '\n\t\t<script>')$(cat all-ears.js)$(echo -en '</script>')\
$(echo -en '\n\t\t<script>')$(cat modern/main.js)$(echo -en '</script>\n ')\
$(tail -n +$((LineJsLast + 1)) modern/index.html)\

echo "$html" | sed \
-e "s~<title>All-Ears Mail</title>~<title>$title</title>~" \
-e "s~<h1>All-Ears Mail</h1>~<h1>$title</h1>~" \
-e "s~<p id=\"greeting\">Private email</p>~<p id=\"greeting\">$subtitle</p>~" \
-e "s~All-Ears Mail API PublicKey placeholder, replaced automatically.~$apiPubkey~" \
-e "s~All-Ears Mail Sig PublicKey placeholder, replaced automatically.~$sigPubkey~" \
-e "s~AEM Normal Addr Salt placeholder~$saltNormal~" \
-e "s~AEM placeholder for email domain~$emldom~" \
-e "s~name=\"aem.domain.api\" content=\"\"~name=\"aem.domain.api\" content=\"$apidom\"~" \
> "$outname"

chmod 1400 "$outname"
echo "Saved to $outname"
