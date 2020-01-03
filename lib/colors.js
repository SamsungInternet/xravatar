function hslVec3ToHex(vec3) {
    const h = vec3.x;
    const s = vec3.y;
    const l = vec3.z;
    return hslToHex(h, s, l);
}

// https://stackoverflow.com/questions/36721830/convert-hsl-to-rgb-and-hex
function hslToHex(h, s, l) {
    h /= 360;
    s;
    l;
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// https://stackoverflow.com/a/39147465
function hexToHslVec3(hex, vec3) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    // see https://en.wikipedia.org/wiki/HSL_and_HSV#Formal_derivation
    // convert r,g,b [0,255] range to [0,1]
    r = r / 255,
    g = g / 255,
    b = b / 255;
    // get the min and max of r,g,b
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    // lightness is the average of the largest and smallest color components
    let lum = (max + min) / 2;
    let hue;
    let sat;
    if (max == min) { // no saturation
        hue = 0;
        sat = 0;
    } else {
        var c = max - min; // chroma
        // saturation is simply the chroma scaled to fill
        // the interval [0, 1] for every combination of hue and lightness
        sat = c / (1 - Math.abs(2 * lum - 1));
        switch(max) {
            case r:
              var segment = (g - b) / c;
              var shift   = 0 / 60;       // R° / (360° / hex sides)
              if (segment < 0) {          // hue > 180, full rotation
                shift = 360 / 60;         // R° / (360° / hex sides)
              }
              hue = segment + shift;
              break;
            case g:
              var segment = (b - r) / c;
              var shift   = 120 / 60;     // G° / (360° / hex sides)
              hue = segment + shift;
              break;
            case b:
              var segment = (r - g) / c;
              var shift   = 240 / 60;     // B° / (360° / hex sides)
              hue = segment + shift;
              break;
        }
    }
    hue = Math.round(hue * 60); // °
    sat = Math.round(sat * 100); // %
    lum = Math.round(lum * 100); // %

    vec3.setX(hue);
    vec3.setY(sat/100);
    vec3.setZ(lum/100);
}

export {
    hslToHex,
    hslVec3ToHex,
    hexToHslVec3
}