#!/bin/bash

echo 'Local.sh: Generate a standalone All-Ears Mail HTML client'

echo 'Enter API domain'
read apidom

echo 'Enter email domain'
read emldom

echo 'Enter the API public key (64 hex characters)'
read apiPubkey

echo 'Enter the signature public key (64 hex characters)'
read sigPubkey

echo 'Enter the normal address salt (32 hex characters)'
read saltNormal

echo "Enter page title"
read title

echo 'Enter page subtitle (greeting)'
read subtitle

echo 'Enter filename'
read outname

js_brotli=$(curl --fail --silent --user-agent '' 'https://cdn.jsdelivr.net/gh/google/brotli@1.0.7/js/decode.min.js')
js_sodium=$(curl --fail --silent --user-agent '' 'https://cdn.jsdelivr.net/gh/jedisct1/libsodium.js@0.7.8/dist/browsers/sodium.js')
js_aem_js=$(cat all-ears.js)
js_modern=$(cat modern/main.js)
css_modern=$(cat modern/main.css)

if [ ! "$js_brotli" ] || [ ! "$js_sodium" ]; then
	echo "Failed fetching Brotli and/or Sodium libraries"
	exit
fi

hash_js_brotli="D02d+8Zt5n4/7mnD+GctnXcW7NBcKHdgDsl3msmWdkOG3094pdP0ceN/4c/zChml"
hash_js_sodium="UQ7f7udPxA0m0PWF3VEnZYGh4Tga11PPkrMLwO/A544LXaznLhy0l3yo+bU1kJjF"
hash_js_aem_js=$(echo -n "$js_aem_js" | openssl dgst -sha384 -binary | openssl base64 -A)
hash_js_modern=$(echo -n "$js_modern" | openssl dgst -sha384 -binary | openssl base64 -A)
hash_css_modern=$(echo -n "$css_modern" | openssl dgst -sha384 -binary | openssl base64 -A)

LineCss=$(cat modern/index.html | grep -F 'main.css' -n -m 1 | sed 's/:.*//')
LineJsFirst=$(cat modern/index.html | grep -F '<script' -n -m 1 | sed 's/:.*//')
LineJsLast=$(cat modern/index.html | grep -F '<script' -n | tail -n 1 | sed 's/:.*//')

html=\
$(cat modern/index.html | head -n $(expr $LineCss - 1))\
$(echo -en '\n\t\t<meta charset="utf-8">')\
$(echo -en '\n\t\t<meta name="referrer" content="no-referrer">')\
$(echo -en '\n\t\t<meta http-equiv="Content-Security-Policy" content="')\
$(echo -n 'connect-src https://'$apidom':302/api data:;')\
$(echo -n " script-src 'unsafe-eval' 'sha384-$hash_js_brotli' 'sha384-$hash_js_sodium' 'sha384-$hash_js_aem_js' 'sha384-$hash_js_modern'; style-src 'sha384-$hash_css_modern';")\
$(echo -n " base-uri 'none'; child-src 'none'; default-src 'none'; font-src 'none'; form-action 'none'; frame-src blob:; img-src blob: data:; manifest-src 'none'; media-src blob:; object-src blob:; prefetch-src 'none'; worker-src 'none'; plugin-types application/pdf;\">")\
$(echo -en '\n\t\t<style>')$(echo -n "$css_modern")$(echo -en '</style>\n ')\
$(cat modern/index.html | tail -n +$(expr $LineCss + 2) | head -n $(expr $LineJsFirst - $LineCss - 2))\
$(echo -en '\n\t\t<script>')$(echo -n "$js_brotli")$(echo -en '</script>')\
$(echo -en '\n\t\t<script>')$(echo -n "$js_sodium")$(echo -en '\n</script>')\
$(echo -en '\n\t\t<script>')$(cat all-ears.js)$(echo -en '</script>')\
$(echo -en '\n\t\t<script>')$(cat modern/main.js)$(echo -en '</script>\n ')\
$(cat modern/index.html | tail -n +$(expr $LineJsLast + 1))\

echo "$html" | sed \
-e "s~<title>All-Ears Mail</title>~<title>$title</title>~" \
-e "s~<h1>All-Ears Mail</h1>~<h1>$title</h1>~" \
-e "s~<p id=\"greeting\">Private email</p>~<p id=\"greeting\">$subtitle</p>~" \
-e "s~All-Ears Mail API PublicKey placeholder, replaced automatically.~$apiPubkey~" \
-e "s~All-Ears Mail Sig PublicKey placeholder, replaced automatically.~$sigPubkey~" \
-e "s~AEM Normal Addr Salt placeholder~$saltNormal~" \
-e "s~aeapidom=\"\"~aeapidom=\"$apidom\"~" \
-e "s~AEM placeholder for email domain~$emldom~" \
> $outname

echo "Saved to $outname"
