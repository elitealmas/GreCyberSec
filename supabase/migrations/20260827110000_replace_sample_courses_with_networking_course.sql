-- Production content migration for GreCyberSec.
--
-- IMPORTANT: the delete below removes only the three disposable sample courses.
-- It also deliberately removes their dependent test lessons, lesson_progress,
-- quizzes, quiz_attempts, quiz_answers and private answer keys. It never touches
-- auth.users or data belonging to any other course.

alter table public.courses
  add column if not exists difficulty text,
  add column if not exists estimated_hours integer;

alter table public.course_modules
  add column if not exists slug text,
  add column if not exists summary text;

-- Preserve any unrelated existing module rows while making slugs available for
-- module quiz routes. The sample modules are removed further below.
update public.course_modules
set slug = coalesce(slug, 'module-' || replace(id::text, '-', '')),
    summary = coalesce(summary, 'Course module')
where slug is null or summary is null;

alter table public.course_modules alter column slug set not null;
alter table public.course_modules alter column summary set not null;
create unique index if not exists course_modules_course_slug_idx on public.course_modules (course_id, slug);

-- The original schema intentionally allowed one final quiz per course. Extend it
-- safely so a quiz can additionally belong to one module, while retaining a
-- single course-level final assessment.
alter table public.quizzes add column if not exists module_id uuid references public.course_modules(id) on delete cascade;
alter table public.quizzes drop constraint if exists quizzes_course_id_key;
create unique index if not exists quizzes_one_final_per_course_idx on public.quizzes (course_id) where module_id is null;
create unique index if not exists quizzes_one_per_module_idx on public.quizzes (module_id) where module_id is not null;

-- Store detailed feedback beside the already-private answer key. It is copied to
-- a member's quiz_answers row only after submission; it is not selectable before.
alter table public.quiz_question_answer_keys add column if not exists explanation text;

-- Replace the scoring function only to add post-submission feedback. It still
-- derives auth.uid() itself, reads private keys server-side, and never trusts a
-- score supplied by the browser.
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_question record;
  v_attempt_id uuid;
  v_response text;
  v_correct_answer text;
  v_explanation text;
  v_is_correct boolean;
  v_correct_answers integer := 0;
  v_scoreable_questions integer := 0;
  v_score numeric(5,2);
  v_passed boolean;
begin
  if v_user_id is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 100 then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
  select * into v_quiz from public.quizzes where id = p_quiz_id and is_published;
  if not found then raise exception 'Quiz is unavailable' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text) left join public.quiz_questions q on q.id = submitted.question_id and q.quiz_id = p_quiz_id where submitted.question_id is null or q.id is null) then raise exception 'Invalid quiz answers' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text) group by question_id having count(*) > 1) then raise exception 'Duplicate quiz answers' using errcode = '22023'; end if;

  insert into public.quiz_attempts (user_id, quiz_id, score, correct_answers, scoreable_questions, passed)
  values (v_user_id, p_quiz_id, 0, 0, 0, false) returning id into v_attempt_id;

  for v_question in select id, question_type from public.quiz_questions where quiz_id = p_quiz_id order by position loop
    select left(coalesce(submitted.response, ''), 5000) into v_response from jsonb_to_recordset(p_answers) as submitted(question_id uuid, response text) where submitted.question_id = v_question.id;
    v_response := coalesce(v_response, ''); v_is_correct := null; v_explanation := null;
    if v_question.question_type = 'mcq' then
      select correct_answer, explanation into v_correct_answer, v_explanation from public.quiz_question_answer_keys where question_id = v_question.id;
      v_scoreable_questions := v_scoreable_questions + 1;
      v_is_correct := lower(btrim(v_response)) = lower(btrim(v_correct_answer));
      if v_is_correct then v_correct_answers := v_correct_answers + 1; end if;
    end if;
    insert into public.quiz_answers (attempt_id, question_id, response, is_correct, feedback)
    values (v_attempt_id, v_question.id, v_response, v_is_correct,
      case when v_question.question_type <> 'mcq' then 'Saved for review'
           when v_is_correct then 'Correct. ' || coalesce(v_explanation, '')
           else 'Not quite. ' || coalesce(v_explanation, '') end);
  end loop;
  v_score := case when v_scoreable_questions = 0 then 0 else round((v_correct_answers::numeric / v_scoreable_questions) * 100, 2) end;
  v_passed := v_score >= v_quiz.passing_score;
  update public.quiz_attempts set score = v_score, correct_answers = v_correct_answers, scoreable_questions = v_scoreable_questions, passed = v_passed where id = v_attempt_id;
  return jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'passed', v_passed);
end;
$$;

-- Explicitly clear dependencies first so the removal remains valid even where
-- quiz_answers has a restrictive question foreign key.
with sample_course_ids as (
  select id from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals')
)
delete from public.quiz_answers where attempt_id in (select a.id from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where q.course_id in (select id from sample_course_ids));
with sample_course_ids as (
  select id from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals')
)
delete from public.quiz_attempts where quiz_id in (select id from public.quizzes where course_id in (select id from sample_course_ids));
with sample_course_ids as (
  select id from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals')
)
delete from public.quiz_question_answer_keys where question_id in (select qq.id from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id where q.course_id in (select id from sample_course_ids));
with sample_course_ids as (
  select id from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals')
)
delete from public.quiz_questions where quiz_id in (select id from public.quizzes where course_id in (select id from sample_course_ids));
with sample_course_ids as (
  select id from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals')
)
delete from public.quizzes where course_id in (select id from sample_course_ids);
with sample_course_ids as (
  select id from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals')
)
delete from public.lesson_progress where lesson_id in (select l.id from public.lessons l join public.course_modules m on m.id = l.module_id where m.course_id in (select id from sample_course_ids));
delete from public.courses where slug in ('networking-for-cybersecurity', 'linux-python-bash', 'cybersecurity-fundamentals');

insert into public.courses (slug, title, description, difficulty, estimated_hours, is_published)
values ('networking-for-cybersecurity', 'Networking for Cybersecurity', 'A practical, defensive networking pathway for cybersecurity students: from first principles to packet analysis, segmentation, incident investigation and CCNA-level foundations.', 'Beginner → Intermediate', 42, true);

insert into public.course_modules (course_id, slug, title, summary, position)
select c.id, v.slug, v.title, v.summary, v.position
from public.courses c
cross join (values
  ('networking-foundations', 'Networking foundations', 'Networks, topologies, performance and the language used to describe real traffic.', 1),
  ('network-devices', 'Network devices', 'The roles, boundaries and telemetry of common network infrastructure.', 2),
  ('osi-and-tcp-ip', 'OSI and TCP/IP models', 'Layered communication, encapsulation and a full web-request walkthrough.', 3),
  ('ethernet-layer-2', 'Ethernet and Layer 2', 'Frames, switching, ARP and the security implications of local networks.', 4),
  ('ipv4-addressing', 'IPv4 addressing', 'Addresses, ranges, gateways and practical packet forwarding.', 5),
  ('subnetting', 'Subnetting and VLSM', 'Manual binary reasoning, CIDR and defensible address plans.', 6),
  ('ipv6', 'IPv6', 'Modern addressing, neighbour discovery and dual-stack security.', 7),
  ('tcp-and-udp', 'TCP and UDP', 'Transport behaviour, flags, reliability and packet-capture interpretation.', 8),
  ('ports-and-sockets', 'Ports and sockets', 'Services, ephemeral ports and how endpoint conversations are identified.', 9),
  ('core-protocols', 'Core network protocols', 'The protocols analysts repeatedly meet in enterprise traffic.', 10),
  ('dns-deep-dive', 'DNS deep dive', 'Resolution, records, encrypted DNS and defensive DNS analysis.', 11),
  ('routing-and-nat', 'Routing and NAT', 'Routing decisions, dynamic protocols and address translation evidence.', 12),
  ('vlans-and-segmentation', 'VLANs and network segmentation', 'Trust boundaries, tagged links and blast-radius reduction.', 13),
  ('firewalls-acls-vpns', 'Firewalls, ACLs and VPNs', 'Policy enforcement, monitoring controls and secure connectivity.', 14),
  ('packet-analysis-troubleshooting', 'Packet analysis and troubleshooting', 'Safe diagnostics, Wireshark and evidence-led troubleshooting.', 15),
  ('network-security-analysis', 'Network security and attack analysis', 'Recognising, containing and investigating hostile network behaviour.', 16)
) as v(slug, title, summary, position)
where c.slug = 'networking-for-cybersecurity';

-- Lessons are Markdown, rendered by an allow-listed React renderer rather than
-- arbitrary HTML. Each record is a substantial, self-contained teaching unit.
insert into public.lessons (module_id, slug, title, summary, content, position)
select m.id, l.slug, l.title, l.summary, l.content, l.position
from public.course_modules m
join public.courses c on c.id = m.course_id and c.slug = 'networking-for-cybersecurity'
join (values
  ('networking-foundations', 'what-is-a-network', 'What a network is and why defenders care', 'Build a precise mental model of systems exchanging data across shared media.', $$## Learning objectives
- Distinguish a host, client, server and peer.
- Explain why network context is essential in cyber investigations.

## Core concepts
A computer network is a set of hosts that exchange data using agreed protocols and a physical or wireless path. A **host** is any addressable endpoint: a laptop, phone, server, camera or virtual machine. In a client-server exchange, the client requests a service and the server responds. Peer-to-peer systems let peers act in both roles.

Cybersecurity work starts with this map of relationships. A SOC alert that says a workstation contacted an unfamiliar server is not meaningful until you know the expected service, direction, identity and data path. Incident responders use the same model to scope affected hosts; cloud teams apply it to workloads and security groups.

> **Security lens:** Networks create useful dependencies. Every allowed path is also a path that needs ownership, logging and an explicit reason.

## Example
When a browser requests a university portal, the laptop is the client, the portal is the server, and DNS, routing, TLS and HTTP each help the request succeed. A proxy log may reveal the destination; a firewall log may reveal whether the path was permitted.

## Common mistakes
Do not assume “server” means a physical machine or “client” means a person. Both describe a role in one conversation.

## Knowledge check
What extra context would you request before deciding whether an outbound connection is suspicious?$$, 1),
  ('networking-foundations', 'network-types-and-boundaries', 'LAN, WAN, WLAN, PAN, internet and intranet', 'Understand network scope and how trust assumptions change across boundaries.', $$## Learning objectives
- Compare common network types and their security assumptions.
- Identify where a private network still depends on public infrastructure.

## Core concepts
A **LAN** connects a limited site such as a lab or office. A **WAN** joins sites over provider or private links. A **WLAN** is a LAN using radio, while a **PAN** is a short-range personal network such as Bluetooth peripherals. An **intranet** is an organisation-controlled network service; the **internet** is the global interconnection of independent networks.

Scope does not equal trust. A wireless guest network might share a building with staff devices but should have a separate security policy. A cloud virtual network looks private, yet its identity, routing and management interfaces still rely on provider services and the public internet.

## Scenario
An employee connects a managed laptop to home Wi-Fi and then to a remote-access VPN. The local WLAN is not the corporate LAN. The VPN creates a protected, authenticated route into selected corporate resources; split-tunnelling policy determines which traffic uses it.

## Key takeaway
Draw the boundary first: who owns the network, which identities may enter, and which paths cross into a different trust zone?$$, 2),
  ('networking-foundations', 'topology-performance-and-domains', 'Topology, bandwidth, latency and network domains', 'Relate network shape and performance measurements to reliability and detection.', $$## Learning objectives
- Read physical and logical topology at a high level.
- Differentiate bandwidth, throughput, latency, jitter and packet loss.

## Core concepts
Physical topology is the cabling or radio layout; logical topology is how traffic actually flows. A **star** places endpoints around a switch, a **mesh** supplies multiple paths, and bus/ring designs describe older or specialised shared arrangements. Modern networks are commonly logical stars with redundant uplinks.

Bandwidth is the theoretical capacity of a link. Throughput is the useful data achieved. Latency is delay, jitter is variation in delay, and packet loss is traffic that never arrives. Voice and video dislike jitter; TCP can recover from modest loss but may slow sharply. A **collision domain** is a shared Ethernet segment where simultaneous transmission can conflict; a switch separates those domains. A **broadcast domain** is the set of hosts that receive a Layer-2 broadcast, usually bounded by a router or VLAN.

## Security relevance
A sudden rise in DNS latency or retransmissions can be an early service-health signal. Oversized broadcast domains also make ARP noise, accidental exposure and troubleshooting harder.

## Knowledge check
Why can a fast link still deliver poor application performance? Name two measurements besides bandwidth. $$, 3),
  ('networking-foundations', 'nics-mac-addresses-and-diagrams', 'NICs, MAC addresses and useful network diagrams', 'Connect physical interfaces and addressing to clear defensive documentation.', $$## Learning objectives
- Explain the purpose of a network interface card and MAC address.
- Produce a diagram that supports response rather than decoration.

## Core concepts
A **NIC** is the interface that sends and receives network signals. It may be physical, virtual or software-defined. At Ethernet Layer 2, a NIC uses a 48-bit MAC address, normally displayed in hexadecimal such as `00:1A:2B:3C:4D:5E`. A MAC identifies an interface on a local segment; it is not a global identity or a replacement for IP addressing.

An investigation-ready diagram names segments, VLANs, gateways, firewalls, key servers, wireless networks, cloud links, monitoring points and ownership. Use arrows only when they mean something: permitted flow, mirrored telemetry, administration or a third-party connection. Record both physical links and the logical trust boundaries that matter.

## Example table
| Diagram item | Why it matters |
| --- | --- |
| Gateway | Likely path between subnets |
| SPAN port | Source of packet evidence |
| VPN concentrator | Remote-access boundary |

## Knowledge check
Which diagram annotation would help an analyst decide whether a device can reach a database directly?$$, 4),
  ('network-devices', 'switches-routers-and-forwarding', 'Switches, Layer 3 switches and routers', 'Understand the forwarding decisions and boundaries created by core infrastructure.', $$## Learning objectives
- Separate Layer-2 switching from Layer-3 routing.
- Recognise where each device contributes to security visibility.

## Core concepts
A Layer-2 switch forwards Ethernet frames using a MAC address table. It learns which source MAC address appeared on each port and sends known unicast frames only where needed. A Layer-3 switch can also route between IP networks, usually at campus speed. A router connects distinct IP networks and chooses a next hop from its routing table.

These roles influence evidence collection. A switch can expose a SPAN or mirror port for a sensor. A router or Layer-3 switch may record NetFlow, route changes and inter-VLAN traffic. Neither automatically replaces a firewall policy: routing answers “where can this go?”, while policy should answer “is it allowed?”.

## Scenario
If a finance VLAN can reach a development VLAN through a Layer-3 switch, document the routed interface and enforce an ACL or firewall rule at the boundary. Do not assume the VLAN label alone is a control.

## Knowledge check
Which table does a switch use for ordinary Layer-2 forwarding, and which table does a router use?$$, 1),
  ('network-devices', 'edge-wireless-and-access-devices', 'Modems, access points, hubs, bridges and repeaters', 'Identify access-layer devices and the risks of shared or wireless media.', $$## Learning objectives
- Describe the role of common edge and access devices.
- Identify security concerns specific to wireless and legacy shared media.

## Core concepts
A modem adapts a provider medium to digital network signals. A wireless access point bridges Wi-Fi clients into a wired network and must enforce modern authentication, encryption and client separation where required. Bridges connect Layer-2 segments; repeaters regenerate signals. Hubs repeat every received signal to every port and create one shared collision domain, which is why they are largely obsolete.

Wireless changes the physical boundary: radio can extend outside a building. Defenders should inventory access points, use approved encryption and authentication, separate guests, monitor for rogue devices and review management access. A bridge or repeater can be legitimate but may unexpectedly extend a trusted segment.

> **Warning:** A device being physically nearby does not make it trusted. Treat unmanaged network hardware as an unauthorised connection until verified.

## Knowledge check
Why does a hub provide less traffic isolation than a switch?$$, 2),
  ('network-devices', 'application-and-security-devices', 'Firewalls, proxies, load balancers, IDS and IPS', 'Place policy, application delivery and detection devices in a real deployment.', $$## Learning objectives
- Distinguish forward proxies, reverse proxies and load balancers.
- Explain the difference between detecting and blocking malicious traffic.

## Core concepts
A firewall applies policy to traffic. A forward proxy acts for internal clients; a reverse proxy sits in front of servers, often terminating TLS and enforcing application controls. A load balancer distributes requests across healthy servers. An IDS alerts on suspicious traffic; an IPS can actively block or reset traffic when placed inline.

Deployment matters. A reverse proxy may log the original client address only if headers are configured and trusted correctly. An IPS false positive can interrupt a legitimate service, so tuning, change control and a fallback plan are part of defensive engineering. Load balancer health checks are useful telemetry but are not proof an application is secure.

## Scenario
An internet-facing web service can use a reverse proxy/WAF at the edge, a load balancer for availability, segmented application servers behind it, and centralised logs from every layer.

## Knowledge check
Which device normally represents an external web server to the internet: a forward or reverse proxy?$$, 3),
  ('network-devices', 'infrastructure-services-and-visibility', 'DNS, DHCP, VPN, TAPs and SPAN ports', 'Understand the services and telemetry points that make networks manageable.', $$## Learning objectives
- Identify the purpose of DNS, DHCP and VPN concentrators.
- Compare passive TAPs with switch SPAN/mirror ports.

## Core concepts
DNS translates names to records; DHCP leases addressing and related network settings; a VPN concentrator terminates protected remote or site links. These services are high-value because availability failures affect many users and their logs can explain identity, address and destination history.

A network TAP passively copies traffic from a physical link to a sensor, while a SPAN/mirror port asks a switch to copy selected traffic. TAPs are predictable but require physical placement; SPAN may drop copied packets under load and depends on switch configuration. Record where evidence was collected before drawing conclusions from missing packets.

## Example
To investigate an unknown IP, correlate DHCP lease history (who used it), DNS logs (which names it asked for), VPN logs (whether it was remote) and firewall/flow logs (where it connected).

## Knowledge check
Why might a SPAN capture be incomplete during a busy incident?$$, 4),
  ('osi-and-tcp-ip', 'osi-physical-to-network', 'OSI layers 1–3: signal, frame and packet', 'Learn the lower OSI layers and the security failures that appear at each.', $$## Learning objectives
- State the purpose of Physical, Data Link and Network layers.
- Relate devices, addressing and PDUs to the correct layer.

## Core concepts
Layer 1, **Physical**, carries bits as electrical, optical or radio signals; cables, transceivers and repeaters belong here. Layer 2, **Data Link**, moves frames on a local link using MAC addresses, Ethernet and VLAN tags; switches work here. Layer 3, **Network**, moves packets between networks using IP addresses, ICMP and routers.

Security problems follow the layer. Physical access, damaged cabling and rogue wireless devices are Layer-1 concerns. ARP manipulation, MAC-table pressure and unapproved VLAN access are Layer-2 concerns. IP spoofing, routing mistakes and overly broad network paths are Layer-3 concerns.

## PDU map
| Layer | Typical PDU | Addressing |
| --- | --- | --- |
| Data Link | Frame | MAC |
| Network | Packet | IP |

## Knowledge check
At which layer would you expect to see a destination MAC address?$$, 1),
  ('osi-and-tcp-ip', 'osi-transport-to-application', 'OSI layers 4–7: conversation and content', 'Understand transport, session, presentation and application responsibilities.', $$## Learning objectives
- Explain the upper OSI layers without treating them as isolated boxes.
- Identify common protocols and security issues at Layers 4–7.

## Core concepts
Layer 4, **Transport**, provides end-to-end delivery with TCP or UDP and uses ports. Layer 5, **Session**, manages dialog state. Layer 6, **Presentation**, handles representation such as encryption, compression and character encoding. Layer 7, **Application**, is where protocols such as HTTP, DNS, SMTP and SSH serve user-facing functions.

The layers are a troubleshooting model, not a claim that every implementation exposes a neat boundary. A TLS certificate problem appears around presentation/application; a blocked TCP port is transport/policy; a malformed HTTP request is application-level. Analysts use the layers to ask disciplined questions: can the host signal, reach the network, establish a transport conversation, and exchange valid application data?

## Security lens
Application controls cannot compensate for an exposed management port, and encrypted traffic still leaves useful transport and endpoint metadata.

## Knowledge check
Which layer uses ports, and which layer normally contains HTTP semantics?$$, 2),
  ('osi-and-tcp-ip', 'tcp-ip-encapsulation-and-pdus', 'TCP/IP, encapsulation and protocol data units', 'Follow data as it gains and loses headers across a network path.', $$## Learning objectives
- Compare the TCP/IP model with OSI.
- Explain encapsulation, de-encapsulation, segments, packets, frames and bits.

## Core concepts
The TCP/IP model groups work into Link, Internet, Transport and Application layers. It maps cleanly enough to OSI for everyday analysis: Ethernet sits at Link, IP at Internet, TCP/UDP at Transport, and services such as HTTP/DNS at Application.

When a browser sends data, the application creates content; TCP adds a transport header to form a **segment**; IP adds source/destination addressing to form a **packet**; Ethernet adds local MAC addresses and an FCS to form a **frame**; the medium carries **bits**. At each router, the incoming Layer-2 frame is removed and a new frame is built for the next local link. The IP packet normally continues with the same end-to-end addresses.

## Common mistake
Do not confuse the MAC addresses seen on one link with the IP destination across the whole route. MAC addresses change hop by hop.

## Knowledge check
Which header is rebuilt at every routed Ethernet hop: IP or Ethernet?$$, 3),
  ('osi-and-tcp-ip', 'website-request-walkthrough', 'What happens when a user opens a website', 'Trace a web request from name lookup to encrypted response and logs.', $$## Learning objectives
- Walk through DNS, routing, TCP, TLS and HTTP in order.
- Identify the evidence each stage can generate.

## Walkthrough
1. The browser checks caches, then asks a resolver for the site name.
2. The host decides whether the destination is local; otherwise it ARPs for the default gateway’s MAC address.
3. Routers forward IP packets toward the destination network.
4. TCP performs a three-way handshake to destination port `443`.
5. TLS authenticates the server and negotiates encryption.
6. HTTP carries the request and response inside the protected TLS session.

## Security relevance
DNS logs may show the name, DHCP may tie the client IP to a device, firewall logs may show the connection, and a reverse proxy may record the HTTP request. With HTTPS, a passive observer cannot normally read the page content, but timing, endpoint, certificate and volume metadata remain useful.

## Knowledge check
Why must DNS succeed before the browser can normally open a name-based website?$$, 4),
  ('ethernet-layer-2', 'ethernet-frames-and-mtu', 'Ethernet frames, EtherType and MTU', 'Inspect the fields that carry local traffic and recognise size boundaries.', $$## Learning objectives
- Name the principal Ethernet frame fields.
- Explain MTU and why frame-size assumptions matter.

## Core concepts
An Ethernet II frame begins with a preamble and start-frame delimiter for timing, then destination and source MAC addresses, an **EtherType**, payload and frame check sequence (FCS). The EtherType identifies the carried protocol, for example IPv4 or ARP. Traditional Ethernet payloads are commonly 46–1500 bytes; a smaller payload is padded to meet minimum frame size. The usual IP MTU on Ethernet is 1500 bytes, though jumbo frames exist in controlled environments.

The FCS detects accidental corruption on the link; it is not cryptographic protection. If a path has a smaller MTU than the sender expects, packets may fragment or fail depending on protocol and settings. VPNs add headers and can lower the effective MTU.

## Example
A capture shows EtherType `0x0800`: that frame carries IPv4. `0x0806` indicates ARP.

## Knowledge check
What does EtherType tell a receiver, and is an FCS a security signature?$$, 1),
  ('ethernet-layer-2', 'mac-learning-and-forwarding', 'MAC tables, learning, forwarding and flooding', 'Understand normal switch behaviour before diagnosing anomalies.', $$## Learning objectives
- Explain how a switch learns MAC addresses.
- Differentiate forwarding, filtering and unknown-unicast flooding.

## Core concepts
A switch records the source MAC address and incoming port of each frame. For a known destination on another port, it forwards the frame there. For a known destination on the same port, it filters the frame. If the destination is unknown, it floods the frame within that VLAN so the owner can reply and become learned. Broadcast and many multicast frames are also deliberately forwarded within the broadcast domain.

MAC entries age out because devices move or disappear. A MAC address rapidly appearing on many ports, a surge of unknown-unicast flooding or a table filled with implausible entries deserves investigation, but normal moves can occur after virtual-machine migrations or redundancy failover.

## Security relevance
Port security, 802.1X, separate VLANs and monitoring of MAC moves can reduce unauthorised access and provide useful alerts.

## Knowledge check
Why does a switch flood an unknown unicast frame, and where is it normally contained?$$, 2),
  ('ethernet-layer-2', 'arp-and-local-delivery', 'ARP, caches and gratuitous ARP', 'Map IPv4 addresses to local MAC addresses and recognise normal ARP behaviour.', $$## Learning objectives
- Explain ARP request/reply behaviour and ARP caching.
- Describe the legitimate uses of gratuitous ARP.

## Core concepts
IPv4 uses ARP to discover the MAC address associated with an IP address on the local broadcast domain. A host broadcasts “who has this IP?” and the owner replies with its MAC address. The result is retained temporarily in an ARP cache. To reach a remote network, the host ARPs for the default gateway rather than for the remote server.

A **gratuitous ARP** is an unsolicited announcement. It can refresh peers after a device changes its address, support high-availability failover or detect an address conflict. It is therefore not automatically malicious; compare it with change records, device identity and subsequent traffic.

## Example
`arp -a` on a local host displays cached mappings. Treat it as a moment-in-time observation, not authoritative network inventory.

## Knowledge check
When contacting an internet server, whose MAC address does a workstation normally resolve with ARP?$$, 3),
  ('ethernet-layer-2', 'layer-2-security-monitoring', 'Layer 2 security: spoofing, flooding and monitoring', 'Recognise local-network abuse concepts and focus on prevention and evidence.', $$## Learning objectives
- Describe ARP spoofing and MAC flooding conceptually.
- Identify defensive controls and safe monitoring evidence.

## Core concepts
ARP spoofing attempts to convince hosts that an attacker-controlled MAC address owns another IP, potentially placing traffic on an unintended path. MAC-table flooding attempts to pressure a switch into more flooding behaviour. Both rely on local Layer-2 access or a compromised position; they are reasons to protect access ports, not reasons to experiment on networks without written authorisation.

Defenders can use dynamic ARP inspection where supported, DHCP snooping bindings, port security, 802.1X, VLAN separation and alerts on unusual MAC/ARP changes. A packet sensor or switch log should record timestamps, VLAN, port, MAC and IP observations so an incident can be correlated with DHCP and identity records.

> **Defensive boundary:** Learn the indicators and mitigations; perform testing only in a lab or within explicit approved scope.

## Knowledge check
Which control can validate ARP messages against trusted DHCP bindings?$$, 4),
  ('ipv4-addressing', 'ipv4-binary-and-address-parts', 'IPv4 structure, binary and address parts', 'Read a 32-bit IPv4 address as network and host portions.', $$## Learning objectives
- Convert a simple octet between decimal and binary.
- Explain how a mask separates network and host bits.

## Core concepts
IPv4 is a 32-bit address written as four decimal octets, for example `192.168.10.25`. Each octet represents eight binary bits. A subnet mask or CIDR prefix marks the network portion; remaining bits identify hosts within that network. With `/24`, the first 24 bits are network bits, so `192.168.10.25/24` belongs to network `192.168.10.0`.

Binary is not ceremony: it explains why a prefix boundary can occur inside an octet. For example, `/26` means the final octet begins `11000000` in the mask (decimal 192), creating blocks of 64 addresses.

## Worked example
`192.168.10.25 AND 255.255.255.0` gives network `192.168.10.0`. The host portion is the final octet.

## Knowledge check
How many total bits are in an IPv4 address?$$, 1),
  ('ipv4-addressing', 'ipv4-special-and-private-addresses', 'Public, private, loopback and special IPv4 ranges', 'Recognise address categories before interpreting traffic.', $$## Learning objectives
- Identify RFC1918 private space and common special ranges.
- Avoid treating address type as a complete security judgement.

## Core concepts
RFC1918 private ranges are `10.0.0.0/8`, `172.16.0.0/12` and `192.168.0.0/16`; they are not globally routed on the public internet. Loopback `127.0.0.0/8` refers to the local host. Link-local/APIPA `169.254.0.0/16` often appears when DHCP fails. `0.0.0.0` can mean an unspecified address, and `255.255.255.255` is the limited broadcast address. IPv4 multicast uses `224.0.0.0/4`.

Private does not mean harmless. A private address in a firewall log may represent a critical internal server. Conversely, a public address can be a legitimate SaaS service. Interpret ownership, direction, port, identity and expected behaviour together.

## Knowledge check
Which range commonly indicates a host could not obtain a DHCP lease?$$, 2),
  ('ipv4-addressing', 'dhcp-static-addressing-and-gateways', 'DHCP, static addressing and default gateways', 'Understand address configuration and the information it leaves for responders.', $$## Learning objectives
- Explain DHCP’s basic lease exchange.
- Distinguish a default gateway from a DNS resolver.

## Core concepts
DHCP commonly follows Discover, Offer, Request and Acknowledgement (DORA). It provides an IP address, subnet mask, default gateway, DNS servers and lease timing. Static addressing is appropriate for controlled infrastructure when documented; unmanaged static addresses can cause conflicts and obscure asset history.

The **default gateway** is the local router used for off-subnet traffic. DNS resolves names; it does not forward ordinary IP packets. During an investigation, DHCP lease data may link an IP and MAC to a device at a particular time, but lease records should be correlated with authentication and endpoint data.

## Command example
```text
ipconfig /all        # Windows: inspect current settings
ip route             # Linux: inspect routing decisions
```

## Knowledge check
Which DHCP option tells a host where to send traffic for remote networks?$$, 3),
  ('ipv4-addressing', 'ipv4-forwarding-between-networks', 'How IPv4 packets cross networks', 'Follow host, gateway and router decisions without confusing local and remote delivery.', $$## Learning objectives
- Explain local-versus-remote destination decisions.
- Describe what changes at a routed Ethernet hop.

## Core concepts
A host compares the destination IP with its own address and subnet mask. If the destination is on the same network, it ARPs for that host. If it is remote, it sends the frame to the default gateway’s MAC address while retaining the remote destination IP inside the packet. The router removes the incoming frame, consults its routing table, decrements TTL and builds a new frame for the next link.

This distinction explains why an incorrect mask can cause surprising failures: a host may wrongly believe a remote system is local and ARP for it. It also explains why a capture taken on different sides of a router shows different Layer-2 addresses for the same IP conversation.

## Knowledge check
Which address stays end-to-end in ordinary routed traffic: the destination IP or destination MAC?$$, 4),
  ('subnetting', 'subnetting-binary-and-cidr', 'Subnetting foundations: binary, CIDR and powers of two', 'Use binary boundaries and powers of two to reason about networks manually.', $$## Learning objectives
- Relate a CIDR prefix to host bits and address counts.
- Recall common prefixes from `/8` through `/32`.

## Core concepts
For IPv4, total addresses in a prefix are `2^(32-prefix)`. Traditional usable-host arithmetic is usually total minus network and broadcast addresses, though point-to-point and special cases deserve separate treatment. `/24` has 256 total addresses and normally 254 usable hosts; `/30` has four total and normally two usable hosts.

Common anchors are `/8` (16,777,216 addresses), `/16` (65,536), `/24` (256), `/25` (128), `/26` (64), `/27` (32), `/28` (16), `/29` (8), `/30` (4), `/31` (two endpoints in suitable point-to-point use) and `/32` (one host route).

## Method
Find the prefix boundary, calculate the block size in the changing octet, then list the network, broadcast and usable range. Do not guess from familiar private ranges.

## Knowledge check
How many host bits remain in a `/27`?$$, 1),
  ('subnetting', 'subnetting-worked-examples', 'Subnetting worked examples: /24 and /16', 'Solve familiar network ranges step by step before moving to smaller blocks.', $$## Learning objectives
- Identify network, broadcast and usable range for two common examples.
- State the block-size method in your own words.

## Example: 192.168.10.0/24
The mask is `255.255.255.0`. Network address: `192.168.10.0`. Broadcast: `192.168.10.255`. Usable range: `192.168.10.1–192.168.10.254`, giving 254 usual usable hosts.

## Example: 10.10.0.0/16
The mask is `255.255.0.0`. Network address: `10.10.0.0`. Broadcast: `10.10.255.255`. Usable range: `10.10.0.1–10.10.255.254`, giving 65,534 usual usable hosts.

## Security relevance
Large ranges simplify addressing but widen the potential broadcast and lateral-movement scope. A security design asks whether all those endpoints genuinely need the same trust boundary.

## Practice
For `192.168.50.0/24`, identify the first and last usable address before checking your answer with a calculator. $$, 2),
  ('subnetting', 'subnetting-smaller-prefixes', 'Subnetting worked examples: /20 and /26', 'Calculate boundaries inside an octet and avoid off-by-one errors.', $$## Learning objectives
- Solve `172.16.32.0/20` and `192.168.1.128/26` manually.
- Explain why the block size is determined by the interesting octet.

## Example: 172.16.32.0/20
`/20` is `255.255.240.0`; the interesting octet is the third and its block size is `256 - 240 = 16`. The range beginning at 32 runs through 47. Network: `172.16.32.0`; broadcast: `172.16.47.255`; usable: `172.16.32.1–172.16.47.254`.

## Example: 192.168.1.128/26
`/26` is `255.255.255.192`; final-octet block size is `64`. The blocks are 0, 64, 128 and 192. Network: `192.168.1.128`; broadcast: `192.168.1.191`; usable: `192.168.1.129–192.168.1.190`.

## Common mistake
The supplied address may be a host address rather than the network address. First locate its block; never assume the last octet is the network boundary.

## Knowledge check
Which /26 block contains `192.168.1.170`?$$, 3),
  ('subnetting', 'vlsm-and-subnetting-practice', 'VLSM and a repeatable subnetting workflow', 'Allocate different-sized networks without losing the ability to audit the plan.', $$## Learning objectives
- Explain VLSM and why largest-first allocation helps.
- Apply a safe, repeatable subnetting worksheet.

## Core concepts
Variable Length Subnet Masking (VLSM) uses different prefix sizes within a larger allocation. Start with the largest requirement, choose the smallest prefix that fits it, reserve that block, then continue with the next largest. Keep an address plan that records purpose, VLAN, gateway, DHCP range, static reservations and owner.

## Practice scenario
You receive `192.168.100.0/24` for a lab needing 100 hosts, 50 hosts, 20 hosts and a point-to-point link. A sensible largest-first outline is `/25` (126 usable), `/26` (62), `/27` (30) and `/30` (2). Calculate exact boundaries before deployment and retain unused space as documented reserves.

## Security relevance
VLSM is not a firewall. It makes segments explicit so ACLs, routes, DHCP scopes and monitoring can align with real trust zones.

## Knowledge check
Why should the largest subnet be allocated before smaller ones?$$, 4),
  ('ipv6', 'ipv6-addressing-and-notation', 'IPv6 addressing and hexadecimal notation', 'Read 128-bit addresses and shorten them correctly.', $$## Learning objectives
- Explain why IPv6 uses 128 bits.
- Apply zero suppression and zero compression safely.

## Core concepts
IPv6 expands the address space to 128 bits and writes eight hexadecimal groups, for example `2001:0db8:0000:0000:0000:ff00:0042:8329`. Leading zeroes inside a group may be omitted; one contiguous run of all-zero groups may be replaced by `::`. The result becomes `2001:db8::ff00:42:8329`.

Only one `::` is allowed because the original number of zero groups must remain unambiguous. IPv6 prefixes are commonly `/64` for a LAN, enabling interface identifiers and neighbour discovery expectations.

## Common mistake
IPv6 is not “IPv4 with colons.” It has different discovery, multicast and address-assignment behaviour.

## Knowledge check
Can an IPv6 address contain `::` twice? Why not?$$, 1),
  ('ipv6', 'ipv6-address-types', 'IPv6 address types and scope', 'Recognise global, link-local, unique local, multicast and loopback addresses.', $$## Learning objectives
- Identify common IPv6 address categories.
- Explain why scope is essential in IPv6 analysis.

## Core concepts
Global unicast addresses are publicly routable (commonly `2000::/3`). Link-local addresses use `fe80::/10` and operate only on a local link; they are normal on every IPv6-enabled interface. Unique local addresses use `fc00::/7` for private-style internal addressing. Multicast uses `ff00::/8`; IPv6 has no broadcast. The loopback is `::1` and the unspecified address is `::`.

An identical link-local address can exist on many interfaces, so logs and commands often require an interface zone. Security tooling must parse IPv6 rather than silently ignoring it; otherwise a dual-stack environment can create an unmonitored path.

## Knowledge check
Which IPv6 address type replaces the role that broadcast often played in IPv4 discovery?$$, 2),
  ('ipv6', 'slaac-dhcpv6-and-neighbour-discovery', 'SLAAC, DHCPv6, ICMPv6 and neighbour discovery', 'Understand IPv6 configuration and the control traffic that supports it.', $$## Learning objectives
- Compare SLAAC and DHCPv6.
- Explain why ICMPv6 is operationally important.

## Core concepts
SLAAC lets a host form an address using router advertisements and a prefix. DHCPv6 can provide addresses and/or additional settings depending on design. IPv6 **Neighbour Discovery** uses ICMPv6 for router discovery, address resolution, duplicate-address detection and reachability. Blocking ICMPv6 indiscriminately commonly breaks legitimate IPv6 operation.

Security teams should validate router advertisements at access layers where supported, monitor unexpected IPv6 gateways and include ICMPv6 in baselines. The defensive goal is controlled configuration, not disabling a protocol family because it is unfamiliar.

## Scenario
A host has working IPv4 but an unexpected IPv6 default route. Check router-advertisement sources, switch-port controls and whether IPv6 was intentionally enabled in that segment.

## Knowledge check
Which protocol family carries IPv6 neighbour discovery messages?$$, 3),
  ('ipv6', 'dual-stack-and-ipv6-security', 'Dual stack and IPv6 security considerations', 'Plan for two protocol stacks without creating blind spots.', $$## Learning objectives
- Explain dual-stack operation and common monitoring gaps.
- Identify safe controls for IPv6-enabled networks.

## Core concepts
Dual stack means hosts and services run IPv4 and IPv6 together. Address selection may prefer IPv6 when it is available, so a firewall, proxy, DNS policy and monitoring pipeline must cover both. An IPv4-only asset inventory or SIEM query can miss the actual path a client used.

Defensive controls include explicit IPv6 addressing plans, DNS AAAA record review, firewall rules for IPv6, secure router-advertisement handling, logging both address families and testing incident playbooks against both. If IPv6 is intentionally unavailable, disable it through a documented, supported policy rather than merely ignoring it.

## Knowledge check
Why is an IPv4-only firewall rule review insufficient in a dual-stack environment?$$, 4),
  ('tcp-and-udp', 'tcp-handshake-and-state', 'TCP connection setup, state and sequence numbers', 'Read a three-way handshake and connect it to dependable delivery.', $$## Learning objectives
- Describe SYN, SYN-ACK and ACK roles.
- Explain sequence and acknowledgement numbers conceptually.

## Core concepts
TCP is connection-oriented. A client sends `SYN`, the server replies `SYN-ACK`, and the client acknowledges with `ACK`. Sequence numbers label bytes in a stream; acknowledgement numbers tell a peer which bytes have been received. This shared state supports ordered, reliable delivery across an unreliable IP network.

Packet captures often show this pattern before an application request. Missing replies, repeated SYNs or immediate resets can indicate reachability, policy, service or load issues, but require corroboration. Sequence numbers are not a counter of packets; they describe positions in the byte stream.

## Knowledge check
Which TCP flag normally begins a new connection?$$, 1),
  ('tcp-and-udp', 'tcp-reliability-and-termination', 'TCP reliability, windows, congestion and termination', 'Understand the mechanisms behind retransmissions and slow connections.', $$## Learning objectives
- Explain retransmission, sliding windows and flow control.
- Distinguish graceful close from reset behaviour.

## Core concepts
TCP retransmits data that is not acknowledged. A sliding window limits how much unacknowledged data can be in flight, providing flow control so a fast sender does not overwhelm a receiver. Congestion control adjusts sending behaviour when the network appears overloaded. These mechanisms make TCP resilient but can expose latency and loss as reduced application throughput.

A normal close typically uses `FIN` and acknowledgements in both directions. `RST` abruptly ends a connection, often because no service is listening, a policy device rejected traffic or an endpoint deliberately reset the session. `PSH` asks for prompt delivery to the application; `URG` is uncommon in modern traffic.

## Knowledge check
What signal would you expect for an abrupt TCP teardown: FIN or RST?$$, 2),
  ('tcp-and-udp', 'udp-and-transport-choices', 'UDP: lightweight transport and its trade-offs', 'Choose and analyse transport based on application behaviour rather than habit.', $$## Learning objectives
- Compare UDP’s header and behaviour with TCP.
- Explain why UDP is useful despite lacking TCP reliability.

## Core concepts
UDP is connectionless and has a small header containing source port, destination port, length and checksum. It does not establish a session, retransmit lost datagrams or guarantee ordering. Applications such as DNS, NTP, real-time media and some telemetry value low overhead or implement reliability themselves.

“UDP is unreliable” does not mean unusable. It means the application or user must accept loss, recover differently, or value timeliness over perfect delivery. In monitoring, a burst of UDP packets may be entirely expected; interpret service, destination and volume before drawing conclusions.

## Scenario
Voice media may prefer a timely new packet over an old retransmitted one. TCP’s recovery could make a conversation sound delayed rather than merely imperfect.

## Knowledge check
Name one reliability feature TCP provides that UDP does not. $$, 3),
  ('tcp-and-udp', 'transport-in-packet-captures', 'Recognising TCP and UDP in packet captures', 'Use flags, ports and timing to form cautious transport-layer hypotheses.', $$## Learning objectives
- Identify useful TCP/UDP fields in a capture.
- Avoid treating one packet as proof of an incident.

## Core concepts
For TCP, inspect the four-tuple (source/destination IP and port), flags, sequence/acknowledgement progression, payload length, retransmissions and timing. For UDP, inspect the same endpoint tuple, packet size, rate and application context. A display filter such as `tcp.flags.syn == 1 && tcp.flags.ack == 0` isolates initial SYN packets in Wireshark.

Normal traffic is patterned: an application may create predictable client-to-server flows. Suspicion grows when patterns conflict with context, for example repeated failed outbound connections to many unrelated destinations or regular beacons at an unusual interval. Confirm with endpoint, DNS and firewall evidence.

## Knowledge check
Which four values identify a transport conversation directionally?$$, 4),
  ('ports-and-sockets', 'ports-sockets-and-ephemeral-ports', 'Ports, sockets and ephemeral ports', 'Understand how one IP address supports many simultaneous services and clients.', $$## Learning objectives
- Define a port and socket.
- Explain why a client usually uses an ephemeral source port.

## Core concepts
A port identifies an application endpoint within an IP host. A socket is commonly described by IP address plus port; a TCP/UDP conversation is identified by the source and destination socket pair. Servers often listen on stable service ports, while client operating systems select temporary **ephemeral ports** so many connections can coexist.

Port ranges are conventionally well-known (`0–1023`), registered (`1024–49151`) and dynamic/private (`49152–65535`), although the exact ephemeral selection range is operating-system dependent. A port number is a clue, not an identity guarantee: services can listen on nonstandard ports.

## Knowledge check
Why can two browser tabs connect to the same HTTPS server without conflicting?$$, 1),
  ('ports-and-sockets', 'essential-port-families', 'Essential ports by service family', 'Learn common ports as service anchors, not as a memorisation contest.', $$## Learning objectives
- Associate common services with their typical ports.
- Group ports by protocol family and operational purpose.

## Reference
| Service | Typical port(s) |
| --- | --- |
| FTP / SSH / Telnet | 20/21, 22, 23 |
| SMTP / DNS / DHCP / TFTP | 25, 53, 67/68, 69 |
| HTTP / HTTPS / Kerberos | 80, 443, 88 |
| POP3 / IMAP / NTP | 110, 143, 123 |
| RPC / NetBIOS / SMB | 135, 137–139, 445 |
| SNMP / LDAP / LDAPS | 161/162, 389, 636 |
| RDP / VNC | 3389, 5900 |

Also recognise SMTP submission/implicit TLS `465/587`, IMAPS `993`, POP3S `995`, MSSQL `1433`, Oracle `1521`, MySQL `3306`, PostgreSQL `5432`, and common alternate HTTP `8080`.

## Security relevance
An exposed service deserves context: owner, authentication, encryption, patch state, allowed source networks and expected use. Knowing that `445` is SMB is more useful than reciting it without understanding file-sharing risk.

## Knowledge check
Which port is commonly associated with encrypted web traffic?$$, 2),
  ('ports-and-sockets', 'services-context-and-encryption', 'Services, context and encrypted alternatives', 'Interpret service exposure through purpose, identity and protection.', $$## Learning objectives
- Compare legacy clear-text and encrypted service variants.
- Explain why port-based assumptions need verification.

## Core concepts
Telnet, FTP and older mail retrieval can expose credentials or content if used without additional protection. SSH, SFTP, HTTPS, IMAPS, POP3S and LDAPS commonly provide encrypted alternatives when configured correctly. Encryption is not equivalent to trust: certificate validation, account controls, patching and network policy still matter.

Analysts should examine process ownership and TLS/application evidence when possible rather than declaring a service based only on a port. A web service may run on `8080`; a non-HTTP process may listen on `443`. Configuration management and asset ownership make that distinction actionable.

## Scenario
An outbound connection to port 443 is not automatically web browsing. Verify DNS, TLS metadata, proxy records, endpoint process and destination reputation before classifying it.

## Knowledge check
Why is “it uses port 443” insufficient evidence that a connection is normal HTTPS?$$, 3),
  ('ports-and-sockets', 'socket-flow-and-firewall-logs', 'Reading socket flow in firewall and endpoint logs', 'Turn endpoint tuples into a defensible account of a connection.', $$## Learning objectives
- Read source/destination roles in a connection log.
- Correlate network and endpoint views of the same flow.

## Example
`10.20.5.14:52341 → 203.0.113.20:443` normally reads as a client at ephemeral source port 52341 connecting to a server’s HTTPS listener. Direction, NAT and proxying can alter what each log source sees, so preserve the device name, time zone and timestamp precision.

## Investigation workflow
1. Identify the client and server role from ports and direction.
2. Check DNS or TLS evidence for the intended service.
3. Correlate endpoint process/user, DHCP lease and firewall decision.
4. Compare bytes, duration and recurrence against a baseline.

## Common mistake
Do not call the source port “the service port” just because it appears first in a log. Client source ports are usually ephemeral.

## Knowledge check
In the example above, which port is most likely the server’s listening port?$$, 4),
  ('core-protocols', 'arp-icmp-and-dhcp', 'ARP, ICMP and DHCP', 'Understand discovery, diagnostics and configuration protocols together.', $$## Learning objectives
- State the operational purpose of ARP, ICMP and DHCP.
- Identify security-relevant observations without treating normal traffic as hostile.

## Core concepts
ARP maps IPv4 addresses to local MAC addresses. ICMP communicates IP-layer status and diagnostics; echo request/reply supports `ping`, while time-exceeded messages support traceroute. DHCP supplies address configuration and lease history. Each is foundational: blocking or ignoring it indiscriminately harms operations and visibility.

Security monitoring should look for deviations: unexpected DHCP servers, unexplained gateway changes, unusual volumes of ICMP errors or inconsistent ARP mappings. A single ARP reply or ping does not establish intent; corroborate with device identity, VLAN, change records and timing.

## Knowledge check
Which protocol provides a responder with historical evidence of who held an IP address?$$, 1),
  ('core-protocols', 'dns-http-https-and-tls', 'DNS, HTTP, HTTPS and TLS', 'Trace the application protocols behind ordinary web use and their observability.', $$## Learning objectives
- Explain the jobs of DNS, HTTP and TLS.
- Separate name resolution from web request semantics.

## Core concepts
DNS resolves names to records. HTTP defines requests and responses such as methods, headers and status codes. HTTPS is HTTP protected by TLS, which authenticates the server (when validation succeeds) and encrypts application data in transit. TLS can also expose useful metadata such as certificate details and negotiated properties to authorised inspection tools.

An analyst may see DNS lookups, a TCP connection to 443 and a TLS handshake without seeing the HTTP path or body. Proxies and application logs provide richer visibility when policy allows. Keep time synchronised across systems so the stages can be correlated.

## Knowledge check
Which protocol encrypts the HTTP exchange in a typical HTTPS connection?$$, 2),
  ('core-protocols', 'administration-file-and-sharing-protocols', 'SSH, FTP, SFTP and SMB', 'Recognise administrative, transfer and file-sharing protocols in enterprise traffic.', $$## Learning objectives
- Compare SSH/SFTP with FTP and distinguish SMB’s role.
- Identify safe security questions for exposed services.

## Core concepts
SSH provides encrypted remote administration, commonly on 22; SFTP runs over SSH for file transfer. FTP commonly uses 20/21 and may expose credentials/content unless separately protected. SMB commonly supports Windows and file/printer sharing on 445 and is operationally important but sensitive to segmentation, identity and patching.

When these services appear in logs, ask whether the source is authorised, whether the target is a managed asset, whether encryption/authentication is expected and whether access crosses a trust boundary. Avoid treating all administrative traffic as benign merely because it is encrypted.

## Knowledge check
Which file-transfer protocol is normally carried inside an SSH session?$$, 3),
  ('core-protocols', 'enterprise-identity-and-management-protocols', 'Mail, SNMP, NTP, LDAP and Kerberos', 'Understand enterprise service traffic and why its timing/identity data matters.', $$## Learning objectives
- Identify the roles of SMTP, IMAP/POP3, SNMP, NTP, LDAP and Kerberos.
- Explain why time and identity services are security-critical.

## Core concepts
SMTP sends mail; IMAP and POP3 retrieve it. SNMP exposes network-management information, often on 161/162. NTP aligns clocks. LDAP provides directory queries; Kerberos provides ticket-based authentication, commonly using port 88. These protocols often connect infrastructure that many users depend on.

Time drift complicates incident timelines and certificate validation. Weak SNMP community strings or excessive directory exposure can create risk. Kerberos failures can look like authentication issues but may be caused by DNS or clock problems, demonstrating why network fundamentals matter in identity troubleshooting.

## Knowledge check
Which protocol is primarily responsible for synchronising time across hosts?$$, 4),
  ('dns-deep-dive', 'dns-hierarchy-and-recursion', 'DNS hierarchy, recursion and caching', 'Follow a name from a client query to an authoritative answer.', $$## Learning objectives
- Describe recursive and authoritative DNS roles.
- Explain root, TLD and authoritative server responsibilities.

## Core concepts
A client usually asks a **recursive resolver**. If it lacks a cached answer, the resolver can consult root servers, then a top-level domain (TLD) server, then the domain’s authoritative nameserver. The authoritative server holds the zone data; the resolver returns and caches the answer for clients.

Caching reduces latency and upstream load but means changes do not appear everywhere immediately. The TTL supplied with a record tells resolvers how long an answer may normally be cached. During an incident, identify which resolver a client used and whether its response matches authoritative data before assuming a name is malicious.

## Knowledge check
Which DNS component normally performs the iterative work on behalf of a client?$$, 1),
  ('dns-deep-dive', 'dns-records-and-reverse-lookups', 'DNS records, TTL and reverse lookups', 'Read common record types and understand their operational meaning.', $$## Learning objectives
- Identify A, AAAA, CNAME, MX, TXT, NS, PTR and SOA records.
- Explain why record type changes the interpretation of a response.

## Reference
| Record | Purpose |
| --- | --- |
| A / AAAA | IPv4 / IPv6 address |
| CNAME | Alias to another name |
| MX | Mail destination |
| TXT | Policy or verification text |
| NS / SOA | Zone authority and metadata |
| PTR | Reverse address-to-name mapping |

PTR data is useful context, not proof of ownership. CNAME chains can lead through CDNs and SaaS providers. TXT records support several legitimate systems, so long values deserve context rather than automatic suspicion.

## Knowledge check
Which record maps an IPv6-capable name to an IPv6 address?$$, 2),
  ('dns-deep-dive', 'encrypted-dns-and-operations', 'DNS over HTTPS, DNS over TLS and operations', 'Understand encrypted DNS trade-offs without losing operational visibility.', $$## Learning objectives
- Compare DoH and DoT conceptually.
- Identify the policy and monitoring questions encrypted DNS introduces.

## Core concepts
DNS over HTTPS (DoH) carries DNS queries inside HTTPS; DNS over TLS (DoT) uses TLS for DNS transport. Both can protect clients from local passive observation and manipulation, but they change where an organisation can observe or enforce DNS policy. The question is not whether encryption is good or bad; it is whether resolver choice, device policy and logging are intentional.

Organisations may provide approved encrypted resolvers, restrict unauthorised resolver access or use endpoint/network telemetry to retain visibility. Ensure privacy, legal and operational requirements are considered together.

## Knowledge check
What operational visibility challenge can arise when a client uses an unapproved encrypted DNS resolver?$$, 3),
  ('dns-deep-dive', 'dns-security-monitoring', 'DNS spoofing, tunnelling concepts and defensive monitoring', 'Recognise DNS abuse concepts while staying focused on detection and mitigation.', $$## Learning objectives
- Describe spoofing, cache poisoning and tunnelling at a conceptual level.
- Identify defensible DNS monitoring signals.

## Core concepts
DNS spoofing or cache poisoning attempts to direct a name to an incorrect answer. DNS tunnelling conceptually uses encoded data in DNS queries/responses to bypass expected application channels. Both ideas are relevant to defenders because DNS is trusted and widely allowed, not because they should be attempted outside an authorised lab.

Watch for newly seen domains, rare query types, unusually long or high-entropy labels, fast-changing answers, unexpected resolvers, excessive NXDOMAIN responses and periodic query patterns. Combine DNS telemetry with endpoint process, proxy/firewall, registrar/reputation and user context before taking action.

## Mitigation
Use trusted resolvers, DNSSEC validation where appropriate, egress controls, central logging and a clear procedure for blocking or sinkholing confirmed harmful domains.

## Knowledge check
Why is a long DNS label not by itself proof of tunnelling?$$, 4),
  ('routing-and-nat', 'routing-tables-and-longest-prefix-match', 'Routing tables, next hops and longest prefix match', 'Explain how a router chooses a path and why specific routes matter.', $$## Learning objectives
- Read directly connected, static and default routes.
- Apply longest prefix matching conceptually.

## Core concepts
A routing table contains destinations, prefixes, next hops/interfaces and often metrics. Directly connected routes come from configured interfaces. Static routes are administrator-defined. A default route (`0.0.0.0/0` for IPv4) handles destinations with no more specific match. When several routes match, the longest prefix wins because it is most specific.

Metrics compare candidate routes within a routing protocol; administrative distance is a vendor concept used to prefer one source of routing information over another. Misunderstanding these terms causes avoidable routing surprises.

## Example
For `10.10.5.8`, a route to `10.10.0.0/16` beats `10.0.0.0/8`; a route to `10.10.5.0/24` beats both.

## Knowledge check
Which route wins when both `/16` and `/24` match a destination in the /24?$$, 1),
  ('routing-and-nat', 'dynamic-routing-concepts', 'RIP, OSPF and BGP concepts', 'Know why dynamic routing protocols exist without turning this into a routing-vendor course.', $$## Learning objectives
- Describe the basic purpose of RIP, OSPF and BGP.
- Identify routing control-plane events worth monitoring.

## Core concepts
RIP is a simple distance-vector protocol historically associated with small networks. OSPF is a link-state interior gateway protocol that builds a view of an organisation’s network. BGP exchanges reachability between autonomous systems and underpins much internet routing. They solve different scale and policy problems.

Routing is control-plane data with major security impact. Unexpected neighbour changes, route withdrawals, path changes or permissive route redistribution can alter availability and exposure. Use authentication where supported, restrict adjacencies, log changes and apply peer review to routing policy.

## Knowledge check
Which protocol is most associated with routing between independent organisations on the internet?$$, 2),
  ('routing-and-nat', 'nat-pat-and-private-addressing', 'NAT, PAT and address translation tables', 'Understand why translation exists and how it changes network evidence.', $$## Learning objectives
- Compare static NAT, dynamic NAT and PAT.
- Explain why NAT does not replace a firewall.

## Core concepts
NAT translates address information between address realms. Static NAT maps one address consistently; dynamic NAT uses a pool; Port Address Translation (PAT) lets many internal connections share one public IP by translating ports as well. NAT is common where private IPv4 addresses access public networks.

Translation tables are time-sensitive evidence: they link internal addresses/ports to external representations. NAT can hide internal addresses from a remote server but does not decide whether a connection is authorised, encrypted or safe. Firewalls and identity controls still need explicit policy.

## Knowledge check
Which NAT form commonly lets many users share one public IPv4 address?$$, 3),
  ('routing-and-nat', 'nat-and-routing-in-investigations', 'Routing and NAT in incident investigations', 'Reconstruct paths using timestamps, translations and multiple log sources.', $$## Learning objectives
- Identify which logs explain a translated connection.
- Avoid false attribution when public addresses are shared.

## Scenario
A provider reports abuse from a public IP at 14:03:12 UTC. The public address alone may represent hundreds of users behind PAT. Investigators need firewall/NAT translation logs with source port and precise time, DHCP/VPN identity history, endpoint evidence and any proxy records. Time zones and clock drift are not minor details.

Routing records can explain why a flow used an unexpected path or why a segment became unreachable. Preserve volatile evidence early: NAT states can expire quickly, and dynamic routing changes can be transient.

## Knowledge check
Why are a public IP and timestamp often insufficient to identify one internal host behind PAT?$$, 4),
  ('vlans-and-segmentation', 'vlans-access-trunks-and-tags', 'VLANs, access ports, trunk ports and 802.1Q', 'Separate logical Layer-2 segments and recognise where tags appear.', $$## Learning objectives
- Differentiate access and trunk ports.
- Explain the purpose of IEEE 802.1Q tagging and a native VLAN.

## Core concepts
A VLAN creates a separate logical broadcast domain on shared switching infrastructure. An access port usually carries one VLAN for an endpoint. A trunk carries multiple VLANs between network devices and uses IEEE 802.1Q tags to identify traffic, except where a configured native-VLAN convention applies. Trunks should be explicit and limited to required VLANs.

VLANs organise traffic but are only part of segmentation. Inter-VLAN routing, firewall policy, management-plane access and endpoint controls decide what crossing the boundary actually means.

## Knowledge check
Which port type normally carries traffic for multiple VLANs between switches?$$, 1),
  ('vlans-and-segmentation', 'inter-vlan-routing-and-security-zones', 'Inter-VLAN routing and security zones', 'Turn VLAN boundaries into enforceable, documented trust decisions.', $$## Learning objectives
- Explain how hosts in different VLANs communicate.
- Design zones around purpose rather than arbitrary numbering.

## Core concepts
Hosts in separate VLANs require Layer-3 routing to communicate. That routing can happen on a router, firewall or Layer-3 switch. Apply policy at the crossing: allow only the necessary source, destination, protocol and port, then log meaningful decisions. An “allow any” inter-VLAN rule removes much of the security value of segmentation.

Useful zones often include user, server, management, guest, laboratory and DMZ networks. Each should have a purpose, owner, expected traffic and change process. The same approach applies to cloud subnets and security groups.

## Knowledge check
What additional function is required for a device in VLAN 10 to reach a device in VLAN 20?$$, 2),
  ('vlans-and-segmentation', 'dmz-management-and-microsegmentation', 'DMZs, management networks and microsegmentation', 'Use layered boundaries to reduce the consequences of compromise.', $$## Learning objectives
- Describe the role of a DMZ and management network.
- Explain microsegmentation as a principle rather than a product.

## Core concepts
A DMZ hosts services that must accept less-trusted traffic while keeping internal systems behind further controls. A management network limits administrative interfaces to authorised operators and jump hosts. Microsegmentation narrows policy closer to workloads or identities, reducing the paths available after a compromise.

The aim is blast-radius reduction. A compromised public web server should not automatically reach databases, directory services or management planes. Design for necessary flows, validate them with logs and regularly remove obsolete exceptions.

## Scenario
Place a public-facing application in a DMZ, permit only its required backend API/database flow through a policy boundary, and restrict server administration to a management path with MFA and logging.

## Knowledge check
Why is a separate management network valuable during an incident?$$, 3),
  ('vlans-and-segmentation', 'segmentation-monitoring-and-response', 'Segmentation monitoring and response', 'Use flow evidence to verify that intended boundaries are real.', $$## Learning objectives
- Measure whether a segmentation policy is behaving as designed.
- Recognise signs of unexpected cross-zone access.

## Core concepts
Documented segmentation is a hypothesis until observed traffic confirms it. Collect firewall allow/deny logs, flows, DNS/proxy data and asset ownership. Review new cross-zone connections, overly broad rules, direct user-to-server administration and management-plane access from untrusted networks.

During response, segmentation can contain risk by isolating an endpoint, limiting egress, or temporarily denying a suspicious path. Changes must be targeted and recorded: indiscriminate blocking can destroy evidence or interrupt critical services. Plan containment actions before an emergency.

## Knowledge check
What should you validate after creating a new VLAN and firewall policy: only connectivity, or both allowed and denied traffic?$$, 4),
  ('firewalls-acls-vpns', 'firewall-types-and-rule-design', 'Firewalls, state and rule design', 'Build explainable policy from packet filters through next-generation controls.', $$## Learning objectives
- Compare packet-filtering, stateful and next-generation firewalls.
- Write a least-privilege rule description.

## Core concepts
Packet filters evaluate basic header fields. Stateful firewalls track connection state and can allow return traffic for an established session. Next-generation firewalls may add application identification, user context, TLS inspection (where lawful and designed), threat prevention and URL controls. Capabilities do not remove the need for clear policy.

A strong rule states source, destination, service, action, owner, purpose, expiry/review date and logging expectation. Start with least privilege and an implicit deny, then add narrowly justified exceptions. Rule order matters because many products stop at the first match.

## Knowledge check
Why should a broad allow rule not sit above a specific deny or restricted allow rule?$$, 1),
  ('firewalls-acls-vpns', 'acls-ids-ips-and-egress-controls', 'ACLs, IDS/IPS and ingress/egress filtering', 'Combine policy and detection without assuming one control is enough.', $$## Learning objectives
- Describe ACL, IDS and IPS roles.
- Explain why egress filtering matters as much as ingress filtering.

## Core concepts
An ACL is a set of permit/deny conditions, often applied on routers, switches or firewalls. IDS observes and alerts; IPS observes and can block inline. Ingress filtering restricts what enters a boundary; egress filtering restricts what leaves it. Both help contain misconfiguration and compromise.

Egress policy can prevent a server from reaching arbitrary internet destinations, constrain DNS to approved resolvers and make unexpected connections more visible. IDS/IPS alerts require tuning and context: a signature is evidence to investigate, not a substitute for asset knowledge.

## Knowledge check
Which control can actively block traffic when deployed inline: IDS or IPS?$$, 2),
  ('firewalls-acls-vpns', 'vpn-fundamentals-and-tunnelling', 'VPN fundamentals: tunnelling, remote access and site-to-site', 'Understand protected connectivity and the controls around it.', $$## Learning objectives
- Compare remote-access and site-to-site VPNs.
- Describe IPsec and TLS VPN concepts at a high level.

## Core concepts
A VPN creates an authenticated, protected tunnel over another network. Remote-access VPNs connect individual users/devices; site-to-site VPNs connect networks. IPsec commonly protects IP traffic between gateways or hosts, while TLS VPNs commonly use TLS for remote user access. The surrounding controls—MFA, device posture, routes, split-tunnelling policy and logging—determine much of the real risk.

VPN access should be least privilege. A valid user should not automatically receive broad internal reachability. Record assigned addresses, identity, device and session times so remote activity can be investigated.

## Knowledge check
What is the main difference between a site-to-site VPN and a remote-access VPN?$$, 3),
  ('firewalls-acls-vpns', 'defensive-control-scenarios', 'Defensive control scenarios and policy review', 'Practice selecting layered controls for realistic network services.', $$## Learning objectives
- Map a scenario to policy, monitoring and recovery controls.
- Explain why rule review is continuous work.

## Scenario
A new web application needs public HTTPS access, a backend database and administrator support. Permit internet-to-reverse-proxy `443`; permit reverse-proxy-to-application only for required service ports; permit application-to-database only for the database port; keep database administration on a management network; log allow and deny decisions; monitor TLS/proxy and database activity.

Review temporary rules, unused objects, shadowed rules, expired vendor access and changes in application dependencies. A firewall configuration is production code: it needs ownership, review and rollback planning.

## Knowledge check
Which boundary should normally receive public HTTPS traffic: the database server or the reverse proxy/application edge?$$, 4),
  ('packet-analysis-troubleshooting', 'safe-network-diagnostic-tools', 'Safe diagnostic tools: ping, traceroute and address inspection', 'Use local, authorised diagnostics to separate reachability from name and service problems.', $$## Learning objectives
- Choose a basic diagnostic tool for a stated question.
- Interpret diagnostic output as evidence, not certainty.

## Command examples
```text
ping example.org           # reachability/latency signal; ICMP may be filtered
tracert example.org        # Windows path view
traceroute example.org     # Unix-like path view
ipconfig /all              # Windows address, gateway and DNS settings
ip addr && ip route        # Linux interface and route view
```

`ping` tests an ICMP path, not whether a web application works. Traceroute reveals responding hops but filtering and asymmetric paths can change results. Start with the local interface, address, mask, gateway and DNS configuration, then move outward one layer at a time.

## Knowledge check
Why does a failed ping not necessarily prove that a remote host is down?$$, 1),
  ('packet-analysis-troubleshooting', 'names-routes-and-local-sockets', 'DNS, routes, ARP and local sockets', 'Gather local facts before escalating a connectivity incident.', $$## Learning objectives
- Use DNS, route and socket tools for authorised troubleshooting.
- Relate each command to a specific diagnostic hypothesis.

## Command examples
```text
nslookup example.org       # basic resolver query
dig example.org A          # detailed DNS query on many Unix-like systems
arp -a                     # cached IPv4-to-MAC mappings
ss -tulpn                  # local sockets on Linux (permissions may affect detail)
netstat -ano               # Windows local connections/listeners
curl -I https://example.org # HTTP response headers, if authorised
```

Use `route print` or `ip route` to confirm next hops. Validate names with approved resolvers and compare answers carefully. A listening socket proves a local process has bound a port; it does not prove a firewall permits remote access.

## Knowledge check
Which tool helps distinguish a DNS resolution issue from a routing issue?$$, 2),
  ('packet-analysis-troubleshooting', 'wireshark-foundations-and-filters', 'Wireshark foundations: capture, display filters and streams', 'Capture only authorised traffic and navigate evidence efficiently.', $$## Learning objectives
- Differentiate capture filters from display filters.
- Use basic filters to narrow an investigation.

## Core concepts
Wireshark captures packets from an interface or opens supplied capture files. Capture filters limit what is collected; display filters change only what is shown after capture. Preserve original files, record capture point/time and minimise collection of unrelated personal data. “Follow stream” reconstructs an observed conversation; it does not decrypt protected traffic by itself.

## Useful display filters
```text
tcp                 # TCP packets
udp                 # UDP packets
dns                 # DNS packets
http                # decoded HTTP packets
arp or icmp         # ARP or ICMP
ip.addr == 192.0.2.10
tcp.port == 443
```

## Knowledge check
Does a display filter change the packet capture file on disk?$$, 3),
  ('packet-analysis-troubleshooting', 'packet-interpretation-and-safe-nmap-concepts', 'Packet interpretation, incident workflow and safe Nmap concepts', 'Combine packet fields with authorised scope and other telemetry.', $$## Learning objectives
- Inspect Ethernet, IP, TCP, DNS and HTTP fields in sequence.
- Understand service-discovery concepts without unauthorised targeting.

## Workflow
Start with the capture source and time. Inspect Ethernet addresses/VLAN, IP endpoints/TTL, transport ports/flags, then application details such as DNS questions or HTTP status. Compare with firewall, DHCP, DNS and endpoint data. A packet capture is powerful evidence but may be partial, decrypted differently or collected after the key event.

Nmap is commonly used for authorised asset inventory and service discovery. Use it only against systems you own or have explicit written permission to assess, with agreed scope and rate. Defenders should understand that connection attempts can appear in firewall and endpoint logs, and should maintain an approved inventory to reduce surprise.

## Knowledge check
Why must the capture point be recorded before interpreting absent packets?$$, 4),
  ('network-security-analysis', 'reconnaissance-scanning-and-enumeration', 'Reconnaissance, scanning and service enumeration concepts', 'Recognise early discovery activity and maintain an authorised defensive perspective.', $$## Learning objectives
- Differentiate reconnaissance, scanning and enumeration conceptually.
- Identify telemetry that can reveal unexpected discovery activity.

## Core concepts
Reconnaissance gathers information about targets; port scanning probes which ports respond; service enumeration seeks more detail about identified services. These concepts are legitimate for authorised testing and defensive validation, but unauthorised targeting is not acceptable. Defenders see possible signs in firewall logs, IDS/IPS, endpoint events, DNS, web logs and flow data.

Look for patterns rather than one connection: many ports on one host, one port across many hosts, repeated failures, unusual source networks or service banners requested outside normal operations. Asset inventory and change records distinguish approved assessment activity from suspicious probing.

## Knowledge check
Why is a single connection to port 443 not enough evidence of port scanning?$$, 1),
  ('network-security-analysis', 'local-network-and-dns-attack-concepts', 'ARP, rogue DHCP, MITM and DNS attack concepts', 'Connect local-trust attacks to the controls that limit them.', $$## Learning objectives
- Explain the prerequisite conditions behind local network interception concepts.
- Map conceptual attack patterns to defensive controls.

## Core concepts
ARP spoofing and rogue DHCP rely on a position in or near a local broadcast domain. A man-in-the-middle position can alter or observe traffic if protections fail; TLS certificate validation helps defend application data even when a path is hostile. DNS attacks aim to influence name-to-address decisions through false responses or compromised resolution paths.

Defences include wired/wireless access control, DHCP snooping, dynamic ARP inspection, approved resolvers, DNSSEC where appropriate, TLS validation, segmentation and monitoring of gateway/DHCP/ARP changes. Capture evidence carefully and avoid reproducing attack techniques on live networks.

## Knowledge check
Which Layer-2 control can help block an untrusted DHCP server on an access network?$$, 2),
  ('network-security-analysis', 'availability-spoofing-and-vlan-concepts', 'DoS/DDoS, spoofing and VLAN-hopping concepts', 'Analyse availability and boundary threats without turning the course into an abuse guide.', $$## Learning objectives
- Describe DoS/DDoS, spoofing and VLAN-hopping concepts at a high level.
- Identify practical prevention and response themes.

## Core concepts
DoS attempts to exhaust a resource; DDoS distributes that pressure across many sources. SYN flooding is a TCP-focused availability concept involving excessive incomplete connection attempts. Spoofing falsifies address or identity-related fields. VLAN-hopping concepts target misconfiguration or trust assumptions around switching/trunks; modern defensive configurations should explicitly set access/trunk behaviour and limit allowed VLANs.

Mitigations include capacity planning, upstream provider support, rate limiting, anti-spoofing filters, hardened switch configuration, segmentation, detection baselines and rehearsed response contacts. Preserve logs and flow records while applying containment so the event can be understood afterwards.

## Knowledge check
What design choice reduces the chance an unused switch port can join an unintended VLAN?$$, 3),
  ('network-security-analysis', 'c2-exfiltration-and-soc-scenarios', 'C2, exfiltration and realistic SOC scenarios', 'Bring network evidence together to investigate suspicious outbound behaviour.', $$## Learning objectives
- Recognise beaconing and data-exfiltration concepts.
- Build a cautious SOC investigation from multiple sources.

## Core concepts
Command-and-control (C2) traffic can appear as periodic outbound connections, unusual destinations, rare user agents, unexpected protocols or encrypted traffic that does not match the endpoint’s role. Data exfiltration may appear as sustained uploads, unusual cloud destinations, DNS anomalies or transfers at unusual times. None of these patterns alone proves compromise.

## SOC scenario
A workstation queries a newly registered domain every five minutes, then opens short TLS sessions with low but regular byte counts. Triage with DNS history, endpoint process/user, proxy/firewall logs, certificate metadata, peer comparison and asset role. If risk is confirmed, isolate with a targeted control, preserve volatile evidence and follow the incident process.

## Key takeaway
Networking knowledge turns raw alerts into testable hypotheses. The best answer is evidence-led, proportionate and documented.

## Knowledge check
Which combination is stronger evidence of suspicious beaconing: a single TLS connection, or a repeated time-regular pattern plus unusual DNS and endpoint context?$$, 4)
) as l(module_slug, slug, title, summary, content, position) on l.module_slug = m.slug;

-- Module quizzes: five automatically scored questions after every module.
insert into public.quizzes (course_id, module_id, title, instructions, passing_score, is_published)
select c.id, m.id, 'Module ' || m.position || ' knowledge check', 'Answer each question from the module. Feedback is shown after submission. You may retake this knowledge check at any time.', 70, true
from public.courses c join public.course_modules m on m.course_id = c.id
where c.slug = 'networking-for-cybersecurity';

-- Final assessment: 40 questions, mixing automatically scored MCQ with written
-- responses saved for instructor review. The 70% pass mark applies to MCQs.
insert into public.quizzes (course_id, title, instructions, passing_score, is_published)
select id, 'Networking for Cybersecurity final assessment', 'This 40-question assessment tests your networking reasoning across the whole course. Multiple-choice questions are scored immediately; written responses are saved for review. You may retake the assessment and previous attempts remain in your history.', 70, true
from public.courses where slug = 'networking-for-cybersecurity';

-- Question data and private answer keys are seeded below. The correct answer and
-- explanation are joined only into quiz_question_answer_keys, which has no
-- authenticated SELECT policy.
with question_data as (
  select q.id as quiz_id, v.position, v.prompt, v.options::jsonb, v.answer, v.explanation
  from public.quizzes q
  join public.course_modules m on m.id = q.module_id
  join public.courses c on c.id = q.course_id and c.slug = 'networking-for-cybersecurity'
  join (values
    ('networking-foundations', 1, 'Which measurement describes variation in delay between packets?', '["Bandwidth", "Jitter", "Throughput", "Duplex"]', 'Jitter', 'Jitter is variation in packet delay, which is especially important for real-time media.'),
    ('networking-foundations', 2, 'Which boundary normally limits Layer-2 broadcasts?', '["A hub", "A router or VLAN boundary", "A NIC", "A repeater"]', 'A router or VLAN boundary', 'Routers and VLAN boundaries separate broadcast domains; hubs and repeaters do not.'),
    ('networking-foundations', 3, 'What does throughput measure?', '["Theoretical link capacity", "Useful data actually delivered", "A MAC address", "A routing preference"]', 'Useful data actually delivered', 'Throughput is achieved useful delivery, not merely advertised capacity.'),
    ('networking-foundations', 4, 'Which diagram label is most useful when planning remote-access security?', '["Wallpaper colour", "VPN concentrator", "Monitor size", "Keyboard layout"]', 'VPN concentrator', 'The VPN concentrator is an authentication and network-boundary control point.'),
    ('networking-foundations', 5, 'A mesh topology is valued primarily because it can provide what?', '["One shared collision domain", "Multiple paths", "No addressing", "Only wireless access"]', 'Multiple paths', 'Meshes can offer alternate paths and resilience when designed correctly.'),
    ('network-devices', 1, 'Which table is primarily used by a Layer-2 switch for forwarding?', '["DNS cache", "MAC address table", "Routing table only", "DHCP lease table"]', 'MAC address table', 'A Layer-2 switch learns and forwards based on MAC address entries.'),
    ('network-devices', 2, 'Which device normally represents internal clients to external web servers?', '["Reverse proxy", "Forward proxy", "Repeater", "TAP"]', 'Forward proxy', 'A forward proxy acts on behalf of clients; a reverse proxy represents servers.'),
    ('network-devices', 3, 'What is a main advantage of a network TAP for monitoring?', '["It rewrites traffic", "It passively copies traffic", "It assigns DHCP leases", "It replaces routing"]', 'It passively copies traffic', 'A TAP is designed to copy traffic for a sensor without being an inline forwarding decision.'),
    ('network-devices', 4, 'Which device can block traffic when deployed inline?', '["IDS", "IPS", "SPAN port", "Bridge"]', 'IPS', 'An IPS can enforce blocking inline; an IDS is generally detection-only.'),
    ('network-devices', 5, 'Why should a wireless guest network be separated from staff devices?', '["To improve monitor resolution", "To limit trust and lateral paths", "To remove encryption", "To disable DHCP"]', 'To limit trust and lateral paths', 'Guest separation reduces access to internal resources and blast radius.'),
    ('osi-and-tcp-ip', 1, 'At which OSI layer is IP addressing primarily handled?', '["Physical", "Data Link", "Network", "Application"]', 'Network', 'IP forwarding and logical addressing are Layer-3/Network responsibilities.'),
    ('osi-and-tcp-ip', 2, 'What is the usual PDU name after TCP adds its header?', '["Frame", "Segment", "Bit", "Record"]', 'Segment', 'TCP data plus its transport header is commonly called a segment.'),
    ('osi-and-tcp-ip', 3, 'Which header normally changes at every routed Ethernet hop?', '["Destination IP", "Ethernet MAC header", "HTTP Host header", "TCP port"]', 'Ethernet MAC header', 'Routers remove and rebuild the Layer-2 frame for the next link.'),
    ('osi-and-tcp-ip', 4, 'Which step normally occurs before an HTTPS request can be sent to a named site?', '["DNS resolution", "Database backup", "ARP for the remote server across the internet", "SMTP delivery"]', 'DNS resolution', 'The browser usually resolves the name before it can establish the connection.'),
    ('osi-and-tcp-ip', 5, 'Which layer is most associated with TCP and UDP ports?', '["Transport", "Physical", "Presentation", "Data Link"]', 'Transport', 'TCP and UDP are transport protocols and use ports.'),
    ('ethernet-layer-2', 1, 'Which EtherType is commonly used for ARP?', '["0x0806", "0x0800", "0x86DD", "0x0035"]', '0x0806', 'EtherType 0x0806 identifies ARP; 0x0800 is IPv4.'),
    ('ethernet-layer-2', 2, 'What does a switch do with an unknown unicast destination?', '["Drops it globally", "Floods it within the VLAN", "Sends it to DNS", "Changes its IP address"]', 'Floods it within the VLAN', 'Unknown unicast flooding stays within the relevant VLAN/broadcast domain.'),
    ('ethernet-layer-2', 3, 'When contacting a remote IPv4 network, a host ARPs for which MAC address?', '["The remote server", "The default gateway", "The DNS root server", "Its own NIC"]', 'The default gateway', 'The gateway is the local next hop for off-subnet destinations.'),
    ('ethernet-layer-2', 4, 'Which control can validate ARP against DHCP snooping information?', '["Dynamic ARP Inspection", "NAT", "HTTP", "Traceroute"]', 'Dynamic ARP Inspection', 'DAI can use trusted bindings to validate ARP messages.'),
    ('ethernet-layer-2', 5, 'What does a frame check sequence primarily detect?', '["Accidental link corruption", "User identity", "Malware family", "DNS authority"]', 'Accidental link corruption', 'FCS is an error-detection mechanism, not cryptographic authentication.'),
    ('ipv4-addressing', 1, 'How many bits are in an IPv4 address?', '["16", "32", "48", "128"]', '32', 'IPv4 addresses contain four 8-bit octets, for 32 bits total.'),
    ('ipv4-addressing', 2, 'Which is an RFC1918 private range?', '["172.16.0.0/12", "172.32.0.0/12", "8.8.8.0/24", "224.0.0.0/4"]', '172.16.0.0/12', 'RFC1918 includes 10/8, 172.16/12 and 192.168/16.'),
    ('ipv4-addressing', 3, 'Which service records can help identify who held an IP address at a time?', '["DHCP leases", "EtherType", "FCS", "TCP flags alone"]', 'DHCP leases', 'DHCP lease history can associate an address with a MAC/device over time.'),
    ('ipv4-addressing', 4, 'What does a host send to the default gateway for a remote destination?', '["A frame addressed to the gateway MAC", "An ARP broadcast for the remote host", "A DNS answer", "A new IP address"]', 'A frame addressed to the gateway MAC', 'The packet retains the remote IP destination inside a frame for the gateway.'),
    ('ipv4-addressing', 5, 'What range often appears after a host fails to receive DHCP configuration?', '["127.0.0.0/8", "169.254.0.0/16", "224.0.0.0/4", "10.0.0.0/8"]', '169.254.0.0/16', 'APIPA/link-local 169.254/16 is commonly used after DHCP failure.'),
    ('subnetting', 1, 'How many total addresses are in a /26?', '["32", "64", "128", "256"]', '64', 'A /26 has six host bits, so 2^6 = 64 total addresses.'),
    ('subnetting', 2, 'What is the broadcast address of 192.168.1.128/26?', '["192.168.1.159", "192.168.1.191", "192.168.1.192", "192.168.1.255"]', '192.168.1.191', 'The /26 block beginning at 128 spans 128 through 191.'),
    ('subnetting', 3, 'Which network contains 172.16.40.10 when using /20 blocks?', '["172.16.16.0/20", "172.16.32.0/20", "172.16.40.0/20", "172.16.48.0/20"]', '172.16.32.0/20', 'A /20 advances by 16 in the third octet, so 32–47 is the matching block.'),
    ('subnetting', 4, 'Why allocate the largest VLSM subnet first?', '["It removes the need for masks", "It avoids fragmenting the available range", "It makes every subnet /24", "It disables routing"]', 'It avoids fragmenting the available range', 'Largest-first allocation preserves contiguous space and avoids later overlap.'),
    ('subnetting', 5, 'How many usual usable hosts are in a /30?', '["0", "2", "4", "6"]', '2', 'A /30 has four total addresses, traditionally leaving two usable endpoints.'),
    ('ipv6', 1, 'How many bits are in an IPv6 address?', '["32", "48", "64", "128"]', '128', 'IPv6 uses 128-bit addresses.'),
    ('ipv6', 2, 'Which IPv6 prefix is link-local?', '["fe80::/10", "2000::/3", "fc00::/7", "ff00::/8"]', 'fe80::/10', 'fe80::/10 identifies link-local addressing.'),
    ('ipv6', 3, 'Which protocol family supports IPv6 neighbour discovery?', '["ICMPv6", "ARP", "FTP", "BGP"]', 'ICMPv6', 'IPv6 uses ICMPv6 neighbour discovery instead of ARP.'),
    ('ipv6', 4, 'Why must dual-stack firewalls include IPv6 rules?', '["IPv6 is only used for printers", "Hosts may use IPv6 paths instead of IPv4", "It increases TCP ports", "It removes DNS"]', 'Hosts may use IPv6 paths instead of IPv4', 'Dual-stack hosts can select IPv6, creating paths that IPv4-only policy misses.'),
    ('ipv6', 5, 'How many times may :: appear in one compressed IPv6 address?', '["Never", "Once", "Twice", "Any number"]', 'Once', 'Only one zero-compression marker is permitted to keep the address unambiguous.'),
    ('tcp-and-udp', 1, 'Which TCP flag normally initiates a connection?', '["ACK", "SYN", "FIN", "RST"]', 'SYN', 'The client begins the three-way handshake with SYN.'),
    ('tcp-and-udp', 2, 'What is the purpose of a TCP acknowledgement number?', '["Identify a VLAN", "Confirm received byte sequence progress", "Resolve a DNS name", "Assign an IP"]', 'Confirm received byte sequence progress', 'Acknowledgements tell the peer which stream bytes have been received.'),
    ('tcp-and-udp', 3, 'Which transport is connectionless?', '["TCP", "UDP", "TLS", "ICMP"]', 'UDP', 'UDP does not establish connection state like TCP.'),
    ('tcp-and-udp', 4, 'Which TCP flag usually signals an abrupt reset?', '["RST", "PSH", "URG", "SYN"]', 'RST', 'RST ends a TCP connection abruptly.'),
    ('tcp-and-udp', 5, 'Which observation may suggest TCP retransmission trouble?', '["Repeated sequence data after missing acknowledgements", "A valid DNS A record", "A MAC address table entry", "A DHCP lease"]', 'Repeated sequence data after missing acknowledgements', 'Retransmissions are often visible as repeated stream data when acknowledgements do not arrive.'),
    ('ports-and-sockets', 1, 'What is an ephemeral port usually used for?', '["A client-side temporary source port", "A permanent DNS server port", "A VLAN tag", "A MAC address"]', 'A client-side temporary source port', 'Clients typically use ephemeral source ports for outbound connections.'),
    ('ports-and-sockets', 2, 'Which port is commonly SSH?', '["21", "22", "23", "25"]', '22', 'SSH commonly listens on TCP port 22.'),
    ('ports-and-sockets', 3, 'Which port is commonly associated with SMB?', '["53", "110", "445", "993"]', '445', 'SMB commonly uses TCP 445.'),
    ('ports-and-sockets', 4, 'Why is a port number not proof of an application identity?', '["Ports are encrypted", "Services can use nonstandard ports", "IP has no ports", "DHCP changes all ports"]', 'Services can use nonstandard ports', 'Port convention is a clue; process and protocol evidence verify the service.'),
    ('ports-and-sockets', 5, 'Which tuple best identifies a TCP flow?', '["Source IP, source port, destination IP, destination port", "MAC only", "DNS name only", "VLAN only"]', 'Source IP, source port, destination IP, destination port', 'The directional four-tuple distinguishes concurrent transport conversations.'),
    ('core-protocols', 1, 'Which protocol translates a hostname to an address record?', '["DNS", "DHCP", "NTP", "SNMP"]', 'DNS', 'DNS resolves names to records.'),
    ('core-protocols', 2, 'Which protocol normally protects HTTP traffic in HTTPS?', '["TLS", "ARP", "FTP", "RIP"]', 'TLS', 'HTTPS uses TLS to protect HTTP in transit.'),
    ('core-protocols', 3, 'Which protocol provides encrypted remote shell access?', '["Telnet", "SSH", "TFTP", "POP3"]', 'SSH', 'SSH provides encrypted remote administration.'),
    ('core-protocols', 4, 'Which protocol keeps clocks aligned?', '["LDAP", "NTP", "SMTP", "SMB"]', 'NTP', 'NTP synchronises time, important for investigation timelines.'),
    ('core-protocols', 5, 'Which protocol is associated with ticket-based enterprise authentication?', '["Kerberos", "ICMP", "ARP", "HTTP"]', 'Kerberos', 'Kerberos uses tickets and commonly runs on port 88.'),
    ('dns-deep-dive', 1, 'Which DNS server holds the authoritative zone data?', '["Recursive resolver", "Authoritative nameserver", "Client stub resolver", "Default gateway"]', 'Authoritative nameserver', 'Authoritative nameservers publish the zone’s definitive records.'),
    ('dns-deep-dive', 2, 'What does TTL communicate in DNS?', '["A permitted cache duration", "A TCP port", "A MAC lifetime", "A password policy"]', 'A permitted cache duration', 'TTL tells caches how long a response may normally be reused.'),
    ('dns-deep-dive', 3, 'Which record type maps a name to an IPv6 address?', '["A", "AAAA", "MX", "PTR"]', 'AAAA', 'AAAA records contain IPv6 addresses.'),
    ('dns-deep-dive', 4, 'What is a reasonable signal to investigate for DNS tunnelling concepts?', '["Many unusually long, high-entropy labels", "One normal A lookup", "A correct time zone", "A static route"]', 'Many unusually long, high-entropy labels', 'Repeated unusual labels can be a signal, but require context and corroboration.'),
    ('dns-deep-dive', 5, 'How does DoH commonly carry DNS queries?', '["Inside HTTPS", "Inside ARP", "Inside Ethernet FCS", "Inside DHCP leases"]', 'Inside HTTPS', 'DNS over HTTPS encapsulates DNS in HTTPS traffic.'),
    ('routing-and-nat', 1, 'When two routes match, which is normally preferred?', '["Shortest prefix", "Longest prefix", "Oldest route", "Highest port"]', 'Longest prefix', 'The most specific matching prefix wins.'),
    ('routing-and-nat', 2, 'Which protocol is used between autonomous systems on the internet?', '["BGP", "ARP", "DHCP", "FTP"]', 'BGP', 'BGP exchanges routing information between autonomous systems.'),
    ('routing-and-nat', 3, 'What does PAT allow?', '["Many internal flows to share a public address using ports", "All VLANs to merge", "DNS records to encrypt", "MAC addresses to route"]', 'Many internal flows to share a public address using ports', 'PAT distinguishes translated connections through port mappings.'),
    ('routing-and-nat', 4, 'Which evidence is especially important when attributing activity behind PAT?', '["Translation log with source port and time", "Only the public IP", "Only a MAC address", "Only the website title"]', 'Translation log with source port and time', 'PAT attribution requires the mapping, ports and precise timestamps.'),
    ('routing-and-nat', 5, 'What is the role of a default route?', '["Handle destinations without a more specific route", "Encrypt all traffic", "Assign DHCP leases", "Resolve names"]', 'Handle destinations without a more specific route', 'A default route is the fallback path.'),
    ('vlans-and-segmentation', 1, 'Which port type normally carries multiple VLANs?', '["Access", "Trunk", "Console", "Loopback"]', 'Trunk', 'Trunks carry tagged traffic for multiple VLANs between devices.'),
    ('vlans-and-segmentation', 2, 'What is needed for hosts in different VLANs to communicate?', '["Inter-VLAN Layer-3 routing", "A hub", "The same MAC", "A longer cable"]', 'Inter-VLAN Layer-3 routing', 'VLANs are separate Layer-2 domains and need routing to cross.'),
    ('vlans-and-segmentation', 3, 'What is the main security purpose of segmentation?', '["Increase wallpaper quality", "Reduce blast radius and unnecessary paths", "Remove all logs", "Replace authentication"]', 'Reduce blast radius and unnecessary paths', 'Segmentation constrains reachability after mistakes or compromise.'),
    ('vlans-and-segmentation', 4, 'Where should administrative interfaces normally be reached from?', '["A controlled management network", "Any guest Wi-Fi", "The public internet by default", "A random user VLAN"]', 'A controlled management network', 'Management networks restrict high-impact administrative access.'),
    ('vlans-and-segmentation', 5, 'What should be reviewed after a segmentation change?', '["Both permitted and denied traffic", "Only cable colour", "Only DNS TTL", "Only keyboard layout"]', 'Both permitted and denied traffic', 'Observability verifies that policy behaves as designed.'),
    ('firewalls-acls-vpns', 1, 'What does a stateful firewall track?', '["Connection state", "Only Ethernet colour", "Only DNS zones", "Only screen size"]', 'Connection state', 'Stateful firewalls understand established flows and return traffic.'),
    ('firewalls-acls-vpns', 2, 'What does an implicit deny mean?', '["Traffic is permitted unless logged", "Unmatched traffic is denied", "All traffic is encrypted", "Routes are removed"]', 'Unmatched traffic is denied', 'An implicit deny blocks traffic not matched by an allow rule.'),
    ('firewalls-acls-vpns', 3, 'Which filtering direction limits what internal systems can reach outward?', '["Egress", "Ingress", "Loopback", "Native VLAN"]', 'Egress', 'Egress filtering constrains outbound destinations and services.'),
    ('firewalls-acls-vpns', 4, 'Which VPN type commonly connects two entire networks?', '["Site-to-site", "Remote-access only", "Loopback", "SPAN"]', 'Site-to-site', 'Site-to-site VPNs join network gateways; remote access serves individual users/devices.'),
    ('firewalls-acls-vpns', 5, 'Why must firewall rule order be reviewed?', '["Many products use first matching rule", "It changes MAC addresses", "It removes TLS", "It assigns leases"]', 'Many products use first matching rule', 'A broad early rule can shadow a later, more specific intended rule.'),
    ('packet-analysis-troubleshooting', 1, 'What can a failed ping conclusively prove?', '["The remote host is down", "Only that the observed ICMP attempt did not succeed", "DNS is broken", "A firewall is misconfigured"]', 'Only that the observed ICMP attempt did not succeed', 'ICMP can be filtered or rate-limited, so ping alone does not prove host failure.'),
    ('packet-analysis-troubleshooting', 2, 'Which tool helps inspect a local Linux routing table?', '["ip route", "dig", "arp -a only", "Wireshark Follow Stream"]', 'ip route', 'ip route displays routing entries and next hops on Linux systems.'),
    ('packet-analysis-troubleshooting', 3, 'What is the difference between a Wireshark capture and display filter?', '["Capture limits collection; display changes what is shown", "They are identical", "Display changes packets on the wire", "Capture decrypts TLS"]', 'Capture limits collection; display changes what is shown', 'Display filters do not alter the stored capture.'),
    ('packet-analysis-troubleshooting', 4, 'Which filter shows packets involving 192.0.2.10?', '["ip.addr == 192.0.2.10", "tcp.port == 192.0.2.10", "dns == 192.0.2.10", "arp.addr == 192.0.2.10"]', 'ip.addr == 192.0.2.10', 'ip.addr matches either IPv4 endpoint address.'),
    ('packet-analysis-troubleshooting', 5, 'Why record a packet capture point?', '["To understand what traffic may be absent or transformed", "To increase bandwidth", "To change DNS", "To avoid timestamps"]', 'To understand what traffic may be absent or transformed', 'Capture placement affects completeness, visibility and interpretation.'),
    ('network-security-analysis', 1, 'Which pattern is more consistent with port scanning?', '["Many ports probed on one host", "One normal HTTPS session", "One DHCP acknowledgement", "A static route"]', 'Many ports probed on one host', 'A multi-port probe pattern is stronger evidence than one ordinary connection.'),
    ('network-security-analysis', 2, 'Which control helps validate ARP messages against trusted bindings?', '["Dynamic ARP Inspection", "NAT", "SMTP", "BGP"]', 'Dynamic ARP Inspection', 'DAI can validate ARP using DHCP snooping bindings.'),
    ('network-security-analysis', 3, 'What can help reduce spoofed-source traffic at a boundary?', '["Anti-spoofing ingress/egress filters", "Increasing TTL only", "Disabling logs", "Using a hub"]', 'Anti-spoofing ingress/egress filters', 'Filtering addresses that should not arrive from a direction helps limit spoofing.'),
    ('network-security-analysis', 4, 'What is a sensible first response to a credible beaconing hypothesis?', '["Correlate DNS, endpoint and network evidence", "Delete all logs", "Assume one packet proves compromise", "Test unrelated public systems"]', 'Correlate DNS, endpoint and network evidence', 'Corroboration and scope are needed before targeted containment.'),
    ('network-security-analysis', 5, 'Which feature can suggest data exfiltration when combined with context?', '["Unexpected sustained outbound upload volume", "A single ARP request", "A valid loopback address", "One NTP packet"]', 'Unexpected sustained outbound upload volume', 'Unusual long-duration outbound volume can be a meaningful signal when contextualised.')
  ) as v(module_slug, position, prompt, options, answer, explanation) on v.module_slug = m.slug
  where q.module_id = m.id
), inserted_questions as (
  insert into public.quiz_questions (quiz_id, prompt, question_type, options, position)
  select quiz_id, prompt, 'mcq', options, position from question_data
  returning id, quiz_id, prompt, position
)
insert into public.quiz_question_answer_keys (question_id, correct_answer, explanation)
select i.id, d.answer, d.explanation from inserted_questions i join question_data d on d.quiz_id = i.quiz_id and d.position = i.position and d.prompt = i.prompt;

with final_question_data as (
  select q.id as quiz_id, v.position, v.prompt, v.question_type, v.options::jsonb, v.answer, v.explanation
  from public.quizzes q
  join public.courses c on c.id = q.course_id and c.slug = 'networking-for-cybersecurity'
  join (values
    (1, 'A user on 192.168.1.10/24 opens 192.168.2.20. Which MAC address is normally used as the destination in the first Ethernet frame?', 'mcq', '["192.168.2.20 MAC", "Default gateway MAC", "DNS server MAC", "Broadcast MAC"]', 'Default gateway MAC', 'The remote IP is carried inside a frame addressed to the local default gateway.'),
    (2, 'Which OSI layer is most directly responsible for routing packets between networks?', 'mcq', '["Physical", "Data Link", "Network", "Session"]', 'Network', 'IP routing is a Network-layer function.'),
    (3, 'Which TCP flag sequence most commonly starts a connection?', 'mcq', '["ACK, FIN, ACK", "SYN, SYN-ACK, ACK", "RST, ACK", "PSH, URG"]', 'SYN, SYN-ACK, ACK', 'This is the TCP three-way handshake.'),
    (4, 'What is the usable host range for 192.168.1.128/26?', 'mcq', '["128–191", "129–190", "130–189", "1–62"]', '129–190', 'The network is .128 and broadcast is .191, leaving .129 through .190.'),
    (5, 'A client uses source port 53122 to connect to TCP 443. Which is most likely the server service port?', 'mcq', '["53122", "443", "Both are service ports", "Neither"]', '443', 'The client typically chooses an ephemeral source port; 443 is the server listener.'),
    (6, 'Which DNS record carries a mail exchanger preference?', 'mcq', '["MX", "PTR", "AAAA", "SOA"]', 'MX', 'MX records identify mail exchangers.'),
    (7, 'What does longest-prefix matching prefer?', 'mcq', '["The most specific matching route", "The oldest route", "The highest metric", "The default route always"]', 'The most specific matching route', 'A longer prefix represents a more specific destination range.'),
    (8, 'Which IPv6 mechanism replaces IPv4 ARP?', 'mcq', '["ICMPv6 Neighbour Discovery", "FTP", "BGP", "SMTP"]', 'ICMPv6 Neighbour Discovery', 'IPv6 uses ICMPv6-based neighbour discovery rather than ARP.'),
    (9, 'Why can an IPv4-only security review be incomplete?', 'mcq', '["Dual-stack hosts may use IPv6", "IPv4 has no ports", "DNS only supports IPv6", "TLS removes IP"]', 'Dual-stack hosts may use IPv6', 'IPv6 traffic can take a path ignored by IPv4-only policy and monitoring.'),
    (10, 'Which switch behaviour sends a frame to many ports when the destination MAC is not yet known?', 'mcq', '["Flooding within the VLAN", "NAT", "DNS recursion", "Route summarisation"]', 'Flooding within the VLAN', 'Unknown unicast frames are flooded within the relevant VLAN.'),
    (11, 'What is the broadcast address of 172.16.32.0/20?', 'mcq', '["172.16.32.255", "172.16.47.255", "172.16.48.255", "172.16.63.255"]', '172.16.47.255', 'A /20 beginning at third octet 32 spans 32 through 47.'),
    (12, 'Which control is best described as an inline detector that can block?', 'mcq', '["IPS", "IDS", "TAP", "DNS resolver"]', 'IPS', 'An IPS can take inline prevention action.'),
    (13, 'What does PAT primarily translate in addition to addresses?', 'mcq', '["Ports", "MAC vendors", "DNS TTL", "TLS certificates"]', 'Ports', 'PAT differentiates flows using translated port mappings.'),
    (14, 'Which protocol is most associated with time synchronisation?', 'mcq', '["NTP", "LDAP", "SNMP", "IMAP"]', 'NTP', 'NTP keeps clocks aligned.'),
    (15, 'A firewall rule is safest when it follows which principle?', 'mcq', '["Least privilege", "Allow any for convenience", "Security through obscurity", "Default permit"]', 'Least privilege', 'Allow only the minimum justified source, destination and service.'),
    (16, 'What does a VLAN primarily create?', 'mcq', '["A separate logical broadcast domain", "An encrypted tunnel", "A TCP session", "A DNS zone"]', 'A separate logical broadcast domain', 'VLANs separate Layer-2 broadcast domains.'),
    (17, 'Which log source can most directly map a leased internal IPv4 address to a device at a time?', 'mcq', '["DHCP lease log", "FCS counter", "Browser history only", "BGP table"]', 'DHCP lease log', 'DHCP records lease assignments over time.'),
    (18, 'What can a repeated outbound connection at a regular interval indicate when paired with other evidence?', 'mcq', '["Possible beaconing", "Guaranteed benign traffic", "A subnet mask", "A VLAN tag"]', 'Possible beaconing', 'Regularity is a useful C2 signal but must be corroborated.'),
    (19, 'Why is a NAT translation log important during attribution?', 'mcq', '["Many hosts may share one public address", "NAT encrypts traffic", "NAT resolves DNS", "NAT replaces DHCP"]', 'Many hosts may share one public address', 'The mapping and port/time identify the internal flow behind shared NAT.'),
    (20, 'Which Wireshark display filter selects DNS packets?', 'mcq', '["dns", "port.dns", "route dns", "ip.dns"]', 'dns', 'The simple display filter dns selects decoded DNS traffic.'),
    (21, 'Which protocol normally provides ordered, reliable delivery?', 'mcq', '["TCP", "UDP", "ARP", "ICMP"]', 'TCP', 'TCP provides ordered, acknowledged delivery with retransmission.'),
    (22, 'Which of these is an IPv4 loopback range?', 'mcq', '["127.0.0.0/8", "169.254.0.0/16", "224.0.0.0/4", "10.0.0.0/8"]', '127.0.0.0/8', '127/8 refers to the local host.'),
    (23, 'What does TLS normally provide for HTTPS?', 'mcq', '["Encryption and server authentication", "IP routing", "DHCP leasing", "MAC learning"]', 'Encryption and server authentication', 'TLS protects the HTTP exchange and normally authenticates the server.'),
    (24, 'Which service is commonly on port 53?', 'mcq', '["DNS", "SSH", "SMB", "RDP"]', 'DNS', 'DNS commonly uses port 53.'),
    (25, 'What is a key limitation of an IDS compared with an IPS?', 'mcq', '["It generally alerts rather than blocks inline", "It cannot see packets", "It has no logs", "It cannot use signatures"]', 'It generally alerts rather than blocks inline', 'IDS detection is commonly out-of-band; IPS can block inline.'),
    (26, 'Which is the right first distinction when troubleshooting a named website?', 'mcq', '["Name resolution, reachability, transport, then application", "Change firewall rules immediately", "Assume DNS is malicious", "Scan unrelated systems"]', 'Name resolution, reachability, transport, then application', 'Layered diagnostics prevent random, disruptive changes.'),
    (27, 'Which address type is fe80::/10?', 'mcq', '["IPv6 link-local", "IPv6 global unicast", "IPv4 private", "IPv6 multicast"]', 'IPv6 link-local', 'fe80::/10 is link-local IPv6.'),
    (28, 'Why is segmenting a management network important?', 'mcq', '["It limits high-impact administrative access", "It increases broadcast everywhere", "It disables logging", "It removes MFA"]', 'It limits high-impact administrative access', 'Administration should have a controlled, auditable path.'),
    (29, 'What does the FCS in an Ethernet frame primarily help detect?', 'mcq', '["Accidental transmission corruption", "Correct user password", "DNS poisoning", "Application authorisation"]', 'Accidental transmission corruption', 'FCS is link error detection, not security authentication.'),
    (30, 'Which dynamic routing protocol is primarily used between autonomous systems?', 'mcq', '["BGP", "OSPF", "RIP", "ARP"]', 'BGP', 'BGP is the inter-domain routing protocol.'),
    (31, 'Which IPv4 network contains 10.10.22.5/16?', 'mcq', '["10.10.0.0/16", "10.10.22.0/24", "10.0.0.0/8 only", "10.10.22.5/32"]', '10.10.0.0/16', 'The first two octets are the network portion in a /16.'),
    (32, 'What can unusually long high-entropy DNS labels suggest, when corroborated?', 'mcq', '["Potential DNS tunnelling", "A guaranteed malware verdict", "A subnet error only", "Normal ARP"]', 'Potential DNS tunnelling', 'They can be an investigative signal, not standalone proof.'),
    (33, 'A new public web application should expose its database directly to the internet. Explain why this statement is unsafe and name the boundary that should receive public HTTPS.', 'written', '[]', null, null),
    (34, 'For 192.168.50.64/27, write the network address, broadcast address and usual usable host range.', 'written', '[]', null, null),
    (35, 'A remote user cannot reach an internal service. List three evidence sources you would check before changing a VPN or firewall rule.', 'written', '[]', null, null),
    (36, 'Explain the difference between a MAC address and an IP address in one concise paragraph.', 'written', '[]', null, null),
    (37, 'Describe what a SOC analyst should correlate before treating a periodic TLS connection as confirmed command-and-control traffic.', 'written', '[]', null, null),
    (38, 'A workstation has a 169.254.x.x address. Explain the most likely configuration problem and two safe checks.', 'written', '[]', null, null),
    (39, 'Explain why encrypted DNS changes monitoring design, and give one privacy-respecting defensive option.', 'written', '[]', null, null),
    (40, 'Design a least-privilege rule in words for an application server that must reach a database, including the fields a change record should include.', 'written', '[]', null, null)
  ) as v(position, prompt, question_type, options, answer, explanation) on true
  where q.module_id is null
), inserted_questions as (
  insert into public.quiz_questions (quiz_id, prompt, question_type, options, position)
  select quiz_id, prompt, question_type, options, position from final_question_data
  returning id, quiz_id, prompt, position
)
insert into public.quiz_question_answer_keys (question_id, correct_answer, explanation)
select i.id, d.answer, d.explanation
from inserted_questions i
join final_question_data d on d.quiz_id = i.quiz_id and d.position = i.position and d.prompt = i.prompt
where d.question_type = 'mcq';
