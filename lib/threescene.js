import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    Group,
    DirectionalLight,
    // MeshStandardMaterial,
} from '../node_modules/three/build/three.module.js';

function renderGL(canvas, gltfScene) {
    const renderer = new WebGLRenderer( { canvas: canvas, antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    
    const scene = new Scene();
    
    const xravatarRoot = new Group();
    xravatarRoot.position.set(0, 0, 5);
    scene.add(xravatarRoot);
    
    const camera = new PerspectiveCamera();
    camera.lookAt(xravatarRoot.position);

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
    
    // const material = new MeshStandardMaterial();
          
    renderer.setAnimationLoop(function () {
      renderer.render(scene, camera);
    });

    const currentlyUsedObjects = new Map();
    function addItem(category, item) {
        const existingItem = currentlyUsedObjects.get(item.model);
        if (existingItem) {
            xravatarRoot.add(existingItem);
        } else {
            const newModel = gltfScene
            .children.find(c => c.name === category)
            .children.find(c => c.name === item.name)
            .clone(true);
            currentlyUsedObjects.set(item.model, newModel);
            xravatarRoot.add(newModel)
        }
    }
    function updateState(state, localstate) {
        xravatarRoot.children.splice(0);
        for (const [category, item] of state.entries()) {
            if (item.children) {
                item.children.forEach(item => addItem(category, item));
            } else {
                addItem(category, item);
            }
        }
        xravatarRoot.rotation.set(
            (localstate.get('threeRotateY') || 0)/-300,
            (localstate.get('threeRotateX') || 0)/300 + Math.PI/2,
            0
        );
    }
    return updateState;
}

export {
    renderGL
}