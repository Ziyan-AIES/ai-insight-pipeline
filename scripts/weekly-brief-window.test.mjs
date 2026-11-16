import {test} from 'vitest'
import assert from 'node:assert/strict'
import {weeklyBriefWindow} from './weekly-brief-window.mjs'
test('publishes once on Beijing Monday for the preceding complete calendar week',()=>{
 const window=weeklyBriefWindow(new Date('2026-11-16T09:00:00Z'))
 assert.deepEqual(window,{start:'2026-11-08T16:00:00.000Z',end:'2026-11-15T16:00:00.000Z'})
 assert.equal(weeklyBriefWindow(new Date('2026-11-17T09:00:00Z')),null)
 assert.equal(weeklyBriefWindow(new Date('2026-11-16T10:00:00Z'),[{period:'weekly',...window}]),null)
 assert.ok(weeklyBriefWindow(new Date('2026-11-15T16:01:00Z')))
 assert.equal(weeklyBriefWindow(new Date('2026-11-15T15:59:00Z')),null)
})
