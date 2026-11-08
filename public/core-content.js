// These interactions run entirely in the browser. No enquiry, account detail,
// measurement or marketing choice is transmitted to a service by this module.
export const CONTENT_STORAGE = Object.freeze({
  preferences:'wow-cookie-preferences-v1',
  saved:'wow-homepage-saved-v1',
  legacyDress:'wow-dress-edit',
  legacyClub:'wow-club-edit',
  commerce:'wow-commerce-preview-v1',
  order:'wow-order-preview-v1',
  returns:'wow-return-preview-v1'
});

export function normalizeText(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

export function matchesQuery(text, query) {
  const haystack = normalizeText(text);
  return normalizeText(query).split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

export function convertMeasurement(value, from='cm', to='in') {
  if (!['cm','in'].includes(from) || !['cm','in'].includes(to)) return null;
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const centimetres = from === 'in' ? numeric * 2.54 : numeric;
  if (centimetres > 300.001) return null;
  const result = to === 'in' ? centimetres / 2.54 : centimetres;
  return Math.round(result * 10) / 10;
}

const topicNames = Object.freeze({
  shopping:'Choosing a product', sizing:'Sizing and fit', delivery:'Delivery or tracking',
  'order-change':'Change or cancel an order', return:'Return or exchange',
  'faulty-item':'Faulty or incorrect item', account:'Account help',
  privacy:'Privacy or saved information', accessibility:'Website accessibility',
  correction:'Editorial correction', other:'Something else'
});

export function prepareEnquiry(values={}) {
  const clean = (value, limit) => String(value ?? '').replace(/\r\n?/g,'\n').trim().slice(0,limit);
  const topic = topicNames[values.topic] || topicNames.other;
  const name = clean(values.name,120), email = clean(values.email,200);
  const reference = clean(values.reference,500), message = clean(values.message,4000);
  return [`WOW Fashion enquiry: ${topic}`, name ? `Name: ${name}` : '', email ? `Reply email: ${email}` : '', reference ? `Product or order reference: ${reference}` : '', '', message].filter((line,index,array) => line || (index > 0 && array[index-1])).join('\n');
}

export function normalizePreference(value) {
  if (!value || typeof value !== 'object' || value.version !== 1 || value.necessary !== true || value.optional !== false) return null;
  const savedAt = typeof value.savedAt === 'string' ? value.savedAt : '';
  if (!savedAt || !Number.isFinite(Date.parse(savedAt))) return null;
  return {version:1,necessary:true,optional:false,savedAt:new Date(savedAt).toISOString()};
}

export function readPreference(storage) {
  let raw;
  try {
    raw = storage.getItem(CONTENT_STORAGE.preferences);
  } catch {
    return {available:false,preference:null};
  }
  try {return {available:true,preference:raw ? normalizePreference(JSON.parse(raw)) : null};}
  catch {return {available:true,preference:null};}
}

function setupHelp() {
  const input = document.querySelector('#help-query');
  if (!input) return;
  const details = [...document.querySelectorAll('[data-help-group]')];
  const filters = [...document.querySelectorAll('[data-help-filter]')];
  let group = 'all';
  const update = () => {
    let count = 0;
    for (const item of details) {
      const show = (group === 'all' || item.dataset.helpGroup === group) && matchesQuery(item.textContent+' '+item.dataset.helpKeywords,input.value);
      item.hidden = !show;
      if (show) count++;
    }
    document.querySelector('#help-count').textContent = `${count} ${count===1?'question':'questions'}${input.value.trim() ? ' matching your search' : ' to explore'}`;
    document.querySelector('#help-empty').hidden = count !== 0;
    for (const filter of filters) filter.setAttribute('aria-pressed',String(filter.dataset.helpFilter===group));
  };
  input.addEventListener('input',update);
  filters.forEach(filter=>filter.addEventListener('click',()=>{group=filter.dataset.helpFilter;update();}));
  const requested = new URLSearchParams(location.search).get('q');
  if (requested) input.value = requested.slice(0,250);
  update();
}

function setupContact() {
  const form = document.querySelector('#contact-draft-form');
  if (!form) return;
  form.querySelector('[type=submit]').disabled=false;
  const topic = new URLSearchParams(location.search).get('topic');
  if (Object.hasOwn(topicNames,topic)) form.elements.namedItem('topic').value=topic;
  const result = document.querySelector('#contact-draft-result');
  const draft = document.querySelector('#contact-draft-copy');
  const status = document.querySelector('#enquiry-copy-status');
  window.addEventListener('pagehide',()=>{form.reset();draft.value='';status.textContent='';form.hidden=false;result.hidden=true;});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    if (String(values.message||'').trim().length < 10) {
      const message=form.elements.namedItem('message');
      message.setCustomValidity('Please include at least 10 characters so the enquiry has useful detail.');
      message.reportValidity();
      return;
    }
    draft.value=prepareEnquiry(values);
    status.textContent='';
    result.hidden=false;
    form.hidden=true;
    document.querySelector('#draft-title').focus();
  });
  form.elements.namedItem('message').addEventListener('input',event=>event.target.setCustomValidity(''));
  document.querySelector('#edit-enquiry').addEventListener('click',()=>{
    result.hidden=true;
    form.hidden=false;
    form.elements.namedItem('message').focus();
  });
  document.querySelector('#copy-enquiry').addEventListener('click',async()=>{
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(draft.value);
      status.textContent='Enquiry copied. Review it before pasting it into your chosen contact channel. Nothing has been sent.';
    } catch {
      draft.focus();
      draft.select();
      status.textContent='Your browser did not allow automatic copying. The draft is selected; use your device’s copy command. Nothing has been sent.';
    }
  });
}

function setupMeasurements() {
  const form = document.querySelector('#measurement-form');
  if (!form) return;
  const inputs=[...form.querySelectorAll('input[type=number]')];
  const canonical=new Map();
  let unit='cm';
  const status=document.querySelector('#measurement-status');
  const guidance=document.querySelector('#measurement-guidance');
  const garment=document.querySelector('#measure-garment');
  const guides={
    tops:['For a top or knit','Compare bust, shoulder, sleeve and length measurements. Allow room for any layer you plan to wear underneath.'],
    trousers:['For pants or leggings','Compare the waist, hip, rise and inside-leg measurements. Check how the chart measures the garment and whether the listing describes stretch.'],
    skirts:['For a skirt','Compare the waist, hip and garment length. Check where you want the waistband and hem to sit, and whether the waistband is adjustable.'],
    dresses:['For a dress','Compare bust, waist, hip and garment length. A fitted waist or shaped bodice can make more than one measurement relevant.'],
    outerwear:['For a coat or jacket','Compare bust, shoulder, sleeve and length. Measure over a similar layer to the one you plan to wear beneath it.']
  };
  const updateGuide=()=>{
    const [title,text]=guides[garment.value]||guides.tops;
    guidance.querySelector('strong').textContent=title;
    guidance.querySelector('p').textContent=text;
  };
  inputs.forEach(input=>input.addEventListener('input',()=>{
    const value=input.value;
    const number=Number(value);
    canonical.set(input.name,value!=='' && Number.isFinite(number) && number>0 && (unit==='cm'?number:number*2.54)<=300.001 ? (unit==='cm'?number:number*2.54) : null);
  }));
  const displayUnits=()=>{
    for (const input of inputs) {
      const original=canonical.get(input.name);
      if (original!==null && original!==undefined) input.value=String(convertMeasurement(original,'cm',unit));
      else input.value='';
      input.max=unit==='cm'?'300':'118.1';
      input.min='0.1';
      const label=input.name==='inseam'?'Inside leg':input.name[0].toUpperCase()+input.name.slice(1);
      input.setAttribute('aria-label',`${label} in ${unit==='cm'?'centimetres':'inches'}`);
    }
    form.querySelectorAll('[data-measure-unit]').forEach(label=>label.textContent=unit);
  };
  form.querySelectorAll('input[name=measure-unit]').forEach(radio=>radio.addEventListener('change',()=>{
    if (!radio.checked || radio.value===unit) return;
    const invalid=inputs.find(input=>input.value!=='' && !input.validity.valid);
    if (invalid) {
      form.querySelector(`input[name=measure-unit][value=${unit}]`).checked=true;
      invalid.reportValidity();
      status.textContent='Correct the highlighted measurement before switching units.';
      return;
    }
    unit=radio.value;
    displayUnits();
    status.textContent=`Showing ${unit==='cm'?'centimetres':'inches'}, rounded to one decimal place. Measurements do not identify a product size.`;
  }));
  form.addEventListener('reset',()=>{
    canonical.clear();unit='cm';
    requestAnimationFrame(()=>{displayUnits();updateGuide();status.textContent='Your measuring notes have been cleared.';});
  });
  form.addEventListener('submit',event=>event.preventDefault());
  garment.addEventListener('change',updateGuide);
  window.addEventListener('pagehide',()=>form.reset());
}

function setupCareTabs() {
  const tabs=[...document.querySelectorAll('[data-care-tab]')];
  if (!tabs.length) return;
  const panels=[...document.querySelectorAll('[data-care-panel]')];
  const activate=(index,focus=false)=>{
    tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
    panels.forEach(panel=>panel.hidden=panel.dataset.carePanel!==tabs[index].dataset.careTab);
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>activate(index));
    tab.addEventListener('keydown',event=>{
      let next;
      if (event.key==='ArrowRight') next=(index+1)%tabs.length;
      if (event.key==='ArrowLeft') next=(index-1+tabs.length)%tabs.length;
      if (event.key==='Home') next=0;
      if (event.key==='End') next=tabs.length-1;
      if (next!==undefined) {event.preventDefault();activate(next,true);}
    });
  });
  activate(0);
}

function setupJournal() {
  const filters=[...document.querySelectorAll('[data-journal-filter]')];
  if (!filters.length) return;
  const stories=[...document.querySelectorAll('[data-journal-topic]')];
  filters.forEach(filter=>filter.addEventListener('click',()=>{
    let count=0;
    stories.forEach(story=>{story.hidden=filter.dataset.journalFilter!=='all'&&filter.dataset.journalFilter!==story.dataset.journalTopic;if(!story.hidden)count++;});
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button===filter)));
    document.querySelector('#journal-count').textContent=`${count} ${count===1?'story':'stories'}${filter.dataset.journalFilter==='all'?'':` in ${filter.dataset.journalFilter.toLowerCase()}`}`;
  }));
}

function setupStorageControls() {
  const form=document.querySelector('#cookie-preference-form');
  const status=document.querySelector('#cookie-preference-status');
  const preferenceStatus=()=>{
    let result;
    try {result=readPreference(localStorage);} catch {result={available:false,preference:null};}
    if (!result.available) status.textContent='Browser storage is unavailable. No optional tracking is installed; a preference cannot be saved on this device.';
    else if (result.preference) status.textContent=`Essential-only preference saved on ${new Date(result.preference.savedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}. No optional tracking is installed.`;
    else status.textContent='No preference is saved in this browser. No optional tracking is installed.';
  };
  if (form) {
    form.querySelector('[type=submit]').disabled=false;
    preferenceStatus();
    form.addEventListener('submit',event=>{
      event.preventDefault();
      try {
        localStorage.setItem(CONTENT_STORAGE.preferences,JSON.stringify({version:1,necessary:true,optional:false,savedAt:new Date().toISOString()}));
        preferenceStatus();
      } catch {status.textContent='Your browser could not save this preference. No optional tracking is installed.';}
    });
    document.querySelector('#reset-cookie-preference').addEventListener('click',()=>{
      try {localStorage.removeItem(CONTENT_STORAGE.preferences);status.textContent='Saved preference removed from this browser. No optional tracking is installed.';}
      catch {status.textContent='Your browser did not allow the saved preference to be removed. You can use its site-data settings.';}
    });
  }
  const reportDevice=message=>document.querySelectorAll('[data-device-status]').forEach(element=>element.textContent=message);
  document.querySelectorAll('[data-clear-saved]').forEach(button=>button.addEventListener('click',()=>{
    let removed=true;
    try {for (const key of [CONTENT_STORAGE.saved,CONTENT_STORAGE.legacyDress,CONTENT_STORAGE.legacyClub]) localStorage.removeItem(key);} catch {removed=false;}
    window.dispatchEvent(new CustomEvent('wow:request-saved',{detail:{clear:true}}));
    reportDevice(removed?'Saved pieces cleared from this browser. Your sample shopping selections have been kept.':'The wishlist is cleared for this visit. Your browser blocked access to saved records; use its site-data settings to remove any earlier stored list.');
  }));
  document.querySelectorAll('[data-clear-shopping]').forEach(button=>button.addEventListener('click',()=>{
    try {
      sessionStorage.removeItem(CONTENT_STORAGE.commerce);
      sessionStorage.removeItem(CONTENT_STORAGE.order);
      sessionStorage.removeItem(CONTENT_STORAGE.returns);
      window.dispatchEvent(new CustomEvent('wow:bag-changed'));
      reportDevice('Sample basket, order and return selections cleared from this browser session. Your saved pieces have been kept.');
    } catch {reportDevice('Your browser did not allow the sample records to be removed. Use its site-data settings or close this browsing session.');}
  }));
}

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('js');
  setupHelp();
  setupContact();
  setupMeasurements();
  setupCareTabs();
  setupJournal();
  setupStorageControls();
}
