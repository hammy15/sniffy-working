// src/StateRegulations.js
import React, { useState } from 'react';

const stateData = {
  'CA': 'California requires electronic submission of POCs and strict timelines.',
  'NY': 'New York enforces state-specific tags in addition to federal F-Tags.',
  'TX': 'Texas requires a separate QA form submission for each deficiency.',
  // Add more states as needed
};

function StateRegulations() {
  const [selectedState, setSelectedState] = useState('');

  return (
    <div style={{ marginTop: 50 }}>
      <h3>📚 State-Specific Regulations</h3>
      <select
        value={selectedState}
        onChange={e => setSelectedState(e.target.value)}
        style={{ padding: 10, width: '100%', marginBottom: 10 }}
      >
        <option value="">Select a state</option>
        {Object.keys(stateData).map(state => (
          <option key={state} value={state}>{state}</option>
        ))}
      </select>
      {selectedState && (
        <div style={{ background: '#f9f9f9', padding: 20, borderRadius: 8 }}>
          <strong>{selectedState} Regulations:</strong>
          <p>{stateData[selectedState]}</p>
        </div>
      )}
    </div>
  );
}

export default StateRegulations;

