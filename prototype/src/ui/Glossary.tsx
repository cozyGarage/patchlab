const ENTRIES = [
  {
    term: 'Patch panel',
    def: 'Front ports that document and terminate horizontal cabling so you can rearrange with short patch cords.',
  },
  {
    term: 'ToR switch',
    def: 'Top-of-rack switch — the first network hop for servers in that rack.',
  },
  {
    term: 'VLAN',
    def: 'Virtual LAN segment. A cable can be physically up but still fail if VLAN IDs do not match.',
  },
  {
    term: 'Admin down',
    def: 'Port is disabled in software. Perfect copper still shows no link.',
  },
  {
    term: 'OM4 fiber / LC',
    def: 'Multimode fiber patching with LC connectors. Do not use Cat6 on fiber ports.',
  },
  {
    term: 'SFP / Te port',
    def: 'Fiber transceiver cage on the switch (shown here as ToR-SFP).',
  },
  {
    term: 'Link light',
    def: 'Green means L1/L2 adjacency is good in this trainer; amber often means admin-down; red means fault/mismatch.',
  },
] as const;

interface GlossaryProps {
  open: boolean;
  onClose: () => void;
}

export function Glossary({ open, onClose }: GlossaryProps) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="drawer panel"
        role="dialog"
        aria-label="Glossary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2>Glossary</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <ul className="glossary-list">
          {ENTRIES.map((e) => (
            <li key={e.term}>
              <strong>{e.term}</strong>
              <p>{e.def}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
