export function resolveVariant(product,id){return product.variants.find(v=>v.id===id)||product.variants[0];}
export function resolveImage(variant,index){return variant.images[((index%variant.images.length)+variant.images.length)%variant.images.length];}
export function validSize(product,size){return product.sizes.includes(size);}
