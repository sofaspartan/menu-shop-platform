import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as loyaltyService from '@/services/loyaltyService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { storeCopy } from '@/lib/storeCopy'
import { createId, formatMoney } from '@/lib/utils'
import type { LoyaltyReward, LoyaltySettings } from '@/types'

export function LoyaltyPage() {
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [settings, setSettings] = useState<LoyaltySettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
    setSettings((s) => {
      if (!s) return s
      const reward: LoyaltyReward = {
        id: createId('rew'),
        type: 'percent_off',
        label: '10% off',
        pointsCost: 100,
        percentOff: 10,
      }
      return { ...s, rewards: [...s.rewards, reward] }
    })
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
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Loyalty</h1>
        <p className="mt-1 text-sm text-stone-500">
          Customers earn points with each order (matched by email). Configure rewards they can
          redeem at checkout — works for {copy.storeNoun} and retail alike.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings((s) => (s ? { ...s, enabled: e.target.checked } : s))}
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
        <p className="text-xs text-stone-500">
          Points are calculated on the merchandise subtotal after coupons and loyalty discounts,
          before tax and tip.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Rewards</h2>
          <Button type="button" variant="outline" size="sm" onClick={addReward}>
            <Plus className="h-4 w-4" />
            Add reward
          </Button>
        </div>
        {settings.rewards.length === 0 ? (
          <p className="text-sm text-stone-500">No rewards yet. Add a discount or free item.</p>
        ) : (
          <ul className="space-y-4">
            {settings.rewards.map((reward) => (
              <li
                key={reward.id}
                className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Label" htmlFor={`rew-label-${reward.id}`}>
                    <Input
                      id={`rew-label-${reward.id}`}
                      value={reward.label}
                      onChange={(e) => updateReward(reward.id, { label: e.target.value })}
                    />
                  </Field>
                  <Field label="Points cost" htmlFor={`rew-cost-${reward.id}`}>
                    <Input
                      id={`rew-cost-${reward.id}`}
                      type="number"
                      min={1}
                      value={reward.pointsCost}
                      onChange={(e) =>
                        updateReward(reward.id, {
                          pointsCost: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label="Type" htmlFor={`rew-type-${reward.id}`}>
                    <Select
                      id={`rew-type-${reward.id}`}
                      value={reward.type}
                      onChange={(e) =>
                        updateReward(reward.id, {
                          type: e.target.value as LoyaltyReward['type'],
                        })
                      }
                    >
                      <option value="percent_off">Percent off</option>
                      <option value="amount_off">Fixed amount off</option>
                      <option value="free_item">Free item</option>
                    </Select>
                  </Field>
                  {reward.type === 'percent_off' ? (
                    <Field label="Percent off" htmlFor={`rew-pct-${reward.id}`}>
                      <Input
                        id={`rew-pct-${reward.id}`}
                        type="number"
                        min={1}
                        max={100}
                        value={reward.percentOff ?? 10}
                        onChange={(e) =>
                          updateReward(reward.id, {
                            percentOff: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </Field>
                  ) : null}
                  {reward.type === 'amount_off' ? (
                    <Field label="Amount off ($)" htmlFor={`rew-amt-${reward.id}`}>
                      <Input
                        id={`rew-amt-${reward.id}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={((reward.amountOffCents ?? 0) / 100).toFixed(2)}
                        onChange={(e) =>
                          updateReward(reward.id, {
                            amountOffCents: Math.round(
                              (Number.parseFloat(e.target.value) || 0) * 100,
                            ),
                          })
                        }
                      />
                    </Field>
                  ) : null}
                  {reward.type === 'free_item' ? (
                    <Field label="Free item" htmlFor={`rew-item-${reward.id}`}>
                      <Select
                        id={`rew-item-${reward.id}`}
                        value={reward.itemId ?? ''}
                        onChange={(e) => updateReward(reward.id, { itemId: e.target.value })}
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeReward(reward.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      <Button type="button" onClick={() => void save()} disabled={busy}>
        {busy ? 'Saving…' : 'Save loyalty'}
      </Button>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Customer balances</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-stone-500">
            No loyalty accounts yet. They appear after a guest checks out with an email.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{account.name || account.email}</div>
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
    </div>
  )
}
