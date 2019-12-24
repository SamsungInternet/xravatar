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
    xravatarRoot.position.set(0, 0, 4);
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
    function updateState(state) {
        scene.children.splice(0);
        for (const [category, item] of state.entries()) {
            if (item.children) continue;
            const existingItem = currentlyUsedObjects.get(item);
            console.log(category, item, existingItem);
            if (existingItem) {
                scene.add(existingItem);
            } else {
                const newModel = gltfScene
                .children.find(c => c.name === category)
                .children.find(c => c.name === item.name)
                .clone(true);
                currentlyUsedObjects.set(item, newModel);
                scene.add(newModel)
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