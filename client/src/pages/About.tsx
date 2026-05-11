
const About = ({ bio }: { bio: string }) => {
  return (
    <div style={{ padding: '60px 0', maxWidth: '800px', margin: '0 auto' }}>
      <h1 className="section-title" style={{ textAlign: 'left', margin: '0 0 30px' }}>My Story</h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>{bio}</p>
      <div style={{ marginTop: '60px', borderTop: '1px solid var(--border)', paddingTop: '40px' }}>
        <h3 style={{ textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px' }}>Current Vibe</h3>
        <p style={{ color: 'var(--secondary)' }}>Exploring the city, capturing the glitch, and staying authentic to the noise.</p>
      </div>
    </div>
  );
};

export default About;
