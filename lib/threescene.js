import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    AmbientLight,
    DirectionalLight,
    SphereGeometry,
    BackSide,
    Mesh,
    MeshBasicMaterial,
    Vector3,
    SpotLight,
    PCFSoftShadowMap,
    Matrix4
} from '../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { BasisTextureLoader } from "../node_modules/three/examples/jsm/loaders/BasisTextureLoader.js";

const loader = new GLTFLoader();
const basisLoader = new BasisTextureLoader();

function sphericalPolarToCartesian(r, p, t) {
    return [
        r * Math.sin(t) * Math.cos(p),
        r * Math.cos(t),
        r * Math.sin(t) * Math.sin(p),
    ];
}

function renderGL(canvas, xravatarRoot, uiData, stateEntries) {
    const renderer = new WebGLRenderer( { canvas: canvas, antialias: false } );
    renderer.shadowMap.enabled	= true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setPixelRatio( window.devicePixelRatio );
    basisLoader.setTranscoderPath( './node_modules/three/examples/js/libs/basis/' );
    basisLoader.detectSupport( renderer );
    
    const scene = new Scene();
    xravatarRoot.position.set(0, 0, 0);
    scene.add(xravatarRoot);
    
    const camera = new PerspectiveCamera();
    camera.position.set(2.5, 1.6, 0);
    camera.near = 0.1;
    camera.rotation.order = "YXZ";
    camera.rotation.y = Math.PI;

    /* load some external assets to make things look nice */
    (async function () {
        // From https://poly.google.com/view/biZ9tKZzlLy by Alex “SAFFY” Safayan
        // & https://poly.google.com/view/aFWefo0cEFo by Google
        const glbPromise = new Promise(resolve => loader.load('assets/bedroom.glb', resolve));
        const {scene: bedroom} = await glbPromise;
        bedroom.traverse(function (mesh) {
            mesh.receiveShadow = true;
        });

        const skygeometry = new SphereGeometry( 20, 50, 50 , 0, 2 * Math.PI);
        const skymaterial = new MeshBasicMaterial();
        skymaterial.side = BackSide;
        skymaterial.onBeforeCompile = function (shader) {
            shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n#define USE_UV');
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n#define USE_UV');
            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
                vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
            `)
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                vec4 col1;
                vec4 col2;
                float mixAmount;
                if (vUv.y > 0.5) {
                    col1 = vec4( 249, 229, 180, 1 ) / 255.0;
                    col2 = vec4( 0, 57, 115, 1 ) / 255.0;
                    float newY = (vUv.y - 0.5) * 2.0;
                    mixAmount = sqrt(newY)*2.0;
                } else {
                    col1 = vec4(0.6);
                }
                diffuseColor *= mix(col1, col2, mixAmount);
            `);
        };
        const skysphere = new Mesh( skygeometry, skymaterial );
        skysphere.rotation.y = Math.PI + 0.5;

        scene.add( skysphere );
        scene.add(bedroom);
    }()).catch(e => console.log(e));

    window.addEventListener( 'resize', onWindowResize, false );

    function onWindowResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( w, h );
    }

    onWindowResize();
    
    const light = new DirectionalLight(0x808040);
    light.position.set(-10, 10, 10);
    light.intensity = 0.7;
    scene.add(light);
    
    const light2 = new AmbientLight(0x404050 );
    light2.intensity = 0.7;
    scene.add(light2);

    const angle = Math.PI/7;
    const target = new Vector3(-1,0, -0.2);
	const spotLight	= new SpotLight()
    spotLight.position.set(1,3,0.5);
    spotLight.target.position.copy(target);
    spotLight.decay = 2;
	spotLight.angle	= angle;
	spotLight.penumbra = 0.3;
	spotLight.intensity	= 0.8;
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    spotLight.shadow.camera.near = 1;
    spotLight.shadow.camera.far = 20;
    scene.add( spotLight );
    scene.add( spotLight.target );

    renderer.setAnimationLoop(function () {
      renderer.render(scene, camera);
    });

    const currentlyUsedObjects = new Map();
    function addItem(parent, categoryName, item) {
        const cache = currentlyUsedObjects;
        let modelToAdd = cache.get(item);
        const category = uiData[categoryName];

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

    const tempMatrix = new Matrix4();
    function applySettings(model, settings) {
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

    const originalCamX = camera.rotation.x;
    const originalCamY = camera.rotation.y;
    const originalCamZ = camera.rotation.z;
    const mirrorItemCache = new Map();
    function updateState(localstate, state) {
        if (state) {
            for (const categoryName of stateEntries) {
                const item = state.get(categoryName);
                const category = uiData[categoryName];
                const parent = category.target;
                parent.children.splice(0);
                if (!item) continue;
                if (item.children) {
                    item.children
                    .forEach(item => {
                        const model = addItem(parent, categoryName, item);
                        applySettings(model, item.settings);
                        applyMorph(model, item.settings);

                        if (item.settings.xravatar_mirror) {
                            const mirrorItem = mirrorItemCache.get(item) || {};
                            mirrorItemCache.set(item, mirrorItem);
                            Object.assign(mirrorItem, item);
                            mirrorItem.settings = {};
                            Object.assign(mirrorItem.settings, item.settings);
                            mirrorItem.settings.xravatar_flip = !mirrorItem.settings.xravatar_flip;
                            
                            const model2 = addItem(parent, categoryName, mirrorItem);
                            applySettings(model2, mirrorItem.settings);
                            applyMorph(model2, mirrorItem.settings);
                        }
                    });
                } else if (item.settings.xravatar_mirror) {
                    parent.parent.matrix.identity();

                    const mirrorItem = mirrorItemCache.get(item) || {};
                    mirrorItemCache.set(item, mirrorItem);
                    Object.assign(mirrorItem, item);
                    mirrorItem.settings = {};
                    Object.assign(mirrorItem.settings, item.settings);
                    mirrorItem.settings.xravatar_flip = !mirrorItem.settings.xravatar_flip;

                    const model = addItem(parent, categoryName, item);
                    applySettings(model, item.settings);
                    applyMorph(model, item.settings);

                    const model2 = addItem(parent, categoryName, mirrorItem);
                    applySettings(model2, mirrorItem.settings);
                    applyMorph(model2, mirrorItem.settings);

                } else {
                    const model = addItem(parent, categoryName, item);
                    applySettings(parent.parent, item.settings);
                    applyMorph(model, item.settings);
                }
            }
        }
        if (localstate) {
            camera.rotation.set(
                originalCamX + (localstate.get('threeRotateY') || 0)/-500,
                originalCamY + (localstate.get('threeRotateX') || 0)/-500 - Math.PI/2,
                originalCamZ
            );
        }
    }
    return updateState;
}

export {
    renderGL
}