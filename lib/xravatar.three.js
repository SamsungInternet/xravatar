/*
  This is the starting point for loading the avatar

  THIS IS COMPILED, naked imports are okay.

  1. Load iframe small, detect if we need to get avatar
  2. (If permission required) Show iframe to get permission
  3. Get the Avatar string
*/

// <!-- This is an iframe which treats api.html as if it were a 3rd party -->
// <!-- This is for testing the 3rd party client integration -->
// <iframe sandbox="allow-scripts" src="api.html" style="position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid var(--blue);"></iframe>

import {
  AvatarLoader
} from './xravatarLoader.js';

async function checkURL() {
  const xravatarSearchParam = new URLSearchParams(new URL(location.href).search).get('xravatar');
  if (xravatarSearchParam) {
    const avatar = await AvatarLoader.loadAvatarFromBase64(xravatarSearchParam.replace(/ /gi,'+'));
    return avatar;
  }
}

async function getAvatar(url) {
  const avatarLoader = new AvatarLoader(url);

  // Creates an iframe to get permission or to prompt the user to make an avatar 
  let test = await avatarLoader.attemptLoad();

  // removes the iframe
  avatarLoader.cleanUp();

  if (test.result === false) {
      throw Error(test.message);
  } else if (test.result === true) {

      // Uses the same iframe to load the avatar
      const avatar = await avatarLoader.getAvatarAsJSON();
      return avatar;
  }
}

function avatarToThreeMesh(avatar) {
  console.log(avatar);
}

export {
  AvatarLoader,
  checkURL,
  getAvatar,
  avatarToThreeMesh
}