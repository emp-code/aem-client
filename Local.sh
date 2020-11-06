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
readonly url_sodium="https://cdn.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.8/dist/browsers/sodium.js"

readonly js_brotli=$(if hash 2>/dev/null curl; then curl --fail --silent --user-agent '' "$url_brotli"; else wget -4 -q -U '' -O - "$url_brotli"; fi)
readonly js_sodium=$(if hash 2>/dev/null curl; then curl --fail --silent --user-agent '' "$url_sodium"; else wget -4 -q -U '' -O - "$url_sodium"; fi)
readonly js_aem_js=$(cat all-ears.js)
readonly js_modern=$(cat modern/main.js)
readonly css_modern=$(cat modern/main.css)

if [ ! "$js_brotli" ] || [ ! "$js_sodium" ]; then
	echo "Failed fetching Brotli and/or Sodium libraries"
	exit
fi

if [ ! "$js_aem_js" ] || [ ! "$js_modern" ] || [ ! "$css_modern" ]; then exit; fi

readonly hash_js_brotli="D02d+8Zt5n4/7mnD+GctnXcW7NBcKHdgDsl3msmWdkOG3094pdP0ceN/4c/zChml"
readonly hash_js_sodium="UQ7f7udPxA0m0PWF3VEnZYGh4Tga11PPkrMLwO/A544LXaznLhy0l3yo+bU1kJjF"
readonly hash_js_aem_js=$(echo -n "$js_aem_js" | openssl dgst -sha384 -binary | openssl base64 -A)
readonly hash_js_modern=$(echo -n "$js_modern" | openssl dgst -sha384 -binary | openssl base64 -A)
readonly hash_css_modern=$(echo -n "$css_modern" | openssl dgst -sha384 -binary | openssl base64 -A)

if [ $(echo -n "$js_brotli" | openssl dgst -sha384 -binary | openssl base64 -A) != "$hash_js_brotli" ]; then echo "Brotli hash mismatch"; exit; fi
if [ $(echo    "$js_sodium" | openssl dgst -sha384 -binary | openssl base64 -A) != "$hash_js_sodium" ]; then echo "Sodium hash mismatch"; exit; fi

readonly LineCss=$(grep -F 'main.css' -n -m 1 modern/index.html | sed 's/:.*//')
readonly LineJsFirst=$(grep -F '<script' -n -m 1 modern/index.html | sed 's/:.*//')
readonly LineJsLast=$(grep -F '<script' -n modern/index.html | tail -n 1 | sed 's/:.*//')

readonly html=\
$(head -n $(expr $LineCss - 1) modern/index.html)\
$(echo -en '\n\t\t<meta charset="utf-8">')\
$(echo -en '\n\t\t<meta name="referrer" content="no-referrer">')\
$(echo -en '\n\t\t<meta http-equiv="Content-Security-Policy" content="')\
$(echo -n 'connect-src https://'$apidom':302/api data:;')\
$(echo -n " script-src 'unsafe-eval' 'sha384-$hash_js_brotli' 'sha384-$hash_js_sodium' 'sha384-$hash_js_aem_js' 'sha384-$hash_js_modern'; style-src 'sha384-$hash_css_modern';")\
$(echo -n " base-uri 'none'; child-src 'none'; default-src 'none'; font-src 'none'; form-action 'none'; frame-src blob:; img-src blob: data:; manifest-src 'none'; media-src blob:; object-src blob:; prefetch-src 'none'; worker-src 'none'; plugin-types application/pdf;\">")\
$(echo -en '\n\t\t<style>')$(echo -n "$css_modern")$(echo -en '</style>\n ')\
$(tail -n +$(expr $LineCss + 2) modern/index.html | head -n $(expr $LineJsFirst - $LineCss - 2))\
$(echo -en '\n\t\t<script>')$(echo -n "$js_brotli")$(echo -en '</script>')\
$(echo -en '\n\t\t<script>')$(echo -n "$js_sodium")$(echo -en '\n</script>')\
$(echo -en '\n\t\t<script>')$(cat all-ears.js)$(echo -en '</script>')\
$(echo -en '\n\t\t<script>')$(cat modern/main.js)$(echo -en '</script>\n ')\
$(tail -n +$(expr $LineJsLast + 1) modern/index.html)\

echo "$html" | sed \
-e "s~<title>All-Ears Mail</title>~<title>$title</title>~" \
-e "s~<h1>All-Ears Mail</h1>~<h1>$title</h1>~" \
-e "s~<p id=\"greeting\">Private email</p>~<p id=\"greeting\">$subtitle</p>~" \
-e "s~All-Ears Mail API PublicKey placeholder, replaced automatically.~$apiPubkey~" \
-e "s~All-Ears Mail Sig PublicKey placeholder, replaced automatically.~$sigPubkey~" \
-e "s~AEM Normal Addr Salt placeholder~$saltNormal~" \
-e "s~aeapidom=\"\"~aeapidom=\"$apidom\"~" \
-e "s~AEM placeholder for email domain~$emldom~" \
> "$outname"

chmod 1400 "$outname"
echo "Saved to $outname"
