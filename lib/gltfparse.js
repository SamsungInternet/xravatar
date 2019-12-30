import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { defaultValues } from './schema.js';
import {
    Group
} from '../node_modules/three/build/three.module.js';
const loader = new GLTFLoader();

const initPromise = (async function init() {
    const {scene: gltfScene} = await new Promise(resolve => loader.load('assets/bits.glb', resolve));
    const uiData = {};
    const xravatarRoot = new Group();

    gltfScene.traverse(o => {
        if (o.parent === null) return;

        // Inherit data from parent (or the default values)
        const dataToInherit = o.parent === gltfScene ? defaultValues : o.parent.userData;
        for ( const key of Object.keys(defaultValues)) {
          o.userData[key] = (o.userData[key] === undefined ? dataToInherit[key] : o.userData[key]);
        }

        if (!o.geometry) {
            // If it has no geometry it's a category
            uiData[o.name] = {
                name: o.name,
                userData: o.userData,
                model: o,
                parent: o.parent === gltfScene ? undefined : o.parent,
                children: {},
            }
        } else {
            // If it has data add it to category;
            uiData[o.parent.name].children[o.name] = ({
                name: o.name,
                model: o,
                userData: o.userData
            });
        }
    });

    return {
        gltf: gltfScene,
        uiData,
        xravatarRoot
    }
}());

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
    getXRAvatarRoot
}