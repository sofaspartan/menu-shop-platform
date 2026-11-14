import { useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Download, Plus } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as qrService from '@/services/qrService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { downloadBlob } from '@/lib/utils'
import type { QrCode } from '@/types'

type Preset = { id: string; label: string; displayPx: number; downloadPx: number }

const PRESETS: Preset[] = [
  { id: 'screen', label: 'Screen', displayPx: 180, downloadPx: 512 },
  { id: 'table-tent', label: 'Table tent', displayPx: 220, downloadPx: 1024 },
  { id: 'flyer', label: 'Flyer', displayPx: 280, downloadPx: 2048 },
]

export function QrPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const previewRef = useRef<HTMLDivElement>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [presetId, setPresetId] = useState('screen')
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState<'restaurant' | 'menu'>('restaurant')
  const [menuId, setMenuId] = useState('')
  const [campaign, setCampaign] = useState('')
  const [foreground, setForeground] = useState('#1A3A2F')
  const [background, setBackground] = useState('#FFFFFF')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const menus = useMemo(() => {
    if (!db || !current) return []
    return db.menus.filter((m) => m.restaurantId === current.id)
  }, [db, current])

  const qrCodes = useMemo(() => {
    if (!db || !current) return []
    return db.qrCodes.filter((q) => q.restaurantId === current.id)
  }, [db, current])

  const selected = qrCodes.find((q) => q.id === selectedId) ?? qrCodes[0] ?? null
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]

  const qrUrl =
    current && selected
      ? qrService.buildQrUrl(window.location.origin, current.slug, selected, menus)
      : ''

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to manage QR codes.</p>
  }

  async function createQr() {
    if (!user || !current || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const qr = await qrService.createQrCode(user.id, current.id, {
        name: name.trim(),
        targetType,
        menuId: targetType === 'menu' ? menuId || undefined : undefined,
        campaign: campaign.trim() || undefined,
        style: { foreground, background },
      })
      setSelectedId(qr.id)
      setCreateOpen(false)
      setName('')
      setCampaign('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create QR code')
    } finally {
      setBusy(false)
    }
  }

  async function updateSelectedStyle(patch: Partial<QrCode['style']>) {
    if (!user || !current || !selected) return
    await qrService.updateQrCode(user.id, current.id, selected.id, {
      style: { ...selected.style, ...patch },
    })
  }

  function exportSvg() {
    const svg = previewRef.current?.querySelector('svg')
    if (!svg || !selected) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: 'image/svg+xml;charset=utf-8',
    })
    downloadBlob(blob, `${selected.name.replace(/\s+/g, '-').toLowerCase()}-qr.svg`)
  }

  async function exportPng() {
    const svg = previewRef.current?.querySelector('svg')
    if (!svg || !selected) return
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    try {
      const img = await loadImage(url)
      const canvas = document.createElement('canvas')
      canvas.width = preset.downloadPx
      canvas.height = preset.downloadPx
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = selected.style.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('PNG export failed'))
            return
          }
          downloadBlob(blob, `${selected.name.replace(/\s+/g, '-').toLowerCase()}-qr.png`)
          resolve()
        }, 'image/png')
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">QR codes</h1>
          <p className="mt-1 text-stone-500">
            Create branded codes for tables, flyers, and campaigns.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New QR code
        </Button>
      </div>

      {qrCodes.length === 0 ? (
        <EmptyState
          title="No QR codes yet"
          description="Generate a code that opens your restaurant or a specific menu."
          actionLabel="Create QR code"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {qrCodes.map((qr) => (
              <button
                key={qr.id}
                type="button"
                onClick={() => setSelectedId(qr.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  selected?.id === qr.id
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                    : 'border-stone-200 bg-white'
                }`}
              >
                <div className="font-medium">{qr.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
                  <span>{qr.targetType}</span>
                  {qr.campaign ? <span>· {qr.campaign}</span> : null}
                </div>
                <div className="mt-2">
                  <Badge tone="brand">{qr.scanCount} scans</Badge>
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{selected.name}</h2>
                  <p className="mt-1 break-all text-xs text-stone-500">{qrUrl}</p>
                </div>
                <Badge tone="success">{selected.scanCount} lifetime scans</Badge>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[auto_1fr]">
                <div
                  ref={previewRef}
                  className="flex flex-col items-center justify-center rounded-2xl border border-stone-100 bg-stone-50 p-6"
                >
                  <QRCodeSVG
                    value={qrUrl}
                    size={preset.displayPx}
                    bgColor={selected.style.background}
                    fgColor={selected.style.foreground}
                    level={selected.style.errorCorrection}
                    includeMargin
                  />
                  {selected.style.caption ? (
                    <p className="mt-3 text-sm font-medium text-stone-700">
                      {selected.style.caption}
                    </p>
                  ) : null}
                  {selected.style.showRestaurantName ? (
                    <p className="text-xs text-stone-500">{current.name}</p>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <Field label="Print preset">
                    <Select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                      {PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label} ({p.downloadPx}px export)
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Foreground">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          className="h-10 w-12 rounded-lg border border-stone-300 p-1"
                          value={selected.style.foreground}
                          onChange={(e) => void updateSelectedStyle({ foreground: e.target.value })}
                        />
                        <Input
                          value={selected.style.foreground}
                          onChange={(e) => void updateSelectedStyle({ foreground: e.target.value })}
                        />
                      </div>
                    </Field>
                    <Field label="Background">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          className="h-10 w-12 rounded-lg border border-stone-300 p-1"
                          value={selected.style.background}
                          onChange={(e) => void updateSelectedStyle({ background: e.target.value })}
                        />
                        <Input
                          value={selected.style.background}
                          onChange={(e) => void updateSelectedStyle({ background: e.target.value })}
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void exportPng()}>
                      <Download className="h-4 w-4" /> Export PNG
                    </Button>
                    <Button variant="outline" onClick={exportSvg}>
                      <Download className="h-4 w-4" /> Export SVG
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() =>
                        void qrService.deleteQrCode(user.id, current.id, selected.id)
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create QR code">
        <div className="space-y-4">
          <Field label="Name" htmlFor="qr-name">
            <Input
              id="qr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Table 12"
            />
          </Field>
          <Field label="Target" htmlFor="qr-target">
            <Select
              id="qr-target"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as 'restaurant' | 'menu')}
            >
              <option value="restaurant">Restaurant home</option>
              <option value="menu">Specific menu</option>
            </Select>
          </Field>
          {targetType === 'menu' ? (
            <Field label="Menu" htmlFor="qr-menu">
              <Select id="qr-menu" value={menuId} onChange={(e) => setMenuId(e.target.value)}>
                <option value="">Select menu…</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Campaign (optional)" htmlFor="qr-campaign">
            <Input
              id="qr-campaign"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="spring-launch"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Foreground">
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg border border-stone-300 p-1"
                  value={foreground}
                  onChange={(e) => setForeground(e.target.value)}
                />
                <Input value={foreground} onChange={(e) => setForeground(e.target.value)} />
              </div>
            </Field>
            <Field label="Background">
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-12 rounded-lg border border-stone-300 p-1"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                />
                <Input value={background} onChange={(e) => setBackground(e.target.value)} />
              </div>
            </Field>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !name.trim()} onClick={() => void createQr()}>
              {busy ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load SVG for export'))
    img.src = url
  })
}
