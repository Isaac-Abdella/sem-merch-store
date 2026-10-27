import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/formatCurrency';
import { hasPriceRange } from '../../utils/productOptions';

export default function ProductCard({ product }) {
  const soldOut = product.stock <= 0;
  return (
    <Link to={`/products/${product.slug}`} className="product-card">
      <div className="product-card__image">
        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div className="img-placeholder" />}
        {soldOut && <span className="tag tag--muted">Sold out</span>}
        {!soldOut && product.stock < 5 && <span className="tag">Only {product.stock} left</span>}
      </div>
      <div className="product-card__body">
        <span className="product-card__category">{product.category}</span>
        <h3>{product.name}</h3>
        <strong>{hasPriceRange(product) && 'From '}{formatCurrency(product.price)}</strong>
      </div>
    </Link>
  );
}
