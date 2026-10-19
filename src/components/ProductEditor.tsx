import { useState } from 'react'
import { safeUrl } from '../analysis'
import type { ResearchProduct } from '../types'

export function ProductEditor({initial,onSave,onClose}:{initial?:ResearchProduct;onSave:(product:ResearchProduct)=>Promise<void>;onClose:()=>void}) {
  const [product,setProduct]=useState<ResearchProduct>(()=>initial?{...initial}:{id:crypto.randomUUID(),name:'',description:'',company:'',url:'',logoUrl:'',screenshotUrl:''})
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  function field(key:keyof ResearchProduct,value:string){setProduct(current=>({...current,[key]:value}))}
  async function save(){
    if(!product.name.trim()){setError('Enter a product name.');return}
    for(const key of ['url','logoUrl','screenshotUrl'] as const)if(product[key].trim()&&!safeUrl(product[key].trim())){setError('Use a complete http or https URL for website and images.');return}
    setBusy(true);setError('')
    try{await onSave({...product,name:product.name.trim(),url:product.url.trim(),logoUrl:product.logoUrl.trim(),screenshotUrl:product.screenshotUrl.trim()});onClose()}
    catch(error){setError(error instanceof Error?error.message:'Product could not be saved. Your entries are still here.')}
    finally{setBusy(false)}
  }
  return <div className="modal-backdrop"><section className="analysis-editor product-editor" role="dialog" aria-modal="true" aria-labelledby="product-editor-title"><header><h2 id="product-editor-title">{initial?'Edit product':'New product'}</h2><button className="unlink-button" aria-label="Close product editor" disabled={busy} onClick={onClose}>×</button></header><p>A name and a short description are enough to start. Saved products are visible to approved members of this research.</p>
    <label>Name<input required value={product.name} onChange={event=>field('name',event.target.value)} placeholder="e.g. Siri"/></label>
    <label>Description<textarea value={product.description} onChange={event=>field('description',event.target.value)} placeholder="What it does and why it matters to this research"/></label>
    <details><summary>Company, website and images · optional</summary><label>Company<input value={product.company} onChange={event=>field('company',event.target.value)}/></label><label>Website URL<input type="url" value={product.url} onChange={event=>field('url',event.target.value)}/></label><label>Logo URL<input type="url" value={product.logoUrl} onChange={event=>field('logoUrl',event.target.value)}/></label><label>Screenshot URL<input type="url" value={product.screenshotUrl} onChange={event=>field('screenshotUrl',event.target.value)}/></label></details>
    {error&&<p role="alert">{error}</p>}<footer className="analysis-controls"><button disabled={busy} onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save product'}</button></footer>
  </section></div>
}
