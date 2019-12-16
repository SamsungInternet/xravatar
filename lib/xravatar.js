/*
  This is the starting point for loading the avatar

  1. Load iframe small, detect if we need to get avatar
  2. (If permission required) Show iframe to get permission
  3. Get the Avatar string
*/

// <!-- This is an iframe which treats api.html as if it were a 3rd party -->
// <!-- This is for testing the 3rd party client integration -->
// <iframe sandbox="allow-scripts" src="api.html" style="position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid var(--blue);"></iframe>

import * as Comlink from "comlink/dist/esm/comlink.mjs";
import { decompress } from "lzma";

const dialogStyle = "position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid #0A78FC; box-shadow: 10px 10px 10px 0em rgba(0,0,0,0.5);";

class XRAvatar {
  constructor (data) {
    this.data = data;
  }
}

class AvatarLoader {
  constructor ( url ) {
    this.apiURL = url;
    this.iframe = null;
    this.comlink = null;
  }
  
  static async decompress (array) {
    return new Promise(resolve => decompress(array, resolve));
  }

  async getComlink () {
    return this.comlink || await (async () => {
      const comlinkIframe = this.iframe = document.createElement('iframe');
      comlinkIframe.setAttribute('sandbox', "allow-scripts allow-same-origin");
      comlinkIframe.setAttribute('referrerpolicy', "strict-origin");
      comlinkIframe.src = this.apiURL;
      comlinkIframe.setAttribute('style',dialogStyle)
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

    if (await api.canDoLocalStorage()) {
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

    } else {
      // Oh dear the user agent is blocking third party storage
      //No worries we will just have to navigate there instead to get the avatar as a URL encoded string
      const locationBits = new URL(location.href);
      location.assign(this.apiURL + '?redirect=' + encodeURIComponent(locationBits.origin + locationBits.pathname));
      return {
        result: false,
        message: "Redirecting to get avatar"
      }
    }

  }

  async loadAvatarFromBase64(base64) {
    const string = atob(base64);
    const array = [...string].map(c => c.charCodeAt(0) - 128);
    const json = await AvatarLoader.decompress(array);
    return new XRAvatar(JSON.parse(json));
  }

  async getAvatarAsJSON () {
    const api = await this.getComlink();
    return new XRAvatar(await api.getAvatarAsJSON());
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