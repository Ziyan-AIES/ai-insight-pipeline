import { runRadarIngest } from './_radar.mjs'

export const config = { schedule: '17 */4 * * *' }

export default async () => {
  const result = await runRadarIngest()
  console.log('scheduled radar refresh complete', result)
}
