// src/StateRegulations.js
import React, { useState } from 'react';

const stateData = {
  WA: {
    title: 'Washington (WAC 388‑97)',
    details: `- Governed by Washington Administrative Code (WAC) 388‑97.
- Requires RN coverage 8 hrs/day, 7 days/week; 24/7 on‑call RN for skilled needs.
- Facilities must meet minimum staffing ratios & maintain individualized care plans.
- WA DOH performs annual and complaint surveys alongside CMS standards.
- Resident rights include notice of transfer, access to grievance process, and dignity provisions.`,
  },
  MT: {
    title: 'Montana (ARM 37.106.2801)',
    details: `- Governed by Administrative Rules of Montana (ARM) 37.106.2801‑2827.
- Requires a licensed nursing home administrator and 24‑hr RN/LPN oversight.
- Must comply with federal 42 CFR 483 subpart B for Medicare/Medicaid participation.
- Care plans must be interdisciplinary and reviewed quarterly.
- MT DPHHS enforces infection prevention and abuse prevention protocols.`,
  },
  OR: {
    title: 'Oregon (OAR 411‑085)',
    details: `- Licensed under Oregon Administrative Rules (OAR) 411‑085.
- Must maintain 2.46 hours of direct care per resident per day (minimum).
- RN or LPN must be present on each shift; administrator must be state‑licensed.
- Resident Bill of Rights includes visitation, dignity, and protection from retaliation.
- OR DHS conducts annual and complaint surveys using CMS F‑tag framework.`,
  },
  AZ: {
    title: 'Arizona (R9‑10‑401 to R9‑10‑425)',
    details: `- Governed by Arizona Administrative Code Title 9, Chapter 10.
- Requires medical director, RN coverage daily, and sufficient direct care staff.
- Must meet CMS Appendix PP and state-specific life safety rules.
- Infection control and staff training reviewed during state surveys.
- AZ DHS licenses facilities and can issue penalties for noncompliance.`,
  },

  // Example states previously added:
  ID: {
    title: 'Idaho (IDAPA 16.03.02)',
    details: `- Facilities regulated under IDAPA 16.03.02 (Rules & Minimum Standards).
- Must license 90 days before opening; include policies/procedures, staffing plans, and administrator licensure.
- Participate in CMS‑approved CNA training (NATCEP) per 42 CFR standards.
- State enforces facility standards and resident rights.`
  },
  CA: {
    title: 'California (Title 22 CCR)',
    details: `- Licensed under CA Title 22 + must follow CMS Appendix PP.
- Minimum 3.5 nursing HPRD, with ≥2.4 CNA hours and 24‑hour RN coverage.
- Infection control training per CMS 483.95 & Appendix PP.
- Extended resident rights: no forced arbitration, re‑admission rights, privacy protections.`
  },

  // Placeholder for all other states (partial example shown)
  AL: { title: 'Alabama', details: 'State regulations coming soon.' },
  AK: { title: 'Alaska', details: 'State regulations coming soon.' },
  WY: { title: 'Wyoming', details: 'State regulations coming soon.' },
  DC: { title: 'District of Columbia', details: 'State regulations coming soon.' },
};

function StateRegulations() {
  const [selected, setSelected] = useState('');

  return (
    <div style={{ marginTop: 40 }}>
      <h3>📚 State-Specific Regulations</h3>
      <select
        style={{ padding: 8, width: '100%', marginBottom: 20 }}
        value={selected}
        onChange={e => setSelected(e.target.value)}
      >
        <option value="">Select a state...</option>
        {Object.entries(stateData).map(([abbr, { title }]) => (
          <option key={abbr} value={abbr}>
            {abbr} – {title}
          </option>
        ))}
      </select>
      {selected && (
        <div style={{ background: '#f4f4f4', padding: 20, borderRadius: 8 }}>
          <p><strong>{stateData[selected].title}</strong></p>
          <p style={{ whiteSpace: 'pre-line' }}>{stateData[selected].details}</p>
          <p><em>Federal Appendix PP applies nationwide.</em></p>
        </div>
      )}
    </div>
  );
}

export default StateRegulations;
