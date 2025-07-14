// src/StateRegulations.js
import React, { useState } from 'react';

const stateData = {
  Idaho: {
    federalLink: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-483',
    notes: 'Idaho generally follows CMS Appendix PP but requires additional documentation around medication error rates exceeding 5%.'
  },
  California: {
    federalLink: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-483',
    notes: 'California has additional regulations under Title 22, Division 5 of the CA Code of Regulations.'
  },
  Texas: {
    federalLink: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-483',
    notes: 'Texas adds additional nurse staffing ratios and dietary requirements in TAC Title 26.'
  }
};

function StateRegulations() {
  const [selected, setSelected] = useState('');

  const handleSelect = (e) => setSelected(e.target.value);

  const info = stateData[selected];

  return (
    <div style={{ marginTop: 40 }}>
      <h3>📚 State-Specific Regulations</h3>
      <select onChange={handleSelect} value={selected} style={{ padding: 8, marginBottom: 20 }}>
        <option value="">Select a state...</option>
        {Object.keys(stateData).map(state => (
          <option key={state} value={state}>{state}</option>
        ))}
      </select>

      {info && (
        <div style={{ background: '#f4f4f4', padding: 20, borderRadius: 8 }}>
          <p><strong>Federal CMS Regulations:</strong><br />
            <a href={info.federalLink} target="_blank" rel="noopener noreferrer">
              {info.federalLink}
            </a></p>
          <p><strong>State-Specific Notes:</strong><br />{info.notes}</p>
        </div>
      )}
    </div>
  );
}

export default StateRegulations;

