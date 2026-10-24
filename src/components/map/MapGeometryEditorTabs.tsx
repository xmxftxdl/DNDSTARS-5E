interface Props {
  section: 'structure' | 'travel'
  onStructure: () => void
  onTravel: () => void
}

export function MapGeometryEditorTabs({ section, onStructure, onTravel }: Props) {
  return (
    <div role="tablist" aria-label="墙体与几何编辑内容" className="mb-2 flex w-full gap-1">
      <button type="button" role="tab" aria-selected={section === 'structure'}
        onClick={onStructure}
        className={`rounded-lg px-3 py-2 text-xs ${section === 'structure' ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400'}`}>墙体编辑</button>
      <button type="button" role="tab" aria-selected={section === 'travel'}
        onClick={onTravel}
        className={`rounded-lg px-3 py-2 text-xs ${section === 'travel' ? 'bg-violet-500/20 text-violet-100' : 'text-slate-400'}`}>地图跳转</button>
    </div>
  )
}
