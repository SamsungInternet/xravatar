import {
    CanvasTexture
} from '../node_modules/three/build/three.module.js';

const c = document.createElement('canvas');
const texture = new CanvasTexture(c);
c.style.width = c.style.height = 'auto';
c.style.transform = 'scale(4) translate(50%,50%)';
// document.body.appendChild(c);
const ctx = c.getContext("2d")

const palettes = [];
const singlePaletteSize = 16;
let sideLength = 0;

function coordinate(index) {
    const sideCapacity = sideLength / singlePaletteSize;
    return [
        (index % sideCapacity) * singlePaletteSize,
        Math.floor(index / sideCapacity) * singlePaletteSize
    ]
}

const buffer = new Uint8ClampedArray(256 * 4);
function draw(ctx, palette, offsetX, offsetY) {
    for (let i=0; i<256;i++) {
        const x=i%singlePaletteSize;
        const y=Math.floor(i/singlePaletteSize);
        const index=x;
        const brightnessshift = 2.0*y/16;
        buffer[i*4 + 0] = palette[index*3 + 0] * brightnessshift;
        buffer[i*4 + 1] = palette[index*3 + 1] * brightnessshift;
        buffer[i*4 + 2] = palette[index*3 + 2] * brightnessshift;
        buffer[i*4 + 3] = 255;
    }
    const id = new ImageData(buffer, singlePaletteSize, singlePaletteSize);
    ctx.putImageData(id,offsetX,offsetY);
}

async function updatePaletteCanvas(uniforms, p, redraw  = false) {
    if (palettes.indexOf(p) === -1) {
        palettes.push(p);
        redraw = true;
    }
    const n = palettes.length;
    const newSideLength = Math.ceil(Math.sqrt(n)) * singlePaletteSize;
    if (newSideLength > sideLength) {
        sideLength = newSideLength;
        redraw = true;
    }
    if (redraw) {
        c.width = c.height = sideLength;
        palettes.forEach((palette, i) => {
            const [x,y] = coordinate(i);
            draw(ctx, palette, x, y);
            if (uniforms.xravatar_offsetx) {
                uniforms.xravatar_offsetx.value = x;
                uniforms.xravatar_offsety.value = y;
                uniforms.xravatar_palettetexelsize.value = 1/sideLength;
            }
            texture.needsUpdate = true;
        });
    } else {
        const i = palettes.indexOf(p);
        const palette = palettes[i];
        const [x,y] = coordinate(i);
        draw(ctx, palette, x, y);
        if (uniforms.xravatar_offsetx) {
            uniforms.xravatar_offsetx.value = x;
            uniforms.xravatar_offsety.value = y;
            uniforms.xravatar_palettetexelsize.value = 1/sideLength;
        }
        texture.needsUpdate = true;
    }
}

export {
    updatePaletteCanvas,
    texture
}