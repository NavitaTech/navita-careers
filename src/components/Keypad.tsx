/**
 * An on-screen number pad for the mobile field.
 *
 * A booth screen cannot rely on the device keyboard: on a kiosk-locked iPad it
 * covers half the form, and on a touchscreen TV there is no keyboard at all.
 * Big fixed keys also survive being hit by someone standing up.
 */
type Props = {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

export function Keypad({ value, onChange, maxLength = 8 }: Props) {
  const press = (key: string) => {
    if (key === 'back') onChange(value.slice(0, -1))
    else if (key === 'clear') onChange('')
    else if (value.length < maxLength) onChange(value + key)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className={[
            'tabular flex items-center justify-center rounded-xl font-display font-bold transition-transform active:scale-95',
            'min-h-[3.4rem] text-[1.5rem]',
            key === 'back' || key === 'clear'
              ? 'bg-ink/10 text-[0.95rem] uppercase tracking-wide text-ink/70 hover:bg-ink/20'
              : 'bg-ink/6 text-ink hover:bg-ink/12',
          ].join(' ')}
          aria-label={key === 'back' ? 'Delete' : key === 'clear' ? 'Clear' : key}
        >
          {key === 'back' ? '⌫' : key === 'clear' ? 'clear' : key}
        </button>
      ))}
    </div>
  )
}
