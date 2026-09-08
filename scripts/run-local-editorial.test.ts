import { describe, expect, it } from 'vitest'
import { validatePayload } from './run-local-editorial'

describe('local editorial snapshot validation', () => {
  it('copies identity and version from the claimed queue snapshot, not model output', () => {
    const pending = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        version: 17,
        canonical_url: 'https://example.com/story',
        title: 'Original title',
        source: 'Example',
        raw_text: 'Source text',
        summary: '',
        category: 'ecosystem',
        captured_at: '2026-09-08T00:00:00Z',
        metadata: {},
      },
    ]
    const payload = validatePayload(
      {
        news: [
          {
            url: 'https://example.com/story',
            id: '99999999-9999-4999-8999-999999999999',
            expected_version: 999,
            status: 'reviewed',
            title: 'Reviewed title',
            summary:
              'Teams now receive a concise verified signal while preserving the human edits made during review.',
            category: 'ai_capability',
            evidence: [
              {
                claim: 'Supported fact',
                source_url: 'https://example.com/story',
                support: 'Source text',
              },
            ],
          } as never,
        ],
      },
      pending,
      'cursor-run-1',
    )

    expect(payload.news[0]).toMatchObject({
      id: pending[0].id,
      expected_version: pending[0].version,
      url: pending[0].canonical_url,
    })
  })
})
