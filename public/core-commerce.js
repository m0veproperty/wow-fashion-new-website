export const CART_KEY = 'wow-commerce-preview-v1';
export const ORDER_KEY = 'wow-order-preview-v1';
export const RETURN_KEY = 'wow-return-preview-v1';
export const SAMPLE_UNIT_PRICE = 48;
export const SAMPLE_COLOURS = ['oat','sage','cocoa'];
export const SAMPLE_SIZES = ['XS','S','M','L','XL'];
const RETURN_REASONS = ['fit','colour','fault','other'];

function parsed(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

export function sanitizeCart(value) {
  const raw=parsed(value);
  const result={version:1,items:[],orderPreview:false};
  if (!raw || typeof raw!=='object' || Array.isArray(raw)) return result;
  const input=Array.isArray(raw.items)?raw.items:raw.colour?[raw]:[];
  for (const item of input.slice(0,150)) {
    if (!item || typeof item!=='object') continue;
    const colour=typeof item.colour==='string'?item.colour.toLowerCase():'';
    const size=item.size;
    const amount=Number(item.quantity);
    if (!SAMPLE_COLOURS.includes(colour) || !SAMPLE_SIZES.includes(size) || !Number.isInteger(amount) || amount<1) continue;
    const quantity=Math.min(10,amount);
    const existing=result.items.find(row=>row.colour===colour&&row.size===size);
    if (existing) existing.quantity=Math.min(10,existing.quantity+quantity);
    else result.items.push({colour,size,quantity});
  }
  result.orderPreview=raw.orderPreview===true&&result.items.length>0;
  return result;
}

export function addSampleItem(cart,item={colour:'oat',size:'M',quantity:1}) {
  const clean=sanitizeCart(cart);
  return sanitizeCart({...clean,items:[...clean.items,item],orderPreview:false});
}

export function changeSampleItem(cart,key,changes) {
  const clean=sanitizeCart(cart);
  return sanitizeCart({...clean,orderPreview:false,items:clean.items.map(item=>`${item.colour}:${item.size}`===key?{...item,...changes}:item)});
}

export function removeSampleItem(cart,key) {
  const clean=sanitizeCart(cart);
  return {...clean,orderPreview:false,items:clean.items.filter(item=>`${item.colour}:${item.size}`!==key)};
}

export function sampleSubtotal(cart) {
  return sanitizeCart(cart).items.reduce((sum,item)=>sum+item.quantity*SAMPLE_UNIT_PRICE,0);
}

export function sanitizeOrder(value) {
  const raw=parsed(value);
  if (!raw || !Array.isArray(raw.items)) return null;
  const items=sanitizeCart(raw).items;
  return items.length?{version:1,items}:null;
}

export function sampleOrder(value) {
  return sanitizeOrder(value)||{version:1,items:[{colour:'oat',size:'M',quantity:1}]};
}

export function sanitizeReturn(value,order) {
  const raw=parsed(value);
  if (!raw || typeof raw!=='object' || Array.isArray(raw) || !RETURN_REASONS.includes(raw.reason) || !['refund','exchange'].includes(raw.resolution)) return null;
  let items=sanitizeCart({items:Array.isArray(raw.items)?raw.items:[{colour:'oat',size:'M',quantity:1}]}).items;
  if(order){
    const available=sampleOrder(order).items;
    items=items.flatMap(item=>{
      const original=available.find(row=>row.colour===item.colour&&row.size===item.size);
      return original?[{...item,quantity:Math.min(item.quantity,original.quantity)}]:[];
    });
  }
  if(!items.length)return null;
  return {version:1,items,reason:raw.reason,resolution:raw.resolution,...(raw.resolution==='exchange'?{exchangeSize:SAMPLE_SIZES.includes(raw.exchangeSize)?raw.exchangeSize:'L'}:{})};
}

export function validatePreviewDetails(values,{email=false,label=false}={}) {
  const text=key=>String(values[key]??'').trim();
  const errors={};
  for (const [key,name] of [['firstName','first name'],['lastName','last name'],['line1','address'],['city','town or city']]) {
    if (!text(key)) errors[key]=`Add a sample ${name}.`;
    else if (text(key).length>100) errors[key]=`Keep the ${name} under 100 characters.`;
  }
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(text('postcode'))) errors.postcode='Use a sample UK postcode, such as AB1 2CD.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text('email'))) errors.email='Use an email format, such as sample@example.invalid.';
  if (label && (!text('label') || text('label').length>40)) errors.label='Give this sample address a name of 1 to 40 characters.';
  return errors;
}

if (typeof document !== 'undefined') initializeCommerce();

function initializeCommerce() {
  const configNode=document.getElementById('commerce-page-data');
  if (!configNode) return;
  let config;
  try { config=JSON.parse(configNode.textContent); } catch { return; }
  const sample=config.sample;
  const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:sample.currency}).format(value);
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const say=message=>{if ($('#commerce-feedback')) $('#commerce-feedback').textContent=message;};
  let cart,order;
  let storageAvailable=true;
  function reloadPreviewState() {
    try {cart=sanitizeCart(sessionStorage.getItem(CART_KEY));order=sanitizeOrder(sessionStorage.getItem(ORDER_KEY));storageAvailable=true;}
    catch {cart=sanitizeCart(null);order=null;storageAvailable=false;}
  }
  reloadPreviewState();
  document.documentElement.classList.add('commerce-ready');

  const make=(tag,className,text)=>{
    const node=document.createElement(tag);
    if (className) node.className=className;
    if (text!==undefined) node.textContent=text;
    return node;
  };
  function saveCart(next) {
    cart=sanitizeCart(next);
    try {sessionStorage.setItem(CART_KEY,JSON.stringify(cart));storageAvailable=true;} catch {storageAvailable=false;}
    renderCart();
    window.dispatchEvent(new Event('wow:bag-changed'));
    if (!storageAvailable) say('The sample works on this page, but your browser is not allowing it to continue between pages.');
  }

  function sampleLine(item,compact=true) {
    const variant=sample.variants.find(v=>v.id===item.colour);
    const row=make('div',`cm-sample-line${compact?' cm-sample-line-compact':''}`);
    const photoLink=make('a');photoLink.href='/products/everyday-rib-cardigan/';photoLink.tabIndex=-1;photoLink.setAttribute('aria-hidden','true');
    const photo=make('img');photo.src=variant.image;photo.alt=variant.alt;photo.width=900;photo.height=1600;photo.loading='lazy';photoLink.append(photo);
    const content=make('div');
    content.append(make('p','eyebrow','Design sample'));
    const title=make('h3');const titleLink=make('a','',sample.name);titleLink.href='/products/everyday-rib-cardigan/';title.append(titleLink);
    content.append(title,make('p','',`${variant.name} / ${item.size} · Quantity ${item.quantity}`),make('strong','',money(item.quantity*sample.price)),make('small','','Example item subtotal'));
    row.append(photoLink,content);return row;
  }

  function bagLine(item) {
    const key=`${item.colour}:${item.size}`;
    const variant=sample.variants.find(v=>v.id===item.colour);
    const article=make('article','cm-bag-item');article.dataset.line=key;
    const photoLink=make('a','cm-bag-product-image');photoLink.href='/products/everyday-rib-cardigan/';
    const photo=make('img');photo.src=variant.image;photo.alt=variant.alt;photo.width=900;photo.height=1600;photoLink.append(photo);
    const content=make('div','cm-bag-product-copy');content.append(make('p','eyebrow','Design sample'));
    const h3=make('h3');const title=make('a','',sample.name);title.href='/products/everyday-rib-cardigan/';h3.append(title);content.append(h3);
    const price=make('p','cm-example-price',money(sample.price));price.append(make('small','','Example unit price'));content.append(price);
    const choices=make('div','cm-bag-options');
    for (const [field,label,options] of [['colour','Colour',sample.variants.map(v=>({value:v.id,label:v.name}))],['size','Size',sample.sizes.map(value=>({value,label:value}))]]) {
      const wrapper=make('label','field');wrapper.append(make('span','',label));const select=make('select');select.setAttribute('aria-label',`${label} for ${variant.name} size ${item.size}`);
      for (const option of options) {const node=make('option','',option.label);node.value=option.value;node.selected=option.value===item[field];select.append(node);}
      select.addEventListener('change',()=>{
        const nextValue=select.value;saveCart(changeSampleItem(cart,key,{[field]:nextValue}));
        const newColour=field==='colour'?nextValue:item.colour;const newSize=field==='size'?nextValue:item.size;
        document.querySelector(`[data-line="${newColour}:${newSize}"] select[aria-label^="${label}"]`)?.focus();
        say('The sample option has been updated.');
      });
      wrapper.append(select);choices.append(wrapper);
    }
    content.append(choices);
    const actions=make('div','cm-item-actions');const quantity=make('div','cm-quantity');quantity.setAttribute('aria-label',`Quantity of ${variant.name} size ${item.size}`);
    for (const direction of [-1,1]) {
      if (direction===1) {
        const input=make('input');input.type='number';input.min='1';input.max='10';input.inputMode='numeric';input.value=String(item.quantity);input.setAttribute('aria-label',`Quantity of ${variant.name} size ${item.size}`);
        input.addEventListener('change',()=>{
          const n=Number(input.value);
          if (!Number.isInteger(n)||n<1||n>10) {input.value=String(item.quantity);say('Choose a sample quantity from 1 to 10.');return;}
          saveCart(changeSampleItem(cart,key,{quantity:n}));document.querySelector(`[data-line="${key}"] input[type="number"]`)?.focus();say('Sample quantity updated.');
        });
        quantity.append(input);
      }
      const control=make('button','',direction===-1?'−':'+');control.type='button';control.disabled=direction===-1?item.quantity<=1:item.quantity>=10;control.setAttribute('aria-label',`${direction===-1?'Decrease':'Increase'} quantity of ${variant.name} size ${item.size}`);
      control.addEventListener('click',()=>{
        saveCart(changeSampleItem(cart,key,{quantity:item.quantity+direction}));
        const controls=document.querySelectorAll(`[data-line="${key}"] .cm-quantity button`);
        const target=controls[direction===-1?0:1];(target&&!target.disabled?target:document.querySelector(`[data-line="${key}"] input`))?.focus();say('Sample quantity updated.');
      });quantity.append(control);
    }
    const remove=make('button','cm-inline-button','Remove');remove.type='button';remove.setAttribute('aria-label',`Remove ${variant.name} size ${item.size}`);
    remove.addEventListener('click',()=>{saveCart(removeSampleItem(cart,key));say(`${variant.name} size ${item.size} removed from the sample bag.`);($('#bag-lines select')||$('[data-add-sample]'))?.focus();});
    actions.append(quantity,remove);content.append(actions);article.append(photoLink,content);return article;
  }

  function renderCart() {
    const count=cart.items.reduce((sum,item)=>sum+item.quantity,0);
    $$('[data-cart-subtotal]').forEach(node=>node.textContent=money(sampleSubtotal(cart)));
    $$('[data-bag-item-count]').forEach(node=>node.textContent=`${count} sample ${count===1?'piece':'pieces'}`);
    if ($('#sample-bag-empty')) $('#sample-bag-empty').hidden=count>0;
    if ($('#sample-bag-filled')) $('#sample-bag-filled').hidden=count===0;
    if ($('#bag-lines')) $('#bag-lines').replaceChildren(...cart.items.map(bagLine));
    $$('[data-cart-summary]').forEach(node=>node.replaceChildren(...cart.items.map(item=>sampleLine(item,true))));
    if ($('#checkout-empty')) $('#checkout-empty').hidden=count>0;
    if ($('#checkout-layout')) $('#checkout-layout').hidden=count===0;
  }
  function renderReturnItems(currentOrder) {
    const host=$('#return-item-options');if(!host)return;
    host.replaceChildren(...currentOrder.items.map(item=>{
      const variant=sample.variants.find(row=>row.id===item.colour);
      const key=`${item.colour}:${item.size}`,id=`return-item-${item.colour}-${item.size}`;
      const row=make('div','cm-return-option');
      const label=make('label','cm-return-product');label.htmlFor=id;
      const checkbox=make('input');checkbox.type='checkbox';checkbox.id=id;checkbox.checked=true;checkbox.defaultChecked=true;checkbox.dataset.returnKey=key;
      const details=make('span');const photo=make('img');photo.src=variant.image;photo.alt=variant.alt;photo.width=900;photo.height=1600;
      const copy=make('span');copy.append(make('strong','',sample.name),make('small','',`${variant.name} / ${item.size} · Ordered quantity ${item.quantity}`),make('small','',`${money(sample.price)} example unit price`));details.append(photo,copy);label.append(checkbox,details);
      const quantityLabel=make('label','field cm-return-quantity');quantityLabel.htmlFor=id+'-quantity';quantityLabel.append(make('span','','Quantity to include'));
      const quantity=make('select');quantity.id=id+'-quantity';quantity.dataset.returnQuantity=key;quantity.setAttribute('aria-label',`Quantity to return for ${variant.name} size ${item.size}`);
      for(let count=1;count<=item.quantity;count++){const option=make('option','',String(count));option.value=String(count);option.selected=count===item.quantity;option.defaultSelected=option.selected;quantity.append(option);}
      checkbox.addEventListener('change',()=>quantity.disabled=!checkbox.checked);
      quantityLabel.append(quantity);row.append(label,quantityLabel);return row;
    }));
  }
  function renderReturnSummary(currentOrder) {
    if(!$('[data-return-lines]'))return;
    let request=null;try{request=sanitizeReturn(sessionStorage.getItem(RETURN_KEY),currentOrder);}catch{}
    const selected=request?{version:1,items:request.items}:currentOrder;
    $('[data-return-lines]').replaceChildren(...selected.items.map(item=>sampleLine(item,true)));
    $('[data-return-subtotal]').textContent=money(sampleSubtotal(selected));
    const reasons={fit:'The fit isn’t quite right',colour:'The colour isn’t what I expected',fault:'There is a fault or damage',other:'Something else'};
    $('#return-summary-reason').textContent=request?reasons[request.reason]:'No preview reason selected yet';
    $('#return-summary-resolution').textContent=request?(request.resolution==='exchange'?`Exchange preview: size ${request.exchangeSize}`:'Refund request preview'):'No preview outcome selected yet';
  }
  function renderOrderViews() {
    const currentOrder=sampleOrder(order);
    $$('[data-order-lines]').forEach(node=>node.replaceChildren(...currentOrder.items.map(item=>sampleLine(item,node.dataset.orderCompact==='true'))));
    $$('[data-order-subtotal]').forEach(node=>node.textContent=money(sampleSubtotal(currentOrder)));
    $$('[data-order-source]').forEach(node=>node.textContent=order?'Your sample checkout selection is shown here. Delivery stages and addresses are illustrative.':'A standalone sample order. Complete the sample checkout to view your selected pieces here.');
    renderReturnItems(currentOrder);
    renderReturnSummary(currentOrder);
  }
  renderCart();
  renderOrderViews();
  $$('[data-add-sample]').forEach(control=>control.addEventListener('click',()=>{saveCart(addSampleItem(cart));say('The sample Oat cardigan in size M has been added.');($('#bag-lines select')||$('#checkout-email'))?.focus();}));

  function showFieldErrors(map,errors) {
    for (const [key,id] of Object.entries(map)) {
      const node=document.getElementById(id), message=document.getElementById(id+'-error');
      if (message) message.textContent=errors[key]||'';
      node?.setAttribute('aria-invalid',String(Boolean(errors[key])));
    }
    const first=Object.keys(errors)[0];if (first) document.getElementById(map[first])?.focus();
  }
  function valuesFor(map) {return Object.fromEntries(Object.entries(map).map(([name,id])=>[name,document.getElementById(id)?.value||'']));}
  function setFeedback(id,message) {const node=document.getElementById(id);if(node)node.textContent=message;}

  let resetCheckout=()=>{};
  if ($('[data-commerce-page="checkout"]')) {
    const map={firstName:'checkout-first',lastName:'checkout-last',line1:'checkout-address',city:'checkout-city',postcode:'checkout-postcode',email:'checkout-email'};
    let activeStep=0;
    $('#preview-checkout-form').addEventListener('submit',event=>event.preventDefault());
    const setStep=step=>{
      activeStep=step;
      $$('[data-checkout-step]').forEach(node=>node.hidden=Number(node.dataset.checkoutStep)!==step);
      $$('[data-checkout-step-label]').forEach(node=>{
        if(Number(node.dataset.checkoutStepLabel)===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
      });
      const panel=document.querySelector(`[data-checkout-step="${step}"]`);panel.tabIndex=-1;panel.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:'instant'});
      if(step===2){const v=valuesFor(map);$('#checkout-address-review').textContent=`${v.firstName} ${v.lastName}\n${v.line1}\n${v.city}\n${v.postcode}\n${v.email}`;}
    };
    $$('[data-checkout-next]').forEach(control=>control.addEventListener('click',()=>{
      const errors=validatePreviewDetails(valuesFor(map),{email:true});showFieldErrors(map,errors);
      if(Object.keys(errors).length){if(activeStep!==0)setStep(0);setFeedback('checkout-error','Check the highlighted sample details.');return;}
      setFeedback('checkout-error','');setStep(Number(control.dataset.checkoutNext));
    }));
    $$('[data-checkout-back]').forEach(control=>control.addEventListener('click',()=>setStep(Number(control.dataset.checkoutBack))));
    $('[data-reset-checkout]').addEventListener('click',()=>{$('#preview-checkout-form').reset();showFieldErrors(map,{});setFeedback('checkout-error','Sample details restored.');});
    $('#preview-place-order').addEventListener('click',()=>{
      if(!cart.items.length){setFeedback('checkout-error','Add the sample cardigan before continuing.');return;}
      if(!$('#preview-checkout-understood').checked){setFeedback('checkout-consent-error','Confirm that you understand this is a sample.');$('#preview-checkout-understood').focus();return;}
      const snapshot=sanitizeOrder(cart);
      try {sessionStorage.setItem(ORDER_KEY,JSON.stringify(snapshot));sessionStorage.removeItem(RETURN_KEY);}
      catch {setFeedback('checkout-consent-error','Your browser is not allowing this sample to continue between pages. Allow session storage to preview the same order on the next screen.');return;}
      order=snapshot;setFeedback('checkout-consent-error','');saveCart({...cart,orderPreview:true});$('#preview-checkout-form').reset();location.assign('/order-confirmation/');
    });
    resetCheckout=()=>{
      activeStep=0;
      $('#checkout-address-review').textContent='';
      $$('[data-checkout-step]').forEach(node=>node.hidden=Number(node.dataset.checkoutStep)!==0);
      $$('[data-checkout-step-label]').forEach(node=>{if(node.dataset.checkoutStepLabel==='0')node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
      showFieldErrors(map,{});
    };
  }

  if ($('[data-commerce-page="recovery"]')) {
    $$('[data-recovery-preview]').forEach(control=>control.addEventListener('click',()=>{$('#recovery-preview').hidden=false;$('#recovery-expired').hidden=true;$('#recovery-preview').focus();}));
    $('[data-recovery-expired]').addEventListener('click',()=>{$('#recovery-preview').hidden=true;$('#recovery-expired').hidden=false;$('#recovery-expired').focus();});
  }
  if ($('#order-status-filter')) $('#order-status-filter').addEventListener('change',event=>{
    const show=event.target.value!=='progress';$('#sample-order-card').hidden=!show;$('#orders-empty').hidden=show;$('#order-results-count').textContent=show?'1 sample order':'No sample orders in progress';
  });

  let resetAddresses=()=>{};
  if ($('[data-commerce-page="addresses"]')) {
    const initial=[{id:'home',label:'Home',firstName:'Sample',lastName:'Shopper',line1:'12 Example Lane',city:'Exampletown',postcode:'AB1 2CD',default:true},{id:'other',label:'Another place',firstName:'Sample',lastName:'Shopper',line1:'24 Sample Street',city:'Exampletown',postcode:'AB1 3CD',default:false}];
    let addresses=initial.map(item=>({...item})),editing=null,removed=null,serial=0,returnFocus=null;
    const map={label:'address-label',firstName:'address-first',lastName:'address-last',line1:'address-line',city:'address-city',postcode:'address-postcode'};
    const dialog=$('#address-dialog');
    function renderAddresses() {
      const host=$('#address-list');host.replaceChildren();
      if(!addresses.length){const empty=make('div','cm-empty-panel');empty.append(make('h3','','A fresh address book.'),make('p','','Add a fictional address to try the layout.'));host.append(empty);return;}
      for(const item of addresses){
        const card=make('article','cm-address-card');if(item.default)card.append(make('span','cm-status','Default sample'));
        card.append(make('h3','',item.label),make('p','',`${item.firstName} ${item.lastName}\n${item.line1}\n${item.city}\n${item.postcode}`));
        const actions=make('div','cm-address-actions');
        const edit=make('button','cm-inline-button','Edit');edit.type='button';edit.setAttribute('aria-label',`Edit ${item.label} sample address`);edit.addEventListener('click',()=>openAddress(item,edit));
        const remove=make('button','cm-inline-button','Remove');remove.type='button';remove.setAttribute('aria-label',`Remove ${item.label} sample address`);remove.addEventListener('click',()=>{
          removed={...item};addresses=addresses.filter(row=>row.id!==item.id);if(item.default&&addresses[0])addresses[0].default=true;renderAddresses();$('#address-undo').hidden=false;say('Sample address removed. You can undo this.');$('[data-undo-address]').focus();
        });actions.append(edit,remove);
        if(!item.default){const use=make('button','cm-inline-button','Make default');use.type='button';use.addEventListener('click',()=>{addresses.forEach(row=>row.default=row.id===item.id);renderAddresses();say(`${item.label} is the default in this preview.`);$('[data-add-address]').focus();});actions.append(use);}
        card.append(actions);host.append(card);
      }
    }
    function openAddress(item,trigger) {
      editing=item?.id||null;returnFocus=trigger;$('#address-dialog-title').textContent=item?'A little update.':'A new place.';
      const values=item||{label:'Another place',firstName:'Sample',lastName:'Shopper',line1:'36 Sample Road',city:'Exampletown',postcode:'AB1 4CD'};
      for(const [name,id] of Object.entries(map))document.getElementById(id).value=values[name];
      $('#address-default').checked=Boolean(item?.default);showFieldErrors(map,{});setFeedback('address-error','');dialog.showModal();$('#address-label').focus();
    }
    $('[data-add-address]').addEventListener('click',event=>openAddress(null,event.currentTarget));
    $$('[data-close-address]').forEach(control=>control.addEventListener('click',()=>dialog.close()));
    dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();else $('[data-add-address]').focus();});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
    $('#address-form').addEventListener('submit',event=>event.preventDefault());
    $('[data-save-address]').addEventListener('click',()=>{
      const values=valuesFor(map),errors=validatePreviewDetails(values,{label:true});showFieldErrors(map,errors);
      if(Object.keys(errors).length){setFeedback('address-error','Check the highlighted sample details.');return;}
      const makeDefault=$('#address-default').checked||addresses.length===0;
      const item={id:editing||'sample-'+(++serial),...Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value.trim()])),default:makeDefault};
      if(makeDefault)addresses.forEach(row=>row.default=false);
      if(editing)addresses=addresses.map(row=>row.id===editing?item:row);else addresses.push(item);
      if(addresses.length&&!addresses.some(row=>row.default))addresses[0].default=true;
      renderAddresses();dialog.close();say('Address updated in this page preview only.');
    });
    $('[data-undo-address]').addEventListener('click',()=>{if(removed){if(removed.default)addresses.forEach(row=>row.default=false);addresses.push(removed);removed=null;renderAddresses();}$('#address-undo').hidden=true;say('Sample address restored.');$('[data-add-address]').focus();});
    resetAddresses=()=>{addresses=initial.map(item=>({...item}));removed=null;editing=null;if(dialog.open)dialog.close();returnFocus=null;renderAddresses();$('#address-undo').hidden=true;};
    renderAddresses();
  }

  if ($('[data-commerce-page="preferences"]')) {
    $('#account-preferences-form').addEventListener('submit',event=>event.preventDefault());
    $('[data-save-preferences]').addEventListener('click',()=>{
      const first=$('#preference-first'),last=$('#preference-last');
      if(!first.value.trim()||!last.value.trim()){say('Add a sample first and last name.');(!first.value.trim()?first:last).focus();return;}
      say('Preview updated. No customer profile or marketing preferences have been changed.');
    });
  }
  if ($('[data-commerce-page="tracking"]')) {
    $('[data-show-tracking]').addEventListener('click',()=>{$('#tracking-result').hidden=false;$('#tracking-intro').hidden=true;$('#tracking-result').focus();say('Showing a fictional delivery example.');});
    $('[data-toggle-tracking]').addEventListener('click',event=>{
      const unavailable=$('#tracking-unavailable').hidden;$('#tracking-unavailable').hidden=!unavailable;$('#tracking-ready').hidden=unavailable;
      event.currentTarget.textContent=unavailable?'View the delivered example':'View tracking-not-ready example';
      const badge=$('#tracking-result .cm-status');badge.textContent=unavailable?'Tracking pending · example':'Delivered · example';
    });
  }
  function resetReturnControls() {
    if(!$('[data-commerce-page="return-start"]'))return;
    $('#return-exchange-options').hidden=$('[name="return-resolution"]:checked').value!=='exchange';
    for(const id of ['return-item-error','return-reason-error','return-understood-error'])setFeedback(id,'');
    $$('[data-return-key]').forEach(input=>{
      const quantity=document.querySelector(`[data-return-quantity="${input.dataset.returnKey}"]`);
      if(quantity)quantity.disabled=!input.checked;
    });
  }
  if ($('[data-commerce-page="return-start"]')) {
    $('#return-preview-form').addEventListener('submit',event=>event.preventDefault());
    $$('[name="return-resolution"]').forEach(control=>control.addEventListener('change',()=>$('#return-exchange-options').hidden=$('[name="return-resolution"]:checked').value!=='exchange'));
    $('[data-submit-return]').addEventListener('click',()=>{
      const items=$$('[data-return-key]:checked').map(input=>{
        const [colour,size]=input.dataset.returnKey.split(':');
        return {colour,size,quantity:Number(document.querySelector(`[data-return-quantity="${input.dataset.returnKey}"]`).value)};
      });
      const reason=$('#return-reason').value,understood=$('#return-understood').checked;
      setFeedback('return-item-error',items.length?'':'Select a sample item to continue.');setFeedback('return-reason-error',RETURN_REASONS.includes(reason)?'':'Choose a reason for this sample request.');setFeedback('return-understood-error',understood?'':'Confirm that you understand this is a preview.');
      if(!items.length){$('[data-return-key]').focus();return;}if(!RETURN_REASONS.includes(reason)){$('#return-reason').focus();return;}if(!understood){$('#return-understood').focus();return;}
      const result=sanitizeReturn({items,reason,resolution:$('[name="return-resolution"]:checked').value,exchangeSize:$('#return-exchange-size').value},sampleOrder(order));
      if(!result){setFeedback('return-item-error','Select a piece and quantity from the sample order.');return;}
      try {sessionStorage.setItem(RETURN_KEY,JSON.stringify(result));} catch {setFeedback('return-understood-error','Allow session storage to carry this sample selection to the status page.');return;}
      location.assign('/returns/status/?preview=1');
    });
  }
  if ($('[data-service-retry]')) $('[data-service-retry]').addEventListener('click',()=>location.reload());
  if ($('[data-commerce-page="newsletter"]')) {
    $('[data-newsletter-preview]').addEventListener('click',()=>{$('#newsletter-signup').hidden=true;$('#newsletter-confirmation').hidden=false;$('#newsletter-confirmation').focus();});
    $('[data-newsletter-reset]').addEventListener('click',()=>{$('#newsletter-signup').hidden=false;$('#newsletter-confirmation').hidden=true;$('[data-newsletter-preview]').focus();});
  }
  if ($('[data-commerce-page="email-preferences"]')) {
    $('#email-preferences-form').addEventListener('submit',event=>event.preventDefault());
    const options=['email-style','email-collections','email-offers'].map(id=>document.getElementById(id));
    $('#email-unsubscribe-all').addEventListener('change',event=>{if(event.target.checked)options.forEach(input=>input.checked=false);});
    options.forEach(input=>input.addEventListener('change',()=>{if(input.checked)$('#email-unsubscribe-all').checked=false;}));
    $('[data-save-email-preferences]').addEventListener('click',()=>say($('#email-unsubscribe-all').checked?'Preview: all marketing switched off. No live subscription has been changed.':'Preference confirmation preview. No live email choices have been changed.'));
  }
  if ($('[data-commerce-page="gift-cards"]')) {
    $$('[name="gift-example-amount"]').forEach(input=>input.addEventListener('change',()=>{if(input.checked)$('#gift-preview-value').textContent='£'+input.value;}));
    $('#gift-example-message').addEventListener('input',event=>$('#gift-preview-message').textContent=event.target.value.trim()||'A little something, just for you.');
  }
  if ($('[data-commerce-page="rewards"]')) {
    $$('[data-reward-tab]').forEach(control=>control.addEventListener('click',()=>{$$('[data-reward-tab]').forEach(node=>node.setAttribute('aria-pressed',String(node===control)));$$('[data-reward-panel]').forEach(node=>node.hidden=node.dataset.rewardPanel!==control.dataset.rewardTab);}));
  }

  window.addEventListener('pagehide',()=>{
    $$('form').forEach(form=>form.reset());
    $$('input:not([readonly]),textarea').forEach(input=>{if(['text','email','password'].includes(input.type)||input.tagName==='TEXTAREA')input.value=input.defaultValue;});
    say('');
    resetCheckout();
    resetAddresses();
    resetReturnControls();
    if($('#gift-preview-message'))$('#gift-preview-message').textContent=$('#gift-example-message').defaultValue||'A little something, just for you.';
  });
  window.addEventListener('pageshow',()=>{
    reloadPreviewState();renderCart();renderOrderViews();resetReturnControls();
    window.dispatchEvent(new Event('wow:bag-changed'));
  });
}
