import { useEffect, useRef } from 'react'

/** Reveal-on-scroll: attach the returned ref to an element that has the `reveal` class;
 *  it gains `is-in` when it scrolls into view, triggering a gentle fade/slide. Honours
 *  prefers-reduced-motion by revealing immediately. */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in')
      return
    }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-in')),
      { threshold: 0.12 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}
