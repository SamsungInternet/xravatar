/* global Hammer */
import '../node_modules/hammerjs/hammer.min.js';

function init(root, state, localState, callback) {
    const hammer = new Hammer(root);
    hammer.get('pinch').set({ enable: true });
    hammer.get('rotate').set({ enable: true });
    hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_VERTICAL });

    hammer.on('press', e => console.log(e));
    hammer.on('pinch', e => console.log(e));

    let tempRotateX;
    let tempRotateY;
    hammer.on('panstart', () => {
        tempRotateX = localState.get('threeRotateX') || 0;
        tempRotateY = localState.get('threeRotateY') || 0;
    });
    hammer.on('pan', ({deltaX, deltaY}) => {
        localState.set('threeRotateX', tempRotateX + deltaX);
        localState.set('threeRotateY', tempRotateY + deltaY);
        callback(state);
    });
}

export {init}