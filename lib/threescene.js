import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    Group,
    DirectionalLight,
    // MeshStandardMaterial,
} from '/node_modules/three/build/three.module.js';

function renderGL(canvas, gltfScene, state) {
    const renderer = new WebGLRenderer( { canvas: canvas, antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    
    const scene = new Scene();
    
    const xravatarRoot = new Group();
    xravatarRoot.position.set(0, 0, 5);
    xravatarRoot.rotation.set(0,Math.PI/2,0);
    scene.add(xravatarRoot);
    
    const light = new DirectionalLight();
    light.position.set(0, 10, 10);
    scene.add(light);
    
    const camera = new PerspectiveCamera();
    camera.lookAt(xravatarRoot.position);
    
    const light2 = new DirectionalLight();
    light2.position.set(10, 10, -10);
    scene.add(light2);
    
    // const material = new MeshStandardMaterial();
          
    renderer.setAnimationLoop(function () {
      renderer.render(scene, camera);
    });

    const currentlyUsedObjects = new Map();
    function addItem(category, item) {
        const existingItem = currentlyUsedObjects.get(item);
        if (existingItem) {
            xravatarRoot.add(existingItem);
        } else {
            const newModel = gltfScene
            .children.find(c => c.name === category)
            .children.find(c => c.name === item.name)
            .clone(true);
            currentlyUsedObjects.set(item, newModel);
            xravatarRoot.add(newModel)
        }
    }
    function updateState(state) {
        xravatarRoot.children.splice(0);
        for (const [category, item] of state.entries()) {
            if (item.children) {
                item.children.forEach(item => addItem(category, item));
            } else {
                addItem(category, item);
            }
        }
    }
    
    if (state) {
        updateState(state);
        return updateState;
    }
    return updateState;
}

export {
    renderGL
}