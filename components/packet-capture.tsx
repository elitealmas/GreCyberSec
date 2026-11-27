import Image from "next/image";
import { WindowTitlebar } from "@/components/window-titlebar";
import { capturedPackets, speakerLinkedIn } from "@/lib/beyond-firewall-gallery";

export function PacketCapture() {
  const total = capturedPackets.length;

  return <section className="site-shell pb-16 sm:pb-24" aria-labelledby="packet-capture-heading">
    <div className="window">
      <WindowTitlebar title="capture.pcap — Beyond the Firewall, 29 Oct 2026" />
      <div className="window-menubar" aria-hidden="true"><span>File</span><span>Capture</span><span>Analyze</span><span>Statistics</span></div>
      <div className="window-body">
        <p className="eyebrow">Packet capture</p>
        <h2 id="packet-capture-heading" className="mt-3 text-3xl tracking-tight text-heading sm:text-4xl">We sniffed the session. For science.</h2>
        <p className="mt-4 max-w-3xl leading-7 text-body">{total} packets captured between 14:00 and 16:00 in the Dreadnought Board Room, featuring our guest speaker <a className="text-link" href={speakerLinkedIn} target="_blank" rel="noopener noreferrer">Ali Mohamed <span aria-hidden="true">↗</span></a>. No credentials were harmed.</p>
        <div className="pcap-filter mt-6" aria-hidden="true"><span>Filter:</span><code>ip.src == &quot;Ali&quot; || career.questions</code></div>
        <ol className="pcap-grid mt-6">
          {capturedPackets.map((packet, index) => {
            const number = String(index + 1).padStart(3, "0");
            return <li key={packet.src}>
              <a className="pcap-packet" href={packet.src} target="_blank" rel="noopener noreferrer">
                <span className="pcap-meta"><span>No. {number}</span><span>{packet.protocol}</span></span>
                <span className="pcap-photo"><Image src={packet.src} alt={packet.alt} width={1066} height={1600} sizes="(min-width: 1024px) 24vw, (min-width: 640px) 45vw, 92vw" /></span>
                <span className="pcap-route">{packet.source} <span aria-hidden="true">→</span><span className="sr-only">to</span> {packet.destination}</span>
                <span className="pcap-info">{packet.info}</span>
              </a>
            </li>;
          })}
        </ol>
      </div>
      <div className="window-statusbar"><span>Packets: {total} · Displayed: {total} · Dropped: 0</span><span>Speaker: Ali Mohamed</span></div>
    </div>
  </section>;
}
