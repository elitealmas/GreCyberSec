export const speakerLinkedIn = "https://www.linkedin.com/in/ali-mohamed1/";

export type CapturedPacket = {
  src: string;
  alt: string;
  source: string;
  destination: string;
  protocol: string;
  info: string;
};

// Captions joke about the event and the tech only, never about anyone's appearance.
export const capturedPackets: readonly CapturedPacket[] = [
  { src: "/images/beyond-the-firewall/packet-001.jpg", alt: "Ali Mohamed presenting a slide on graduate schemes, internships and junior cybersecurity roles", source: "Ali", destination: "Audience", protocol: "PPTX", info: "Payload: graduate schemes, internships, junior roles. Zero packets dropped." },
  { src: "/images/beyond-the-firewall/packet-002.jpg", alt: "Ali Mohamed in front of a slide reading 'Build relationships. Keep applying.'", source: "Ali", destination: "Audience", protocol: "TCP SYN", info: "Handshake initiated: “Build relationships. Keep applying.”" },
  { src: "/images/beyond-the-firewall/packet-003.jpg", alt: "Ali Mohamed standing beside a slide showing a large question mark", source: "Ali", destination: "Audience", protocol: "ICMP", info: "The big “?” slide. The only ping guaranteed a reply." },
  { src: "/images/beyond-the-firewall/packet-004.jpg", alt: "An attendee asking a question during the Q&A", source: "Audience", destination: "Ali", protocol: "QUERY", info: "First question detected. Intrusion prevention deliberately disabled." },
  { src: "/images/beyond-the-firewall/packet-005.jpg", alt: "An attendee speaking during the Q&A in front of the Greenwich Students' Union sign", source: "Audience", destination: "Ali", protocol: "DPI", info: "Deep packet inspection of the career roadmap, now in progress." },
  { src: "/images/beyond-the-firewall/packet-006.jpg", alt: "Two attendees talking to each other during the session", source: "Audience", destination: "Audience", protocol: "P2P", info: "Peer-to-peer exchange. No VPN required." },
  { src: "/images/beyond-the-firewall/packet-007.jpg", alt: "An attendee listening closely to the talk", source: "Audience", destination: "Ali", protocol: "ACK", info: "Processing… processing… acknowledged." },
  { src: "/images/beyond-the-firewall/packet-008.jpg", alt: "An attendee listening at a desk while others stand nearby", source: "Audience", destination: "Ali", protocol: "ACK", info: "Received, parsed and filed under “apply this week”." },
  { src: "/images/beyond-the-firewall/packet-009.jpg", alt: "An attendee seated at a desk following the discussion", source: "Audience", destination: "Ali", protocol: "KEEPALIVE", info: "Session still up at hour two. Uptime: impressive." },
  { src: "/images/beyond-the-firewall/packet-010.jpg", alt: "Ali Mohamed listening to a question from the audience", source: "Ali", destination: "Audience", protocol: "TLS", info: "Questions came in encrypted. Answers went out in plain text." },
  { src: "/images/beyond-the-firewall/packet-011.jpg", alt: "Ali Mohamed looking out at the room at the end of the session", source: "Ali", destination: "Audience", protocol: "FIN", info: "Connection closed gracefully. Firewall: successfully looked beyond." },
];
