import {readFileSync} from 'node:fs';

const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const taxonomy = readJson('portal/public/data/taxonomy.json');
const buildStatus = readJson('portal/public/data/build-status.json');
const campaigns = readJson('data/campaign-heroes.json');
const sentenceCase = value => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

// These are shopping groups, not a second collection taxonomy. Collection names
// and destinations come from the same source files used to build the pages.
const departmentDefinitions = [
  {
    id:'dresses', label:'Dresses', source:'data/dresses.json',
    groups:[
      ['Everyday & occasion', ['casual-dresses','work-dresses','club-dresses','cocktail-and-evening-dresses','wedding-guest-dresses']],
      ['Length & shape', ['short-dresses','tea-length-dresses','long-dresses','maxi-dresses','two-piece-dresses']],
      ['Print & season', ['boho-dresses','floral-dresses','sequin-dresses','spring-dresses','summer-dresses','winter-dresses']]
    ]
  },
  {
    id:'blouses', label:'Blouses', source:'data/collections.json',
    groups:[
      ['Fabrics', ['cotton-blouses','chiffon-blouses','silk-blouses','satin-blouses','lace-blouses','denim-blouses']],
      ['Shapes & details', ['long-sleeved-blouses','short-sleeved-blouses','peasant-blouses','pussy-bow-blouse','ruffled-blouses']],
      ['Everyday & occasion', [{filter:'shop-2748',label:'Casual blouses'},'work-and-formal-blouses','dressy-blouses','summer-blouses',{filter:'shop-2747',label:'T-shirts'}]]
    ]
  },
  {
    id:'cardigans', label:'Cardigans', source:'data/cardigans.json',
    groups:[
      ['Shapes & details', ['long-cardigans','cropped-dressy-cardigans','cardigan-vests','kimono-cardigans','hooded-cardigans','zipped-cardigans','short-sleeved-cardigans']],
      ['Fabric & print', ['cashmere-cardigans','wool-cardigans','silk-cardigans','lace-cardigans','animal-print-cardigans']],
      ['Light & warm layers', ['lightweight-cardigans','summer-spring-cardigans','warm-cardigans']]
    ]
  },
  {
    id:'coats-and-jackets', label:'Coats & jackets', source:'data/outerwear.json',
    groups:[
      ['Coats', ['trench-coats','casual-coats','long-parka-coat','work-and-pea-coats','down-coats','winter-coats']],
      ['Jackets', ['bomber-jackets','jean-and-denim-jackets','leather-jackets','military-and-cargo-jackets','quilted-jackets','rain-jackets']],
      ['Season & texture', ['light-jackets','spring-jackets','fall-jackets','linen-jackets','fleece-jackets','faux-fur-coats']]
    ]
  },
  {
    id:'pants', label:'Pants & leggings', source:'data/pants.json',
    groups:[
      ['Jeans & shorts', ['jeans','skinny-jeans','high-waisted-jeans','boyfriend-jeans','bootcut-jeans','cropped-jeans','ripped-jeans','denim-shorts','shorts','short-pants']],
      ['Trousers', ['wide-leg-pants','casual-pants','work-pants','high-waisted-pants','cropped-pants','flared-pants','skinny-pants','cargo-khaki-pants','linen-pants','corduroy-pants','leather-pants','harem-pants']],
      ['Leggings & joggers', ['black-leggings','high-waisted-leggings','capri-leggings','colored-patterned-leggings','fleece-lined-thermal-leggings','velvet-leggings','joggers']]
    ]
  },
  {
    id:'skirts', label:'Skirts', source:'data/skirts.json',
    groups:[
      ['Length & shape', ['short-skirts','knee-length-skirt','long-skirts','a-line-skirts','high-waisted-skirts']],
      ['Details & texture', ['pleated-skirts','wrap-skirts','slit-skirts','denim-skirts','corduroy-skirts','leather-skirts','suede-skirts']],
      ['Everyday & occasion', ['casual-skirts','gypsy-skirts','summer-and-beach-skirts','work-and-business-skirts']]
    ]
  },
  {
    id:'sweaters', label:'Sweaters', source:'data/sweaters.json',
    groups:[
      ['Fit & details', ['cropped-sweaters','long-sweaters','oversized-and-baggy-sweaters','tunic-sweaters','off-the-shoulder-sweaters','turtle-neck-sweaters']],
      ['Fabric & layers', ['cashmere-sweaters','cotton-sweaters','wool-and-knitted-sweaters','cardigan-sweaters']],
      ['By season', ['spring-sweaters','summer-sweaters','fall-sweaters','winter-sweaters']]
    ]
  }
];

const labelOverrides = {
  'long-sleeved-blouses':'Long-sleeved blouses',
  'short-sleeved-blouses':'Short-sleeved blouses',
  'work-and-formal-blouses':'Work & formal blouses',
  'short-sleeved-cardigans':'Short-sleeved cardigans',
  'cropped-dressy-cardigans':'Cropped & dressy cardigans',
  'summer-spring-cardigans':'Spring & summer cardigans',
  'jean-and-denim-jackets':'Denim jackets',
  'military-and-cargo-jackets':'Military & cargo jackets',
  'work-and-pea-coats':'Work & pea coats',
  'cargo-khaki-pants':'Cargo & khaki pants',
  'colored-patterned-leggings':'Coloured & patterned leggings',
  'fleece-lined-thermal-leggings':'Fleece-lined & thermal leggings',
  'high-waisted-jeans':'High-waisted jeans',
  'high-waisted-leggings':'High-waisted leggings',
  'high-waisted-pants':'High-waisted pants',
  'high-waisted-skirts':'High-waisted skirts',
  'knee-length-skirt':'Knee-length skirts',
  'tea-length-dresses':'Tea-length dresses',
  'two-piece-dresses':'Two-piece dresses',
  'off-the-shoulder-sweaters':'Off-the-shoulder sweaters',
  'turtle-neck-sweaters':'Turtleneck sweaters'
};

const departmentSources = departmentDefinitions.map(definition => {
  const source = readJson(definition.source);
  return {...definition, collections:Array.isArray(source) ? source : source.collections};
});

function mappedLink(id, label) {
  const row = taxonomy.rows.find(row => row.id === id && ['shop','editorial'].includes(row.system));
  if (!row) throw new Error('Unknown navigation map entry: ' + id);
  const built = buildStatus.pages[id];
  const href = built?.pageBuilt === 'Yes' && built.previewUrl
    ? new URL(built.previewUrl).pathname
    : '/shop/?collection=' + id;
  return {label:label || sentenceCase(row.name), href};
}

export const navigationDepartments = departmentSources.map(department => {
  const bySlug = new Map(department.collections.map(collection => [collection.slug, collection]));
  const included = new Set();
  const href = '/' + department.id + '/';
  const groups = department.groups.map(([label, items]) => ({
    label,
    links:items.map(item => {
      if (typeof item !== 'string') return mappedLink(item.filter, item.label);
      const collection = bySlug.get(item);
      if (!collection) throw new Error('Unknown navigation collection: ' + department.id + '/' + item);
      if (included.has(item)) throw new Error('Duplicate navigation collection: ' + department.id + '/' + item);
      included.add(item);
      return {label:labelOverrides[item] || sentenceCase(collection.name), href:href + item + '/'};
    })
  }));
  const missing = department.collections.filter(collection => !included.has(collection.slug));
  if (missing.length) throw new Error('Collections missing from navigation: ' + missing.map(collection => href + collection.slug + '/').join(', '));
  const image = campaigns[href]?.src || (department.id === 'dresses' ? '/dresses/assets/hero-poster.webp' : '');
  if (!image) throw new Error('Missing navigation campaign image: ' + department.id);
  return {id:department.id, label:department.label, href, image, groups};
});

export const navigationEdits = [
  {label:'Shop all', href:'/shop/'},
  {label:'New arrivals', href:'/new-arrivals/'},
  {label:'Bestsellers', href:'/bestsellers/'},
  {label:'Sale & offers', href:'/sale/'},
  mappedLink('shop-2755', 'Outfits & sets'),
  mappedLink('shop-2746', 'Plus size'),
  mappedLink('shop-15', 'Fashion edit'),
  {label:'Browse every collection', href:'/shop/#wardrobe-directory'},
  {label:'Style journal', href:'/journal/'},
  {label:'About WOW Fashion', href:'/about/'}
];

export const navigationHelp = [
  {label:'Help & FAQs', href:'/help/'},
  {label:'Contact us', href:'/contact/'},
  {label:'Delivery', href:'/delivery/'},
  {label:'Returns & exchanges', href:'/returns/'},
  {label:'Track an order', href:'/track-order/'},
  {label:'Size guide', href:'/size-guide/'},
  {label:'Care guide', href:'/care-guide/'}
];

// Derive the expected inventory directly from the build sources, independently
// of the menu groups, so coverage tests need not repeat a hand-maintained list.
export const navigationInventory = {
  departmentPaths:departmentSources.map(department => '/' + department.id + '/'),
  subcategoryPaths:departmentSources.flatMap(department => department.collections.map(collection => '/' + department.id + '/' + collection.slug + '/')),
  mapFilterPaths:['shop-2748','shop-2747','shop-2755','shop-2746','shop-15'].map(id => mappedLink(id).href),
  sourceFiles:departmentDefinitions.map(department => department.source)
};
