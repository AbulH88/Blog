import React from 'react';

const AgeGate = ({ onVerify }: { onVerify: () => void }) => {
  const handleVerify = () => {
    localStorage.setItem('ageVerified', 'true');
    onVerify();
  };

  return (
    <div className="age-gate">
      <div className="age-gate-content">
        <h1>Welcome</h1>
        <p>You must be at least 18 years old to view this content.</p>
        <div className="cta-group" style={{ marginTop: '20px' }}>
          <button onClick={handleVerify} className="btn btn-primary">I am 18+</button>
          <a href="https://google.com" className="btn btn-secondary">Exit</a>
        </div>
      </div>
    </div>
  );
};

export default AgeGate;
