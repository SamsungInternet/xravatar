import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    DirectionalLight
} from '../node_modules/three/build/three.module.js';

function renderGL(canvas, xravatarRoot, uiData) {
    const renderer = new WebGLRenderer( { canvas: canvas, antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    
    const scene = new Scene();

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
    function addItem(parent, categoryName, item) {
        let modelToAdd = currentlyUsedObjects.get(item.model);
        const category = uiData[categoryName];

        // Fail gracefully on unmatched things from the state
        if (!category) {
            console.warn(`"${categoryName}", from state, not found in GLTF file.`);
            return
        }

        if (!modelToAdd) {
            const child = category.children[item.name];
            if (!child) {
                console.warn(`"Child "${item.name}" of ${categoryName}", from state, not found in GLTF file.`);
                return
            }
            const newModel = child.model.clone(true);
            currentlyUsedObjects.set(item.model, newModel);
            modelToAdd = newModel;
        }
        parent.add(modelToAdd);
    }
    function updateState(state, localstate) {

        for (const [category, item] of state.entries()) {

            let parent;
            if (category.parent) {
                const parentCategory = category.parent.name;
                const currentActiveInParentCategory = state.get(parentCategory);
                parent = currentlyUsedObjects.get(currentActiveInParentCategory.model);
    
                if (!parent) {
                    console.warn(`${currentActiveInParentCategory.name} is not rendered by the scene yet so can't append to it yet.`);
                    return;
                }
            } else {
                parent = xravatarRoot;
            }
            parent.children.splice(0);

            if (item.children) {
                item.children.forEach(item => addItem(parent, category, item));
            } else {
                addItem(parent, category, item);
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