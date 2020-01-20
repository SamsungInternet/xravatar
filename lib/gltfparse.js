import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { defaultValues } from './schema.js';
import common from './glsl/common.glsl.js';
import mapFragment from './glsl/map_fragment.glsl.js';
import {
    Group,
    NearestFilter,
    CanvasTexture
} from '../node_modules/three/build/three.module.js';
const loader = new GLTFLoader();

const c = document.createElement('canvas');
const canvasTexture = new CanvasTexture(c);
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

const initPromise = (async function init() {
    const {scene: gltfScene} = await new Promise(resolve => loader.load('assets/bits.glb', resolve));
    const uiData = {};
    const categoriesInTraverseOrder = [];
    const toBeRemoved = [];
    let material;

    gltfScene.children[0].traverse(o => {
        if (o.type === 'Group') return;

        // Inherit data from parent (or the default values)
        const dataToInherit = o.parent === gltfScene ? defaultValues : o.parent.userData;
        for ( const key of Object.keys(defaultValues)) {
          o.userData[key] = (o.userData[key] === undefined ? dataToInherit[key] : o.userData[key]);
        }

        if (!material && o.material) {
            material = o.material;
        }
        if (o.material) {
            o.material = material;
        }

        if (!o.geometry) {
            const parent = o.parent === gltfScene ? undefined : o.parent;
            const target = new Group();
            o.add(target);

            // If it has no geometry it's a category
            categoriesInTraverseOrder.push(o.name);
            uiData[o.name] = {
                name: o.name,
                userData: o.userData,
                model: o,
                parent,
                children: {},
                target
            }
        } else {

            o.castShadow = true;
            toBeRemoved.push(o);

            // If it has data add it to category;
            const data = uiData[o.parent.name].children[o.name] = ({
                name: o.name,
                model: o,
                userData: o.userData,
                morphTargets: o.morphTargetDictionary && Object.keys(o.morphTargetDictionary)
            });
            if (data.userData.xravatar_canMove) {
                
                const radius = o.position.length();
                data.startPosition = {
                    radius,
                    phi: Math.atan2(o.position.z, o.position.x),
                    theta: Math.acos(o.position.y / radius)
                }
                o.position.x = 0;
                o.position.y = 0;
                o.position.z = 0;
            }
        }
    });

    /* Tweak the material to enable the map to behave as a HSL indexed colour map rather than as an rgb map */
    const oldOnBeforeCompile = material.onBeforeCompile;
    let uniforms = {};
    material.onBeforeCompile = function (shader) {
        oldOnBeforeCompile();
        uniforms = shader.uniforms;
        shader.uniforms.xravatar_palette = {
            value: canvasTexture
        };
        shader.uniforms.xravatar_offsetx = {
            value: 0
        };
        shader.uniforms.xravatar_offsety = {
            value: 0
        };
        shader.uniforms.xravatar_palettetexelsize = {
            value: 1/16
        };
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapFragment)
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', common);
    };
    material.map.minFilter = material.map.magFilter = NearestFilter;
    material.morphTargets = true;

    toBeRemoved.forEach(o => o.parent.remove(o));

    const xravatarRoot = new Group();
    xravatarRoot.name = "xravatarRoot";
    xravatarRoot.add(gltfScene.children[0]);

    return {
        gltf: gltfScene,
        uiData,
        xravatarRoot,
        categoriesInTraverseOrder,
        uniforms
    }
}());


async function updatePaletteCanvas(p, redraw  = false) {
    const {uniforms} = await initPromise;
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
            canvasTexture.needsUpdate = true;
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
        canvasTexture.needsUpdate = true;
    }
}

async function getCategoriesInTraverseOrder() {
    const {categoriesInTraverseOrder} = await initPromise;
    return categoriesInTraverseOrder;
}

async function getXRAvatarRoot() {
    const {xravatarRoot} = await initPromise;
    return xravatarRoot;
}

async function getGLTF() {
    const {gltf} = await initPromise;
    return gltf;
}

/*
    Returns a flat structure of categories and the different options for them.
*/
async function getUIData() {
 const {uiData} = await initPromise;
 return uiData;
}

export {
    getGLTF,
    getUIData,
    getXRAvatarRoot,
    getCategoriesInTraverseOrder,
    updatePaletteCanvas
}