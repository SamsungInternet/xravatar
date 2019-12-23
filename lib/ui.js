import { wire, bind } from '../node_modules/hyperhtml/esm.js';
import { defaultValues } from './schema.js';

function xravatarIndexSort(a,b) {
  return a.userData.xravatar_index - b.userData.xravatar_index;
}


function renderUI (target, gltfScene, state) {
  for (const category of gltfScene.children) {
    // Inherit default values from the schema
    for ( const key of Object.keys(defaultValues)) {
      category.userData[key] = (category.userData[key] === undefined ? defaultValues[key] : category.userData[key]);
    }
      
    // Children inherit from their parents
    for (const child of category.children) {
      for ( const key of Object.keys(category.userData)) {
        child.userData[key] = (child.userData[key] === undefined ? category.userData[key] : child.userData[key]);
      }
    }
  }

  const eventListeners = {
    addItem(inData, e) {
      const {
        child, state, data, category
      } = inData;
      if (!e) return e => this.addItem(inData,e);
      if (data.children.length < child.userData.xravatar_maxCount) {
        data.children.push({
          name: child.name
        });
        state.set(category.name, data);
        e.target.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  }

  const categories = gltfScene.children.sort(xravatarIndexSort);

  function render(state) {
    bind(target)`
      <nav class="oui-tab" role="tablist" id="categorytabs">
        <a class="oui-tab-link" href="#" role="tab"><span aria-label="Close">×</span></a>
        ${categories.map(category => wire(category, 'html:tab')`
          <a href="${'#' + category.name}" class="oui-tab-link" role="tab">${category.name}</a>
        `)}
      </nav>
      <form class="tabs oui-bubble" aria-live="polite" role="region" id="categorypanels">
        ${categories.map(category => wire(category, 'html:panel')`
          <fieldset id="${category.name}" role="tabpanel">
            ${formItem(category, eventListeners, state)}
          </fieldset>
        `)}
      </form>
    `;

  }

  if (state) {
    return render(state);
  }
  return render;
}

function formItem(category, eventListeners, state) {
  
  // If exactly one has to be selected use radio buttons
  // 🔘item1
  // ◯ item2
  if (category.userData.xravatar_maxCount === 1) {
    const out = [];
    const hasData = !!state.get(category.name);
    const data = state.get(category.name) || {};
    if (category.userData.xravatar_minCount === 0) {
      out.push(wire(category, 'html:exit')`
        <label class="oui-label oui-container-radio">
          <input type="radio" class="oui-input-radio" name="${category.name}" value="" checked="${!hasData}">
          <span class="oui-input-text">None</span>
          <span class="oui-input-radio-checkmark"></span>
        </label>
      `)
    }
    for (const child of category.children.sort(xravatarIndexSort)) {
      out.push(wire(child, 'html:radio')`
        <label class="oui-label oui-container-radio">
          <input type="radio" class="oui-input-radio" name="${category.name}" value="${child.name}" selected="${data.name === child.name}">
          <span class="oui-input-text">${child.name}</span>
          <span class="oui-input-radio-checkmark"></span>
        </label>
      `)
    }

    if (hasData) out.push(settingsEl(data));

    return out;
  }

  // If more than one can be selected use a menu of items
  // + item1
  // + item2
  if (category.userData.xravatar_maxCount > 1) {
    const data = state.get(category.name) || {
      children: []
    }
    state.set(category.name, data);
    return wire(category, 'html:menu')`
      <ul>
        ${category
          .children
          .sort(xravatarIndexSort)
          .map(child => wire(child, 'html:li')`
          <li onclick=${eventListeners.addItem({
            child, state, data, category
          })} class="${'oui-bubble-item button ' + (data.children.length > category.userData.xravatar_maxCount ? 'disabled' : '')}" tabindex="0" role="button" style="cursor: pointer; user-select: none;">
            <span class="plus">+</span>
            ${child.name}
          </li>`
          )
        }
      </ul>
      <h3>Children, ${data.children.length}/${category.userData.xravatar_maxCount} used.</h3>
      ${
        wire(data, 'html:dataitems')`<ul>
          ${data.children.map(item => settingsEl(item))}
        </ul>`
      }`;
  }
}

function settingsEl(data) {
  const {
    name
  } = data;
  return wire(data, 'html:settings')`
    <details>
      <summary>${name}</summary>
    </details>
  `;
}

export {
  renderUI
}