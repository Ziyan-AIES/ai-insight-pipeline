import { runRadarIngest } from './_radar.mjs'

export const config = { schedule: '0 */8 * * *' }

export default async () => {
  const result = await runRadarIngest()
  console.log('scheduled radar refresh complete', result)
}
