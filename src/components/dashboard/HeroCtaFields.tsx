import { Field, Input, Select } from '@/components/ui/Input'
import {
  STORE_LINK_KIND_OPTIONS,
  parseStoreLinkHref,
  serializeStoreLinkTarget,
  type StoreLinkKind,
  type StoreLinkTarget,
} from '@/lib/storeLinkTarget'

export function HeroCtaFields({
  idPrefix,
  title,
  label,
  href,
  onLabelChange,
  onHrefChange,
  labelPlaceholder,
}: {
  idPrefix: string
  title: string
  label: string
  href: string
  onLabelChange: (label: string) => void
  onHrefChange: (href: string) => void
  labelPlaceholder?: string
}) {
  const target = parseStoreLinkHref(href)

  function setTarget(next: StoreLinkTarget) {
    onHrefChange(serializeStoreLinkTarget(next))
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-3 sm:col-span-2">
      <p className="text-sm font-medium text-stone-700">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Button label" htmlFor={`${idPrefix}-label`}>
          <Input
            id={`${idPrefix}-label`}
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder={labelPlaceholder ?? 'e.g. View menu'}
          />
        </Field>
        <Field label="Goes to" htmlFor={`${idPrefix}-kind`}>
          <Select
            id={`${idPrefix}-kind`}
            value={target.kind}
            onChange={(e) => {
              const kind = e.target.value as StoreLinkKind
              if (kind === 'path') {
                setTarget({ kind, path: target.path || '' })
              } else if (kind === 'url') {
                setTarget({ kind, url: target.url || 'https://' })
              } else {
                setTarget({ kind })
              }
            }}
          >
            {STORE_LINK_KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        {target.kind === 'path' ? (
          <Field label="Named page / path" htmlFor={`${idPrefix}-path`}>
            <Input
              id={`${idPrefix}-path`}
              value={target.path ?? ''}
              onChange={(e) => setTarget({ kind: 'path', path: e.target.value })}
              placeholder="about, shop, menu/lunch, or #section-…"
            />
          </Field>
        ) : null}
        {target.kind === 'url' ? (
          <Field label="Custom URL" htmlFor={`${idPrefix}-url`}>
            <Input
              id={`${idPrefix}-url`}
              value={target.url ?? ''}
              onChange={(e) => setTarget({ kind: 'url', url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
        ) : null}
      </div>
      <p className="text-xs text-stone-500">
        {target.kind === 'shop'
          ? 'Opens your Shop / Menu catalog.'
          : target.kind === 'about'
            ? 'Opens the About page.'
            : target.kind === 'contact'
              ? 'Opens the Contact page.'
              : target.kind === 'reserve'
                ? 'Opens the table reservation page.'
                : target.kind === 'home'
                  ? 'Goes to the storefront home.'
                  : target.kind === 'featured'
                    ? 'Jumps to the Featured section on the homepage.'
                    : target.kind === 'aboutSection'
                      ? 'Jumps to the About teaser on the homepage.'
                      : target.kind === 'path'
                        ? 'Relative to this store (e.g. about, shop, or a hash).'
                        : 'Opens an external link in a new tab.'}
      </p>
    </div>
  )
}
