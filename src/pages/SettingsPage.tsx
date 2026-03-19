import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { PageHeader } from '../components/PageHeader'
import { useDataRoot } from '../features/settings/DataRootContext'
import { exportDataBundle, importDataBundle } from '../lib/fs/fileApi'
import { emitDataChanged } from '../lib/liveSync'

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const index = normalized.lastIndexOf('/')
  if (index <= 0) {
    return normalized
  }

  return normalized.slice(0, index)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function isNestedPath(parent: string, child: string): boolean {
  if (!parent || !child) {
    return false
  }
  if (parent === child) {
    return false
  }
  return child.startsWith(`${parent}/`)
}

export function SettingsPage() {
  const {
    baseDataRoot,
    dataRoot,
    activeProfile,
    updateDataRoot,
    migrateDataRoot,
    refresh,
    loading,
  } = useDataRoot()

  const [draftPath, setDraftPath] = useState(baseDataRoot ?? '')
  const [rootMessage, setRootMessage] = useState('')

  const defaultExportDir = useMemo(() => {
    if (!dataRoot) {
      return ''
    }
    return parentPath(dataRoot)
  }, [dataRoot])

  const [exportDir, setExportDir] = useState(defaultExportDir)
  const [exportMessage, setExportMessage] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

  const [importSource, setImportSource] = useState('')
  const [overwriteImport, setOverwriteImport] = useState(true)
  const [importMessage, setImportMessage] = useState('')
  const [importBusy, setImportBusy] = useState(false)

  const [migrateTarget, setMigrateTarget] = useState('')
  const [overwriteMigrate, setOverwriteMigrate] = useState(false)
  const [migrateMessage, setMigrateMessage] = useState('')
  const [migrateBusy, setMigrateBusy] = useState(false)

  const normalizedBaseRoot = useMemo(() => normalizePath(baseDataRoot ?? ''), [baseDataRoot])
  const normalizedMigrateTarget = useMemo(() => normalizePath(migrateTarget.trim()), [migrateTarget])
  const migrateValidationMessage = useMemo(() => {
    if (!normalizedMigrateTarget || !normalizedBaseRoot) {
      return ''
    }
    if (normalizedMigrateTarget === normalizedBaseRoot) {
      return 'Migration destination cannot be the same as current data root.'
    }
    if (
      isNestedPath(normalizedBaseRoot, normalizedMigrateTarget) ||
      isNestedPath(normalizedMigrateTarget, normalizedBaseRoot)
    ) {
      return 'Current data root and migration destination cannot be nested.'
    }
    return ''
  }, [normalizedBaseRoot, normalizedMigrateTarget])

  useEffect(() => {
    setDraftPath(baseDataRoot ?? '')
  }, [baseDataRoot])

  useEffect(() => {
    if (!exportDir) {
      setExportDir(defaultExportDir)
    }
  }, [defaultExportDir, exportDir])

  useEffect(() => {
    if (!baseDataRoot || migrateTarget) {
      return
    }

    const suggested = baseDataRoot.replace(/life-tracker-data$/, 'dailytrack-data')
    setMigrateTarget(suggested === baseDataRoot ? '' : suggested)
  }, [baseDataRoot, migrateTarget])

  async function handleRootSubmit(event: FormEvent) {
    event.preventDefault()
    setRootMessage('')

    const nextPath = draftPath.trim()
    if (!nextPath) {
      setRootMessage('Path cannot be empty.')
      return
    }

    try {
      await updateDataRoot(nextPath)
      setRootMessage('Data root updated.')
    } catch {
      setRootMessage('Failed to update data root.')
    }
  }

  async function handleExport(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      setExportMessage('Data root is not ready.')
      return
    }

    const destination = exportDir.trim()
    if (!destination) {
      setExportMessage('Export destination path is required.')
      return
    }

    setExportBusy(true)
    setExportMessage('')

    try {
      const bundlePath = await exportDataBundle(dataRoot, destination)
      setExportMessage(`Export completed: ${bundlePath}`)
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Export failed.'
      setExportMessage(text)
    } finally {
      setExportBusy(false)
    }
  }

  async function handleMigrate(event: FormEvent) {
    event.preventDefault()

    if (!baseDataRoot) {
      setMigrateMessage('Data root is not ready.')
      return
    }

    const destination = migrateTarget.trim()
    if (!destination) {
      setMigrateMessage('Migration destination path is required.')
      return
    }
    if (migrateValidationMessage) {
      setMigrateMessage(migrateValidationMessage)
      return
    }

    setMigrateBusy(true)
    setMigrateMessage('')

    try {
      await migrateDataRoot(destination, overwriteMigrate)
      setMigrateMessage('Migration completed. Active data root switched to destination.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Migration failed.'
      setMigrateMessage(text)
    } finally {
      setMigrateBusy(false)
    }
  }

  async function handleImport(event: FormEvent) {
    event.preventDefault()

    if (!dataRoot) {
      setImportMessage('Data root is not ready.')
      return
    }

    const source = importSource.trim()
    if (!source) {
      setImportMessage('Import source path is required.')
      return
    }

    setImportBusy(true)
    setImportMessage('')

    try {
      await importDataBundle(source, dataRoot, overwriteImport)
      await refresh()
      emitDataChanged({ scope: 'all' })
      setImportMessage('Import completed and data root refreshed.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Import failed.'
      setImportMessage(text)
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure base data folder and move active profile data between computers via export/import."
      />

      <div className="max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>
          Active profile: <span className="font-medium">{activeProfile || '-'}</span>
        </p>
        <p>
          Active profile root: <span className="font-medium">{dataRoot || '-'}</span>
        </p>
      </div>

      <form onSubmit={handleRootSubmit} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Data Root</h2>
        <p className="text-sm text-slate-600">
          This only switches the active base root. It does not copy data from the old location.
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="data-root">
          Base data root path
        </label>
        <input
          id="data-root"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={draftPath}
          onChange={(event) => setDraftPath(event.target.value)}
          placeholder="/Users/you/dailytrack-data"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Save Data Root
        </button>
        <button
          type="button"
          disabled={loading || !draftPath.trim()}
          onClick={() => {
            setMigrateTarget(draftPath.trim())
            setMigrateMessage('')
          }}
          className="ml-2 rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
        >
          Use This Path for Migration
        </button>
        {rootMessage ? <p className="text-sm text-slate-600">{rootMessage}</p> : null}
      </form>

      <form onSubmit={handleMigrate} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Migrate Data Root</h2>
        <p className="text-sm text-slate-600">
          Copy the entire current base root to a new location, then switch app root to the destination.
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="migrate-target">
          Migration destination path
        </label>
        <input
          id="migrate-target"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={migrateTarget}
          onChange={(event) => setMigrateTarget(event.target.value)}
          placeholder="/Users/you/dailytrack-data"
          disabled={loading || migrateBusy}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={overwriteMigrate}
            onChange={(event) => setOverwriteMigrate(event.target.checked)}
            disabled={loading || migrateBusy}
          />
          Overwrite destination files when names conflict
        </label>
        <button
          type="submit"
          disabled={loading || migrateBusy || !migrateTarget.trim() || Boolean(migrateValidationMessage)}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {migrateBusy ? 'Migrating...' : 'Migrate and Switch'}
        </button>
        {migrateValidationMessage ? <p className="text-sm text-rose-700">{migrateValidationMessage}</p> : null}
        {migrateMessage ? <p className="break-all text-sm text-slate-600">{migrateMessage}</p> : null}
      </form>

      <form onSubmit={handleExport} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Export Data</h2>
        <p className="text-sm text-slate-600">
          Creates a new folder like <code>dailytrack-export-&lt;timestamp&gt;</code> in the destination directory.
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="export-dir">
          Export destination directory
        </label>
        <input
          id="export-dir"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={exportDir}
          onChange={(event) => setExportDir(event.target.value)}
          placeholder="/Users/you/Desktop"
          disabled={loading || exportBusy}
        />
        <button
          type="submit"
          disabled={loading || exportBusy}
          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {exportBusy ? 'Exporting...' : 'Export'}
        </button>
        {exportMessage ? <p className="break-all text-sm text-slate-600">{exportMessage}</p> : null}
      </form>

      <form onSubmit={handleImport} className="max-w-3xl space-y-3 rounded-lg border border-slate-200 p-4">
        <h2 className="text-base font-semibold text-slate-900">Import Data</h2>
        <p className="text-sm text-slate-600">
          Import from an exported bundle folder into the current data root.
        </p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="import-source">
          Import source folder path
        </label>
        <input
          id="import-source"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
          value={importSource}
          onChange={(event) => setImportSource(event.target.value)}
          placeholder="/Users/you/Desktop/dailytrack-export-123456789"
          disabled={loading || importBusy}
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={overwriteImport}
            onChange={(event) => setOverwriteImport(event.target.checked)}
            disabled={loading || importBusy}
          />
          Overwrite existing files with imported files
        </label>

        <button
          type="submit"
          disabled={loading || importBusy}
          className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {importBusy ? 'Importing...' : 'Import'}
        </button>
        {importMessage ? <p className="break-all text-sm text-slate-600">{importMessage}</p> : null}
      </form>
    </section>
  )
}
