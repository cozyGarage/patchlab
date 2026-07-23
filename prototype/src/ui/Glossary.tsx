const ENTRIES = [
  {
    term: 'Structured cabling',
    def: 'Standards-based pathways and patching (TIA-568 / TIA-942 thinking): panels, labels, and predictable moves instead of spaghetti point-to-point runs.',
  },
  {
    term: 'ToR switch',
    def: 'Top-of-rack switch — first hop for servers. Keep the patch panel nearby to shorten copper runs.',
  },
  {
    term: 'PDU',
    def: 'Power distribution unit. Active gear stays dark until a PSU cord lands on a PDU outlet.',
  },
  {
    term: 'Console / rollover',
    def: 'Out-of-band serial access. Use it when the network path is broken and you still need to configure a device.',
  },
  {
    term: 'VLAN',
    def: 'Virtual LAN segment. A cable can be physically up but still fail if VLAN IDs do not match.',
  },
  {
    term: 'Subnet / prefix',
    def: 'Hosts share a network when address + mask (CIDR prefix) match. /24 is the classic beginner lab size.',
  },
  {
    term: 'Ping path',
    def: 'In PatchLab: both devices powered, data cabled, same subnet, and firewall policy must allow the flow.',
  },
  {
    term: 'Firewall ACL',
    def: 'Top-down permit/deny rules. First match wins; an implicit deny can block traffic even when cabling looks perfect.',
  },
  {
    term: 'OM4 fiber / LC',
    def: 'Multimode fiber patching with LC connectors. Never seat Cat6 into an SFP cage.',
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
