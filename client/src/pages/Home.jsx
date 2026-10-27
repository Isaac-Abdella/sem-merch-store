import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCategories, listProducts } from '../api/products';
import { getErrorMessage } from '../api/axios';
import ProductGrid from '../components/products/ProductGrid';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  // Debounced search so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      listProducts({ q: query || undefined, category: category || undefined, limit: 24 })
        .then((data) => {
          setProducts(data.products);
          setError('');
        })
        .catch((err) => setError(getErrorMessage(err)))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, category]);

  return (
    <div className="container">
      <section className="hero">
        <h1>Merch for the 6ix, delivered to your door.</h1>
        <p>
          Same-week local delivery anywhere within 25 km of downtown Toronto, with live tracking on a map.{' '}
          <Link to="/delivery-area">Check the delivery area →</Link>
        </p>
      </section>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search products"
        />
        <div className="chips">
          <button type="button" className={`chip ${!category ? 'chip--active' : ''}`} onClick={() => setCategory('')}>
            All
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className={`chip ${category === c ? 'chip--active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="alert alert--error">{error} — is the API running on port 5000?</p>}
      {loading && !products.length ? <p className="muted">Loading products…</p> : <ProductGrid products={products} />}
    </div>
  );
}
