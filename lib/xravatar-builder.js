import { renderUI } from './ui.js';
import { renderGL } from './threescene.js'
import { storeAvatar, getLocalState, getState } from './storage.js';
import { init as touchInit } from './touch.js';
import { getXRAvatarRoot, getUIData, getCategoriesInTraverseOrder, getPalette } from './gltfparse.js';
import { createEmptySettings } from './schema.js';
import '../node_modules/localforage/dist/localforage.min.js';

(async function init() {
	const xravatarRoot = await getXRAvatarRoot();
	const uiData = await getUIData(); // The data needed to construct the interface
	const state = await getState(); // State which is saved & sent to the client
	const localState = await getLocalState(); // State which is saved but not transferred
	const canvas = document.querySelector('canvas');
	const uiTarget = document.getElementById('uitarget');
	const categoriesInOrder = await getCategoriesInTraverseOrder();
	const paletteUniforms = await getPalette();
	const paletteArray = state.get('palette');

	// Update the uniforms based on the state palette if one is set
	if (state.get('palette')) {

		// Update the uniforms based on the state palette if one is set
		paletteUniforms.forEach((u,i) => u.fromArray(paletteArray, i*3));
	} else {

		// Set the state to what ever the generated one is.
		const newPaletteArray = [];
		paletteUniforms.forEach((u,i) => u.toArray(newPaletteArray, i*3));
		state.set('palette', newPaletteArray);
	}

	console.log(uiData, state);

	// Prepares the the UI renderer so that it can later render with state
	const renderUIFn = renderUI(uiTarget, uiData, {
		palette: paletteUniforms
	}, {
		onCategoryInput,
		onSettingsInput,
		onPaletteInput
	});

	// Prepares the the WebGL renderer so that it can later render with state
	const updateGLState = renderGL(canvas, xravatarRoot, uiData, categoriesInOrder);

	
	async function onPaletteInput() {
		// Write the updated palette to the state and update it
		const palette = state.get('palette');
		paletteUniforms.forEach((u,i) => u.toArray(palette, i*3));
		await storeAvatar(Object.fromEntries(state.entries()));
	}

	async function onCategoryInput() {
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
				let previousData = state.get(categoryName) || createEmptySettings(child);
				if (previousData.name !== categoryName) {
					previousData = createEmptySettings(child);
				}
				state.set(categoryName, previousData);
			}
		}

		// Re-render
		renderUIFn(state);
		updateGLState(state, localState);
		await storeAvatar(Object.fromEntries(state.entries()));
	}
	async function onSettingsInput() {
		const data = Object.fromEntries(new FormData(this).entries());
		console.log(data);

		// Update State

		renderUIFn(state);
		updateGLState(state, localState);
		await storeAvatar(Object.fromEntries(state.entries()));
	}
	touchInit(canvas, state, localState, () => updateGLState(state, localState));
	window.addEventListener('hashchange', () => renderUIFn(state), false);

  // First renders
	updateGLState(state, localState);
	const {
		categoryForms
	} = renderUIFn(state);
	
	// Run onInput from each form to set default value if one is not otherwise set
	categoryForms.forEach(form => onCategoryInput.bind(form)());
}());