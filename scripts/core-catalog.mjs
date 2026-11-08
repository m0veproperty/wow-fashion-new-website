import {readFileSync} from 'node:fs';

const sourceTaxonomy = JSON.parse(readFileSync(new URL('../portal/public/data/taxonomy.json', import.meta.url), 'utf8'));
const sourceBuildStatus = JSON.parse(readFileSync(new URL('../portal/public/data/build-status.json', import.meta.url), 'utf8'));
const departmentOrder = ['dresses', 'blouses', 'cardigans', 'coats-and-jackets', 'pants', 'skirts', 'sweaters'];
const featuredIds = ['blouses-31', 'cardigans-6', 'dresses-20', 'pants-95', 'skirts-34', 'sweaters-2', 'dresses-31', 'coats-and-jackets-15'];
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

function sourceKey(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'wowfashion.com') throw new Error('Unsupported catalogue source: ' + value);
  return url.origin + url.pathname.replace(/\/+$/, '') + '/';
}

function hrefFor(department, product) {
  if (department === 'cardigans' && [6, 45, 29, 20].includes(product.id)) return '/products/' + new URL(product.url).pathname.split('/').filter(Boolean)[0] + '/';
  return sourceKey(product.url);
}

function unique(values) { return [...new Set(values)]; }

/** Build one catalogue from the actual collection selections and the portal map.
 * Prices, dates, stock and sales rankings are deliberately unknown unless a
 * future verified feed supplies them. Map-only terms are browse filters, not
 * invented replacement category URLs.
 */
export function buildCatalog({departments, campaignHeroes = {}, taxonomy = sourceTaxonomy, buildStatus = sourceBuildStatus}) {
  if (!Array.isArray(departments) || !departments.length) throw new Error('The catalogue needs the built departments.');
  const raw = departments.flatMap(department => department.products.filter(product => !product.url.includes('__trashed')).map(product => ({...product, recordId:`${department.slug}-${product.id}`, department:department.slug, departmentName:department.parent.name})));
  const idAliases = {};
  const productsBySource = new Map();
  for (const product of raw) {
    const sourceUrl = sourceKey(product.url);
    const existing = productsBySource.get(sourceUrl);
    if (existing) {
      idAliases[product.recordId] = existing.id;
      existing.aliases.push(product.recordId);
      existing.departments = unique([...existing.departments, product.department]);
      existing.sourceCategories = unique([...existing.sourceCategories, ...product.categories]);
      continue;
    }
    productsBySource.set(sourceUrl, {
      id:product.recordId,
      name:product.name,
      href:hrefFor(product.department, product),
      sourceUrl,
      image:`/assets/${product.department}/${product.id}.webp`,
      department:product.department,
      departments:[product.department],
      category:product.departmentName,
      sourceCategories:unique(product.categories),
      aliases:[],
      collectionPaths:[],
      collectionKeys:[],
      price:null,
      priceLabel:'View current price'
    });
  }
  const canonicalId = id => idAliases[id] || id;
  const products = [...productsBySource.values()];
  const productById = new Map(products.map(product => [product.id, product]));
  const collectionByPath = new Map();

  for (const department of departments) {
    const available = raw.filter(product => product.department === department.slug);
    for (const [collection, isParent] of [[department.parent, true], ...department.collections.map(collection => [collection, false])]) {
      const path = `/${department.slug}/${isParent ? '' : collection.slug + '/'}`;
      if (collectionByPath.has(path)) throw new Error('Duplicate built collection path: ' + path);
      const members = isParent ? available : Array.isArray(collection.ids) ? available.filter(product => collection.ids.includes(product.id)) : available.filter(product => product.categories.includes(collection.match));
      const campaign = campaignHeroes[path];
      const image = campaign?.src || (path === '/dresses/' ? '/dresses/assets/hero-poster.webp' : path === '/dresses/club-dresses/' ? '/dresses/club-dresses/assets/hero-poster.jpg' : `/assets/${department.slug}/${collection.hero}.webp`);
      collectionByPath.set(path, {
        id:path,
        key:path,
        name:collection.name,
        path,
        department:department.slug,
        parentPath:isParent ? '' : `/${department.slug}/`,
        isParent,
        kind:'collection',
        image,
        imagePosition:campaign?.position || '75% 42%',
        description:isParent ? `Explore the ${department.parent.name.toLowerCase()} collection.` : collection.description || '',
        sourceIds:[],
        aliases:[],
        productIds:unique(members.map(product => canonicalId(product.recordId)))
      });
    }
  }

  const shoppingRows = taxonomy.rows.filter(row => row.system === 'editorial' || row.system === 'shop');
  const mapAssignments = [];
  const unmatched = [];
  for (const row of shoppingRows) {
    const record = buildStatus.pages[row.id];
    if (record?.pageBuilt === 'Yes' && record.previewUrl) {
      const path = new URL(record.previewUrl).pathname;
      const collection = collectionByPath.get(path);
      if (!collection) throw new Error(`The map points ${row.id} to an unknown collection: ${path}`);
      collection.sourceIds.push(row.id);
      if (row.name !== collection.name) collection.aliases.push(row.name);
      mapAssignments.push({sourceId:row.id, sourceName:row.name, system:row.system, sourcePath:row.path, path, kind:'collection'});
    } else unmatched.push(row);
  }

  const departmentForRoot = row => {
    const mapped = buildStatus.pages[row.rootId];
    if (!mapped?.previewUrl) return '';
    return collectionByPath.get(new URL(mapped.previewUrl).pathname)?.department || '';
  };
  const tag = (product, name) => product.sourceCategories.some(category => normalize(category) === normalize(name));
  const mapOnly = unmatched.map(row => {
    const isPlusChild = row.parentId === 'shop-2746';
    const name = isPlusChild ? `Plus size ${row.name.toLowerCase()}` : row.name;
    const descendants = unmatched.filter(candidate => candidate.rootId === row.id && candidate.id !== row.id);
    const members = products.filter(product => {
      if (isPlusChild) {
        if (!tag(product, 'Plus size')) return false;
        if (row.id === 'shop-2763') return product.departments.includes('blouses');
        if (row.id === 'shop-2761') return product.departments.includes('dresses');
        return tag(product, 'Outfits') || tag(product, 'Outfits & Sets');
      }
      return tag(product, row.name) || (!row.parentId && descendants.some(child => !['Blouses', 'Dresses', 'Outfits'].includes(child.name) && tag(product, child.name)));
    });
    const path = `/shop/?collection=${row.id}`;
    const collection = {
      id:row.id,
      key:row.id,
      name,
      sourceName:row.name,
      path,
      department:departmentForRoot(row),
      parentPath:row.parentId ? (buildStatus.pages[row.parentId]?.previewUrl ? new URL(buildStatus.pages[row.parentId].previewUrl).pathname : `/shop/?collection=${row.parentId}`) : '',
      isParent:!row.parentId,
      kind:'mapped-filter',
      image:members[0]?.image || '',
      imagePosition:'center',
      description:`Browse the ${name.toLowerCase()} styles in this catalogue.`,
      sourceIds:[row.id],
      aliases:isPlusChild ? [row.name, row.rootName] : [],
      productIds:members.map(product => product.id)
    };
    mapAssignments.push({sourceId:row.id, sourceName:row.name, system:row.system, sourcePath:row.path, path, kind:'mapped-filter'});
    return collection;
  });
  const collections = [...collectionByPath.values(), ...mapOnly];
  for (const collection of collections) {
    collection.aliases = unique(collection.aliases);
    collection.count = collection.productIds.length;
    for (const id of collection.productIds) {
      const product = productById.get(id);
      if (!product) throw new Error(`Collection ${collection.name} references a missing product ${id}`);
      product.collectionPaths.push(collection.path);
      product.collectionKeys.push(collection.key);
    }
  }
  const departmentSummaries = [...departments].sort((a, b) => departmentOrder.indexOf(a.slug) - departmentOrder.indexOf(b.slug)).map(department => {
    const parent = collectionByPath.get(`/${department.slug}/`);
    return {
      id:department.slug,
      slug:department.slug,
      name:department.parent.name,
      path:parent.path,
      image:parent.image,
      imagePosition:parent.imagePosition,
      count:parent.count,
      children:collections.filter(collection => collection.parentPath === parent.path).sort((a, b) => a.name.localeCompare(b.name, 'en'))
    };
  });
  const extraGroups = mapOnly.filter(collection => collection.isParent).map(collection => ({...collection, children:mapOnly.filter(child => child.parentPath === collection.path)}));

  // The first row is an editorial selection. The rest alternates departments
  // so the all-products view is not dominated by one alphabetical category.
  const orderedIds = featuredIds.filter(id => productById.has(id));
  const lists = departmentSummaries.map(department => products.filter(product => product.department === department.id).map(product => product.id));
  const max = Math.max(...lists.map(list => list.length));
  for (let index = 0; index < max; index++) for (const list of lists) if (list[index]) orderedIds.push(list[index]);
  const order = new Map(unique(orderedIds).map((id, index) => [id, index]));
  products.sort((a, b) => order.get(a.id) - order.get(b.id));
  products.forEach((product, index) => { product.rank = index; });

  const mapAudit = {
    source:'portal/public/data/taxonomy.json and portal/public/data/build-status.json',
    auditedAt:taxonomy.auditedAt,
    shoppingRecords:shoppingRows.length,
    mappedRecords:mapAssignments.length,
    mappedToBuiltCollections:mapAssignments.filter(record => record.kind === 'collection').length,
    mappedToBrowseFilters:mapAssignments.filter(record => record.kind === 'mapped-filter').length,
    builtCollectionDestinations:collectionByPath.size,
    additionalBrowseFilters:mapOnly.length,
    primaryDepartments:departmentSummaries.length,
    additionalMapRoots:extraGroups.length,
    sourceProductRecords:departments.reduce((sum, department) => sum + department.products.length, 0),
    nonRetiredProductRecords:raw.length,
    uniqueProducts:products.length,
    duplicateRecords:Object.keys(idAliases).length,
    retiredRecordsExcluded:departments.reduce((sum, department) => sum + department.products.length, 0) - raw.length,
    blogTermsExcludedFromShopping:taxonomy.rows.filter(row => row.system === 'blog').length,
    emptyFilters:collections.filter(collection => !collection.count).map(collection => ({name:collection.name, path:collection.path})),
    notes:[
      'Every editorial and shop record in the website map resolves to a built collection or an explicit Shop All filter.',
      'Equivalent editorial and shop terms share their existing collection route.',
      'Repeated product URLs are combined across departments; alternate record IDs remain available as aliases.',
      'Collection membership follows explicit editorial IDs or the existing product category tags. Related alternatives on empty category pages are not treated as matches.',
      'The catalogue is the existing seven-department product snapshot. Product availability, current prices, arrival dates, sales rankings and promotions require a verified commerce feed.',
      'Plus-size child filters require an explicit Plus size source category as well as the matching department; shared category names alone are not enough.'
    ]
  };
  if (mapAssignments.length !== shoppingRows.length || new Set(mapAssignments.map(record => record.sourceId)).size !== shoppingRows.length) throw new Error('The shopping map is not fully accounted for.');
  return {schemaVersion:1, products, departments:departmentSummaries, collections, extraGroups, idAliases, mapAudit, mapAssignments};
}
