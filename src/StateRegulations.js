// src/StateRegulations.js
import React, { useState } from 'react';

const stateData = {
  OH: {
    title: 'Ohio (ORC 3721 & OAC 3701‑17)',
    details: `- Personnel training, qualifications, fire safety, inspections under OAC 3701‑17.  
- Licensing via ORC Chapter 3721 with annual renewals.  
- Resident rights and safety standards strictly enforced by ODH.`
  },
  TX: {
    title: 'Texas (HSC Chapter 242 & TAC 26‑554)',
    details: `- Licensed nurse on duty 24/7, min .4 licensed-nurse hours per resident per day.  
- Regulated under TAC 26, Subchapters E, H, I (staffing, quality, reporting).  
- Strict complaint reporting, annual inspections, and quality oversight.`
  },
  FL: {
    title: 'Florida (Chapter 400 FS & FAC 59A‑4)',
    details: `- Minimum staffing: ~3.6 HPRD (2.6 CNA + 1 RN).  
- Facilities must have 96‑hr backup generator.  
- Annual inspections, resident rights, ombudsman support, and emergency reporting via HFRS database.`
  },
  AZ: {
    title: 'Arizona (AAC R9‑10‑401 to 425)',
    details: `- Medical director required, daily RN coverage, and adequate direct-care staffing.  
- Must comply with CMS Appendix PP plus AZ life-safety rules.  
- Infection control and staff training inspected by AZ DHS.`
  },
  // Existing entries for WA, MT, OR...
  CA: {/* ... */},
  WA: {/* ... */},
  MT: {/* ... */},
  OR: {/* ... */},
  // Placeholders for others here...
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
