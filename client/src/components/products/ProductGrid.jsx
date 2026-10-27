import ProductCard from './ProductCard';

export default function ProductGrid({ products }) {
  if (!products.length) return <p className="muted">No products match your search.</p>;
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  );
}
