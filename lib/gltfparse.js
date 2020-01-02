import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { defaultValues } from './schema.js';
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

    material.onBeforeCompile = function (shader) {
        console.log({uniforms: shader.uniforms});

        shader.uniforms.xravatar_palette = palette;

        /*
        Tweak the map to use the map as an index rather than as an image

        Index = floor(r/16);
        Brightness = r%16;

        Use this to get the colour in HSL format from the array of 16 colours in the uniforms

        put into hsl2rgb to get final colour.
        */
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
            vec4 texelColor = texture2D( map, vUv );
            texelColor = mapTexelToLinear( texelColor );
            int index = int(16.0 * texelColor.r);
            float bshift = 0.5 * 16.0 * (mod(texelColor.r, 0.0625) - 0.03125);
            vec3 hsl;
            ${
                shader.uniforms.xravatar_palette.value.map((o,i) => `if ( ${i} <= index ) hsl = xravatar_palette[ ${i} ];`).join('\n')
            }
            vec3 rgb = hsl2rgb(hsl.x/360.0, hsl.y, hsl.z + bshift);
            diffuseColor *= vec4(rgb,1.0);
        #endif
        `)


        /* Include some helper functions, and our uniform after <common> */
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
        uniform vec3 xravatar_palette[16];

        #include <common>

        // From https://github.com/Jam3/glsl-hsl2rgb/blob/master/index.glsl
		// MIT License (MIT) Copyright (c) 2015 Jam3
		
		float hue2rgb(float f1, float f2, float hue) {
			if (hue < 0.0)
				hue += 1.0;
			else if (hue > 1.0)
				hue -= 1.0;
			float res;
			if ((6.0 * hue) < 1.0)
				res = f1 + (f2 - f1) * 6.0 * hue;
			else if ((2.0 * hue) < 1.0)
				res = f2;
			else if ((3.0 * hue) < 2.0)
				res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
			else
				res = f1;
			return res;
		}
		
		vec3 hsl2rgb(vec3 hsl) {
			vec3 rgb;
			
			if (hsl.y == 0.0) {
				rgb = vec3(hsl.z); // Luminance
			} else {
				float f2;
				
				if (hsl.z < 0.5)
					f2 = hsl.z * (1.0 + hsl.y);
				else
					f2 = hsl.z + hsl.y - hsl.y * hsl.z;
					
				float f1 = 2.0 * hsl.z - f2;
				
				rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
				rgb.g = hue2rgb(f1, f2, hsl.x);
				rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
			}   
			return rgb;
		}
		
		vec3 hsl2rgb(float h, float s, float l) {
			return hsl2rgb(vec3(h, s, l));
		}
        `);
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
        palette
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