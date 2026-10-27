import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span>© {new Date().getFullYear()} Linawaa Dash Delivery</span>
        <span>
          Delivering within 25 km of downtown Toronto · <Link to="/delivery-area">See the delivery area</Link>
        </span>
      </div>
    </footer>
  );
}
