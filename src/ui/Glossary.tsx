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
    term: 'Access VLAN',
    def: 'An access port belongs to one VLAN. Change the switchport access VLAN to move a host between segments without inventing a new cable type.',
  },
  {
    term: 'Trunk',
    def: 'A trunk carries multiple VLANs (802.1Q tagging). Uplinks between switches or to a firewall often run as trunks.',
  },
  {
    term: 'Default gateway',
    def: 'The router/firewall IP on the local subnet that hosts use to leave their network. Wrong or missing gateway breaks off-subnet pings.',
  },
  {
    term: 'Static NAT',
    def: 'One-to-one mapping: one public outside IP ↔ one private inside host. Used to publish a server to WAN peers.',
  },
  {
    term: 'Inter-VLAN routing',
    def: 'Hosts in different VLANs cannot talk at L2. A router/firewall needs an interface (or SVI) in each VLAN — then it routes between them.',
  },
  {
    term: 'Static route',
    def: 'Manual route entry: destination prefix → next-hop IP. Used when the destination is not on a directly connected interface.',
  },
  {
    term: 'Longest-prefix match',
    def: 'When multiple routes cover a destination, the most specific prefix wins (a /32 host route beats a /24). A poisoned host route can black-hole traffic until you override it.',
  },
  {
    term: 'Admin up / no shutdown',
    def: 'A port can be cabled correctly and still stay dark if it is administratively down. Enabling the port (no shutdown) restores the link without moving the cable.',
  },
  {
    term: 'Subnet mask / prefix',
    def: 'Defines which bits are the network. 10.10.10.10/24 and 10.10.10.1/16 are not “the same subnet” for routing decisions.',
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
