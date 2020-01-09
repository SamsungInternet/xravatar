import { wire, bind } from '../node_modules/hyperhtml/esm.js';
import { createEmptySettings } from './schema.js';
import { arrayToRgb } from './colors.js';
const settingsCache = new Map();

function xravatarIndexSort(a,b) {
  return a.userData.xravatar_index - b.userData.xravatar_index;
}

function renderUI (target, uiData, eventListeners, palette) {

  // Add Additional Event listeners
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

  const categories = Object.values(uiData).sort(xravatarIndexSort);

  function render(state) {

    const colors = [];
    for (let i = 0; i < palette.length; i+=3) {
      const color = new Uint8ClampedArray(palette.buffer,i,3);
      colors.push(color);
    }

    const categoryForms = categories.map(category => wire(category, 'html:panel')`
      <form oninput=${eventListeners.onCategoryInput} id="${category.name}" role="tabpanel">
        ${formItem(uiData, category, eventListeners, state)}
      </form>
    `);

    const paletteForm = wire(palette, 'html:panel')`
      <form id="Palette" role="tabpanel">
        ${colors.map((p, i) => wire(p, 'html:colorpicker')`
          <p><label><input oninput=${eventListeners.onPaletteInput(p)} type="color" name="colors" value="${arrayToRgb(p)}"> Colour ${i}</label></p>
        `)}
      </form>
    `;

    const categoryPanels = wire(state, 'html:categoryPanels')`
      <section class="tabs oui-bubble" aria-live="polite" role="region" id="categoryPanels">
        ${paletteForm}
        ${categoryForms}
      </section>
    `;

    const categoryTabs = categories.map(category => wire(category, 'html:tab')`
      <a href="${'#' + category.name}" class=${'oui-tab-link ' + ('#' + category.name === location.hash ? 'oui-tab-link--active' : '')} role="tab">${category.name}</a>
    `);

    const nav = wire(categories, 'html:nav')`
      <nav class="oui-tab" role="tablist" id="categorytabs">
        <a class="oui-tab-link" href="#" role="tab"><span aria-label="Close">×</span></a>
        <a class="oui-tab-link" href="#Palette" role="tab"><span aria-label="Palette">Palette</span></a>
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

function formItem(uiData, category, eventListeners, state) {
  
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
    for (const child of Object.values(category.children).sort(xravatarIndexSort)) {
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

    if (data) out.push(settingsEl(
      category.children[data.name].userData,
      eventListeners,
      data
    ));

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
        ${Object.values(category.children)
          .sort(xravatarIndexSort)
          .map(child => wire(child, 'html:li')`
          <li onclick=${eventListeners.addItem({
            child, state, data, category
          })} class="${'oui-bubble-item button ' + (data.children.length > category.userData.xravatar_maxCount ? 'disabled' : '')}"
            tabindex="0" role="button" style="cursor: pointer; user-select: none;">
            <span class="plus">+</span>
            ${child.name}
          </li>`
          )
        }
      </ul>
      <h3>Children, ${data.children.length}/${category.userData.xravatar_maxCount} used.</h3>
      ${
        wire(data, 'html:dataitems')`<ul>
          <section data-category=${category.name}>
            ${data.children.map(item => wire(item, 'html:settinswithbutton')`
              <button class="del-btn" aria-label="delete" onclick=${function () {
                data.children.splice(data.children.indexOf(item), 1);
                eventListeners.onSettingsInput(true);
              }}>×</button>
              ${settingsEl(
                category.children[item.name].userData,
                eventListeners,
                item
              )}
            `)}
          </section>
        </ul>`
      }`;
  }
}

function settingsEl(userData, eventListeners, item) {
  const {
    name,
    xravatar_canMirror,
    xravatar_defaultMirror
  } = userData;
  const out = [];
  if (xravatar_canMirror) {
    out.push(wire(item, 'html:xravatar_canMirror')`
      <label><input type="checkbox" name="xravatar_canMirror" selected=${!!xravatar_defaultMirror}>Mirror Element</label>
    `);
  }
  return wire(item, 'html:settings')`
    <form oninput=${eventListeners.onSettingsInput}><details>
      <summary>${name}</summary>
      ${out}
    </details></form>
  `;
}

export {
  renderUI
}