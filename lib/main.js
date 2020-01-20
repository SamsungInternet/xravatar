import { renderUI } from './ui.js';
import { renderGL } from './threescene.js'
import { storeAvatar, getLocalState, getState } from './storage.js';
import { init as touchInit } from './touch.js';
import { getXRAvatarRoot, getUIData, getCategoriesInTraverseOrder, updatePaletteCanvas } from './gltfparse.js';
import { createEmptySettings, settingKeys } from './schema.js';
import { hexToArray } from './colors.js';
import '../node_modules/localforage/dist/localforage.min.js';

(async function init() {
	const xravatarRoot = await getXRAvatarRoot();
	const uiData = await getUIData(); // The data needed to construct the interface
	const state = await getState(); // State which is saved & sent to the client
	const localState = await getLocalState(); // State which is saved but not transferred
	const canvas = document.querySelector('canvas');
	const uiTarget = document.getElementById('uitarget');
	const categoriesInOrder = await getCategoriesInTraverseOrder();
	const paletteArray = state.get('palette');
	const palette = Uint8ClampedArray.from(
		[248,169,52,254,248,224,38,217,217,41,128,0,55,240,236,0,128,192,194,193,135,128,0,128,0,255,255,255,128,0,0,128,255,209,220,10,128,0,128,179,85,169,124,126,52,140,213,43]
	);

	window.xravatar_state = state;

	// Update the uniforms based on the state palette if one is set
	if (paletteArray) {
		palette.set(paletteArray);
	} else {
		// Set the state to what ever the default one is.
		state.set('palette', [...palette]);
	}
	updatePaletteCanvas(palette);

	console.log(uiData, state);

	// Prepares the the UI renderer so that it can later render with state
	const renderUIFn = renderUI(uiTarget, uiData, {
		onCategoryInput,
		onSettingsInput,
		onPaletteInput
	}, palette);

	// Prepares the the WebGL renderer so that it can later render with state
	const updateGLState = renderGL(canvas, xravatarRoot, uiData, categoriesInOrder);
	function onPaletteInput(subPalette) {
		return async function () {
			hexToArray(this.value, subPalette);

			// Write the updated palette to the state and update it
			const paletteArray = state.get('palette');
			paletteArray.splice(0);
			paletteArray.push(...palette);
			await storeAvatar(Object.fromEntries(state.entries()));

			updatePaletteCanvas(palette);
		}
	}

	function onCategoryInput() {
		const data = new FormData(this).entries();

		// Update State
		for (const [categoryName, itemName] of data) {
			if (itemName === '') {
				state.set(categoryName, false);
				continue;
			}

			const child = uiData[categoryName].children[itemName];
			if (!child) {
				console.warn(`Child "${itemName}" of "${categoryName}", from state, not found in GLTF file.`);
				continue;
			} else {
				const oldData = state.get(categoryName);
				const previousName = oldData && oldData.name;
				if (previousName !== itemName) {
					const newItem = createEmptySettings(child);
					state.set(categoryName, newItem);
				}
			}
		}

		// Re-render
		renderUIFn(state);
		updateGLState(localState, state);
		storeAvatar(Object.fromEntries(state.entries()));
	}
	function onSettingsInput(item, e, del) {

		// If an event is not provided then curry it for later
		if (!e) return function (e, del) { onSettingsInput.bind(this)(item, e, del) };

		// If the item was deleted there is nothing to do so just let it be 
		if (!del) {
			const data = Object.fromEntries(new FormData(this).entries());
			Object.entries(settingKeys).forEach(([key, type]) => item.settings[key] = type(data[key]));

			// handle the morph target data which is dynamic so not included in the schema
			Object.keys(data)
			.filter(key => key.indexOf('xravatar_morph_') === 0)
			.forEach(key => item.settings[key] = Number(data[key]))
		}
		updateGLState(localState, state);
		storeAvatar(Object.fromEntries(state.entries()));
	}
	touchInit(canvas, state, localState, () => updateGLState(localState));
	window.addEventListener('hashchange', () => renderUIFn(state), false);

  // First renders
	updateGLState(localState, state);
	const {
		categoryForms
	} = renderUIFn(state);
	
	// Run onInput from each form to set default value if one is not otherwise set
	categoryForms.forEach(form => onCategoryInput.bind(form)());
}());