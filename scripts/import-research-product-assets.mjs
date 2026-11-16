import fs from 'node:fs/promises'
import path from 'node:path'
const configPath=new URL('../config/personal-agent-products.json',import.meta.url)
const config=JSON.parse(await fs.readFile(configPath,'utf8'))
const origin='https://personal-agent-research-studio.ziyan-li-pku.chatgpt.site'
await fs.mkdir('public/product-media',{recursive:true})
for(const product of config.products){
 for(const [field,original] of [['logoUrl','originalLogoPath'],['screenshotUrl','originalScreenshotPath']]){
  const remote=product.provenance?.[original]
  if(!remote||!/^\/product-media\/[a-z0-9-]+\.(png|svg|jpg|webp|ico)$/i.test(remote))continue
  const filename=path.basename(remote),destination='public/product-media/'+filename
  try{
   const response=await fetch(origin+remote,{signal:AbortSignal.timeout(15000),redirect:'error'})
   if(!response.ok||!/^image\//i.test(response.headers.get('content-type')||''))throw Error('Not an image')
   const bytes=Buffer.from(await response.arrayBuffer())
   if(bytes.length>5*1024*1024)throw Error('Image exceeds size limit')
   await fs.writeFile(destination,bytes)
   // These assets now belong to this site; no runtime dependency on Studio.
   product[field]=remote
   console.log('Imported '+filename)
  }catch{console.error('Asset unavailable: '+filename);process.exitCode=1}
 }
}
await fs.writeFile(configPath,JSON.stringify(config,null,2)+'\n')
