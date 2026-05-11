
const Blog = ({ blog }: { blog: any[] }) => {
  return (
    <div className="blog-list">
      <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Latest Updates</h1>
      {blog.map((post) => (
        <article key={post.id} className="blog-card">
          <h2>{post.title}</h2>
          <p style={{ marginBottom: '15px' }}>{post.excerpt}</p>
          <button className="btn btn-secondary" style={{ padding: '8px 20px' }}>Read More</button>
        </article>
      ))}
    </div>
  );
};

export default Blog;
