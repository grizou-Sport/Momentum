const MiB = 1024 * 1024;
export class FileValidationError extends Error {
  constructor(code, status = 422) { super(code); this.status = status; }
}
const reject = code => { throw new FileValidationError(code); };
const crc16 = bytes => {
  let crc = 0;
  for (const byte of bytes) { crc ^= byte; for (let bit=0;bit<8;bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1; }
  return crc;
};
export function validateFIT(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header=bytes[0], end=header+(bytes.length>=12?view.getUint32(4,true):0);
  if (![12,14].includes(header) || bytes.length<14 || String.fromCharCode(...bytes.slice(8,12))!=='.FIT' || end<=header || end+2!==bytes.length) reject('invalid_fit');
  if ((header===14 && view.getUint16(12,true)!==0 && crc16(bytes.subarray(0,header))!==0) || crc16(bytes)!==0) reject('invalid_fit_crc');
  const definitions=new Map();let offset=header,records=0;
  while(offset<end) {
    const record=bytes[offset++],compressed=Boolean(record&0x80),local=compressed?(record>>5)&3:record&15;
    if(!compressed && record&0x10) reject('invalid_fit_record');
    if(!compressed && record&0x40) {
      if(offset+5>end || bytes[offset]!==0 || bytes[offset+1]>1) reject('invalid_fit_definition');
      const count=bytes[offset+4];offset+=5;let size=0,timestamp=0;
      if(offset+count*3>end)reject('invalid_fit_definition');
      for(let i=0;i<count;i++,offset+=3){if(bytes[offset+1]===0)reject('invalid_fit_definition');size+=bytes[offset+1];if(bytes[offset]===253&&bytes[offset+1]===4)timestamp=4;}
      if(record&0x20){if(offset>=end)reject('invalid_fit_definition');const developers=bytes[offset++];if(offset+developers*3>end)reject('invalid_fit_definition');for(let i=0;i<developers;i++,offset+=3){if(!bytes[offset+1])reject('invalid_fit_definition');size+=bytes[offset+1];}}
      if(!size)reject('invalid_fit_definition');definitions.set(local,{size,timestamp});
    } else {
      const definition=definitions.get(local);if(!definition)reject('invalid_fit_record');
      offset+=definition.size-(compressed?definition.timestamp:0);if(offset>end)reject('invalid_fit_record');records++;
    }
  }
  if(!records)reject('invalid_fit_record');
}
function xmlDocument(bytes,DOMParser) {
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{reject('invalid_xml');}
  if(/<!DOCTYPE|<!ENTITY/i.test(text) || (text.match(/</g)||[]).length>250000)reject('invalid_xml');
  // Bound nesting before building a DOM, including extension elements.
  let depth=0;for(const match of text.matchAll(/<\/?[A-Za-z_][^>]*>/g)){const tag=match[0];if(tag.startsWith('</'))depth--;else if(!tag.endsWith('/>'))depth++;if(depth>100)reject('invalid_xml');}
  try{return new DOMParser({onError:()=>{throw new Error('invalid_xml');}}).parseFromString(text,'application/xml');}catch{reject('invalid_xml');}
}
export function validateGPX(bytes,DOMParser) {
  const doc=xmlDocument(bytes,DOMParser),root=doc.documentElement;
  if(root?.localName!=='gpx' || !['','http://www.topografix.com/GPX/1/0','http://www.topografix.com/GPX/1/1'].includes(root.namespaceURI||''))reject('invalid_gpx');
  let count=0;
  for(const tag of ['trkpt','rtept','wpt']) for(const point of Array.from(root.getElementsByTagNameNS('*',tag))){
    const lat=point.getAttribute('lat'),lon=point.getAttribute('lon');
    if(!lat?.trim()||!lon?.trim()||!Number.isFinite(+lat)||!Number.isFinite(+lon)||Math.abs(+lat)>90||Math.abs(+lon)>180)reject('invalid_gpx_coordinate');count++;
  }
  if(!count)reject('empty_gpx');
}
const svgTags=new Set('svg g defs path rect circle ellipse line polyline polygon text tspan linearGradient radialGradient stop clipPath mask use title desc metadata'.split(' '));
const svgAttributes=new Set('id x y x1 y1 x2 y2 cx cy r rx ry width height viewBox d points fill stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset fill-rule clip-rule opacity fill-opacity stroke-opacity transform gradientTransform gradientUnits offset stop-color stop-opacity clip-path mask preserveAspectRatio font-size font-family font-weight text-anchor dominant-baseline dx dy href xmlns version'.split(' '));
export function sanitizeSVG(bytes,DOMParser,XMLSerializer) {
  const doc=xmlDocument(bytes,DOMParser),root=doc.documentElement;
  if(root?.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg')reject('invalid_svg');
  for(const node of [root,...Array.from(root.getElementsByTagName('*'))]){
    if(!svgTags.has(node.localName)||node.namespaceURI!==root.namespaceURI)reject('unsafe_svg');
    if(['metadata','title','desc'].includes(node.localName)){node.parentNode.removeChild(node);continue;}
    for(const attr of Array.from(node.attributes)){
      const name=attr.name,value=attr.value.trim();
      if(!svgAttributes.has(name) || (name==='href'&&!/^#[\w-]+$/.test(value)) || /[<>]|javascript:|data:|https?:|\/\//i.test(value) && name!=='xmlns')reject('unsafe_svg');
      if(/url\(/i.test(value)&&!/^url\(#[\w-]+\)$/.test(value))reject('unsafe_svg');
    }
  }
  // Drop comments and processing instructions; only the sanitized root is serialized.
  const clean=node=>{for(const child of Array.from(node.childNodes)){if([7,8].includes(child.nodeType))node.removeChild(child);else clean(child);}};clean(root);
  return new TextEncoder().encode(new XMLSerializer().serializeToString(root));
}
function imageDimensions(bytes,extension) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(extension==='png') {
    if(bytes.length<33||String.fromCharCode(...bytes.subarray(1,4))!=='PNG'||bytes[0]!==137||v.getUint32(4)!==0x0d0a1a0a||v.getUint32(12)!==0x49484452)reject('invalid_image');
    let offset=8,ended=false;
    while(offset+12<=bytes.length){const size=v.getUint32(offset),type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(size>bytes.length-offset-12)reject('invalid_image');if(type==='acTL')reject('animated_image');offset+=size+12;if(type==='IEND'){ended=true;break;}}
    if(!ended||offset!==bytes.length)reject('invalid_image');
    return [v.getUint32(16),v.getUint32(20)];
  }
  if(extension==='webp') {
    if(bytes.length<30||String.fromCharCode(...bytes.subarray(0,4))!=='RIFF'||String.fromCharCode(...bytes.subarray(8,12))!=='WEBP'||v.getUint32(4,true)+8!==bytes.length)reject('invalid_image');
    const type=String.fromCharCode(...bytes.subarray(12,16));
    if(type==='VP8X'){if(bytes[20]&2)reject('animated_image');return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];}
    if(type==='VP8L'&&bytes[20]===0x2f){const bits=v.getUint32(21,true);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
    if(type==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)return [v.getUint16(26,true)&0x3fff,v.getUint16(28,true)&0x3fff];
    reject('invalid_image');
  }
  if(bytes.length<4||v.getUint16(0)!==0xffd8||v.getUint16(bytes.length-2)!==0xffd9)reject('invalid_image');
  let offset=2;
  while(offset+4<bytes.length){if(bytes[offset++]!==255)reject('invalid_image');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===0xda||marker===0xd9)break;const length=v.getUint16(offset);if(length<2||offset+length>bytes.length)reject('invalid_image');if([0xc0,0xc1,0xc2].includes(marker)){if(length<8)reject('invalid_image');return [v.getUint16(offset+5),v.getUint16(offset+3)];}offset+=length;}
  reject('invalid_image');
}
export function createContentValidator({DOMParser,XMLSerializer,decodeImage}) {
  return async ({bytes,name,bucket})=>{
    const limit=(bucket==='activities'?20:bucket==='avatars'||bucket==='club-logos'?5:10)*MiB;
    if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>limit)throw new FileValidationError('file_size',413);
    const ext=String(name||'').toLowerCase().split('.').pop(),extension=ext==='jpg'?'jpeg':ext;
    if(bucket==='activities'){
      if(extension==='fit')validateFIT(bytes);else if(extension==='gpx')validateGPX(bytes,DOMParser);else reject('file_type');
      return {bytes,mime:extension==='fit'?'application/octet-stream':'application/gpx+xml',extension};
    }
    if(!['activity-media','moment-media','avatars','club-logos'].includes(bucket))reject('file_type');
    if(extension==='svg'&&bucket==='club-logos')return {bytes:sanitizeSVG(bytes,DOMParser,XMLSerializer),original:bytes,mime:'image/svg+xml',extension:'svg',originalExtension:'svg'};
    if(!['jpeg','png','webp'].includes(extension))reject('file_type');
    const [width,height]=imageDimensions(bytes,extension);
    if(!width||!height||width>8192||height>8192||width*height>12000000)reject('image_dimensions');
    const shared=bucket!=='activity-media';
    try{
      const decoded=await decodeImage(bytes,extension,{shared,avatar:bucket==='avatars'});
      return shared?{...decoded,original:bytes,originalExtension:extension}:{bytes,mime:'image/'+extension,extension};
    }catch(error){if(error instanceof FileValidationError)throw error;reject('invalid_image');}
  };
}
