import { describe, expect, test } from 'bun:test'
import { buildVersionTable } from './version'

// Micro-suite for buildVersionTable's redesigned ownership: alias chains,
// yank threading, deprecated behavior. Parser fns (parseVersion/parseTag/
// compareVersions/versionDepth) are untouched by the redesign and already
// exercised indirectly here — no separate suite added for them.

describe('buildVersionTable', () => {
  test('alias chain: latest + major + minor + patch sharing one digest', () => {
    const table = buildVersionTable(
      {
        latest: { content: 'sha256:aaa', observed: '2026-01-01T00:00:00Z' },
        3: { content: 'sha256:aaa', observed: '2026-01-01T00:00:00Z' },
        '3.31': { content: 'sha256:aaa', observed: '2026-01-01T00:00:00Z' },
        '3.31.7': { content: 'sha256:aaa', observed: '2026-01-01T00:00:00Z' },
        '3.31.6': { content: 'sha256:bbb', observed: '2025-12-01T00:00:00Z' },
      },
      'active',
    )

    const row = table.rows.find(r => r.isDefault)!
    expect(row.primaryTag).toBe('latest')
    expect(row.showLatestHighlight).toBe(true)
    expect(row.aliasChain.map(m => m.tag)).toEqual(['latest', '3', '3.31', '3.31.7'])
    expect(row.aliasChain.every(m => m.digest === 'sha256:aaa')).toBe(true)

    // 3.31.6 is a different digest — grouped, not part of the chain.
    const major = row.majorGroups.find(mg => mg.major === 3)!
    const minor = major.minorGroups.find(m => m.minorTag === '3.31')!
    expect(minor.patches.map(p => p.tag)).toEqual(['3.31.7', '3.31.6'])
  })

  test('yank threading: yanked patch is struck and carries its reason inline', () => {
    const table = buildVersionTable(
      {
        '3.30.2': {
          content: 'sha256:ccc',
          observed: '2026-05-14T00:00:00Z',
          yanked: { reason: 'upstream artifact checksum mismatch', at: '2026-05-14T00:00:00Z' },
        },
        '3.30.1': { content: 'sha256:ddd', observed: '2026-05-01T00:00:00Z' },
      },
      'active',
    )

    const row = table.rows.find(r => r.isDefault)!
    const minor = row.majorGroups[0].minorGroups[0]
    const yankedPatch = minor.patches.find(p => p.tag === '3.30.2')!
    expect(yankedPatch.yanked?.reason).toBe('upstream artifact checksum mismatch')

    // Yanked tags never win primary/alias-chain selection.
    expect(row.primaryTag).toBe('3.30.1')
    expect(row.aliasChain.map(m => m.tag)).not.toContain('3.30.2')
  })

  test('deprecated: no live latest, even if a stray "latest" tag is present', () => {
    const table = buildVersionTable(
      {
        latest: { content: 'sha256:eee', observed: '2026-01-01T00:00:00Z' },
        '0.10.0': { content: 'sha256:fff', observed: '2026-01-01T00:00:00Z' },
      },
      'deprecated',
    )

    const row = table.rows.find(r => r.isDefault)!
    expect(row.primaryTag).toBe('0.10.0')
    expect(row.showLatestHighlight).toBe(false)
    expect(row.aliasChain.map(m => m.tag)).not.toContain('latest')
  })

  test('all-yanked row: no primary, no alias chain, groups still render', () => {
    const table = buildVersionTable(
      {
        '1.0.0': {
          content: 'sha256:111',
          observed: '2026-01-01T00:00:00Z',
          yanked: { reason: 'broken build', at: '2026-01-02T00:00:00Z' },
        },
      },
      'active',
    )

    const row = table.rows.find(r => r.isDefault)!
    expect(row.primaryTag).toBeNull()
    expect(row.aliasChain).toEqual([])
    expect(row.majorGroups[0].minorGroups[0].patches[0].tag).toBe('1.0.0')
  })

  test('unknown tags carry digest + yanked through too', () => {
    const table = buildVersionTable(
      { nightly_build: { content: 'sha256:999', observed: '2026-01-01T00:00:00Z' } },
      'active',
    )
    expect(table.unknownTags).toEqual([{ tag: 'nightly_build', digest: 'sha256:999', yanked: undefined }])
  })
})
