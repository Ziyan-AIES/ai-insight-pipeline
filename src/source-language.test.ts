import {beforeEach,expect,it} from 'vitest'
import {act,renderHook} from '@testing-library/react'
import {sourceLanguage,useSourceLanguage} from './source-language'
beforeEach(()=>localStorage.clear())
it('uses original language instead of translated display text',()=>{
 expect(sourceLanguage('https://mp.weixin.qq.com/s/article',{language:'en'})).toBe('zh')
 expect(sourceLanguage('https://example.com',{original_language:'zh-CN',language:'en'})).toBe('zh')
 expect(sourceLanguage('https://example.com',{language:'English'})).toBe('en')
 expect(sourceLanguage('https://example.com')).toBe('unknown')
})
it('defaults to all and retains an explicit selection after remount',()=>{
 const first=renderHook(()=>useSourceLanguage())
 expect(first.result.current[0]).toBe('all')
 act(()=>first.result.current[1]('en'))
 first.unmount()
 expect(renderHook(()=>useSourceLanguage()).result.current[0]).toBe('en')
})
