import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    DirectionalLight,
    sRGBEncoding,
    SphereGeometry,
    BackSide,
    Mesh,
    MeshBasicMaterial,
} from '../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { BasisTextureLoader } from "/node_modules/three/examples/jsm/loaders/BasisTextureLoader.js";

const loader = new GLTFLoader();
const basisLoader = new BasisTextureLoader();

function renderGL(canvas, xravatarRoot, uiData, stateEntries) {
    const renderer = new WebGLRenderer( { canvas: canvas, antialias: false } );
    renderer.setPixelRatio( window.devicePixelRatio );
    basisLoader.setTranscoderPath( '/node_modules/three/examples/js/libs/basis/' );
    basisLoader.detectSupport( renderer );
    
    const scene = new Scene();
    xravatarRoot.position.set(0, 0, 0);
    scene.add(xravatarRoot);
    
    const camera = new PerspectiveCamera();
    camera.position.set(2.5, 1.6, 0);
    camera.near = 0.1;
    camera.rotation.y = Math.PI;
    camera.eulerOrder = "YXZ";

    /* load some external assets to make things look nice */
    (async function () {
        // From https://poly.google.com/view/biZ9tKZzlLy by Alex “SAFFY” Safayan
        // & https://poly.google.com/view/aFWefo0cEFo by Google
        const glbPromise = new Promise(resolve => loader.load('assets/bedroom.glb', resolve));
        const basisPromise = new Promise(resolve =>  basisLoader.load( './assets/skysmall.basis', resolve));
        const {scene: bedroom} = await glbPromise;
        const texture = await basisPromise;
        texture.offset.set(0,-1);

        const skygeometry = new SphereGeometry( 20, 50, 50 , 0, 2 * Math.PI);
        const skymaterial = new MeshBasicMaterial();
        const skysphere = new Mesh( skygeometry, skymaterial );
        skysphere.rotation.y = Math.PI + 0.5;

        texture.encoding = sRGBEncoding;
        texture.repeat.y = 2;
        skymaterial.map = texture;
        skymaterial.side = BackSide;
        skymaterial.needsUpdate = true;

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
    
    const light = new DirectionalLight();
    light.position.set(0, 10, 10);
    scene.add(light);
    
    const light2 = new DirectionalLight();
    light2.position.set(10, 10, -10);
    scene.add(light2);
          
    renderer.setAnimationLoop(function () {
      renderer.render(scene, camera);
    });

    const currentlyUsedObjects = new Map();
    function addItem(parent, categoryName, item) {
        let modelToAdd = currentlyUsedObjects.get(item);
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
            currentlyUsedObjects.set(item.model, modelToAdd);
        }
        parent.add(modelToAdd);
    }

    const originalCamX = camera.rotation.x;
    const originalCamY = camera.rotation.y;
    const originalCamZ = camera.rotation.z;
    console.log(originalCamX, originalCamY, originalCamZ)
    function updateState(state, localstate) {
        for (const categoryName of stateEntries) {
            const item = state.get(categoryName);
            const category = uiData[categoryName];
            const parent = category.target;
            parent.children.splice(0);
            if (!item) continue;
            if (item.children) {
                item.children.forEach(item => addItem(parent, categoryName, item));
            } else {
                addItem(parent, categoryName, item);
            }
        }
        camera.rotation.set(
            originalCamX + (localstate.get('threeRotateY') || 0)/-300,
            originalCamY + (localstate.get('threeRotateX') || 0)/-300 - Math.PI/2,
            originalCamZ
        );
    }
    return updateState;
}

export {
    renderGL
}