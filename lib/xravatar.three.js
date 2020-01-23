/* global THREE */

/*
This is the starting point for loading the avatar

THIS IS COMPILED, naked imports are okay.

1. Load iframe small, detect if we need to get avatar
2. (If permission required) Show iframe to get permission
3. Get the Avatar string
*/

// <!-- This is an iframe which treats api.html as if it were a 3rd party -->
// <!-- This is for testing the 3rd party client integration -->
// <iframe sandbox="allow-scripts" src="api.html" style="position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid var(--blue);"></iframe>

import {
  AvatarLoader
} from './xravatarLoader.js';
import common from './glsl/common.glsl.js';
import mapFragment from './glsl/map_fragment.glsl.js';
import { defaultValues } from './schema.js';
import {
  getCanvasTexture, updatePaletteCanvas
} from './canvasPaletteMap.js'

function sphericalPolarToCartesian(r, p, t) {
  return [
    r * Math.sin(t) * Math.cos(p),
    r * Math.cos(t),
    r * Math.sin(t) * Math.sin(p),
  ];
}

async function checkURL() {
  const xravatarSearchParam = new URLSearchParams(new URL(location.href).search).get('xravatar');
  if (xravatarSearchParam) {
    const avatar = await AvatarLoader.loadAvatarFromBase64(xravatarSearchParam.replace(/ /gi, '+'));
    return avatar;
  }
}

async function getAvatar(url) {
  const avatarLoader = new AvatarLoader(url);

  // Creates an iframe to get permission or to prompt the user to make an avatar 
  let test = await avatarLoader.attemptLoad();

  // removes the iframe
  avatarLoader.cleanUp();

  if (test.result === false) {
    throw Error(test.message);
  } else if (test.result === true) {

    // Uses the same iframe to load the avatar
    const avatar = await avatarLoader.getAvatarAsJSON();
    return avatar;
  }
}

const assemblerCache = new Map();
class Assembler {
  constructor(gltfPath) {

    // There is one Assembler per gltfPath
    if (assemblerCache.has(gltfPath)) {
      return assemblerCache.get(gltfPath);
    }
    const loader = new THREE.GLTFLoader();
    this.categoriesPromise = new Promise(resolve => loader.load(gltfPath, resolve))
      .then(function ({ scene: gltfScene }) {
        const categories = {};
        const toBeRemoved = [];
        let material;
        let morphMaterial;

        gltfScene.children[0].traverse(o => {
          if (o.type === 'Group') return;

          // Inherit data from parent (or the default values)
          const dataToInherit = o.parent === gltfScene ? defaultValues : o.parent.userData;
          for (const key of Object.keys(defaultValues)) {
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
            if (!o.morphTargetDictionary) o.material = material;
            else o.material = morphMaterial;
          }

          if (!o.geometry) {
            const parent = o.parent === gltfScene ? undefined : o.parent;
            const target = new THREE.Group();
            o.add(target);

            // If it has no geometry it's a category
            categories[o.name] = {
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
            const data = categories[o.parent.name].children[o.name] = ({
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
        let uniforms = {
            xravatar_palette: {
                value: getCanvasTexture(THREE.CanvasTexture)
            },
            xravatar_offsetx: {
                value: 0
            },
            xravatar_offsety: {
                value: 0
            },
            xravatar_palettetexelsize: {
                value: 1/16
            }
        };
        morphMaterial.onBeforeCompile = material.onBeforeCompile = function (shader) {
            oldOnBeforeCompile();
            Object.assign(shader.uniforms, uniforms);
            Object.assign(uniforms, shader.uniforms);
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapFragment)
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', common);
        };
        material.map.minFilter = material.map.magFilter = THREE.NearestFilter;

        toBeRemoved.forEach(o => o.parent.remove(o));
        // sort the gltf into it's bits
        return {
          xravatar_root: gltfScene.children[0],
          categories,
          uniforms
        };
      });
  }

  async assemble(state) {
    const gltfParsed = await this.categoriesPromise;
    const categories = gltfParsed.categories;
    const xravatar_root = gltfParsed.xravatar_root;
    const categoryNames = Object.keys(categories);
    const uniforms = gltfParsed.uniforms;

    updatePaletteCanvas(uniforms, state.palette);

    for (const categoryName of categoryNames) {
      const item = state[categoryName];
      const category = categories[categoryName];
      const parent = category.target;
      parent.children.splice(0);
      if (!item) continue;
      if (item.children) {
        item.children
          .forEach(item => {
            const model = addItem(categories, parent, categoryName, item);
            applySettings(model, item.settings);
            applyMorph(model, item.settings);

            if (item.settings.xravatar_mirror) {
              const mirrorItem = {};
              Object.assign(mirrorItem, item);
              mirrorItem.settings = {};
              Object.assign(mirrorItem.settings, item.settings);
              mirrorItem.settings.xravatar_flip = !mirrorItem.settings.xravatar_flip;

              const model2 = addItem(categories, parent, categoryName, mirrorItem);
              applySettings(model2, mirrorItem.settings);
              applyMorph(model2, mirrorItem.settings);
            }
          });
      } else if (item.settings.xravatar_mirror) {
        parent.parent.matrix.identity();

        const mirrorItem = {};
        Object.assign(mirrorItem, item);
        mirrorItem.settings = {};
        Object.assign(mirrorItem.settings, item.settings);
        mirrorItem.settings.xravatar_flip = !mirrorItem.settings.xravatar_flip;

        const model = addItem(categories, parent, categoryName, item);
        applySettings(model, item.settings);
        applyMorph(model, item.settings);

        const model2 = addItem(categories, parent, categoryName, mirrorItem);
        applySettings(model2, mirrorItem.settings);
        applyMorph(model2, mirrorItem.settings);

      } else {
        const model = addItem(categories, parent, categoryName, item);
        applySettings(parent.parent, item.settings);
        applyMorph(model, item.settings);
      }
    }
    return xravatar_root.clone(true);
  }
}


const currentlyUsedObjects = new Map();
function addItem(categories, parent, categoryName, item) {
  const cache = currentlyUsedObjects;
  let modelToAdd = cache.get(item);
  const category = categories[categoryName];

  // Fail gracefully on unmatched things from the state
  if (!category) {
    console.warn(`"${categoryName}", from state, not found in GLTF file.`);
    return
  }

  if (!modelToAdd) {
    const child = category.children[item.name];
    if (!child) {
      console.warn(`Child "${item.name}" of ${categoryName}", from state, not found in GLTF file.`);
      return
    }
    modelToAdd = child.model.clone();
    cache.set(item, modelToAdd);
  }
  parent.add(modelToAdd);

  return modelToAdd;
}

function applyMorph(model, settings) {
  // Apply morph targets
  Object.keys(settings)
    .filter(key => key.indexOf('xravatar_morph_') === 0)
    .forEach(key => {
      const morphName = key.slice(15);
      const index = model.morphTargetDictionary[morphName];
      model.morphTargetInfluences[index] = settings[key];
    });
}

let tempMatrix;
function applySettings(model, settings) {
  tempMatrix = tempMatrix || new THREE.Matrix4();
  model.matrixAutoUpdate = false;
  model.matrix.identity();
  const scale = settings.xravatar_scale || 1.0;
  if (settings.xravatar_flip) {
    model.matrix.multiply(tempMatrix.makeScale(
      1.0,
      1.0,
      -1.0
    ));
  }
  const oldPosition = model.oldPosition || (model.oldPosition = model.position.clone());
  if (settings.xravatar_positionRadius) {
    model.matrix.multiply(tempMatrix.makeTranslation(
      ...sphericalPolarToCartesian(
        settings.xravatar_positionRadius,
        settings.xravatar_positionPhi,
        settings.xravatar_positionTheta
      )
    ));
  } else {
    model.matrix.multiply(tempMatrix.makeTranslation(
      oldPosition.x, oldPosition.y, oldPosition.z
    ));
  }
  model.matrix.multiply(tempMatrix.makeScale(
    scale,
    scale,
    scale
  ));
}

export {
  AvatarLoader,
  checkURL,
  getAvatar,
  Assembler
}