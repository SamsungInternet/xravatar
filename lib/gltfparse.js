import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { defaultValues } from './schema.js';
import common from './glsl/common.glsl.js';
import mapFragment from './glsl/map_fragment.glsl.js';
import {
    Group,
    Vector3,
    NearestFilter
} from '../node_modules/three/build/three.module.js';
const loader = new GLTFLoader();

const initPromise = (async function init() {
    const {scene: gltfScene} = await new Promise(resolve => loader.load('assets/bits.glb', resolve));
    const uiData = {};
    const categoriesInTraverseOrder = [];
    const toBeRemoved = [];
    let material;

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    const palettePartA = [
        new Vector3(
          0.9725490196078431,
          0.6627450980392157,
          0.20392156862745098
        ),
        new Vector3(
          0.996078431372549,
          0.9725490196078431,
          0.8784313725490196
        ),
        new Vector3(
          0.14901960784313725,
          0.8509803921568627,
          0.8509803921568627
        ),
    ];
    const palette = {
        value: palettePartA.concat(shuffle([
            new Vector3(
              0.1607843137254902,
              0.5019607843137255,
              0
            ),
            new Vector3(
              0.21568627450980393,
              0.9411764705882353,
              0.9254901960784314
            ),
            new Vector3(
              0,
              0.5019607843137255,
              0.7529411764705882
            ),
            new Vector3(
              0.7607843137254902,
              0.7568627450980392,
              0.5294117647058824
            ),
            new Vector3(
              0.5019607843137255,
              0,
              0.5019607843137255
            ),
            new Vector3(
              0,
              1,
              1
            ),
            new Vector3(
              1,
              0.5019607843137255,
              0
            ),
            new Vector3(
              0,
              0.5019607843137255,
              1
            ),
            new Vector3(
              0.8196078431372549,
              0.8627450980392157,
              0.0392156862745098
            ),
            new Vector3(
              0.5019607843137255,
              0,
              0.5019607843137255
            ),
            new Vector3(
              0.7019607843137254,
              0.3333333333333333,
              0.6627450980392157
            ),
            new Vector3(
              0.48627450980392156,
              0.49411764705882355,
              0.20392156862745098
            ),
            new Vector3(
              0.5490196078431373,
              0.8352941176470589,
              0.16862745098039217
            ),
          ]))
    };

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
            uiData[o.parent.name].children[o.name] = ({
                name: o.name,
                model: o,
                userData: o.userData
            });
        }
    });

    /* Tweak the material to enable the map to behave as a HSL indexed colour map rather than as an rgb map */
    const oldOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = function (shader) {
        oldOnBeforeCompile();
        shader.uniforms.xravatar_palette = palette;
        console.log(palette);
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapFragment(shader))
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', common(shader));
    };

    material.map.minFilter = material.map.magFilter = NearestFilter;

    toBeRemoved.forEach(o => o.parent.remove(o));

    const xravatarRoot = new Group();
    xravatarRoot.name = "xravatarRoot";
    xravatarRoot.add(gltfScene.children[0]);

    return {
        gltf: gltfScene,
        uiData,
        xravatarRoot,
        categoriesInTraverseOrder,
        palette: palette.value
    }
}());

async function getPalette() {
    const {palette} =  await initPromise;
    return palette;
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
    getPalette
}