const defaultValues = {
    "xravatar_index": 0,
    "xravatar_minCount": 0,
    "xravatar_maxCount": 1,
    "xravatar_minR": 0,
    "xravatar_maxR": 0.7,
    "xravatar_minScale": 0.7,
    "xravatar_maxScale": 1.3,
    "xravatar_canMirror": 1,
    "xravatar_defaultMirror": 0
}

const settingKeys = {
    xravatar_scale: Number,
    xravatar_flip: Boolean,
    xravatar_mirror: Boolean
};

// This is what is saved back out
function createEmptySettings(model) {
    return {
        name: model.name,
        settings: {}
    }
}

export {
    defaultValues,
    createEmptySettings,
    settingKeys
}