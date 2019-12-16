import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";
import localforage from 'https://unpkg.com/localforage@1.7.3/src/localforage.js';
<script src="https://unpkg.com/lzma@2.2.1/src/lzma-c-min.js"></script>

const avatarKey = 'xravatar-avatar';
const savedDomainsKey = 'xravatar-saved-domains'
let canDoLocalStorage = true;

async function getAvatar() {
    return await localforage.getItem(avatarKey).catch(() => undefined);
}

async function canDoLocalStorage() {
    return localforage
    .getItem(avatarKey)
    .then(() => true)
    .catch(() => false);
}

async function getSavedDomains() {
    return (await (localforage.getItem(savedDomainsKey).catch(() => false))) || [];
}

async function getAvatarJSON() {
    return JSON.stringify(await getAvatar());
}

async function getAvatarCompressed() {
    const avatarString = await getAvatar();
    const compressed = await new Promise(resolve => window.LZMA.compress(avatarString, 6, resolve));
    const base64 = btoa(String.fromCharCode(...compressed.map(i => i + 128)));
}

export {
    getAvatar,
    getAvatarCompressed,
    getSavedDomains,
    canDoLocalStorage,
    getAvatarJSON
}