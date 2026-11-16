import { spawnSync } from 'node:child_process'
const nativeFetch = globalThis.fetch
const quote = value => '"' + String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n') + '"'
globalThis.fetch = async (url, options = {}) => {
 const target = new URL(String(url))
 const exchange = target.hostname === 'api2.cursor.sh' && target.pathname === '/auth/exchange_user_api_key'
 if (!exchange && !(target.hostname.endsWith('.supabase.co') || target.hostname === 'api.netlify.com')) return nativeFetch(url, options)
 const method = options.method || 'GET'
 const safe = exchange || ['GET','PATCH','PUT'].includes(method) || String(url).includes('on_conflict=')
 let failure = ''
 for (let attempt = 0; attempt < (safe ? 3 : 1); attempt++) {
  const config = ['silent','show-error','max-time = 25','url = '+quote(url),'request = '+quote(method),'write-out = "\\n%{http_code}"',...(attempt===1?['proxy = "http://127.0.0.1:7897"']:['noproxy = "*"']),...Object.entries(options.headers || {}).map(([k,v])=>'header = '+quote(k+': '+v)),...(options.body ? ['data = '+quote(options.body)] : [])].join('\n')
  const result = spawnSync('curl.exe',['--config','-'],{input:config,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:32*1024*1024})
  if(result.status===0){const at=result.stdout.lastIndexOf('\n');const status=Number(result.stdout.slice(at+1));return new Response(status===204?null:result.stdout.slice(0,at),{status})}
  failure = (result.stderr || result.error?.message || '').slice(0, 250)
 }
 throw Error('Network request failed after bounded transport retries: ' + failure)
}
