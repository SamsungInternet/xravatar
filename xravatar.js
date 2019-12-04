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
    this.apiURL = url;
    this.iframe = null;
    this.comlink = null;
  }

  async getComlink () {
    return this.comlink || await (async () => {
      const comlinkIframe = this.iframe = document.createElement('iframe');
      // comlinkIframe.setAttribute('sandbox', "allow-scripts");
      comlinkIframe.src = this.apiURL;
      comlinkIframe.setAttribute('style',"position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid var(--blue);")
      comlinkIframe.style.visibility = 'hidden';
      document.body.appendChild(comlinkIframe);
      this.comlink = await new Promise((resolve, reject) => {
        comlinkIframe.onload = async function iframeLoaded() {
          const api = Comlink.wrap(Comlink.windowEndpoint(comlinkIframe.contentWindow));
          resolve(api);
        }
        comlinkIframe.onerror = function iframeError(e) {
          reject(Error('Iframe failed to load: ' + e.message));
        }
      });
      return this.comlink;
    })()
  }

  async canLoad () {
    const api = await this.getComlink();
    console.log(await api.testVal);
    const hasAvatar = await api.hasAvatar();
    console.log({hasAvatar});
    const hasPermission = await api.hasPermission();
    console.log({hasPermission});

    // Everything is all good go ahead and get the avatar
    if (hasAvatar && hasPermission) return {result: true};
    
    // Something went wrong either no avatar or no permission
    // Show the iframe
    this.iframe.style.visibility = '';

    try {
      await api.getPermission();
      console.log('Permission Granted!!');
      this.iframe.style.visibility = 'hidden';
      return {result: true};
    } catch (e) {
      this.iframe.style.visibility = 'hidden';
      return {
        result: false,
        message: e.message
      };
    }

  }

  async getAvatarAsJSON () {
    const api = await this.getComlink();
    return api.getAvatarAsJSON();
  }

  destroy () {
    this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    this.comlink = null;
  }
}

export {
  AvatarLoader
}