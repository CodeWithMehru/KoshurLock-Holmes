/** Fixed aurora background from the KoshurLock Aurora design: four large
 * blurred color blobs drifting slowly behind all content. Purely
 * presentational; rendered once per view by App. Transform-only animation
 * (GPU-composited); disabled under prefers-reduced-motion. */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <span
        className="animate-drift-1 absolute h-[640px] w-[640px] rounded-full opacity-[0.42] blur-[90px] mix-blend-screen"
        style={{ left: -140, top: -160, background: "radial-gradient(circle, #3B82F6, transparent 68%)" }}
      />
      <span
        className="animate-drift-2 absolute h-[720px] w-[720px] rounded-full opacity-[0.42] blur-[90px] mix-blend-screen"
        style={{ right: -180, top: -120, background: "radial-gradient(circle, #A855F7, transparent 66%)" }}
      />
      <span
        className="animate-drift-3 absolute h-[600px] w-[600px] rounded-full opacity-[0.42] blur-[90px] mix-blend-screen"
        style={{ left: "32%", bottom: -260, background: "radial-gradient(circle, #EC4899, transparent 68%)" }}
      />
      <span
        className="animate-drift-1 absolute h-[420px] w-[420px] rounded-full opacity-[0.42] blur-[90px] mix-blend-screen [animation-duration:34s]"
        style={{ right: "22%", bottom: -160, background: "radial-gradient(circle, #22D3EE, transparent 70%)" }}
      />
    </div>
  );
}
