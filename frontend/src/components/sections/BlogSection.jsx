import { useInView }    from '../../hooks/useInView';
import { useBlogPosts } from '../../hooks/useBlog';

function BlogCard({ post, index }) {
  const [ref, inView] = useInView();
  const date = new Date(post.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div ref={ref} className={`reveal ${inView ? 'revealed' : ''}`} style={{ transitionDelay: `${index * 0.08}s` }}>
      <a href={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        <div className="glass" style={{ borderRadius: '1rem', padding: '1.75rem', height: '100%', display: 'flex',
          flexDirection: 'column', gap: '0.875rem', transition: 'border-color 0.25s, transform 0.25s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.45)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{date}</span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {post.readingTimeMinutes} min read
            </span>
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {post.title}
          </h3>

          <p style={{ color: 'var(--text-body)', fontSize: '0.875rem', lineHeight: 1.7, flexGrow: 1 }}>
            {post.excerpt}
          </p>

          {/* Tags */}
          {post.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              {post.tags.map((tag) => (
                <span key={tag} className="tech-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </a>
    </div>
  );
}

export function BlogSection() {
  const [ref, inView]               = useInView();
  const { data: posts, isLoading }  = useBlogPosts();

  if (!isLoading && posts?.length === 0) return null; // Hide section if no published posts

  return (
    <section id="blog" style={{ padding: 'var(--section-y) var(--content-px)',
      background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-surface) 50%, var(--bg) 100%)' }}>
      <div ref={ref} className={`reveal ${inView ? 'revealed' : ''}`}
        style={{ maxWidth: 'var(--content-max)', margin: '0 auto' }}>
        <span className="section-label">04 / Blog</span>
        <h2 className="section-title">Writing</h2>
        <div className="section-divider" />

        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {[1,2].map(n => <div key={n} className="skeleton" style={{ height: '220px', borderRadius: '1rem' }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {posts.map((post, i) => <BlogCard key={post._id} post={post} index={i} />)}
          </div>
        )}
      </div>
    </section>
  );
}