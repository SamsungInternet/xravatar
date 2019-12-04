/*
  This is the starting point for loading the avatar

  1. Load iframe small, detect if we need to get avatar
  2. (If permission required) Show iframe to get permission
  3. Get the Avatar string
*/

// <!-- This is an iframe which treats api.html as if it were a 3rd party -->
// <!-- This is for testing the 3rd party client integration -->
// <iframe sandbox="allow-scripts" src="api.html" style="position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid var(--blue);"></iframe>

import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";

class AvatarLoader {
  constructor ( url ) {
    this.url = url;
    this.iframe = null;
  }

  canLoad () {

  }

  getAvatarAsJSON () {

  }

  destroy () {
    this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
  }
}

export {
  AvatarLoader
}