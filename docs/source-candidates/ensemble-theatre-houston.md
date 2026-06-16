---
name: Ensemble Theatre Houston
status: added
platform: Custom HTML ripper
url: https://www.ensemblehouston.com/
tags: [Theater, Midtown]
firstSeen: 2026-06-16
lastChecked: 2026-06-16
eventCount: 6
pr: (pending)
impl:
  type: custom
  geo: { lat: 29.7301, lng: -95.4105, label: "Ensemble Theatre Houston, 3535 Main St, Houston, TX 77002" }
---

Professional African American theater company in Midtown. Main stage productions and educational programming. Ticketing via Salesforce.

**Verified details:**
- 6+ mainstage productions per season
- Event listings at https://www.ensemblehouston.com/seasons (or ticketing page)
- Salesforce-based ticketing system with show dates, times, and descriptions
- Stable production schedule (4-6 shows typically in season)

**Implementation path:**
Custom HTMLRipper scraper for production pages. Extract show title, dates, show times, description, ticket link. Moderate effort (~2 hours).
