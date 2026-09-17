import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as magick from '@imagemagick/magick-wasm';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createContentValidator,validateFIT} from '../../supabase/functions/file-ingest/content.mjs';
import {imageCodec} from '../../supabase/functions/file-ingest/image-codec.mjs';
await magick.initializeImageMagick(await readFile(new URL(import.meta.resolve('@imagemagick/magick-wasm/magick.wasm'))));
const validate=createContentValidator({DOMParser,XMLSerializer,decodeImage:imageCodec(magick)});
const text=value=>new TextEncoder().encode(value);
const png=magick.ImageMagick.read(new magick.MagickColor('red'),2,3,image=>image.write(magick.MagickFormat.Png,bytes=>new Uint8Array(bytes)));
const run=(bytes,name,bucket='activity-media')=>validate({bytes,name,bucket});
test('real image decoding keeps private original bytes and rejects forged or damaged images',async()=>{
  assert.deepEqual((await run(png,'photo.png')).bytes,png);
  await assert.rejects(run(text('<script>alert(1)</script>'),'photo.png'),/invalid_image/);
  await assert.rejects(run(png.subarray(0,40),'photo.png'),/invalid_image/);
  await assert.rejects(run(png,'photo.jpeg'),/invalid_image/);
  await assert.rejects(run(new Uint8Array(10*1024*1024+1),'photo.png'),/file_size/);
  const huge=png.slice();new DataView(huge.buffer).setUint32(16,99999);await assert.rejects(run(huge,'photo.png'),/image_dimensions/);
});
test('shared raster files lose metadata while the exact original remains available for private storage',async()=>{
  const original=magick.ImageMagick.read(png,image=>{image.setAttribute('comment','Private GPS marker 46.500000 6.600000');image.setProfile('xmp',text('<x:xmpmeta xmlns:x="adobe:ns:meta/">Private GPS marker</x:xmpmeta>'));return image.write(magick.MagickFormat.Jpeg,bytes=>new Uint8Array(bytes));});
  const result=await run(original,'photo.jpg','moment-media');assert.deepEqual(result.original,original);assert.equal(result.mime,'image/webp');
  magick.ImageMagick.read(result.bytes,image=>{assert.equal(image.width,2);assert.equal(image.height,3);assert.deepEqual(image.profileNames,[]);assert.equal(image.getAttribute('comment'),null);});
  assert.equal(new TextDecoder().decode(result.bytes).includes('Private GPS marker'),false);
});
test('SVG logos preserve basic vector shapes but reject active and external content',async()=>{
  const svg=text('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><metadata>Private GPS</metadata><rect width="10" height="10" fill="red"/></svg>');
  const result=await run(svg,'club.svg','club-logos');assert.deepEqual(result.original,svg);assert.doesNotMatch(new TextDecoder().decode(result.bytes),/metadata|Private GPS/);
  for(const body of ['<script>alert(1)</script>','<image href="https://example.invalid/x"/>','<rect onload="alert(1)"/>','<use href="https://example.invalid/x#y"/>','<foreignObject/>']) await assert.rejects(run(text('<svg xmlns="http://www.w3.org/2000/svg">'+body+'</svg>'),'club.svg','club-logos'),/unsafe_svg/);
  await assert.rejects(run(svg,'photo.svg'),/file_type/);
});
test('GPX is parsed completely and rejects malformed XML, entities and invalid coordinates',async()=>{
  const gpx=text('<gpx version="1.1"><trk><trkseg><trkpt lat="46.5" lon="6.6"/></trkseg></trk></gpx>');
  assert.deepEqual((await run(gpx,'track.gpx','activities')).bytes,gpx);
  for(const body of ['<gpx><trkpt lat="46" lon="6"></gpx>','<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///etc/passwd">]><gpx>&x;</gpx>','<gpx><trkpt lat="91" lon="6"/></gpx>','<html><gpx><trkpt lat="46" lon="6"/></gpx></html>','<gpx/>']) await assert.rejects(run(text(body),'track.gpx','activities'));
});
test('FIT validates the file checksum and record boundaries, including a damaged payload with unchanged headers',()=>{
  // Minimal valid FIT definition + one timestamp record, with a fixed CRC trailer.
  const bytes=Uint8Array.from([12,16,0,0,14,0,0,0,46,70,73,84,64,0,0,20,0,1,253,4,134,0,1,0,0,0,0,0]);
  bytes.set([148,51],26);
  assert.doesNotThrow(()=>validateFIT(bytes));
  const damaged=bytes.slice();damaged[23]^=1;assert.throws(()=>validateFIT(damaged),/invalid_fit_crc/);
  assert.throws(()=>validateFIT(bytes.subarray(0,27)),/invalid_fit/);
});
