// global localforage
import '../node_modules/localforage/dist/localforage.min.js';

const avatarKey = 'xravatar-avatar';
const savedDomainsKey = 'xravatar-saved-domains'
const localStateKey = 'xravatar-local-state';

let stateCache;
async function getState() {
    const state = stateCache || new Map(Object.entries(await getAvatar() || {}));
    return state;
}

let localStateCache;
async function getLocalState() {
    if (localStateCache) return localStateCache;
    const localState = await window.localforage.getItem(localStateKey).catch(() => undefined);
    const state = new Map(Object.entries(localState || {}));
    return state;
}

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
    const avatarString = JSON.stringify(await getAvatar());
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
    storeAvatar,
    getLocalState,
    getState
}