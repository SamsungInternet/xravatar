import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { defaultValues } from './schema.js';
import common from './glsl/common.glsl.js';
import mapFragment from './glsl/map_fragment.glsl.js';
import {
    Group,
    Vector3
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
    
    const palette = {
        value: shuffle([
            new Vector3(0,1,0.5),
            new Vector3(10,1,0.5),
            new Vector3(45,1,0.5),
            new Vector3(55,1,0.5),
            new Vector3(90,1,0.5),
            new Vector3(100,1,0.5),
            new Vector3(135,1,0.5),
            new Vector3(145,1,0.5),
            new Vector3(180,1,0.5),
            new Vector3(190,1,0.5),
            new Vector3(225,1,0.5),
            new Vector3(235,1,0.5),
            new Vector3(270,1,0.5),
            new Vector3(280,1,0.5),
            new Vector3(315,1,0.5),
            new Vector3(325,1,0.5)
        ])
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
        console.log({uniforms: shader.uniforms});
        shader.uniforms.xravatar_palette = palette;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapFragment(shader))
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', common(shader));
    };

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