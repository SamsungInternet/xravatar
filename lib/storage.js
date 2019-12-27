// global localforage
import '../node_modules/localforage/dist/localforage.min.js';

const avatarKey = 'xravatar-avatar';
const savedDomainsKey = 'xravatar-saved-domains'

async function getAvatar() {
    return await window.localforage.getItem(avatarKey).catch(() => undefined);
}

async function storeAvatar(stateAsObject) {
    return await window.localforage.setItem(avatarKey, stateAsObject);
}

async function canDoLocalStorage() {
    return window.localforage
    .getItem(avatarKey)
    .then(() => true)
    .catch(() => false);
}

async function getSavedDomains() {
    return (await (window.localforage.getItem(savedDomainsKey).catch(() => false))) || [];
}

async function getAvatarJSON() {
    return JSON.stringify(await getAvatar());
}

async function getAvatarCompressed() {
    const avatarString = await getAvatar();
    const compressed = await new Promise(resolve => window.LZMA.compress(avatarString, 6, resolve));
    const base64 = btoa(String.fromCharCode(...compressed.map(i => i + 128)));
    return base64;
}

export {
    getAvatar,
    getAvatarCompressed,
    getSavedDomains,
    canDoLocalStorage,
    getAvatarJSON,
    storeAvatar
}