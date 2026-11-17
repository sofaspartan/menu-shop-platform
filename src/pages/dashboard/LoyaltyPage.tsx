import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Settings2, Trash2, Users } from 'lucide-react'
import { IconAction } from '@/components/ui/IconAction'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as loyaltyService from '@/services/loyaltyService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { storeCopy } from '@/lib/storeCopy'
import { createId, formatMoney, cn } from '@/lib/utils'
import type { LoyaltyReward, LoyaltySettings } from '@/types'

type LoyaltyTab = 'settings' | 'rewards' | 'members'

export function LoyaltyPage() {
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<LoyaltyTab>('settings')
  const [query, setQuery] = useState('')
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null)

  const copy = storeCopy(current?.storeKind)
  const accounts = useMemo(() => {
    if (!db || !current) return []
    return db.loyaltyAccounts
      .filter((a) => a.restaurantId === current.id)
      .sort((a, b) => b.pointsBalance - a.pointsBalance)
  }, [db, current])

  const items = useMemo(() => {
    if (!db || !current) return []
    return db.items
      .filter((i) => i.restaurantId === current.id && i.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current])

  const filteredRewards = useMemo(() => {
    if (!settings) return []
    const q = query.trim().toLowerCase()
    if (!q) return settings.rewards
    return settings.rewards.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        String(r.pointsCost).includes(q),
    )
  }, [settings, query])

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.phone || '').toLowerCase().includes(q),
    )
  }, [accounts, query])

  const selectedReward =
    filteredRewards.find((r) => r.id === selectedRewardId) ??
    filteredRewards[0] ??
    null

  useEffect(() => {
    if (!current) return
    setSettings({
      enabled: current.loyalty?.enabled ?? false,
      pointsPerDollar: current.loyalty?.pointsPerDollar ?? 1,
      rewards: (current.loyalty?.rewards ?? []).map((r) => ({ ...r })),
    })
  }, [current])

  if (!current || !user || !settings) {
    return <p className="text-sm text-stone-500">Select a store to configure loyalty.</p>
  }

  function addReward() {
    const reward: LoyaltyReward = {
      id: createId('rew'),
      type: 'percent_off',
      label: '10% off',
      pointsCost: 100,
      percentOff: 10,
    }
    setSettings((s) => (s ? { ...s, rewards: [...s.rewards, reward] } : s))
    setSelectedRewardId(reward.id)
    setTab('rewards')
    setQuery('')
  }

  function updateReward(id: string, patch: Partial<LoyaltyReward>) {
    setSettings((s) => {
      if (!s) return s
      return {
        ...s,
        rewards: s.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }
    })
  }

  function removeReward(id: string) {
    setSettings((s) => (s ? { ...s, rewards: s.rewards.filter((r) => r.id !== id) } : s))
    setSelectedRewardId((cur) => (cur === id ? null : cur))
  }

  async function save() {
    if (!user || !current || !settings) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await loyaltyService.updateLoyaltySettings(user.id, current.id, settings)
      await load(user.id)
      setMessage('Loyalty settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save loyalty settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Loyalty</h1>
        <p className="mt-1 text-sm text-stone-500">
          Customers earn points with each order (matched by email). Configure rewards they can
          redeem at checkout — works for restaurants and retail alike.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'settings' as const, label: 'Settings', icon: Settings2 },
            { id: 'rewards' as const, label: 'Rewards', icon: Plus },
            { id: 'members' as const, label: 'Members', icon: Users },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setQuery('')
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
              tab === t.id
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {tab !== 'settings' ? (
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pl-9"
              placeholder={tab === 'rewards' ? 'Search rewards…' : 'Search members…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-wrap gap-2">
          {tab === 'rewards' ? (
            <Button type="button" variant="outline" onClick={addReward}>
              <Plus className="h-4 w-4" />
              Add reward
            </Button>
          ) : null}
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save loyalty'}
          </Button>
        </div>
      </div>

      {tab === 'settings' ? (
        <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">Program settings</h2>
              <p className="mt-1 text-sm text-stone-500">
                Points are calculated on the merchandise subtotal after coupons and loyalty
                discounts, before tax and tip.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                setSettings((s) => (s ? { ...s, enabled: e.target.checked } : s))
              }
              className="h-4 w-4 rounded border-stone-300"
            />
            Enable loyalty program
          </label>
          <Field label="Points per dollar spent" htmlFor="pts-rate">
            <Input
              id="pts-rate"
              type="number"
              min={0}
              step={0.5}
              value={settings.pointsPerDollar}
              onChange={(e) =>
                setSettings((s) =>
                  s
                    ? {
                        ...s,
                        pointsPerDollar: Number.parseFloat(e.target.value) || 0,
                      }
                    : s,
                )
              }
            />
          </Field>
        </section>
      ) : null}

      {tab === 'rewards' ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {filteredRewards.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                {query ? 'No matching rewards.' : 'No rewards yet.'}
              </p>
            ) : (
              filteredRewards.map((reward) => (
                <button
                  key={reward.id}
                  type="button"
                  onClick={() => setSelectedRewardId(reward.id)}
                  className={cn(
                    'w-full rounded-2xl border px-4 py-3 text-left',
                    (selectedReward?.id ?? '') === reward.id
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                      : 'border-stone-200 bg-white hover:border-stone-300',
                  )}
                >
                  <div className="font-medium">{reward.label}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
                    <span>{reward.type.replaceAll('_', ' ')}</span>
                    <span>· {reward.pointsCost} pts</span>
                  </div>
                  <div className="mt-2">
                    <Badge tone="accent">{reward.pointsCost} pts</Badge>
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedReward ? (
            <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{selectedReward.label || 'Reward'}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Edit this reward, then save loyalty to publish changes.
                  </p>
                </div>
                <IconAction
                  label="Delete reward"
                  danger
                  onClick={() => removeReward(selectedReward.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconAction>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Label" htmlFor={`rew-label-${selectedReward.id}`}>
                  <Input
                    id={`rew-label-${selectedReward.id}`}
                    value={selectedReward.label}
                    onChange={(e) =>
                      updateReward(selectedReward.id, { label: e.target.value })
                    }
                  />
                </Field>
                <Field label="Points cost" htmlFor={`rew-cost-${selectedReward.id}`}>
                  <Input
                    id={`rew-cost-${selectedReward.id}`}
                    type="number"
                    min={1}
                    value={selectedReward.pointsCost}
                    onChange={(e) =>
                      updateReward(selectedReward.id, {
                        pointsCost: Number.parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </Field>
                <Field label="Type" htmlFor={`rew-type-${selectedReward.id}`}>
                  <Select
                    id={`rew-type-${selectedReward.id}`}
                    value={selectedReward.type}
                    onChange={(e) =>
                      updateReward(selectedReward.id, {
                        type: e.target.value as LoyaltyReward['type'],
                      })
                    }
                  >
                    <option value="percent_off">Percent off</option>
                    <option value="amount_off">Fixed amount off</option>
                    <option value="free_item">Free item</option>
                  </Select>
                </Field>
                {selectedReward.type === 'percent_off' ? (
                  <Field label="Percent off" htmlFor={`rew-pct-${selectedReward.id}`}>
                    <Input
                      id={`rew-pct-${selectedReward.id}`}
                      type="number"
                      min={1}
                      max={100}
                      value={selectedReward.percentOff ?? 10}
                      onChange={(e) =>
                        updateReward(selectedReward.id, {
                          percentOff: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                ) : null}
                {selectedReward.type === 'amount_off' ? (
                  <Field label="Amount off ($)" htmlFor={`rew-amt-${selectedReward.id}`}>
                    <Input
                      id={`rew-amt-${selectedReward.id}`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={((selectedReward.amountOffCents ?? 0) / 100).toFixed(2)}
                      onChange={(e) =>
                        updateReward(selectedReward.id, {
                          amountOffCents: Math.round(
                            (Number.parseFloat(e.target.value) || 0) * 100,
                          ),
                        })
                      }
                    />
                  </Field>
                ) : null}
                {selectedReward.type === 'free_item' ? (
                  <Field label="Free item" htmlFor={`rew-item-${selectedReward.id}`}>
                    <Select
                      id={`rew-item-${selectedReward.id}`}
                      value={selectedReward.itemId ?? ''}
                      onChange={(e) =>
                        updateReward(selectedReward.id, { itemId: e.target.value })
                      }
                    >
                      <option value="">Select item…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({formatMoney(item.basePriceCents)})
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-sm text-stone-500">
              {query ? 'No matches for your search.' : 'Add a reward to get started.'}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'members' ? (
        <section className="rounded-2xl border border-stone-200 bg-white">
          {filteredAccounts.length === 0 ? (
            <p className="px-4 py-8 text-sm text-stone-500">
              {query
                ? 'No matching members.'
                : `No loyalty accounts yet. They appear after a ${copy.guestNoun} checks out with an email.`}
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filteredAccounts.map((account) => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {account.name || account.email}
                    </div>
                    <div className="text-xs text-stone-500">{account.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{account.pointsBalance} pts</Badge>
                    <span className="text-xs text-stone-400">
                      {account.lifetimePoints} lifetime
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
