const defaultValues = {
    "xravatar_index": 0,
    "xravatar_minCount": 0,
    "xravatar_maxCount": 1,
    "xravatar_minR": 0,
    "xravatar_maxR": 0.7,
    "xravatar_minScale": 0.7,
    "xravatar_maxScale": 1.3,
    "xravatar_canMirror": 1,
    "xravatar_canMove": 0.0,
    "xravatar_defaultMirror": 0
}

const settingKeys = {
    xravatar_scale: Number,
    xravatar_flip: Boolean,
    xravatar_mirror: Boolean,
    xravatar_positionRadius: Number,
    xravatar_positionPhi: Number,
    xravatar_positionTheta: Number,
};

// This is what is saved back out
function createEmptySettings(item) {
    const out = {
        name: item.name,
        settings: {
            xravatar_scale: item.userData.xravatar_minScale + (item.userData.xravatar_maxScale - item.userData.xravatar_minScale)/2,
            xravatar_mirror: item.userData.xravatar_defaultMirror,
        }
    }

    if (item.morphTargets) {
        item.morphTargets.forEach(key => {
            out.settings['xravatar_morph_' + key] = 0;
        });
    }

    if (item.userData.xravatar_canMove) {
        out.settings.xravatar_positionRadius = item.startPosition.radius;
        out.settings.xravatar_positionPhi = item.startPosition.phi;
        out.settings.xravatar_positionTheta = item.startPosition.theta;
        console.log(item.startPosition);
    }

    return out;
}

export {
    defaultValues,
    createEmptySettings,
    settingKeys
}