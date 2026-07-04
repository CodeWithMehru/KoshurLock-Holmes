# Scenario specification: the Rahul Sharma case

This is a synthetic corporate security incident used to demonstrate cross-source,
multi-hop reasoning and the ability to teach a correction and forget a planted
false clue. Every value below is fictional. The case is designed so that the raw
evidence, taken naively, frames an innocent employee, and only cross-source
reasoning plus one confirmed analyst finding reveals the truth.

## The company and the people

- Company: Northgate Financial (email domain northgate-financial.com).
- Framed employee: Rahul Sharma, login rsharma, email rsharma@northgate-financial.com,
  Employee ID EMP-4471, Finance department, Floor 3.
- Colleague and manager: D. Kapoor, login dkapoor.
- Another internal user (appears only in the VPN log): mgomez.
- External attacker: operates from IP 41.220.13.7, geolocated to Lagos, NG.

## Key identifiers (these appear as graph nodes and timeline entries)

- Attacker IP: 41.220.13.7 (Lagos, NG, unrecognized, the indicator of compromise).
- Rahul Sharma legitimate IPs: 10.20.3.14 (office, Floor 3 internal),
  103.211.54.9 (Bengaluru, IN residential).
- Exfiltration destination: grey.market.datavault@gmail.com (external).
- Exfiltrated files: Q4_Customer_Database.xlsx, Customer_PII_Export_Full.csv.
- Attacker VPN session: VPN-88742.
- Hosts: FIN-FS-01, FIN-FS-02. Cameras: CAM-3F-07, CAM-3F-02, CAM-3F-01.
- SOC reference: SOC-2026-0619. Employee ID: EMP-4471.

## What actually happened

On 2026-06-19 Rahul Sharma's corporate credentials were phished. MFA was not
enforced on the legacy VPN and the password was never rotated. On the night of
30 June into 1 July, Rahul Sharma was physically in the office working late
(confirmed by badge and CCTV). At around 02:00 an external attacker used the
stolen credentials to log in from 41.220.13.7 (Lagos), viewed and downloaded the
customer database and a PII export, and emailed them to an external Gmail address.
A resignation filed on 2026-06-23 and an anonymous tip received at 07:40 the next
morning both point at Rahul Sharma, but neither is supported by the system logs.
The physical impossibility (in the office and logging in from Lagos at the same
time) plus the confirmed phishing finding exonerate Rahul Sharma and identify the
external attacker.

## Evidence sources (8 files in backend/data)

Each source is loaded with a provenance header (SOURCE, SOURCE TYPE, RELIABILITY)
so answers can cite their origin and reliability is visible in the graph.

| File | Type | Reliability | Role |
| --- | --- | --- | --- |
| vpn_logs.csv | VPN connection log | system-generated (high) | Shows the failed then successful login from 41.220.13.7 (session VPN-88742) and Rahul's legitimate office and residential logins. |
| file_access_logs.csv | File access / DLP log | system-generated (high) | The 02:19 and 02:22 downloads of the customer database and PII export, tied to session VPN-88742 on FIN-FS-02. |
| email_logs.csv | Email gateway log | system-generated (high) | The 02:35 and 02:36 exfiltration emails (48.6 MB and 39.2 MB) to grey.market.datavault@gmail.com. |
| badge_logs.csv | Physical badge-access log | system-generated (high) | Rahul badges back into the Finance wing at 23:01 and does not badge out until 05:44 - the physical alibi. |
| cctv_events.csv | CCTV person-detection log | system-generated (high) | Camera CAM-3F-07 places Rahul at his desk at 02:14, during the Lagos login window. |
| hr_notes.txt | HR case note | internal record (medium) | The resignation on 2026-06-23; a red-herring motive. |
| phishing_evidence.txt | SOC threat-intel note | security-verified (high) | The confirmed phishing on 2026-06-19 and the 41.220.13.7 indicator. HELD BACK from the initial ingest; its finding enters via Teach. |
| anonymous_tip.txt | anonymous whistleblower tip | UNVERIFIED / uncorroborated (low) | A planted, uncorroborated accusation against Rahul Sharma. Removed via Forget. |

## The critical timeline (all 2026)

- 06-19 14:22 - Rahul's credentials phished (from phishing_evidence.txt).
- 06-23 - resignation filed (hr_notes.txt).
- 06-30 22:58 / 23:01 - Rahul badges into the building and the Finance wing.
- 06-30 23:03, 23:41 - CCTV at Rahul's desk.
- 07-01 01:12 - CCTV, kitchenette.
- 07-01 01:58 - VPN login FAILED from 41.220.13.7.
- 07-01 02:03 - VPN login SUCCESS from 41.220.13.7 (session VPN-88742).
- 07-01 02:07 - VIEW Q4_Customer_Database.xlsx.
- 07-01 02:14 - CCTV at Rahul's desk (the physical impossibility).
- 07-01 02:19 - DOWNLOAD Q4_Customer_Database.xlsx.
- 07-01 02:22 - DOWNLOAD Customer_PII_Export_Full.csv.
- 07-01 02:35 / 02:36 - exfiltration emails to the external Gmail.
- 07-01 02:41 - VPN LOGOUT (session VPN-88742).
- 07-01 03:50 - CCTV at Rahul's desk.
- 07-01 05:43 / 05:44 / 05:46 - CCTV elevator and badge out.
- 07-01 07:40 - anonymous tip received.

## The forget target and the taught correction

- Forget target: anonymous_tip.txt. It is ingested into its own dataset so it can
  be surgically removed with a single forget-by-dataset. It directly accuses Rahul
  Sharma with no supporting log.
- Taught correction (Improve): a CONFIRMED SOC determination (reference
  SOC-2026-0619) stating that 41.220.13.7 is a known external attacker, that
  Rahul's credentials were phished and stolen on 2026-06-19, that the 02:00 to
  02:41 activity from that IP was an account takeover and not Rahul's action, and
  that Rahul was physically in the office and therefore could not have logged in
  from Lagos. This is the distilled finding from phishing_evidence.txt, added as
  the highest-reliability source.

## Expected outcome of The Turn

- Before (raw evidence plus the planted tip): the naive conclusion implicates Rahul
  Sharma, since the downloads happen under his account and the tip and resignation
  point at him.
- After (teach the phishing finding, forget the tip): the conclusion re-derives to
  exonerate Rahul Sharma and name the external attacker at 41.220.13.7, because the
  account takeover explanation plus the badge and CCTV alibi make Rahul's guilt
  physically impossible.
