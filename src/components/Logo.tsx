/** Logo Lookout : les deux O forment des jumelles tenues par le T. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="48 0 720 460" className={className} role="img" aria-label="Lookout">
      <g fill="none" stroke="#13233F" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 110 45 L 110 290 L 200 290" />
        <circle cx="172" cy="362" r="38" />
        <path d="M 250 324 L 250 352 Q 250 400 290 400 Q 330 400 330 352 L 330 324" />
        <path d="M 382 246 L 382 400" />
        <path d="M 296 214 Q 300 246 330 246 L 434 246 Q 464 246 468 214" />
        <path d="M 590 45 L 590 290" />
        <path d="M 596 176 L 698 62" />
        <path d="M 632 138 L 706 290" />
      </g>
      <circle cx="382" cy="118" r="30" fill="#13233F" />
      <rect x="350" y="132" width="64" height="38" rx="8" fill="#13233F" />
      <circle cx="290" cy="150" r="62" fill="#F2A33A" stroke="#13233F" strokeWidth="30" />
      <circle cx="475" cy="150" r="62" fill="#F2A33A" stroke="#13233F" strokeWidth="30" />
    </svg>
  );
}
