import { wire, bind } from '../node_modules/hyperhtml/esm.js';
import { createEmptySettings } from './schema.js';
const settingsCache = new Map();

function xravatarIndexSort(a,b) {
  return a.userData.xravatar_index - b.userData.xravatar_index;
}

function renderUI (target, gltfScene, eventListeners) {

  Object.assign(eventListeners, {
    addItem(inData, e) {
      const {
        child, state, data, category
      } = inData;
      if (!e) return e => this.addItem(inData,e);
      if (data.children.length < child.userData.xravatar_maxCount) {
        data.children.push(createEmptySettings(child));
        state.set(category.name, data);
        e.target.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  });

  const categories = gltfScene.children.sort(xravatarIndexSort);

  function render(state) {

    const categoryForms = categories.map(category => wire(category, 'html:panel')`
      <form oninput=${eventListeners.updateState} id="${category.name}" role="tabpanel">
        ${formItem(category, eventListeners, state)}
      </form>
    `);

    const categoryPanels = wire(state, 'html:mainform')`
      <section class="tabs oui-bubble" aria-live="polite" role="region" id="categoryPanels">
        ${categoryForms}
      </section>
    `;

    const categoryTabs = categories.map(category => wire(category, 'html:tab')`
      <a href="${'#' + category.name}" class=${'oui-tab-link ' + ('#' + category.name === location.hash ? 'oui-tab-link--active' : '')} role="tab">${category.name}</a>
    `);

    const nav = wire(gltfScene, 'html:nav')`
      <nav class="oui-tab" role="tablist" id="categorytabs">
        <a class="oui-tab-link" href="#" role="tab"><span aria-label="Close">×</span></a>
        ${categoryTabs}
      </nav>
    `;

    bind(target)`
      ${nav}
      ${categoryPanels}
    `;

    return {
      nav,
      categoryPanels,
      categoryForms,
      categoryTabs
    }
  }
  return render;
}

function formItem(category, eventListeners, state) {
  
  // If exactly one has to be selected use radio buttons
  // 🔘 item1
  // ◯ item2
  if (category.userData.xravatar_maxCount === 1) {
    const out = [];
    const hasData = !!state.get(category.name);
    const categoryData = state.get(category.name) || {};
    let data;
    if (category.userData.xravatar_minCount === 0) {
      out.push(wire(category, 'html:nooption')`
        <label class="oui-label oui-container-radio">
          <input type="radio" class="oui-input-radio" name="${category.name}" value="" checked="${!hasData}">
          <span class="oui-input-text">None</span>
          <span class="oui-input-radio-checkmark"></span>
        </label>
      `)
    }
    let i = 0;
    for (const child of category.children.sort(xravatarIndexSort)) {
      const checked = categoryData.name === child.name;
      out.push(wire(child, 'html:radio')`
        <label class="oui-label oui-container-radio">
          <input type="radio" class="oui-input-radio" name="${category.name}" value="${child.name}" checked="${checked || (!categoryData.name && i===0 && category.userData.xravatar_minCount === 1)}">
          <span class="oui-input-text">${child.name}</span>
          <span class="oui-input-radio-checkmark"></span>
        </label>
      `)
      if (checked) data = settingsCache.get(child) || createEmptySettings(child);
      settingsCache.set(child, data);
      i++;
    }

    if (data) out.push(settingsEl(eventListeners, data));

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
          <section data-category=${category}>
            ${data.children.map(item => settingsEl(eventListeners, item))}
          </section>
        </ul>`
      }`;
  }
}

function settingsEl(eventListeners, data) {
  if (!data.model) return '';
  const {
    name,
    xravatar_canMirror,
    xravatar_defaultMirror
  } = data.model;
  const out = [];
  if (xravatar_canMirror) {
    out.push(wire(data, 'html:xravatar_canMirror')`
      <label><input type="checkbox" name="xravatar_canMirror" selected=${!!xravatar_defaultMirror}>Mirror Element</label>
    `);
  }
  return wire(data, 'html:settings')`
    <form oninput=${eventListeners.updateState}><details>
      <summary>${name}</summary>
      ${out}
    </details></form>
  `;
}

export {
  renderUI
}