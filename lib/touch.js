/* global Hammer */
import '../node_modules/hammerjs/hammer.min.js';

function init(root, state) {
    const hammer = new Hammer(root);
    hammer.get('pinch').set({ enable: true });
    hammer.on('press', e => console.log(e));
    hammer.on('pinch', e => console.log(e));
}

export {init}