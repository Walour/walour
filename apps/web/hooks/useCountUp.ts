import { useEffect, useRef, useState } from 'react'

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function useCountUp(target: number, duration = 1600, trigger = true) {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!trigger || started.current) return
    started.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setValue(Math.round(easeOutCubic(t) * target))
      if (t < 1) requestAnimationFrame(tick)
      else setValue(target)
    }
    requestAnimationFrame(tick)
  }, [trigger, target, duration])

  return value
}
