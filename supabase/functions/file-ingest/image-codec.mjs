// Dependencies are initialized by the runtime entry point, also exercised under Node tests.
export function imageCodec({ImageMagick,MagickFormat,ResourceLimits}) {
  ResourceLimits.width=8192n;ResourceLimits.height=8192n;ResourceLimits.area=12000000n;
  ResourceLimits.memory=128n*1024n*1024n;ResourceLimits.disk=0n;ResourceLimits.listLength=4n;
  ResourceLimits.maxProfileSize=2n*1024n*1024n;
  return (bytes,extension,{shared,avatar})=>ImageMagick.read(bytes,MagickFormat[extension==='jpeg'?'Jpeg':extension==='png'?'Png':'WebP'],image=>{
    if(!image.width||!image.height||image.width*image.height>12000000)throw new Error('image_dimensions');
    if(!shared)return {width:image.width,height:image.height};
    image.autoOrient();image.strip();
    const limit=avatar?1024:2560,scale=Math.min(1,limit/Math.max(image.width,image.height));
    if(scale<1)image.resize(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
    image.quality=85;
    return image.write(avatar?MagickFormat.Jpeg:MagickFormat.WebP,data=>({bytes:new Uint8Array(data),extension:avatar?'jpeg':'webp',mime:avatar?'image/jpeg':'image/webp'}));
  });
}
