"use client";

// Client component so we can compute the greeting from browser time
// without hydration mismatch.
export function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  const phrase =
    hour < 12 ? "Magandang umaga" :
    hour < 18 ? "Magandang hapon" : "Magandang gabi";

  return (
    <span>
      {phrase}, <span className="text-[var(--text-primary)]">{name}</span>
    </span>
  );
}
