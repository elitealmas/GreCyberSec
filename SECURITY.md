# Security Policy

## Supported versions

Only the latest version on the default branch is supported during initial development.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the GreCyberSec society committee or the University of Greenwich’s approved security contact when one is published. Do not open a public issue for a potential vulnerability.

Include a clear description, affected URL or component, reproduction steps, impact and any suggested mitigation. Do not access, alter or exfiltrate data; test only against systems you are authorised to use.

We aim to acknowledge reports promptly, investigate responsibly and coordinate a fix before public disclosure. Please allow reasonable time for remediation and avoid publishing exploit details while a fix is underway.

## Expectations

- Do not commit secrets, personal data, private keys or environment files.
- Treat all user input as untrusted and validate it on the server.
- Review changes to authentication, database access, uploads or external integrations before merging.
- Keep dependencies to a minimum and run `npm audit` as part of release checks.
