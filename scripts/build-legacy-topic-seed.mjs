import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const url = (process.env.OLD_TOPIC_SUPABASE_URL || '').replace(/\/$/, '')
const key = process.env.OLD_TOPIC_SUPABASE_ANON_KEY || ''
const outputPath = path.resolve(
  process.argv[2] || 'supabase/seed-legacy-topics.json',
)

if (!url || !key) {
  throw new Error(
    'Set OLD_TOPIC_SUPABASE_URL and OLD_TOPIC_SUPABASE_ANON_KEY',
  )
}

const response = await fetch(
  `${url}/rest/v1/monthly_topics?select=*&order=month_order.asc,display_order.asc`,
  {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
  },
)
if (!response.ok) throw new Error(await response.text())

const currentMonth = new Date().toISOString().slice(0, 7).replace('-', '')
const rows = (await response.json()).map((item) => {
  const monthOrder = String(item.month_order)
  return {
    id: item.id,
    title: item.topic_title,
    notes: item.notes || '',
    category: item.category,
    status: monthOrder < currentMonth ? 'completed' : 'scheduled',
    scheduled_month: `${monthOrder.slice(0, 4)}-${monthOrder.slice(4, 6)}-01`,
    display_order: item.display_order || 1,
  }
})

await fs.writeFile(outputPath, JSON.stringify(rows), 'utf8')
console.log(JSON.stringify({ output: outputPath, rows: rows.length }))
