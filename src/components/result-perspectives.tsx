export function ResultPerspectives({ items }: { items: { title: string; body: string }[] }) {
  if (!items.length) return null;
  return <>
    <div className="result-perspectives" aria-label="Perspectives at a glance">
      {items.map((item, index) => <article key={`${item.title}-${index}`} className={`perspective-${index % 4}`}><h3>{item.title}</h3><p>{item.body}</p></article>)}
    </div>
    <svg className="canvas-connectors" viewBox="0 0 1000 38" preserveAspectRatio="none" aria-hidden="true">
      {items.map((item, index) => <path key={`${item.title}-${index}`} d={`M ${(index + .5) * 1000 / items.length} 0 C ${(index + .5) * 1000 / items.length} 28, 500 10, 500 38`} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
    </svg>
  </>;
}
