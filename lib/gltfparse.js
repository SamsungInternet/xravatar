import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { defaultValues } from './schema.js';
import common from './glsl/common.glsl.js';
import mapFragment from './glsl/map_fragment.glsl.js';
import {
    Group,
    NearestFilter
} from '../node_modules/three/build/three.module.js';
import {
    getGLTFURL
} from './schema.js';
import {
    texture as canvasTexture
} from './canvasPaletteMap.js'
const loader = new GLTFLoader();

const initPromise = (async function init() {
    const {scene: gltfScene} = await new Promise(resolve => loader.load(getGLTFURL(), resolve));
    const uiData = {};
    const categoriesInTraverseOrder = [];
    const toBeRemoved = [];
    let material;
    let morphMaterial;

    gltfScene.children[0].traverse(o => {
        if (o.type === 'Group') return;

        // Inherit data from parent (or the default values)
        const dataToInherit = o.parent === gltfScene ? defaultValues : o.parent.userData;
        for ( const key of Object.keys(defaultValues)) {
          o.userData[key] = (o.userData[key] === undefined ? dataToInherit[key] : o.userData[key]);
        }

        if (!material && o.material && !o.morphTargetDictionary) {
            material = o.material;
        }
        if (!morphMaterial && o.material && o.morphTargetDictionary) {
            morphMaterial = o.material;
            morphMaterial.morphTargets = true;
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
    morphMaterial.onBeforeCompile = material.onBeforeCompile = function (shader) {
        oldOnBeforeCompile();
        Object.assign(uniforms, shader.uniforms);
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



async function getCategoriesInTraverseOrder() {
    const {categoriesInTraverseOrder} = await initPromise;
    return categoriesInTraverseOrder;
}

async function getUniforms() {
    const {uniforms} = await initPromise;
    return uniforms;
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
    getUniforms
}