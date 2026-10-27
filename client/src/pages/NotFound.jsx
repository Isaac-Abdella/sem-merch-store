import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container empty-state">
      <h1>Page not found</h1>
      <Link to="/" className="btn btn--primary">Go to the shop</Link>
    </div>
  );
}
