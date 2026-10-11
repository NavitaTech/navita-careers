/**
 * A draggable university card.
 *
 * dnd-kit, not native HTML5 drag and drop, which does not fire on touch at all.
 * The card follows the finger with no transition on the transform - any easing
 * here reads as lag, and the brief's bar is that the card feels stuck to the
 * fingertip.
 */
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import type { UniversityRecord } from '../lib/types'
import { cachedLogo, initialsFor } from '../lib/logos'

type Props = {
  record: UniversityRecord
  showName: boolean
  disabled?: boolean
  /** Set while this card is the one being dragged. */
  dragging?: boolean
  /** Plays the shake when a drop was judged wrong. */
  rejected?: boolean
  reducedMotion: boolean
}

export function CardFace({
  record,
  showName,
  compact = false,
}: {
  record: UniversityRecord
  showName: boolean
  compact?: boolean
}) {
  const logo = cachedLogo(record.id)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 py-2">
      <div
        className="flex items-center justify-center"
        style={{ width: compact ? 92 : 120, height: compact ? 48 : 64 }}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          /* No file supplied yet: a neutral mark, never a traced logo. */
          <div className="flex h-full w-full items-center justify-center rounded-lg bg-navy-800/8">
            <span className="font-display text-2xl font-extrabold tracking-tight text-navy-800">
              {initialsFor(record)}
            </span>
          </div>
        )}
      </div>
      {showName && (
        <span className="line-clamp-2 text-center font-label text-[0.92rem] font-semibold leading-tight text-navy-800">
          {record.short}
        </span>
      )}
    </div>
  )
}

export function UniversityCard({ record, showName, disabled, dragging, rejected, reducedMotion }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: record.id,
    disabled,
  })

  const lifted = isDragging || dragging

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      animate={
        rejected && !reducedMotion
          ? { x: [0, -9, 9, -6, 6, 0], rotate: [0, -2, 2, -1, 1, 0] }
          : { x: 0, rotate: lifted ? -2.5 : 0 }
      }
      transition={rejected ? { duration: 0.4 } : { type: 'spring', stiffness: 400, damping: 26 }}
      className={[
        'relative select-none rounded-2xl bg-white',
        // touch-action none is what stops the page panning under the finger.
        'touch-none',
        lifted ? 'shadow-lift' : 'shadow-card',
        disabled ? 'opacity-40' : 'cursor-grab active:cursor-grabbing',
      ].join(' ')}
      style={{
        // The dragged original stays in place as a ghost; DragOverlay carries
        // the visible copy, which is what keeps the tray layout stable.
        opacity: isDragging ? 0.25 : 1,
      }}
      aria-label={record.name}
    >
      <CardFace record={record} showName={showName} />
    </motion.div>
  )
}

/** The copy that actually travels with the finger. */
export function DragGhost({ record, showName }: { record: UniversityRecord; showName: boolean }) {
  return (
    <div className="rotate-[-3deg] scale-[1.06] rounded-2xl bg-white shadow-lift">
      <CardFace record={record} showName={showName} />
    </div>
  )
}
